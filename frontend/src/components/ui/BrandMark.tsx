export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="14" fill="#0F9D8E" />
      {/* Open library book silhouette */}
      <path
        d="M14 21C14 19.343 15.343 18 17 18H28.5C30.433 18 32 19.567 32 21.5V46.5C32 44.843 30.657 43.5 29 43.5H17C15.343 43.5 14 42.157 14 40.5V21Z"
        fill="#FFFFFF"
      />
      <path
        d="M50 21C50 19.343 48.657 18 47 18H35.5C33.567 18 32 19.567 32 21.5V46.5C32 44.843 33.343 43.5 35 43.5H47C48.657 43.5 50 42.157 50 40.5V21Z"
        fill="#CCFBF1"
      />
      <path d="M32 21V46.5" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M18.5 25.5H27.5M18.5 30.5H27.5M18.5 35.5H25"
        stroke="#0F766E"
        strokeOpacity="0.45"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M36.5 25.5H45.5M36.5 30.5H45.5M36.5 35.5H43"
        stroke="#0F766E"
        strokeOpacity="0.45"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
