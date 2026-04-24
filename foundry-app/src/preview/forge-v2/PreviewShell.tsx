import { useEffect, type ReactNode } from 'react';
import { NoiseOverlay } from './atmosphere/NoiseOverlay';
import { HeatHaze } from './atmosphere/HeatHaze';
import type { Phase } from './fixtures';
import './tokens.css';

const FONT_LINK_ID = 'forge-v2-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@300;400;500;600&display=swap';

/**
 * Preview-only wrapper. Loads JetBrains Mono on mount (Bebas Neue is already
 * self-hosted by the live app) and mounts NoiseOverlay + HeatHaze inside the
 * `.forge-v2` scope. Never touch the app root — atmosphere is sandbox-local.
 */
export function PreviewShell({
  children,
  phase = 'Intensification',
  hazeVariant = 'default',
}: {
  children: ReactNode;
  phase?: Phase;
  hazeVariant?: 'default' | 'focus';
}) {
  // Inject the JetBrains Mono link tag once. Bebas Neue is self-hosted in the
  // live app and picked up automatically since it's declared on `document`.
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);

  return (
    <div className="forge-v2" style={{ position: 'relative', minHeight: '100vh' }}>
      <NoiseOverlay />
      <HeatHaze phase={phase} variant={hazeVariant} />
      {children}
    </div>
  );
}
