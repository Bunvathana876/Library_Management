import { useId } from 'react';

export function BrandMark({ size = 40 }: { size?: number }) {
  const gradId = `brand-teal-${useId().replace(/:/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C9B5" />
          <stop offset="100%" stopColor="#009B8D" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradId})`} />
      <rect
        x="2.5"
        y="2.5"
        width="59"
        height="59"
        rx="13.5"
        stroke="#5EEAD4"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      {/* Open library book silhouette */}
      <path
        d="M14 21C14 19.343 15.343 18 17 18H28.5C30.433 18 32 19.567 32 21.5V46.5C32 44.843 30.657 43.5 29 43.5H17C15.343 43.5 14 42.157 14 40.5V21Z"
        fill="#FFFFFF"
      />
      <path
        d="M50 21C50 19.343 48.657 18 47 18H35.5C33.567 18 32 19.567 32 21.5V46.5C32 44.843 33.343 43.5 35 43.5H47C48.657 43.5 50 42.157 50 40.5V21Z"
        fill="#CCFBF1"
      />
      <path d="M32 21V46.5" stroke="#00897B" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M18.5 25.5H27.5M18.5 30.5H27.5M18.5 35.5H25"
        stroke="#00897B"
        strokeOpacity="0.45"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M36.5 25.5H45.5M36.5 30.5H45.5M36.5 35.5H43"
        stroke="#00897B"
        strokeOpacity="0.45"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
