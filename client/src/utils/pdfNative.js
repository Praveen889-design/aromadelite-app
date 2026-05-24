/**
 * pdfNative.js — PDF download & share for web + Capacitor Android
 */
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Detect Capacitor native app via window.Capacitor (injected by the runtime).
 * Using window.Capacitor directly is safer than importing @capacitor/core
 * because it works even if the bundle import path has issues.
 */
export const isNative = () => {
  try {
    return !!(window?.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

/** jsPDF → base64 string (synchronous, no FileReader needed) */
const pdfBase64 = (pdf) => pdf.output('datauristring').split(',')[1];

/**
 * DOWNLOAD the PDF.
 *   Native → cache + Share sheet so user can save to Downloads/Drive/etc.
 *   Web    → blob-URL anchor click (works in all modern browsers)
 */
export const downloadPdf = async (pdf, fileName) => {
  if (isNative()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: pdfBase64(pdf),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: fileName,
      url: result.uri,
      dialogTitle: 'Save PDF to…',
    });
  } else {
    const blob = pdf.output('blob');
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
};

/**
 * SHARE the PDF as a file (WhatsApp, Drive, email, etc.).
 *   Native → Capacitor Share plugin (opens Android share sheet with the file)
 *   Web    → Web Share API with File object; falls back to blob-URL download
 */
export const sharePdf = async (pdf, fileName, title) => {
  if (isNative()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: pdfBase64(pdf),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title,
      url: result.uri,
      dialogTitle: 'Share PDF via…',
    });
  } else {
    const blob = pdf.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });
    // Try Web Share API with file (works on mobile Chrome / Safari)
    if (typeof navigator?.share === 'function') {
      try {
        await navigator.share({ title, files: [file] });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return; // user dismissed — not an error
        // Not supported with files → fall through to download
      }
    }
    // Desktop fallback: download the file
    await downloadPdf(pdf, fileName);
  }
};
