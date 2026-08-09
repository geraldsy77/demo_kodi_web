import { Link } from 'react-router-dom';

export function RouteLoading() {
  return (
    <section className="route-state" aria-live="polite" aria-busy="true">
      <span className="loading-mark" aria-hidden="true" />
      <p>Loading your library…</p>
    </section>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'The library could not be loaded. Please try again.',
}: ErrorStateProps) {
  return (
    <section className="route-state error-state" role="alert">
      <p className="eyebrow">Library unavailable</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <Link className="button-link" to="/">Return home</Link>
    </section>
  );
}
