import { Capacitor } from '@capacitor/core';

/**
 * Cold-launch reveal: black → orange forge glow → Home.
 *
 * The veil (#launch-veil) is static HTML/CSS in index.html so it's on screen
 * from the first frame — continuing the black native launch screen with no
 * flash. Once the app has painted, this hides the native splash (instantly;
 * the veil is already covering) and plays the reveal, then removes the veil.
 * Reduced-motion users get a short plain fade (see index.html).
 */
export function playLaunchReveal(): void {
  const veil = document.getElementById('launch-veil');
  if (!veil) return;

  if (Capacitor.isNativePlatform()) {
    import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 0 }))
      .catch(() => { /* the veil is up either way */ });
  }

  // Wait until the app has painted something under the veil (lazy screens
  // can take a few frames), but never more than ~1s.
  const root = document.getElementById('root');
  const started = performance.now();
  const reveal = () => {
    veil.classList.add('reveal');
    const remove = () => veil.remove();
    veil.addEventListener('animationend', (e) => {
      if (e.target === veil) remove();
    });
    // Safety net: never leave the veil blocking the app.
    window.setTimeout(remove, 2500);
  };
  const wait = () => {
    const painted = !!root && root.childElementCount > 0 && root.getBoundingClientRect().height > 0;
    if (painted || performance.now() - started > 1000) requestAnimationFrame(reveal);
    else requestAnimationFrame(wait);
  };
  requestAnimationFrame(wait);
}
