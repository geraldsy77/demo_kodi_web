import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { DashboardError, DashboardLoading } from '../components/DashboardState';
import { fetchLibrarySummary, type LibrarySummary } from '../services/api';

interface PlaceholderPageProps {
  title: string;
  eyebrow: string;
}

type DashboardStatus =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; summary: LibrarySummary };

export function HomePage() {
  const [status, setStatus] = useState<DashboardStatus>({ state: 'loading' });
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus({ state: 'loading' });

    void fetchLibrarySummary(controller.signal)
      .then((summary) => setStatus({ state: 'ready', summary }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus({ state: 'error' });
      });

    return () => controller.abort();
  }, [requestKey]);

  const retry = () => setRequestKey((key) => key + 1);

  return (
    <div className="dashboard">
      <header className="page-heading home-heading">
        <p className="eyebrow">Private media library</p>
        <h1>Your library.</h1>
        <p className="page-intro">
          A quiet overview of the movies and shows available on your network.
        </p>
      </header>

      {status.state === 'loading' && <DashboardLoading />}
      {status.state === 'error' && <DashboardError onRetry={retry} />}
      {status.state === 'ready' && (
        <>
          <section className="summary-grid" aria-label="Library summary">
            <Link className="summary-card" to="/movies">
              <span className="summary-label">Movies</span>
              <strong>{status.summary.movieCount.toLocaleString()}</strong>
              <span className="summary-action">Browse movies <span aria-hidden="true">→</span></span>
            </Link>
            <Link className="summary-card" to="/tvshows">
              <span className="summary-label">TV Shows</span>
              <strong>{status.summary.tvShowCount.toLocaleString()}</strong>
              <span className="summary-action">Browse shows <span aria-hidden="true">→</span></span>
            </Link>
          </section>
          {status.summary.movieCount === 0 && status.summary.tvShowCount === 0 && (
            <p className="empty-library" role="status">
              Your library is empty. Add media in KODI, then refresh this page.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function PlaceholderPage({ title, eyebrow }: PlaceholderPageProps) {
  return (
    <section className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-intro">
        This section is ready for its library content in the next focused ticket.
      </p>
    </section>
  );
}
