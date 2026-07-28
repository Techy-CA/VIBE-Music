import { useEffect } from 'react';
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer';
import { usePlayerStore }   from '../../store/usePlayerStore';

export const PlayerEngine = () => {
  const { seek }  = useYouTubePlayer('yt-player-frame', 'yt-player-frame-preload');
  const setSeekFn = usePlayerStore(s => s.setSeekFn);

  useEffect(() => {
    if (typeof setSeekFn === 'function') setSeekFn(seek);
  }, [seek, setSeekFn]);

  return (
    // ✅ Off-screen but non-zero size — YT needs real dimensions to run
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        width: '1px',
        height: '1px',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      <div
        id="yt-player-frame"
        style={{ width: '1px', height: '1px' }}
      />
      <div
        id="yt-player-frame-preload"
        style={{ width: '1px', height: '1px' }}
      />
    </div>
  );
};  