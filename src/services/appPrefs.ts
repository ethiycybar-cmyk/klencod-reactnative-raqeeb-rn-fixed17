import { EMPLOYEE_MODE_KEY, GEMINI_KEY, GEMINI_MODEL_KEY, SHOP_NAME_KEY, storage } from '../data/storage';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';

export function isEmployeeMode(): boolean {
  return storage.getBoolean(EMPLOYEE_MODE_KEY) === true;
}
export function setEmployeeMode(on: boolean): void {
  storage.set(EMPLOYEE_MODE_KEY, on);
}

export function getShopName(): string {
  return storage.getString(SHOP_NAME_KEY) ?? '';
}
export function saveShopName(name: string): void {
  const v = name.trim();
  if (v) storage.set(SHOP_NAME_KEY, v);
  else storage.remove(SHOP_NAME_KEY);
}

export function getGeminiKey(): string {
  return storage.getString(GEMINI_KEY) ?? '';
}
export function getGeminiModel(): string {
  return storage.getString(GEMINI_MODEL_KEY) || DEFAULT_GEMINI_MODEL;
}
export function saveGemini(key: string, model: string): void {
  if (key.trim()) storage.set(GEMINI_KEY, key.trim());
  else storage.remove(GEMINI_KEY);
  if (model.trim()) storage.set(GEMINI_MODEL_KEY, model.trim());
  else storage.remove(GEMINI_MODEL_KEY);
}
