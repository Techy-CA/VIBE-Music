import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useAuthStore } from '../store/useAuthStore';
import type { Song } from '../types';

declare global {
  interface Window {
    YT: {
      Player: new (id: string, opts: YTOptions) => YTPlayer;
      PlayerState: {
        PLAYING: number; PAUSED: number; ENDED: number;
        BUFFERING: number; CUED: number; UNSTARTED: number;
      };
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(s: number, b: boolean): void;
  getPlayerState(): number;
  destroy(): void;
}

interface YTOptions {
  videoId?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?:       (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { target: YTPlayer; data: number }) => void;
    onError?:       (e: { target: YTPlayer; data: number }) => void;
  };
}

// ── Global API loader ──────────────────────────────────────
let ytApiReady     = false;
let ytApiCallbacks: (() => void)[] = [];

function whenYtReady(cb: () => void) {
  if (ytApiReady && window.YT?.Player) cb();
  else ytApiCallbacks.push(cb);
}

const loadYouTubeApi = () => {
  if (ytApiReady && window.YT?.Player) return;
  if (document.getElementById('yt-script')) return;
  const script = document.createElement('script');
  script.id    = 'yt-script';
  script.src   = 'https://www.youtube.com/iframe_api';
  script.async = true;
  document.head.appendChild(script);
  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytApiCallbacks.forEach(cb => cb());
    ytApiCallbacks = [];
  };
};

const isPlayerReady = (p: unknown): p is YTPlayer =>
  !!p &&
  typeof (p as YTPlayer).playVideo      === 'function' &&
  typeof (p as YTPlayer).pauseVideo     === 'function' &&
  typeof (p as YTPlayer).loadVideoById  === 'function' &&
  typeof (p as YTPlayer).getDuration    === 'function' &&
  typeof (p as YTPlayer).getCurrentTime === 'function' &&
  typeof (p as YTPlayer).getPlayerState === 'function' &&
  typeof (p as YTPlayer).seekTo         === 'function';

const safeCall = (fn: () => void, label?: string) => {
  try { fn(); }
  catch (e) { console.debug(`[YT] ${label ?? ''} failed`, e); }
};

const safeGet = <T>(fn: () => T, fallback: T): T => {
  try { return fn(); }
  catch { return fallback; }
};

const PLAYER_VARS: Record<string, number | string> = {
  autoplay:       1,
  controls:       0,
  rel:            0,
  modestbranding: 1,
  iv_load_policy: 3,
  playsinline:    1,
  enablejsapi:    1,
  disablekb:      1,
  fs:             0,
  origin: typeof window !== 'undefined' ? window.location.origin : '',
};

// ── Crossfade tuning ────────────────────────────────────────
const CROSSFADE_SECONDS          = 5;    // how long the blend lasts
const MIN_DURATION_FOR_CROSSFADE = 25;   // skip crossfade on very short clips
const CROSSFADE_TICK_MS          = 100;
// Most tracks' own intro is a quiet build-up or a baked-in fade-in — blending
// our crossfade into that reads as dead air / a second fade stacked on top
// of the first. Jumping a few seconds in lands past it more often than not.
const INTRO_SKIP_MAX_SECONDS     = 6;
const INTRO_SKIP_RATIO           = 0.08; // as a fraction of the track's length

// ── Hook ───────────────────────────────────────────────────
export const useYouTubePlayer = (
  containerId:        string,
  preloadContainerId: string,
) => {
  const playerRef      = useRef<YTPlayer | null>(null);
  const preloadRef     = useRef<YTPlayer | null>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSeeking      = useRef(false);
  const preloadedId    = useRef<string | null>(null);
  const initAttemptRef = useRef(false);
  const volumeRef      = useRef(100);
  const mutedRef       = useRef(false);
  const statusRef      = useRef<string>('idle');
  const tabHiddenAtRef = useRef<number>(0);

  // ✅ Crossfade engine state
  const crossfadeActiveRef = useRef(false);
  const crossfadeRampRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const skipHardLoadRef    = useRef(false); // set right before a crossfade-driven song swap

  // ✅ Recommendation callbacks
  const onEndedCallbackRef  = useRef<(() => void) | null>(null);
  const onSkippedCallbackRef = useRef<(() => void) | null>(null);

  const [isApiReady, setIsApiReady] = useState(false);

  const {
    currentSong, status, volume, isMuted, queue, categoryPool, crossfadeEnabled,
    setStatus, setCurrentTime, setDuration, playNext, peekNext,
    setPreloadedSong, setCrossfadeProgress, advanceToNext,
  } = usePlayerStore();
  const userId = useAuthStore(s => s.user?.uid ?? s.user?.id);

  const crossfadeEnabledRef = useRef(crossfadeEnabled);

  useEffect(() => { volumeRef.current = volume;  }, [volume]);
  useEffect(() => { mutedRef.current  = isMuted; }, [isMuted]);
  useEffect(() => { statusRef.current = status;  }, [status]);
  useEffect(() => { crossfadeEnabledRef.current = crossfadeEnabled; }, [crossfadeEnabled]);

  // ── Watchdog ──────────────────────────────────────────────
  const startWatchdog = useCallback((label: string) => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      if (!isPlayerReady(playerRef.current)) return;
      const state   = safeGet(() => playerRef.current!.getPlayerState(), -1);
      const PLAYING = window.YT?.PlayerState?.PLAYING ?? 1;
      if (state !== PLAYING) {
        safeCall(() => playerRef.current!.playVideo(), `watchdog:${label}`);
      }
    }, 1500);
  }, []);

  // ── Load API ──────────────────────────────────────────────
  useEffect(() => {
    loadYouTubeApi();
    whenYtReady(() => setIsApiReady(true));
  }, []);

  // ── Tab visibility fix ────────────────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        tabHiddenAtRef.current = Date.now();
      } else {
        if (statusRef.current === 'playing') {
          [100, 500, 1000].forEach(delay =>
            setTimeout(() => {
              if (!isPlayerReady(playerRef.current)) return;
              if (statusRef.current !== 'playing') return;
              const st = safeGet(() => playerRef.current!.getPlayerState(), -1);
              if (st !== (window.YT?.PlayerState?.PLAYING ?? 1)) {
                safeCall(() => playerRef.current!.playVideo(), `tab-resume@${delay}`);
              }
            }, delay),
          );
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // ── Init preload player ───────────────────────────────────
  useEffect(() => {
    if (!isApiReady || !preloadContainerId) return;
    if (isPlayerReady(preloadRef.current)) return;
    const el = document.getElementById(preloadContainerId);
    if (!el) return;
    try {
      preloadRef.current = new window.YT.Player(preloadContainerId, {
        playerVars: { ...PLAYER_VARS, autoplay: 0, mute: 1 },
        events: {
          onReady: (e: { target: { setVolume: (arg0: number) => void; mute: () => void; }; }) => {
            safeCall(() => e.target.setVolume(0), 'preload.vol');
            safeCall(() => e.target.mute(),       'preload.mute');
          },
        },
      });
    } catch (e) { console.debug('[YT] Preload init failed:', e); }
  }, [isApiReady, preloadContainerId]);

  // ── Preload whatever would play next (queue or smart pool) ──
  const nextUp = queue.length > 0 || categoryPool.length > 0 ? peekNext() : null;
  const nextVideoId = nextUp?.videoId ?? null;
  useEffect(() => {
    if (!isApiReady || !nextVideoId) return;
    if (!isPlayerReady(preloadRef.current)) return;
    if (preloadedId.current === nextVideoId) return;
    safeCall(() => preloadRef.current!.cueVideoById(nextVideoId), 'preload.cue');
    preloadedId.current = nextVideoId;
  }, [isApiReady, nextVideoId, currentSong?.id]);

  // ── Crossfade: cancel and restore both players to a clean state ──
  const abortCrossfade = useCallback(() => {
    if (crossfadeRampRef.current) {
      clearInterval(crossfadeRampRef.current);
      crossfadeRampRef.current = null;
    }
    if (crossfadeActiveRef.current) {
      safeCall(() => {
        playerRef.current?.setVolume(mutedRef.current ? 0 : volumeRef.current);
      }, 'crossfade.abort.mainVol');
      safeCall(() => {
        preloadRef.current?.pauseVideo();
        preloadRef.current?.setVolume(0);
        preloadRef.current?.mute();
      }, 'crossfade.abort.preload');
    }
    crossfadeActiveRef.current = false;
    setPreloadedSong(null);
    setCrossfadeProgress(0);
  }, [setPreloadedSong, setCrossfadeProgress]);

  // ── Crossfade: swap preload -> main once the ramp finishes ──
  const completeCrossfade = useCallback((next: Song) => {
    const finished = playerRef.current;
    playerRef.current  = preloadRef.current;
    preloadRef.current = finished;

    safeCall(() => { finished?.pauseVideo(); finished?.setVolume(0); finished?.mute(); }, 'crossfade.retireOld');
    safeCall(() => {
      playerRef.current?.setVolume(mutedRef.current ? 0 : volumeRef.current);
      if (!mutedRef.current) playerRef.current?.unMute();
    }, 'crossfade.finalizeNew');

    crossfadeActiveRef.current = false;
    preloadedId.current = null; // the (now empty) preload slot needs a fresh cue
    setPreloadedSong(null);
    setCrossfadeProgress(0);
    skipHardLoadRef.current = true;
    advanceToNext(next, userId);
  }, [advanceToNext, setPreloadedSong, setCrossfadeProgress, userId]);

  // ── Crossfade: start the volume ramp ─────────────────────
  const startCrossfade = useCallback((next: Song) => {
    if (!isPlayerReady(playerRef.current) || !isPlayerReady(preloadRef.current)) return;
    if (crossfadeActiveRef.current) return;

    crossfadeActiveRef.current = true;
    setPreloadedSong(next);
    setCrossfadeProgress(0.001);

    // Skip past the incoming track's own intro/fade-in so the blend lands
    // on actual content instead of stacking our fade on top of its fade.
    const preDur = safeGet(() => preloadRef.current!.getDuration(), 0);
    const introSkip = preDur > 0
      ? Math.min(INTRO_SKIP_MAX_SECONDS, preDur * INTRO_SKIP_RATIO)
      : 0;

    safeCall(() => {
      if (introSkip > 1.5) preloadRef.current!.seekTo(introSkip, true);
      preloadRef.current!.unMute();
      preloadRef.current!.setVolume(0);
      preloadRef.current!.playVideo();
    }, 'crossfade.startPreload');

    const startedAt = Date.now();
    const totalMs   = CROSSFADE_SECONDS * 1000;

    crossfadeRampRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - startedAt) / totalMs);
      const liveVol = mutedRef.current ? 0 : volumeRef.current;

      setCrossfadeProgress(t);
      safeCall(() => playerRef.current?.setVolume(Math.round(liveVol * (1 - t))),  'crossfade.mainVol');
      safeCall(() => preloadRef.current?.setVolume(Math.round(liveVol * t)),       'crossfade.preVol');

      if (t >= 1) {
        if (crossfadeRampRef.current) { clearInterval(crossfadeRampRef.current); crossfadeRampRef.current = null; }
        completeCrossfade(next);
      }
    }, CROSSFADE_TICK_MS);
  }, [setPreloadedSong, setCrossfadeProgress, completeCrossfade]);

  // ── Init / load video on song change ─────────────────────
  useEffect(() => {
    if (!isApiReady || !currentSong) return;

    if (skipHardLoadRef.current) {
      // Crossfade already swapped the active player and is playing this
      // song — just sync the UI's duration, nothing to (re)load.
      skipHardLoadRef.current = false;
      setCurrentTime(0);
      const dur = safeGet(() => playerRef.current?.getDuration() ?? 0, 0);
      if (dur > 0) setDuration(dur);
      return;
    }

    abortCrossfade();
    setCurrentTime(0);
    setDuration(0);
    preloadedId.current = null;

    if (isPlayerReady(playerRef.current)) {
      safeCall(
        () => playerRef.current!.loadVideoById(currentSong.videoId),
        'loadVideoById',
      );
      startWatchdog('loadVideoById');
      return;
    }

    if (initAttemptRef.current) return;
    initAttemptRef.current = true;

    try {
      playerRef.current = new window.YT.Player(containerId, {
        videoId:    currentSong.videoId,
        playerVars: PLAYER_VARS,
        events: {
          onReady: (e: { target: unknown; }) => {
            initAttemptRef.current = false;
            if (!isPlayerReady(e.target)) return;
            const player = e.target as YTPlayer;
            safeCall(() => player.setVolume(mutedRef.current ? 0 : volumeRef.current), 'onReady.vol');
            if (mutedRef.current) safeCall(() => player.mute(), 'onReady.mute');
            safeCall(() => player.playVideo(), 'onReady.play');
            startWatchdog('onReady');
          },

          onStateChange: (e: { target: unknown; data: number; }) => {
            if (!isPlayerReady(e.target)) return;
            // A player that's been retired into the preload slot (after a
            // crossfade swap) can still fire late events — ignore anything
            // that isn't from whichever player is currently "main".
            if (e.target !== playerRef.current) return;
            const S = window.YT?.PlayerState;
            if (!S) return;

            if (e.data === S.PLAYING) {
              if (watchdogRef.current) clearTimeout(watchdogRef.current);
              setStatus('playing');
              const dur = safeGet(() => (e.target as YTPlayer).getDuration(), 0);
              if (dur > 0) setDuration(dur);
            }

            if (e.data === S.PAUSED) {
              const msSinceHidden = Date.now() - tabHiddenAtRef.current;
              if (msSinceHidden < 2000) return;
              setStatus('paused');
            }

            if (e.data === S.BUFFERING) {
              setStatus('loading');
              startWatchdog('buffering');
            }

            if (e.data === S.ENDED) {
              // Crossfade already handled (or is handling) the transition.
              if (crossfadeActiveRef.current) return;
              onEndedCallbackRef.current?.();
              setStatus('idle');
              playNext();
            }
          },

          onError: (e: { target: unknown; data: number; }) => {
            if (e.target !== playerRef.current) return;
            console.debug('[YT] Error code:', e.data);
            initAttemptRef.current = false;
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
            setStatus('idle');
            if ([100, 101, 150].includes(e.data)) setTimeout(() => playNext(), 600);
          },
        },
      });
    } catch (e) {
      console.error('[YT] Player init failed', e);
      initAttemptRef.current = false;
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      setStatus('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiReady, currentSong?.videoId]);

  // ── Sync play / pause ─────────────────────────────────────
  useEffect(() => {
    if (!isPlayerReady(playerRef.current)) return;
    if (status === 'playing') safeCall(() => playerRef.current!.playVideo(),  'play');
    if (status === 'paused') {
      if (crossfadeActiveRef.current) abortCrossfade();
      safeCall(() => playerRef.current!.pauseVideo(), 'pause');
    }
  }, [status, abortCrossfade]);

  // ── Volume / mute ─────────────────────────────────────────
  useEffect(() => {
    if (!isPlayerReady(playerRef.current)) return;
    if (crossfadeActiveRef.current) return; // ramp owns volume while blending
    safeCall(() => {
      playerRef.current!.setVolume(volume);
      if (isMuted) playerRef.current!.mute();
      else         playerRef.current!.unMute();
    }, 'vol/mute');
  }, [volume, isMuted]);

  // ── Poll currentTime + trigger crossfade near the end ────
  useEffect(() => {
    if (status === 'playing') {
      intervalRef.current = setInterval(() => {
        if (!isPlayerReady(playerRef.current) || isSeeking.current) return;
        const t   = safeGet(() => playerRef.current!.getCurrentTime(), -1);
        const dur = safeGet(() => playerRef.current!.getDuration(), 0);
        if (t   >= 0) setCurrentTime(t);
        if (dur > 0)  setDuration(dur);

        if (
          crossfadeEnabledRef.current &&
          !crossfadeActiveRef.current &&
          dur >= MIN_DURATION_FOR_CROSSFADE &&
          dur - t <= CROSSFADE_SECONDS && dur - t > 0
        ) {
          const next = peekNext();
          if (next && isPlayerReady(preloadRef.current) && preloadedId.current === next.videoId) {
            startCrossfade(next);
          }
        }
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, setCurrentTime, setDuration, startCrossfade]);

  // ── Seek ──────────────────────────────────────────────────
  const seek = useCallback((seconds: number) => {
    if (!isPlayerReady(playerRef.current)) return;
    if (crossfadeActiveRef.current) abortCrossfade();
    isSeeking.current = true;
    setCurrentTime(seconds);
    safeCall(() => playerRef.current!.seekTo(seconds, true), 'seekTo');
    setTimeout(() => { isSeeking.current = false; }, 300);
  }, [setCurrentTime, abortCrossfade]);

  // ── ✅ skipSong — skip button pe yahi call karo ───────────
  const skipSong = useCallback(() => {
    if (crossfadeActiveRef.current) abortCrossfade();
    onSkippedCallbackRef.current?.(); // log skip event
    playNext();
  }, [playNext, abortCrossfade]);

  // ── ✅ Callback registrars ────────────────────────────────
  const onSongEnd = useCallback((cb: () => void) => {
    onEndedCallbackRef.current = cb;
  }, []);

  const onSongSkip = useCallback((cb: () => void) => {
    onSkippedCallbackRef.current = cb;
  }, []);

  // ── Cleanup ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      if (crossfadeRampRef.current) clearInterval(crossfadeRampRef.current);
      try { playerRef.current?.destroy();  } catch { /* ignore */ }
      try { preloadRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current  = null;
      preloadRef.current = null;
    };
  }, []);

  return { seek, skipSong, onSongEnd, onSongSkip }; // ✅ 3 naye exports
};
