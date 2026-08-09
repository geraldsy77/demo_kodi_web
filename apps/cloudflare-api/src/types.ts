export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface MovieListItem {
  id: number;
  title: string;
  premiered: string | null;
  rating: number | null;
  playCount: number | null;
  artworkUrl: string | null;
}

export interface MovieDetail extends MovieListItem {
  plot: string | null;
  userRating: number | null;
  votes: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
  resume: { positionSeconds: number; totalSeconds: number } | null;
}

export interface TvShowListItem {
  id: number;
  title: string;
  premiered: string | null;
  rating: number | null;
  totalEpisodes: number | null;
  watchedEpisodes: number | null;
  totalSeasons: number | null;
  artworkUrl: string | null;
}

export interface TvShowDetail extends TvShowListItem {
  plot: string | null;
  userRating: number | null;
  durationSeconds: number | null;
  votes: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
}

export interface SearchResultItem {
  id: number;
  title: string;
  entityType: 'movie' | 'tvshow';
}
