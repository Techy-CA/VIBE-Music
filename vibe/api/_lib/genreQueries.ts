// ── Search query pool per genre — drives automatic discovery ──
// Multiple angles per genre (year/decade/mood/language) so a day's run finds
// different videos than the last, instead of re-polling the same top-50.
export const GENRE_QUERY_POOL: Record<string, string[]> = {
  bollywood: [
    'top bollywood songs 2025', 'best bollywood songs 2024', 'bollywood hit songs 2023',
    'old bollywood hit songs', 'bollywood romantic songs', 'bollywood party songs',
    'bollywood love songs', 'trending bollywood songs', 'bollywood sad songs',
    '90s bollywood songs', 'bollywood dance songs',
  ],
  hiphop: [
    'top hip hop songs 2025', 'best rap songs 2024', 'hip hop hits 2023',
    'old school hip hop hits', 'trap hits', 'rap songs 2022',
    'underground hip hop hits', 'hip hop classics', '2010s hip hop hits',
    'desi hip hop songs', 'r&b hits',
  ],
  pop: [
    'top pop songs 2025', 'best pop songs 2024', 'pop hits 2023',
    'pop classics', 'top 40 pop songs', 'pop songs 2022', 'viral pop songs',
    '2010s pop hits', '90s pop hits', 'k-pop hits',
  ],
  indie: [
    'best indie songs 2025', 'indie hits 2024', 'indie rock songs',
    'indie pop hits', 'indie folk songs', 'alternative indie hits',
    'indie acoustic songs', 'indie electronic songs',
  ],
  lofi: [
    'best lofi songs', 'lofi chill hits', 'lofi hip hop mix songs',
    'lofi study songs', 'chillhop songs', 'lofi sad songs',
    'lofi sleep music songs', 'lofi jazz hop songs',
  ],
  sufi: [
    'best sufi songs', 'sufi qawwali hits', 'sufi songs 2024', 'popular sufi tracks',
    'sufi rock songs', 'coke studio sufi songs',
  ],
  classical: [
    'indian classical instrumental hits', 'best classical instrumental music',
    'carnatic classical music', 'hindustani classical music',
    'sitar instrumental music', 'flute instrumental relaxing music', 'violin instrumental hits',
  ],
  edm: [
    'top edm songs 2025', 'best edm songs 2024', 'edm hits 2023',
    'electronic dance hits', 'festival edm anthems', 'edm 2010s hits',
    'progressive house hits', 'edm workout songs',
  ],
  rock: [
    'top rock songs 2025', 'best rock songs 2024', 'classic rock hits',
    'alternative rock hits', 'rock ballads', 'rock anthems',
    '90s rock hits', '2000s rock hits', 'indie rock anthems',
  ],
  devotional: [
    'best devotional bhajan songs', 'popular hindu bhajans',
    'devotional songs hits', 'bhakti geet hits', 'krishna bhajan songs',
    'shiv bhajan songs', 'gurbani shabad songs',
  ],
  punjabi: [
    'top punjabi songs 2025', 'best punjabi songs 2024', 'punjabi hits 2023',
    'punjabi bhangra hits', 'punjabi romantic songs', 'punjabi sad songs',
    'punjabi rap songs',
  ],
  jazz: [
    'best jazz songs', 'jazz classics', 'smooth jazz hits', 'jazz standards',
    'jazz piano songs', 'bossa nova jazz songs', 'jazz vocal classics',
  ],
};

// ── One simple recency term per genre — paired with a `date`-ordered,
// `publishedAfter`-bounded search so freshly uploaded tracks get caught
// even after the discovery pool above plateaus. ──
export const GENRE_RECENCY_SEED: Record<string, string> = {
  bollywood:  'bollywood song',
  hiphop:     'hip hop song',
  pop:        'pop song',
  indie:      'indie song',
  lofi:       'lofi song',
  sufi:       'sufi song',
  classical:  'classical instrumental',
  edm:        'edm song',
  rock:       'rock song',
  devotional: 'bhajan song',
  punjabi:    'punjabi song',
  jazz:       'jazz song',
};
