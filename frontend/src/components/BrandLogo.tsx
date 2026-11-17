interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = 'h-9 w-9' }: BrandLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="brand-bg" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id="brand-accent" x1="18" y1="16" x2="48" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#brand-bg)" />
      <rect x="5" y="5" width="54" height="54" rx="15" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" />
      <path d="M32 14L12 23.5L32 33L52 23.5L32 14Z" fill="#ffffff" />
      <path
        d="M20 29V37.5C20 40.8 25.4 43.5 32 43.5C38.6 43.5 44 40.8 44 37.5V29L32 34.8L20 29Z"
        fill="#ccfbf1"
      />
      <path d="M49 25V36" stroke="url(#brand-accent)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="49" cy="37.5" r="2.6" fill="url(#brand-accent)" />
      <path
        d="M25.5 48.5L21 51.5L25.5 54.5"
        stroke="#99f6e4"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M38.5 48.5L43 51.5L38.5 54.5"
        stroke="#99f6e4"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M33.8 47.5L30.2 55.5" stroke="url(#brand-accent)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
