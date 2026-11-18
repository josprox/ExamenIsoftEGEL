import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

interface BrandLogoProps {
  size?: number;
}

export function BrandLogo({ size = 36 }: BrandLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="brand-bg" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#0f766e" />
          <Stop offset="1" stopColor="#0d9488" />
        </LinearGradient>
        <LinearGradient id="brand-accent" x1="18" y1="16" x2="48" y2="46" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#fbbf24" />
          <Stop offset="1" stopColor="#f59e0b" />
        </LinearGradient>
      </Defs>
      <Rect x="4" y="4" width="56" height="56" rx="16" fill="url(#brand-bg)" />
      <Rect x="5" y="5" width="54" height="54" rx="15" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" />
      <Path d="M32 14L12 23.5L32 33L52 23.5L32 14Z" fill="#ffffff" />
      <Path
        d="M20 29V37.5C20 40.8 25.4 43.5 32 43.5C38.6 43.5 44 40.8 44 37.5V29L32 34.8L20 29Z"
        fill="#ccfbf1"
      />
      <Path d="M49 25V36" stroke="url(#brand-accent)" strokeWidth="2.6" strokeLinecap="round" />
      <Circle cx="49" cy="37.5" r="2.6" fill="url(#brand-accent)" />
      <Path
        d="M25.5 48.5L21 51.5L25.5 54.5"
        stroke="#99f6e4"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M38.5 48.5L43 51.5L38.5 54.5"
        stroke="#99f6e4"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M33.8 47.5L30.2 55.5" stroke="url(#brand-accent)" strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}
