import { useEffect, useId, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

export interface SummaryErrorItem {
  fieldId: string;
  label: string;
  message: string;
}

interface ErrorSummaryProps {
  errors: SummaryErrorItem[];
  title?: string;
}

export function ErrorSummary({
  errors,
  title = 'Please check the highlighted fields',
}: ErrorSummaryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (errors.length > 0) {
      containerRef.current?.focus();
    }
  }, [errors]);

  if (errors.length === 0) return null;

  return (
    <div
      ref={containerRef}
      role="alert"
      tabIndex={-1}
      aria-labelledby={headingId}
      className="error-summary"
    >
      <div className="error-summary-head">
        <AlertCircle size={17} aria-hidden="true" />
        <h3 id={headingId} style={{ fontSize: '0.875rem', color: 'inherit' }}>
          {title}
        </h3>
      </div>
      <ul className="error-summary-list">
        {errors.map((err) => (
          <li key={err.fieldId}>
            <button
              type="button"
              className="error-summary-link"
              onClick={() => {
                const target = document.getElementById(err.fieldId);
                target?.focus();
              }}
            >
              {err.label}: {err.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
