/**
 * shareWorkout — capture a DOM node to PNG and hand it to the best available
 * share surface (native share sheet on iOS/Android, Web Share API on mobile
 * browsers, file download on desktop).
 *
 * Capture pipeline:
 *   1. Wait for fonts. html-to-image paints from the live computed style, so
 *      if Bebas Neue / InterVariable haven't parsed yet the snapshot uses
 *      the fallback stack. `document.fonts.ready` resolves once every
 *      declared face has loaded.
 *   2. html-to-image.toPng at pixelRatio 2. 1080×1350 → 2160×2700 raster.
 *   3. Turn the data-URL into a `File` so the Web Share API / download link
 *      can consume it directly.
 *
 * Surface selection (in order of preference):
 *   - Web Share API with files support → `navigator.share({ files })`.
 *     Works in Capacitor iOS WKWebView 15+, mobile Safari 15+, and Chrome
 *     Android. This is the ONLY path that ships an actual image to
 *     Instagram / Snapchat / WhatsApp, so we try it even on Capacitor.
 *   - `@capacitor/share` plugin → text + URL only (no file support in the
 *     plugin as of 7.x). Used as a fallback when Web Share isn't available
 *     on native.
 *   - Desktop fallback → download the PNG + copy share text to clipboard.
 *     Instagram / Snapchat don't accept programmatic web uploads so this is
 *     the best desktop can do.
 */

import * as htmlToImage from 'html-to-image';

export interface ShareWorkoutMeta {
  /** Short share-sheet title, e.g. "Crushed Push A". */
  title: string;
  /** Full text body attached to the share. Includes emoji + URL. */
  text: string;
  /** Filename for the generated PNG, e.g. "foundry-push-a-w2.png". */
  fileName: string;
}

export type ShareOutcome =
  | 'shared-native' // Web Share API accepted
  | 'shared-capacitor' // Capacitor Share plugin (text only)
  | 'downloaded' // desktop fallback wrote a file
  | 'cancelled'; // user dismissed

// ─── Internal helpers ───────────────────────────────────────────────────────

async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], fileName, { type: 'image/png' });
}

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

async function captureNodeToPng(node: HTMLElement): Promise<string> {
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
    pixelRatio: 2,
    // Explicit size avoids layout-dependent cropping if the node sits in
    // an off-screen position:absolute wrapper. Height is flow-sized on the
    // new ShareCard, so fall back to the node's rendered offsetHeight.
    width: node.offsetWidth || 1080,
    height: node.offsetHeight || 1350,
  });
}

/**
 * Capture a share-ready payload without actually dispatching a share. Used
 * by the branded ShareSheet so each destination tile can decide what to do
 * with the file (native share, download + intent URL, clipboard).
 */
export async function captureShareCardPayload(
  node: HTMLElement,
  meta: ShareWorkoutMeta,
): Promise<{ file: File; dataUrl: string } & ShareWorkoutMeta> {
  const dataUrl = await captureNodeToPng(node);
  const file = await dataUrlToFile(dataUrl, meta.fileName);
  return { file, dataUrl, ...meta };
}

