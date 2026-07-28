import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

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

  // ✅ Recommendation callbacks
  const onEndedCallbackRef  = useRef<(() => void) | null>(null);
  const onSkippedCallbackRef = useRef<(() => void) | null>(null);

  const [isApiReady, setIsApiReady] = useState(false);

  const {
    currentSong, status, volume, isMuted, queue,
    setStatus, setCurrentTime, setDuration, playNext,
  } = usePlayerStore();

  useEffect(() => { volumeRef.current = volume;  }, [volume]);
  useEffect(() => { mutedRef.current  = isMuted; }, [isMuted]);
  useEffect(() => { statusRef.current = status;  }, [status]);

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
    if (!isApiReady) return;
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

  // ── Preload next song ─────────────────────────────────────
  const nextVideoId = queue?.[0]?.videoId ?? null;
  useEffect(() => {
    if (!isApiReady || !nextVideoId) return;
    if (!isPlayerReady(preloadRef.current)) return;
    if (preloadedId.current === nextVideoId) return;
    safeCall(() => preloadRef.current!.cueVideoById(nextVideoId), 'preload.cue');
    preloadedId.current = nextVideoId;
  }, [isApiReady, nextVideoId]);

  // ── Init / load video on song change ─────────────────────
  useEffect(() => {
    if (!isApiReady || !currentSong) return;

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

          onStateChange: (e: { target: unknown; data: any; }) => {
            if (!isPlayerReady(e.target)) return;
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
              // ✅ Fire completed callback BEFORE playNext
              onEndedCallbackRef.current?.();
              setStatus('idle');
              playNext();
            }
          },

          onError: (e: { data: number; }) => {
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
    if (status === 'paused')  safeCall(() => playerRef.current!.pauseVideo(), 'pause');
  }, [status]);

  // ── Volume / mute ─────────────────────────────────────────
  useEffect(() => {
    if (!isPlayerReady(playerRef.current)) return;
    safeCall(() => {
      playerRef.current!.setVolume(volume);
      isMuted ? playerRef.current!.mute() : playerRef.current!.unMute();
    }, 'vol/mute');
  }, [volume, isMuted]);

  // ── Poll currentTime ──────────────────────────────────────
  useEffect(() => {
    if (status === 'playing') {
      intervalRef.current = setInterval(() => {
        if (!isPlayerReady(playerRef.current) || isSeeking.current) return;
        const t   = safeGet(() => playerRef.current!.getCurrentTime(), -1);
        const dur = safeGet(() => playerRef.current!.getDuration(), 0);
        if (t   >= 0) setCurrentTime(t);
        if (dur > 0)  setDuration(dur);
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [status, setCurrentTime, setDuration]);

  // ── Seek ──────────────────────────────────────────────────
  const seek = useCallback((seconds: number) => {
    if (!isPlayerReady(playerRef.current)) return;
    isSeeking.current = true;
    setCurrentTime(seconds);
    safeCall(() => playerRef.current!.seekTo(seconds, true), 'seekTo');
    setTimeout(() => { isSeeking.current = false; }, 300);
  }, [setCurrentTime]);

  // ── ✅ skipSong — skip button pe yahi call karo ───────────
  const skipSong = useCallback(() => {
    onSkippedCallbackRef.current?.(); // log skip event
    playNext();
  }, [playNext]);

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
      try { playerRef.current?.destroy();  } catch { /* ignore */ }
      try { preloadRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current  = null;
      preloadRef.current = null;
    };
  }, []);

  return { seek, skipSong, onSongEnd, onSongSkip }; // ✅ 3 naye exports
};