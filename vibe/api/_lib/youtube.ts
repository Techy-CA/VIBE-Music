const YT_API = 'https://www.googleapis.com/youtube/v3';

interface YTThumbnail { url: string; }

export interface YTVideoDetails {
  id: string;
  snippet: {
    title: string;
    thumbnails: { high?: YTThumbnail; medium?: YTThumbnail; default?: YTThumbnail };
  };
  contentDetails: { duration: string };
}

// ── Search recent/relevant videos for a query — used for trending discovery ──
export async function searchVideoIds(
  apiKey: string,
  query: string,
  maxResults = 10,
): Promise<string[]> {
  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    q: query,
    type: 'video',
    videoCategoryId: '10', // Music
    order: 'relevance',
    regionCode: 'IN',
    safeSearch: 'moderate',
    maxResults: String(maxResults),
  });

  const res = await fetch(`${YT_API}/search?${params}`);
  if (!res.ok) throw new Error(`YouTube search failed (${res.status}): ${await res.text()}`);
  const data = await res.json() as { items?: { id?: { videoId?: string } }[] };
  return (data.items ?? [])
    .map(item => item.id?.videoId)
    .filter((id): id is string => Boolean(id));
}

// ── Video IDs from a curated playlist ───────────────────────
export async function playlistVideoIds(
  apiKey: string,
  playlistId: string,
  maxResults = 25,
): Promise<string[]> {
  const params = new URLSearchParams({
    key: apiKey,
    part: 'contentDetails',
    playlistId,
    maxResults: String(maxResults),
  });

  const res = await fetch(`${YT_API}/playlistItems?${params}`);
  if (!res.ok) throw new Error(`YouTube playlistItems failed (${res.status}): ${await res.text()}`);
  const data = await res.json() as { items?: { contentDetails?: { videoId?: string } }[] };
  return (data.items ?? [])
    .map(item => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));
}

// ── Full details (title/thumbnail/duration) for a batch of video IDs ──
export async function videoDetails(apiKey: string, ids: string[]): Promise<YTVideoDetails[]> {
  const out: YTVideoDetails[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const params = new URLSearchParams({
      key: apiKey,
      part: 'snippet,contentDetails',
      id: batch.join(','),
    });
    const res = await fetch(`${YT_API}/videos?${params}`);
    if (!res.ok) throw new Error(`YouTube videos failed (${res.status}): ${await res.text()}`);
    const data = await res.json() as { items?: YTVideoDetails[] };
    out.push(...(data.items ?? []));
  }
  return out;
}

// ── "PT3M42S" → 222 (seconds) ───────────────────────────────
export function parseIsoDuration(iso: string): number {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}
