export interface TvShowListItem {
  id: string;
  title: string;
  premiered: string | null;
  rating: number | null;
  totalEpisodes: number | null;
  watchedEpisodes: number | null;
  totalSeasons: number | null;
  artworkUrl: string | null;
}

export interface TvShowListResponse {
  items: TvShowListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface TvShowDetail extends TvShowListItem {
  plot: string | null;
  userRating: number | null;
  durationSeconds: number | null;
  votes: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
}
