import { Capacitor, registerPlugin } from '@capacitor/core';

const DiaryMediaStore = registerPlugin('DiaryMediaStore');

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Unable to prepare calendar image'));
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.readAsDataURL(blob);
});

/**
 * Android WebView ignores many blob URL anchor downloads. Write the actual file via
 * Capacitor. On Android try persistent Documents/MyDiary first; when blocked,
 * open the OS save/share chooser so the user can choose a destination.
 * In browsers use native file sharing when possible or an ordinary download.
 */
export async function saveCalendarPng(blob, name, destination = 'downloads') {
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('Calendar image is empty');
  const fileName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');

  if (Capacitor.isNativePlatform()) {
    // Plugins are lazy so the public web/portfolio does not load native APIs.
    let Filesystem, Directory, Share;
    try {
      ({ Filesystem, Directory } = await import('@capacitor/filesystem'));
      ({ Share } = await import('@capacitor/share'));
    } catch {
      throw new Error('Native PNG export needs Filesystem and Share plugins installed, then an Android rebuild (npx cap sync android).');
    }
    const data = await blobToBase64(blob);
    // New Android native MediaStore plugin puts an actual PNG in Downloads or
    // Gallery. No broad storage permission is needed on Android 10+.
    if (Capacitor.getPlatform() === 'android' && destination !== 'share') {
      try {
        const result = await DiaryMediaStore.savePng({ data, fileName, destination });
        return { method: 'media-store', message: `Saved PNG to ${result.destination}.` };
      } catch (error) {
        console.warn('Direct MediaStore save unavailable; using share fallback:', error);
      }
    }
    // Android 11+ can write app-created files into public Documents. Try a real
    // persistent download first; not all OS versions/storage policies permit it.
    if (Capacitor.getPlatform() === 'android' && destination === 'downloads') {
      try {
        const documentsPath = `MyDiary/${fileName}`;
        await Filesystem.writeFile({ path: documentsPath, data, directory: Directory.Documents, recursive: true });
        return { method: 'android-documents', message: `PNG saved to Documents/MyDiary/${fileName}. Open Files → Documents to find it.` };
      } catch {
        // On restricted Android versions, use cache + the OS save/share chooser.
      }
    }
    const path = `calendar-exports/${fileName}`;
    await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    if (!uri) throw new Error('Could not create a shareable calendar image');
    try {
      await Share.share({ title: 'My Diary calendar', dialogTitle: 'Save or share calendar PNG', files: [uri] });
      return { method: 'native-share', message: 'Calendar ready. Choose Save to Files, Photos, or another destination in the Android share sheet.' };
    } catch (err) {
      if (/cancel|dismiss/i.test(String(err?.message || err))) {
        return { method: 'cancelled', message: 'Share cancelled. Tap Export again to choose where to save your PNG.' };
      }
      throw new Error(`Calendar image created, but Android could not open the save/share sheet: ${err?.message || err}`);
    }
  }

  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: 'My Diary calendar' });
      return { method: 'web-share', message: 'Choose a destination in the share sheet to save your calendar.' };
    } catch (err) {
      if (err?.name === 'AbortError') return { method: 'cancelled', message: 'Share cancelled.' };
      // Fall back to classic browser download.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url; link.download = fileName; link.style.display = 'none';
    document.body.appendChild(link); link.click(); link.remove();
    return { method: 'browser-download', message: 'PNG download started. Check your browser Downloads folder.' };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
