export function DashboardLoading() {
  return (
    <div className="summary-grid" aria-label="Loading library summary" aria-busy="true">
      <div className="summary-card summary-card-skeleton" />
      <div className="summary-card summary-card-skeleton" />
    </div>
  );
}

interface DashboardErrorProps {
  onRetry: () => void;
}

export function DashboardError({ onRetry }: DashboardErrorProps) {
  return (
    <section className="dashboard-message" role="alert">
      <p className="eyebrow">Connection interrupted</p>
      <h2>We couldn’t reach your library.</h2>
      <p>Check that the API and database are available, then try again.</p>
      <button className="button-link" type="button" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}
