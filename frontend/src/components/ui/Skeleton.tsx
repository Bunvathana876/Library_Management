export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="kpi-grid" aria-busy="true" aria-label="Loading library metrics">
      {Array.from({ length: count }, (_, idx) => (
        <div key={idx} className="card skeleton-card">
          <div className="skeleton skeleton-line-sm" />
          <div className="skeleton skeleton-line-lg" />
          <div className="skeleton skeleton-line" />
        </div>
      ))}
    </section>
  );
}

export function BookGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="catalog-grid" aria-busy="true" aria-label="Loading books catalog">
      {Array.from({ length: count }, (_, idx) => (
        <div key={idx} className="catalog-card catalog-skeleton-card">
          <div className="catalog-card-main">
            <div className="skeleton catalog-skeleton-cover" />
            <div className="catalog-card-info">
              <div className="catalog-card-top">
                <div className="skeleton" style={{ width: '74px', height: '22px', borderRadius: '6px' }} />
                <div className="skeleton" style={{ width: '84px', height: '24px', borderRadius: '9999px' }} />
              </div>
              <div className="skeleton skeleton-line-lg" style={{ width: '78%', marginTop: '6px' }} />
              <div className="skeleton skeleton-line" style={{ width: '52%' }} />
              <div className="skeleton skeleton-line-sm" style={{ width: '64%', marginTop: '6px' }} />
            </div>
          </div>
          <div className="catalog-card-actions">
            <div className="skeleton" style={{ width: '78px', height: '30px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ width: '92px', height: '34px', borderRadius: '10px' }} />
          </div>
        </div>
      ))}
    </section>
  );
}

export function TableSkeleton({ rows = 4, label = 'Loading records' }: { rows?: number; label?: string }) {
  return (
    <section className="card card-padded form-stack" aria-busy="true" aria-label={label}>
      <div className="skeleton skeleton-line-sm" />
      {Array.from({ length: rows }, (_, idx) => (
        <div key={idx} className="skeleton skeleton-line" style={{ height: '2.25rem' }} />
      ))}
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <div className="form-stack" aria-busy="true" aria-label="Loading book record">
      <div className="skeleton skeleton-line-sm" />
      <div className="skeleton skeleton-line-lg" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
    </div>
  );
}
