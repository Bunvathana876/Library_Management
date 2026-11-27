export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--accent)' }}>
      <path d="M4 7h8c2 0 4 1 4 3v17c0-2-2-3-4-3H4V7Zm24 0h-8c-2 0-4 1-4 3v17c0-2 2-3 4-3h8V7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 12h4m-4 4h4m8-4h4m-4 4h4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
