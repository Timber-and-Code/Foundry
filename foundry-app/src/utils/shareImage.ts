import { Capacitor } from '@capacitor/core';

export type ShareImageOutcome = 'shared' | 'saved' | 'cancelled';

export interface ShareImageInput {
  dataUrl: string;
  fileName: string;
  title: string;
}

const isCancel = (e: unknown) => {
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  return (e as { name?: string })?.name === 'AbortError' || msg.includes('cancel');
};

/**
 * Hand a rendered image to the system share sheet.
 *
 * Native: write the PNG to the app cache and give its file:// URI to
 * @capacitor/share, so iOS's own sheet gets a real image — Instagram,
 * Messages, Snapchat, WhatsApp, Save Image, AirDrop, anything installed.
 * (The old flow relied on the Web Share API inside WKWebView plus brand
 * tiles, half of which could only open a web page with text.)
 * Web: Web Share API with the file where supported, otherwise download.
 */
export async function shareImage({ dataUrl, fileName, title }: ShareImageInput): Promise<ShareImageOutcome> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: dataUrl.split(',')[1] ?? '',
      directory: Directory.Cache,
    });
    try {
      await Share.share({ title, files: [uri], dialogTitle: title });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }

  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }
  downloadImage(dataUrl, fileName);
  return 'saved';
}

/** Browser download. On native, "Save Image" lives in the share sheet. */
export function downloadImage(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
