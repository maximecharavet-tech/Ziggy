/**
 * Photo booth — share (Web Share API with files, e.g. straight to Instagram /
 * TikTok on a phone) or save. The file goes from this device to the app the
 * parent picks; Ziggy's server never sees it.
 */

export function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Shares the file when the device can, otherwise saves it. */
export async function shareOrSave(blob: Blob, filename: string, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type });
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // NotAllowedError (no user activation left) and others: fall back to saving.
    }
  }
  saveBlob(blob, filename);
  return 'saved';
}
