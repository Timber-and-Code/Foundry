import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import FocusLitePreview from './FocusLitePreview';
import HomePreview from './HomePreview';
import ExplorePreview from './ExplorePreview';
import ProgressPreview from './ProgressPreview';
import ScheduleOverviewPreview from './ScheduleOverviewPreview';

// Scoped keyframes injected on mount (cleaner than a separate stylesheet for
// a preview-only animation set).
const KEYFRAMES = `
@keyframes hl-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes hl-pulse-glow { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
@keyframes hl-ring { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
@keyframes hl-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes hl-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
`;

const STYLE_ID = 'hybrid-preview-keyframes';

export default function HybridRoute() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
  }, []);

  if (pathname.endsWith('/home')) return <HomePreview />;
  if (pathname.endsWith('/explore')) return <ExplorePreview />;
  if (pathname.endsWith('/progress')) return <ProgressPreview />;
  if (pathname.endsWith('/schedule')) return <ScheduleOverviewPreview />;
  // Default for /preview/hybrid and /preview/hybrid/focus
  return <FocusLitePreview />;
}
