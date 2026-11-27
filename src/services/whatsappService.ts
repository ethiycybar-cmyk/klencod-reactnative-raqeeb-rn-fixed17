import { Linking } from 'react-native';
import { storage, WHATSAPP_KEY } from '../data/storage';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

export function getWhatsappNumber(): string {
  return storage.getString(WHATSAPP_KEY) ?? '';
}

/** يقبل الرقم بصيغة دولية (مع رمز الدولة). يعيد null إن كان غير صالح. */
export function normalizeWhatsappNumber(raw: string): string | null {
  let digits = toLatinDigits(raw).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** يحفظ الرقم؛ نص فارغ يمسحه. يعيد false عند رقم غير صالح. */
export function saveWhatsappNumber(raw: string): boolean {
  if (!raw.trim()) {
    storage.remove(WHATSAPP_KEY);
    return true;
  }
  const normalized = normalizeWhatsappNumber(raw);
  if (!normalized) return false;
  storage.set(WHATSAPP_KEY, normalized);
  return true;
}

/** يفتح واتساب والرسالة جاهزة؛ المستخدم يضغط «إرسال» بنفسه. دون رقم محفوظ يختار المحادثة. */
export async function openWhatsappWithText(text: string, toNumber?: string): Promise<boolean> {
  const number = toNumber ?? getWhatsappNumber();
  const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
