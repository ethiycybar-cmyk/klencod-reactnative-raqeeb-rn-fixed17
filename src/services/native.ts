import { NativeModules } from 'react-native';

/** الوحدة الأصلية RaqeebNative (Java). قد تكون غائبة في نسخ قديمة، فكل استدعاء يتحقق منها. */
type RaqeebNative = {
  scanBarcode(): Promise<string>;
  shareFile(base64: string, filename: string, mime: string, whatsappNumber: string | null, message: string | null): Promise<string>;
  saveFile(base64: string, filename: string, mime: string): Promise<string>;
  pickFile(): Promise<string>;
  encryptBackup(json: string, password: string): Promise<string>;
  decryptBackup(base64: string, password: string): Promise<string>;
};

export function getNative(): Partial<RaqeebNative> | null {
  const mod = (NativeModules as { RaqeebNative?: Partial<RaqeebNative> }).RaqeebNative;
  return mod ?? null;
}

export function nativeErrorCode(e: unknown): string {
  return String((e as { code?: unknown } | null)?.code ?? '');
}

export function nativeErrorText(e: unknown): string {
  const msg = (e as { message?: unknown } | null)?.message;
  return typeof msg === 'string' && msg ? msg : String(e);
}

/** يفتح ماسح الباركود (كاميرا Google). يعيد null عند إلغاء المستخدم، ويرمي خطأً عربياً عند الفشل. */
export async function scanBarcode(): Promise<string | null> {
  const native = getNative();
  if (!native?.scanBarcode) throw new Error('الماسح غير متاح في هذه النسخة. أدخل الباركود يدوياً.');
  try {
    return await native.scanBarcode();
  } catch (e) {
    const code = nativeErrorCode(e);
    if (code === 'CANCELED') return null;
    if (code === 'EMPTY') throw new Error('لم يُقرأ باركود، حاول مجدداً بإضاءة أفضل.');
    throw new Error(`تعذّر تشغيل الماسح. تأكد من خدمات Google Play ثم أدخل الباركود يدوياً. (${nativeErrorText(e)})`);
  }
}
