export interface CuratedPlaylist {
  genreId:    string;
  playlistId: string;
}

// ── Optional hand-picked YouTube playlists, synced on every ingest run ──
// Add entries as { genreId: 'lofi', playlistId: 'PL...' } — grab the playlistId
// from a YouTube playlist URL's `list=` query param. Leave empty to rely on
// trending discovery (GENRE_SEARCH_QUERIES) alone.
export const CURATED_PLAYLISTS: CuratedPlaylist[] = [];
