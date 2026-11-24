import { PieChart } from 'lucide-react';

interface AvailabilityGaugeProps {
  totalBooks: number;
  availableBooks: number;
  borrowedBooks: number;
  overdueCount: number | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function AvailabilityGauge({
  totalBooks,
  availableBooks,
  borrowedBooks,
  overdueCount,
  loading = false,
  error = null,
  onRetry,
}: AvailabilityGaugeProps) {
  const radius = 47;
  const circumference = 2 * Math.PI * radius;
  const safeTotal = Math.max(totalBooks, 1);

  const overdueSegment = overdueCount ? Math.min(overdueCount, borrowedBooks) : 0;
  const onTimeBorrowed = Math.max(0, borrowedBooks - overdueSegment);

  const availLen = totalBooks === 0 ? 0 : (availableBooks / safeTotal) * circumference;
  const onTimeLen = totalBooks === 0 ? 0 : (onTimeBorrowed / safeTotal) * circumference;
  const overdueLen = totalBooks === 0 ? 0 : (overdueSegment / safeTotal) * circumference;

  const availPercent = totalBooks === 0 ? 0 : Math.round((availableBooks / safeTotal) * 100);

  return (
    <section className="card card-padded form-stack" aria-labelledby="collection-health-heading">
      <div className="card-header-with-icon">
        <span className="section-icon-badge" aria-hidden="true">
          <PieChart size={18} />
        </span>
        <div>
          <h3 id="collection-health-heading" className="card-title">
            Collection Availability Pulse
          </h3>
          <p className="card-subtitle">
            {totalBooks === 0
              ? 'No volumes indexed in catalog yet'
              : `Live shelf readiness ratio across ${totalBooks} catalog volume${totalBooks === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {loading && totalBooks === 0 ? (
        <div className="availability-widget" aria-busy="true" aria-label="Loading availability data">
          <div className="skeleton" style={{ width: '126px', height: '126px', borderRadius: '50%' }} />
          <div className="donut-legend">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line-sm" />
          </div>
        </div>
      ) : error && totalBooks === 0 ? (
        <div className="alert alert-danger alert-row" role="alert">
          <span>{error}</span>
          {onRetry ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : (
        <div className="availability-widget">
          <div className="donut-wrap">
            <svg
              viewBox="0 0 120 120"
              className="donut-svg"
              role="img"
              aria-label={`${availPercent}% of catalog books are currently available on shelf (${availableBooks} available, ${borrowedBooks} borrowed${overdueCount !== null ? `, ${overdueSegment} overdue` : ''})`}
            >
              <circle cx="60" cy="60" r={radius} className="donut-track" />
              {availLen > 0 ? (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className="donut-seg"
                  stroke="var(--success)"
                  strokeDasharray={`${availLen} ${circumference}`}
                  strokeDashoffset={0}
                />
              ) : null}
              {onTimeLen > 0 ? (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className="donut-seg"
                  stroke="var(--warning)"
                  strokeDasharray={`${onTimeLen} ${circumference}`}
                  strokeDashoffset={-availLen}
                />
              ) : null}
              {overdueLen > 0 ? (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className="donut-seg"
                  stroke="var(--danger)"
                  strokeDasharray={`${overdueLen} ${circumference}`}
                  strokeDashoffset={-(availLen + onTimeLen)}
                />
              ) : null}
            </svg>
            <div className="donut-center">
              <span className="donut-center-value">{availPercent}%</span>
              <span className="donut-center-label">Available</span>
            </div>
          </div>

          <div className="donut-legend">
            <div className="legend-item">
              <span className="legend-label">
                <span className="legend-swatch" style={{ background: 'var(--success)' }} aria-hidden="true" />
                On Shelf
              </span>
              <strong className="tabular-nums">{availableBooks}</strong>
            </div>
            <div className="legend-item">
              <span className="legend-label">
                <span className="legend-swatch" style={{ background: 'var(--warning)' }} aria-hidden="true" />
                {overdueCount !== null ? 'Checked Out (On Time)' : 'Checked Out'}
              </span>
              <strong className="tabular-nums">{onTimeBorrowed}</strong>
            </div>
            {overdueCount !== null ? (
              <div className="legend-item">
                <span className="legend-label">
                  <span className="legend-swatch" style={{ background: 'var(--danger)' }} aria-hidden="true" />
                  Overdue Returns
                </span>
                <strong className="tabular-nums">{overdueSegment}</strong>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
