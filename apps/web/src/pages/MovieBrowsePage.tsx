import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { MovieGrid, MovieGridLoading } from '../components/MovieGrid';
import { fetchMovies, type MovieListResponse } from '../services/api';

type MoviePageStatus =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; response: MovieListResponse };

function pageFromQuery(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function MovieBrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = pageFromQuery(searchParams.get('page'));
  const [status, setStatus] = useState<MoviePageStatus>({ state: 'loading' });
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus({ state: 'loading' });

    void fetchMovies(page, controller.signal)
      .then((response) => setStatus({ state: 'ready', response }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus({ state: 'error' });
      });

    return () => controller.abort();
  }, [page, requestKey]);

  const goToPage = (nextPage: number) => {
    setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="browse-page">
      <header className="browse-heading">
        <div>
          <p className="eyebrow">Browse</p>
          <h1>Movies</h1>
        </div>
        {status.state === 'ready' && status.response.pagination.totalItems > 0 && (
          <p>{status.response.pagination.totalItems.toLocaleString()} titles</p>
        )}
      </header>

      {status.state === 'loading' && <MovieGridLoading />}
      {status.state === 'error' && (
        <section className="dashboard-message" role="alert">
          <p className="eyebrow">Connection interrupted</p>
          <h2>Movies couldn’t be loaded.</h2>
          <p>Check the API connection, then try again.</p>
          <button
            className="button-link"
            type="button"
            onClick={() => setRequestKey((key) => key + 1)}
          >
            Try again
          </button>
        </section>
      )}
      {status.state === 'ready' && status.response.items.length === 0 && (
        <section className="dashboard-message empty-state" role="status">
          <p className="eyebrow">No movies found</p>
          <h2>Your movie shelf is empty.</h2>
          <p>Add movies in KODI, then return here to browse them.</p>
          <Link className="button-link" to="/">Return home</Link>
        </section>
      )}
      {status.state === 'ready' && status.response.items.length > 0 && (
        <>
          <MovieGrid movies={status.response.items} />
          <nav className="pagination" aria-label="Movie pages">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </button>
            <span>Page {page} of {status.response.pagination.totalPages}</span>
            <button
              type="button"
              disabled={page >= status.response.pagination.totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
