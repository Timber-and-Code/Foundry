/**
 * shareWorkout — render a DOM node to a PNG data URL (html-to-image).
 * Sharing the result is utils/shareImage.ts.
 *
 * Capture pipeline:
 *   1. Wait for fonts. html-to-image paints from the live computed style, so
 *      if Bebas Neue / InterVariable haven't parsed yet the snapshot uses
 *      the fallback stack.
 *   2. Inline every <img> as a data URL (WKWebView asset-server race).
 *   3. html-to-image.toPng at the given pixel ratio. The share cards are
 *      laid out at 1080 × 1920, so they capture at ratio 1.
 */

import * as htmlToImage from 'html-to-image';

// ─── Internal helpers ───────────────────────────────────────────────────────

async function inlineImagesAsDataUrls(node: HTMLElement): Promise<void> {
  // html-to-image fetches each <img src> at capture time. On Capacitor that
  // fetch can race the WKWebView asset server (capacitor:// scheme) and
  // silently drop the image — the F logo was missing from shared cards
  // for this exact reason. Pre-fetching every image into a data URL on the
  // element itself sidesteps the second fetch entirely.
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) return;
      try {
        const res = await fetch(src);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        img.setAttribute('src', dataUrl);
        if (!img.complete || img.naturalWidth === 0) {
          await new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          });
        }
      } catch {
        // Best-effort: leave img alone. html-to-image may still succeed on
        // its own internal fetch path.
      }
    }),
  );
}

export async function captureNodeToPng(node: HTMLElement, pixelRatio = 2): Promise<string> {
  // Wait for fonts. `document.fonts` is supported everywhere we care about
  // (Safari 10+, Chrome 35+). Guard anyway so tests running under a
  // minimal jsdom shim don't explode.
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Font loading timed out — carry on. html-to-image will substitute.
    }
  }

  await inlineImagesAsDataUrls(node);

  return htmlToImage.toPng(node, {
    pixelRatio,
    // Explicit size avoids layout-dependent cropping if the node sits in
    // an off-screen position:absolute wrapper. Height is flow-sized on the
    // new ShareCard, so fall back to the node's rendered offsetHeight.
    width: node.offsetWidth || 1080,
    height: node.offsetHeight || 1350,
  });
}
