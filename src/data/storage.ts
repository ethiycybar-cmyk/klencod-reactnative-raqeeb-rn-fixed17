import { createMMKV } from 'react-native-mmkv';

/** تخزين متزامن سريع للجلسة والإعدادات الصغيرة. الأسرار تُخزَّن كتجزئة في SQLite. */
export const storage = createMMKV({ id: 'raqeeb-store' });

export const SESSION_KEY = 'session_ok';
export const DEVICE_KEY = 'device_fingerprint';
export const LAST_SYNC_KEY = 'last_sync';
export const WHATSAPP_KEY = 'whatsapp_number';
export const THRESHOLDS_KEY = 'category_thresholds';
export const EMPLOYEE_MODE_KEY = 'employee_mode';
export const SHOP_NAME_KEY = 'shop_name';
export const GEMINI_KEY = 'gemini_api_key';
export const GEMINI_MODEL_KEY = 'gemini_model';

export function isSessionOpen(): boolean {
  return storage.getBoolean(SESSION_KEY) === true;
}

export function openSession(): void {
  storage.set(SESSION_KEY, true);
}

export function closeSession(): void {
  storage.set(SESSION_KEY, false);
}
