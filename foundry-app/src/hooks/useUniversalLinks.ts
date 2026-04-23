import { useEffect } from 'react';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';

/**
 * Catch iOS / Android universal-link opens and route the incoming URL's
 * path through React Router so the app handles it natively instead of
 * bouncing the user to Safari.
 *
 * Today only `/friend/:code` is wired on the AASA (see
 * `foundry-app/public/apple-app-site-association`). If the URL's path
 * doesn't look like one of our known deep-link shapes we navigate to
 * `/` — safer than leaving the user on a blank screen inside the app.
 *
 * Web platform short-circuits immediately — React Router already owns
 * the URL there, so there's nothing to listen for.
 */
export function useUniversalLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => void } | null = null;
    let cancelled = false;

    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      try {
        const url = new URL(event.url);
        // Ensure the domain matches ours — prevents random deep-link
        // schemes from jumping into app routes.
        if (url.hostname && url.hostname !== 'thefoundry.coach') return;
        const path = url.pathname + url.search;
        if (!path || path === '/') {
          navigate('/', { replace: true });
          return;
        }
        // Allowlist of deep-link prefixes the app actually handles. Keep
        // this aligned with the `paths` array in apple-app-site-association.
        const allowedPrefixes = ['/friend/'];
        if (allowedPrefixes.some((p) => path.startsWith(p))) {
          navigate(path, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch {
        navigate('/', { replace: true });
      }
    }).then((h) => {
      if (cancelled) {
        h.remove();
      } else {
        handle = h;
      }
    });

    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, [navigate]);
}
