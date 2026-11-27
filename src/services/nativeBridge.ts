import { NativeModules } from 'react-native';

type RaqeebNative = {
  scanBarcode(): Promise<string | null>;
  pickFile(): Promise<string>;
};

function mod(): RaqeebNative | null {
  return (NativeModules as { RaqeebNative?: RaqeebNative }).RaqeebNative ?? null;
}

const isCanceled = (e: unknown) => (e as { code?: string })?.code === 'CANCELED';

/** يفتح ماسح Google. يعيد نص الباركود، أو null عند الإلغاء. يرمي رسالة عربية عند الفشل. */
export async function scanBarcode(): Promise<string | null> {
  const m = mod();
  if (!m) throw new Error('ميزة المسح غير متاحة في هذه النسخة.');
  try {
    const value = await m.scanBarcode();
    return value ? String(value).trim() : null;
  } catch (e) {
    if (isCanceled(e)) return null;
    throw new Error('تعذّر تشغيل الماسح. يتطلب خدمات Google Play وتحديثها.');
  }
}

/** يفتح منتقي الملفات ويعيد محتوى الملف base64، أو null عند الإلغاء. */
export async function pickFileBase64(): Promise<string | null> {
  const m = mod();
  if (!m) throw new Error('اختيار الملفات غير متاح في هذه النسخة.');
  try {
    return await m.pickFile();
  } catch (e) {
    if (isCanceled(e)) return null;
    if ((e as { code?: string })?.code === 'TOO_LARGE') throw new Error('الملف كبير جداً.');
    throw new Error('تعذّر قراءة الملف.');
  }
}
