import { useEffect, useState } from 'react';

/**
 * Width breakpoints — MUST match src/styles/responsive.css.
 *
 * Layout keys off available width only (never the device): an iPad in Slide
 * Over is as narrow as a phone and should get the phone layout; an unfolded
 * foldable is as wide as a small tablet and should get the tablet one.
 * Prefer the CSS classes/tokens in responsive.css; reach for these only when
 * the markup itself has to differ (e.g. ARIA orientation, chart sizing).
 */
/** 481–699: phone layout filling up to 640px (unfolded foldables, Split View). */
export const BP_ROOMY = 481;
export const BP_REGULAR = 700;
export const BP_WIDE = 1000;

function query(q: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(q).matches;
}

export function useMediaQuery(q: string): boolean {
  const [matches, setMatches] = useState(() => query(q));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(q);
    const onChange = () => setMatches(mql.matches);
    onChange();
    // Safari < 14 only has the deprecated addListener.
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [q]);
  return matches;
}

/** ≥ 700px — side rail, wider column, sheets as dialogs. */
export const useIsRegularWidth = () => useMediaQuery(`(min-width: ${BP_REGULAR}px)`);
/** ≥ 1000px — multi-column dashboards. */
export const useIsWideWidth = () => useMediaQuery(`(min-width: ${BP_WIDE}px)`);
