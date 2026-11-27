import { Share as RNShare } from 'react-native';
import { buildPdfFromJpegBase64 } from '../utils/pdf';
import { todayISO } from '../utils/dates';
import { getNative, nativeErrorText } from './native';

export type ExportFormat = 'image' | 'pdf' | 'text';
export type ExportTarget = 'any' | 'owner';

const isCancel = (e: unknown) => /did not share|cancel/i.test(e instanceof Error ? e.message : String((e as any)?.message ?? e));

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

export type ShareResult = { ok: boolean; message?: string };

/** مشاركة صورة/PDF. للمالك: يفتح محادثته مباشرة في واتساب إن أمكن، وإلا قائمة المشاركة. */
export async function shareReportFile(
  kind: 'image' | 'pdf',
  base64: string,
  opts: { toOwner: boolean; ownerNumber: string; shopName: string },
): Promise<ShareResult> {
  const mime = kind === 'pdf' ? 'application/pdf' : 'image/png';
  const ext = kind === 'pdf' ? 'pdf' : 'png';
  const filename = `raqeeb-report-${todayISO()}.${ext}`;
  const title = `تقرير ${opts.shopName || 'رقيب'}`;

  // المسار الأساسي: وحدة رقيب الأصلية (ملف في الكاش + FileProvider خاص بالتطبيق).
  const native = getNative();
  if (native?.shareFile) {
    try {
      await native.shareFile(base64, filename, mime, opts.toOwner && opts.ownerNumber ? opts.ownerNumber : null, title);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: `تعذّرت المشاركة: ${nativeErrorText(e)}` };
    }
  }

  // احتياطي إن غابت الوحدة الأصلية: مكتبة react-native-share.
  const url = `data:${mime};base64,${base64}`;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Share = require('react-native-share').default;
  try {
    if (opts.toOwner && opts.ownerNumber) {
      try {
        await Share.shareSingle({ social: Share.Social.WHATSAPP, whatsAppNumber: opts.ownerNumber, url, type: mime, filename, message: title });
        return { ok: true };
      } catch (e) {
        if (isCancel(e)) return { ok: false, message: 'تم الإلغاء' };
      }
    }
    await Share.open({ url, type: mime, filename, title, failOnCancel: false });
    return { ok: true };
  } catch (e) {
    if (isCancel(e)) return { ok: false, message: 'تم الإلغاء' };
    return { ok: false, message: `تعذّرت المشاركة: ${nativeErrorText(e)}` };
  }
}

export async function shareReportText(message: string): Promise<void> {
  await RNShare.share({ message });
}
