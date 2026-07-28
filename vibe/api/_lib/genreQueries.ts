// ── One search query per genre — drives automatic trending discovery ──
// Tune these any time; they run on every ingest cycle, no redeploy logic change needed elsewhere.
export const GENRE_SEARCH_QUERIES: Record<string, string> = {
  bollywood:  'new bollywood hit songs',
  hiphop:     'hip hop rap hit songs',
  pop:        'pop hit songs',
  indie:      'indie hit songs',
  lofi:       'lofi chill songs',
  sufi:       'sufi songs',
  classical:  'indian classical instrumental music',
  edm:        'edm dance hit songs',
  rock:       'rock hit songs',
  devotional: 'devotional bhajan songs',
  punjabi:    'punjabi hit songs',
  jazz:       'jazz music',
};
