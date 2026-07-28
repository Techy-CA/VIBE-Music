// ── Extract video ID ───────────────────────────────────────
export const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
    /youtube-nocookie\.com\/embed\/([^&\n?#]+)/,  // ✅ nocookie URLs bhi handle
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

// ── Best available thumbnail ───────────────────────────────
export const getThumbnail = (videoId: string): string =>
  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

// ── Embed URL builder ──────────────────────────────────────
// ✅ youtube-nocookie.com — adblocker safe, same IFrame API
export const getEmbedUrl = (videoId: string, autoplay = true): string => {
  const params = new URLSearchParams({
    autoplay:        autoplay ? '1' : '0',
    controls:        '0',
    rel:             '0',          // related videos off
    iv_load_policy:  '3',          // annotations off
    modestbranding:  '1',          // YouTube branding minimal
    playsinline:     '1',          // iOS inline play
    enablejsapi:     '1',          // JS API enable
    origin:          typeof window !== 'undefined' ? window.location.origin : '',
    widget_referrer: typeof window !== 'undefined' ? window.location.origin : '',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
};

// ── Preload URL — silent, warms up connection ──────────────
export const getPreloadUrl = (videoId: string): string =>
  getEmbedUrl(videoId, false); // autoplay=0 — silent preload

// ── Fetch video title via oEmbed (no API key needed) ───────
export const fetchVideoMeta = async (
  url: string,
): Promise<{ title: string; thumbnail: string; videoId: string } | null> => {
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );
    if (!res.ok) throw new Error('oEmbed failed');
    const data = await res.json();

    return {
      title:     data.title ?? 'Unknown Title',
      thumbnail: getThumbnail(videoId),
      videoId,
    };
  } catch {
    // Fallback — title unknown but videoId valid hai toh continue karo
    return {
      title:     'Unknown Title',
      thumbnail: getThumbnail(videoId),
      videoId,
    };
  }
};

// ── Suppress YouTube postMessage cross-origin warnings ─────
// ✅ Console mein red warnings spam karta tha — ab nahi karega
if (typeof window !== 'undefined') {
  const _warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('postMessage') ||
      msg.includes('youtube.com') ||
      msg.includes('target origin')
    ) return;
    _warn(...args);
  };
}