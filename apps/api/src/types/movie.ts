export interface MovieListItem {
  id: number;
  title: string;
  premiered: string | null;
  rating: number | null;
  playCount: number | null;
  artworkUrl: string | null;
}

export interface MovieListResponse {
  items: MovieListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface MovieDetail {
  id: number;
  title: string;
  plot: string | null;
  premiered: string | null;
  userRating: number | null;
  rating: number | null;
  votes: number | null;
  playCount: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
  resume: {
    positionSeconds: number;
    totalSeconds: number;
  } | null;
  artworkUrl: string | null;
}
