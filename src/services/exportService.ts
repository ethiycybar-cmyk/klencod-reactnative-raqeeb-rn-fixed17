import { Share as RNShare } from 'react-native';
import { buildPdfFromJpegBase64 } from '../utils/pdf';
import { todayISO } from '../utils/dates';

export type ExportFormat = 'image' | 'pdf' | 'text';
export type ExportTarget = 'any' | 'owner';

function errText(e: unknown): string {
  try {
    if (typeof e === 'string') return e;
    const any = e as { message?: unknown; error?: unknown };
    if (any?.message) return String(any.message);
    if (any?.error) return typeof any.error === 'string' ? any.error : String((any.error as { message?: unknown })?.message ?? '');
    return JSON.stringify(e) ?? '';
  } catch {
    return '';
  }
}

// react-native-share يرفض (reject) بكائن وليس Error عند إغلاق القائمة، فنفحص كل الأشكال.
export const isCancel = (e: unknown) => /did not share|cancel|dismiss/i.test(errText(e));

/** يلتقط بطاقة التقرير كصورة base64 (بدون بادئة data:). المكتبة تُحمَّل عند الحاجة فقط. */
export async function captureReport(ref: unknown, kind: 'png' | 'jpg'): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { captureRef } = require('react-native-view-shot');
  const base64 = await captureRef(ref, {
    format: kind,
    quality: kind === 'jpg' ? 0.92 : 1,
    result: 'base64',
    pixelRatio: 3,
  });
  return String(base64);
}

export async function makeReportPdf(ref: unknown): Promise<string> {
  const jpg = await captureReport(ref, 'jpg');
  return buildPdfFromJpegBase64(jpg);
}

export { errText };
export type ShareResult = { ok: boolean; message?: string };

/** مشاركة صورة/PDF. للمالك: يفتح محادثته مباشرة في واتساب إن أمكن، وإلا قائمة المشاركة. */
export async function shareReportFile(
  kind: 'image' | 'pdf',
  base64: string,
  opts: { toOwner: boolean; ownerNumber: string; shopName: string },
): Promise<ShareResult> {
  const mime = kind === 'pdf' ? 'application/pdf' : 'image/png';
  const url = `data:${mime};base64,${base64}`;
  const filename = `report-${todayISO()}`;
  const title = `تقرير ${opts.shopName || 'رقيب'}`;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Share = require('react-native-share').default;
  try {
    if (opts.toOwner && opts.ownerNumber) {
      try {
        await Share.shareSingle({ social: Share.Social.WHATSAPP, whatsAppNumber: opts.ownerNumber, url, type: mime, filename, message: title });
        return { ok: true };
      } catch (e) {
        if (isCancel(e)) return { ok: false, message: 'تم الإلغاء' };
        // واتساب غير متاح أو رفض الملف: نكمل بقائمة المشاركة العامة.
      }
    }
    try {
      await Share.open({ url, type: mime, filename, title, failOnCancel: false });
      return { ok: true };
    } catch (first) {
      if (isCancel(first)) return { ok: false, message: 'تم الإلغاء' };
      // محاولة أبسط بخيارات أقل قبل الاستسلام.
      await Share.open({ url, type: mime, failOnCancel: false });
      return { ok: true };
    }
  } catch (e) {
    if (isCancel(e)) return { ok: false, message: 'تم الإلغاء' };
    const detail = errText(e).slice(0, 90);
    return { ok: false, message: `تعذّرت المشاركة${detail ? ` (${detail})` : ''}` };
  }
}

export async function shareReportText(message: string): Promise<void> {
  await RNShare.share({ message });
}

/** مشاركة ملف zip (النسخة الاحتياطية) عبر قائمة المشاركة لحفظه في الملفات/درايف/واتساب. */
export async function shareZip(base64: string, filename: string): Promise<ShareResult> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Share = require('react-native-share').default;
  try {
    await Share.open({ url: `data:application/zip;base64,${base64}`, type: 'application/zip', filename, title: 'نسخة احتياطية - رقيب', failOnCancel: false });
    return { ok: true };
  } catch (e) {
    if (isCancel(e)) return { ok: false, message: 'تم الإلغاء' };
    return { ok: false, message: `تعذّر حفظ/مشاركة الملف (${errText(e).slice(0, 90)})` };
  }
}
