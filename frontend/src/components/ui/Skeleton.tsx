export function BookshelfSkeleton() {
  return (
    <div className="form-stack" aria-busy="true" aria-label="Loading personal bookshelf">
      <div className="bookshelf-header-card">
        <div className="bookshelf-identity" style={{ width: '100%', maxWidth: '20rem' }}>
          <div className="skeleton skeleton-line-sm" style={{ width: '7rem' }} />
          <div className="skeleton skeleton-line-lg" style={{ width: '13rem', marginTop: '6px' }} />
          <div className="skeleton skeleton-line-sm" style={{ width: '11rem', marginTop: '4px' }} />
        </div>
      </div>
      <div className="skeleton skeleton-line" style={{ maxWidth: '28rem', height: '18px' }} />
      <TableSkeleton rows={3} label="Loading active loans" />
    </div>
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
              <div className="skeleton skeleton-line-sm" style={{ width: '5.5rem' }} />
              <div className="skeleton skeleton-line-lg" style={{ width: '82%', marginTop: '4px' }} />
              <div className="skeleton skeleton-line" style={{ width: '54%' }} />
              <div className="skeleton skeleton-line-sm" style={{ width: '48%', marginTop: '4px' }} />
            </div>
          </div>
          <div className="catalog-card-actions">
            <div className="skeleton" style={{ width: '3.5rem', height: '20px' }} />
            <div className="skeleton" style={{ width: '5.5rem', height: '36px' }} />
          </div>
        </div>
      ))}
    </section>
  );
}

export function TableSkeleton({ rows = 4, label = 'Loading records' }: { rows?: number; label?: string }) {
  return (
    <section className="form-stack" style={{ paddingBlock: '12px' }} aria-busy="true" aria-label={label}>
      <div className="skeleton skeleton-line-sm" style={{ width: '10rem' }} />
      {Array.from({ length: rows }, (_, idx) => (
        <div key={idx} className="skeleton skeleton-line" style={{ height: '2.5rem' }} />
      ))}
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <div className="form-stack" aria-busy="true" aria-label="Loading record details">
      <div className="skeleton skeleton-line-sm" />
      <div className="skeleton skeleton-line-lg" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
    </div>
  );
}
