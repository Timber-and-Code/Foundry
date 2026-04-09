import React from 'react';
import { tokens } from '../../styles/tokens';

interface HammerIconProps {
  size?: number;
  style?: React.CSSProperties;
}

function HammerIcon({ size = 22, style = {} }: HammerIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    >
      <line x1="12" y1="22" x2="12" y2="9" stroke={tokens.colors.gold} strokeWidth="3" strokeLinecap="round" />
      <rect x="3" y="2" width="18" height="7" rx="2" fill="#E8651A" />
    </svg>
  );
}

export default HammerIcon;
