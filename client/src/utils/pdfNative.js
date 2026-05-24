/**
 * pdfNative.js
 *
 * Abstracts PDF download & sharing so the same code works in:
 *   - Browser (web)          → jsPDF.save() / Web Share API
 *   - Capacitor Android APK  → @capacitor/filesystem + @capacitor/share
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** true when running inside the native Android/iOS app */
export const isNative = () => Capacitor.isNativePlatform();

/** Convert a jsPDF instance → base64 string (no data-URI prefix) */
const toBase64 = (pdf) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror   = reject;
    reader.readAsDataURL(pdf.output('blob'));
  });

/**
 * Save the PDF to the device cache directory and return its native URI.
 * The cache dir never needs WRITE_EXTERNAL_STORAGE permission.
 */
const saveToCache = async (pdf, fileName) => {
  const base64 = await toBase64(pdf);
  const result = await Filesystem.writeFile({
    path:      fileName,
    data:      base64,
    directory: Directory.Cache,
    recursive: true,
  });
  return result.uri;
};

/**
 * Download (save) the PDF.
 *   Native  → writes to Documents folder (appears in Files app / My Files)
 *   Web     → triggers browser download via jsPDF.save()
 */
export const downloadPdf = async (pdf, fileName) => {
  if (isNative()) {
    const base64 = await toBase64(pdf);
    await Filesystem.writeFile({
      path:      fileName,
      data:      base64,
      directory: Directory.Documents,
      recursive: true,
    });
  } else {
    pdf.save(fileName);
  }
};

/**
 * Share the PDF as a file.
 *   Native  → saves to cache, opens Android share sheet (WhatsApp, Drive, etc.)
 *   Web     → uses Web Share API with file blob; falls back to pdf.save()
 */
export const sharePdf = async (pdf, fileName, title) => {
  if (isNative()) {
    const uri = await saveToCache(pdf, fileName);
    await Share.share({
      title,
      url:         uri,
      dialogTitle: 'Share PDF via…',
    });
  } else {
    const blob = pdf.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const canShare =
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] });
    if (canShare) {
      await navigator.share({ title, files: [file] });
    } else {
      pdf.save(fileName);
    }
  }
};
