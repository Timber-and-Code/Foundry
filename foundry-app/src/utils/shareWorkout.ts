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
import * as Sentry from '@sentry/react';
import { Capacitor } from '@capacitor/core';

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

function downloadPng(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function copyTextToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // Clipboard blocked (e.g. non-secure context). Not fatal — the image
    // still downloaded.
  }
}

/** Runtime feature-detect: does this browser accept files in a share call? */
function canShareFiles(file: File): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function shareWorkoutCard(
  node: HTMLElement,
  meta: ShareWorkoutMeta,
): Promise<ShareOutcome> {
  try {
    const dataUrl = await captureNodeToPng(node);
    const file = await dataUrlToFile(dataUrl, meta.fileName);
    const url = 'https://thefoundry.coach';

    // 1. Web Share API with files — best surface. Pops every installed
    //    share target on iOS/Android including IG, Snap, WhatsApp.
    if (canShareFiles(file)) {
      try {
        await navigator.share({
          title: meta.title,
          text: meta.text,
          files: [file],
        });
        return 'shared-native';
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return 'cancelled';
        }
        // Fall through to next option rather than throwing — some Android
        // browsers advertise canShare(files) but reject on some targets.
      }
    }

    // 2. Capacitor native plugin — text-only share. Useful on native
    //    platforms where the Web Share API isn't wired through the
    //    WKWebView (older iOS Capacitor builds).
    if (Capacitor.isNativePlatform()) {
      try {
        // Dynamic import: the plugin isn't needed on web builds and
        // keeping it out of the main bundle saves a few KB.
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: meta.title,
          text: meta.text,
          url,
          dialogTitle: 'Share your workout',
        });
        // Even though we couldn't attach the image, still save it to the
        // user's downloads so they can manually attach it to IG/Snap.
        downloadPng(dataUrl, meta.fileName);
        return 'shared-capacitor';
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return 'cancelled';
        }
        // Fall through to desktop fallback.
      }
    }

    // 3. Desktop fallback — download + clipboard text.
    downloadPng(dataUrl, meta.fileName);
    await copyTextToClipboard(meta.text);
    return 'downloaded';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return 'cancelled';
    }
    // Only Sentry-capture real failures.
    try {
      Sentry.captureException(err, {
        tags: { context: 'share', operation: 'shareWorkoutCard' },
      });
    } catch {
      // Sentry wasn't initialised — swallow.
    }
    throw err;
  }
}
