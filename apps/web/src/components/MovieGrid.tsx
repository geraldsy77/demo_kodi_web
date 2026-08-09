import { Link } from 'react-router-dom';

import type { MovieListItem } from '../services/api';
import { PosterArtwork } from './PosterArtwork';

interface MovieGridProps {
  movies: MovieListItem[];
}

function releaseYear(premiered: string | null): string | null {
  if (!premiered) return null;
  const year = premiered.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

export function MovieGrid({ movies }: MovieGridProps) {
  return (
    <section className="movie-grid" aria-label="Movies">
      {movies.map((movie) => {
        const year = releaseYear(movie.premiered);
        return (
          <Link
            className="movie-card"
            key={movie.id}
            to={`/movies/${movie.id}`}
            aria-label={`View ${movie.title}`}
          >
            <span className="poster-placeholder" aria-hidden="true">
              <PosterArtwork artworkUrl={movie.artworkUrl} title={movie.title} />
              {movie.playCount !== null && movie.playCount > 0 && (
                <small className="watched-badge">Watched</small>
              )}
            </span>
            <span className="movie-card-copy">
              <strong title={movie.title}>{movie.title}</strong>
              <span className="movie-metadata">
                {year && <span>{year}</span>}
                {movie.rating !== null && <span>★ {movie.rating.toFixed(1)}</span>}
                {!year && movie.rating === null && <span>Movie</span>}
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}

export function MovieGridLoading({ label = 'Loading movies' }: { label?: string }) {
  return (
    <div className="movie-grid" aria-label={label} aria-busy="true">
      {Array.from({ length: 12 }, (_, index) => (
        <div className="movie-card movie-card-skeleton" key={index} />
      ))}
    </div>
  );
}
