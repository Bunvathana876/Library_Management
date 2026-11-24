import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  foot: string;
  icon: ReactNode;
  watermark?: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info';
  progress?: number;
  staggerIndex?: number;
}

export function StatCard({
  label,
  value,
  foot,
  icon,
  watermark,
  tone = 'accent',
  progress,
  staggerIndex = 0,
}: StatCardProps) {
  return (
    <article
      className="card kpi-card stagger-enter"
      data-tone={tone}
      style={{ ['--stagger' as string]: staggerIndex }}
    >
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon" data-tone={tone} aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="kpi-value">{value}</div>
      {typeof progress === 'number' ? (
        <div className="kpi-progress-track" aria-hidden="true">
          <div
            className="kpi-progress-fill"
            data-tone={tone}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      ) : null}
      <div className="kpi-foot">{foot}</div>
      <span className="kpi-watermark" data-tone={tone} aria-hidden="true">
        {watermark ?? icon}
      </span>
    </article>
  );
}
