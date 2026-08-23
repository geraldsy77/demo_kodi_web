import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  ApiRequestError,
  fetchMovie,
  type MovieDetail,
} from '../services/api';
import { PosterArtwork } from '../components/PosterArtwork';

type DetailStatus =
  | { state: 'loading' }
  | { state: 'notFound' }
  | { state: 'error' }
  | { state: 'ready'; movie: MovieDetail };

function movieIdFromRoute(value: string | undefined): string | null {
  return value && /^[A-Za-z1-9]{11,}$/.test(value) ? value : null;
}

function displayDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function displayDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${minutes}m`;
}

export function MovieDetailPage() {
  const movieId = movieIdFromRoute(useParams().id);
  const [status, setStatus] = useState<DetailStatus>(
    movieId === null ? { state: 'notFound' } : { state: 'loading' },
  );
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    if (movieId === null) {
      setStatus({ state: 'notFound' });
      return;
    }

    const controller = new AbortController();
    setStatus({ state: 'loading' });
    void fetchMovie(movieId, controller.signal)
      .then((movie) => setStatus({ state: 'ready', movie }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus(
          error instanceof ApiRequestError && error.status === 404
            ? { state: 'notFound' }
            : { state: 'error' },
        );
      });

    return () => controller.abort();
  }, [movieId, requestKey]);

  if (status.state === 'loading') {
    return (
      <div className="movie-detail movie-detail-loading" aria-label="Loading movie details" aria-busy="true">
        <div className="detail-poster detail-skeleton" />
        <div className="detail-copy detail-skeleton" />
      </div>
    );
  }

  if (status.state === 'notFound') {
    return (
      <section className="dashboard-message empty-state" role="alert">
        <p className="eyebrow">Movie not found</p>
        <h1>This movie isn’t available.</h1>
        <p>It may have been removed from KODI or the link may be incorrect.</p>
        <Link className="button-link" to="/movies">Back to movies</Link>
      </section>
    );
  }

  if (status.state === 'error') {
    return (
      <section className="dashboard-message" role="alert">
        <p className="eyebrow">Connection interrupted</p>
        <h1>Movie details couldn’t be loaded.</h1>
        <p>Check the API connection, then try again.</p>
        <button
          className="button-link"
          type="button"
          onClick={() => setRequestKey((key) => key + 1)}
        >
          Try again
        </button>
      </section>
    );
  }

  const { movie } = status;
  const premiered = displayDate(movie.premiered);
  const dateAdded = displayDate(movie.dateAdded);
  const lastPlayed = displayDate(movie.lastPlayed);
  const progress = movie.resume && movie.resume.totalSeconds > 0
    ? Math.min(100, movie.resume.positionSeconds / movie.resume.totalSeconds * 100)
    : null;

  return (
    <article className="movie-detail">
      <div className="detail-poster" aria-hidden="true">
        <PosterArtwork artworkUrl={movie.artworkUrl} title={movie.title} />
      </div>
      <div className="detail-copy">
        <Link className="back-link" to="/movies">← Back to movies</Link>
        <p className="eyebrow">Movie</p>
        <h1>{movie.title}</h1>
        <div className="detail-facts" aria-label="Movie facts">
          {premiered && <span>{premiered}</span>}
          {movie.rating !== null && <span>★ {movie.rating.toFixed(1)}</span>}
          {movie.votes !== null && <span>{movie.votes.toLocaleString()} votes</span>}
          {movie.playCount !== null && movie.playCount > 0 && <span>Watched</span>}
        </div>
        <p className="detail-plot">{movie.plot || 'No plot summary is available.'}</p>

        {progress !== null && movie.resume && (
          <section className="resume-panel" aria-label="Resume progress">
            <div><strong>Continue watching</strong><span>{displayDuration(movie.resume.positionSeconds)} of {displayDuration(movie.resume.totalSeconds)}</span></div>
            <progress max="100" value={progress}>{Math.round(progress)}%</progress>
          </section>
        )}

        <dl className="detail-metadata">
          {movie.userRating !== null && <><dt>Your rating</dt><dd>{movie.userRating}/10</dd></>}
          {dateAdded && <><dt>Added</dt><dd>{dateAdded}</dd></>}
          {lastPlayed && <><dt>Last played</dt><dd>{lastPlayed}</dd></>}
        </dl>
      </div>
    </article>
  );
}
