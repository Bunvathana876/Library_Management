import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  foot: string;
  icon: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info';
  staggerIndex?: number;
}

/**
 * KPI stat card matching the clean Athenaeum white surface language.
 */
export function StatCard({
  label,
  value,
  foot,
  icon,
  tone = 'accent',
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
      <div className="kpi-foot">{foot}</div>
    </article>
  );
}
