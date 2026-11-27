import { deflateSync, inflateSync } from 'fflate';
import { buildBackup, importBackup, type ImportResult } from './backupService';
import { base64ToBytes, bytesToBase64 } from '../utils/pdf';
import { utf8Decode, utf8Encode } from '../utils/utf8';
import { createEncryptedZip, readEncryptedZip, ZipError } from '../utils/zipcrypto';
import { todayISO } from '../utils/dates';

const ENTRY_NAME = 'raqeeb-backup.json';

const randomBytes = (n: number): Uint8Array => {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
};

/** ينشئ أرشيف zip مضغوطاً ومحمياً بكلمة المرور ويعيده base64 مع اسم مقترح. */
export function createBackupZip(password: string): { base64: string; filename: string } {
  const json = buildBackup();
  const zip = createEncryptedZip(ENTRY_NAME, utf8Encode(json), password, (d) => deflateSync(d, { level: 9 }), randomBytes);
  return { base64: bytesToBase64(zip), filename: `raqeeb-backup-${todayISO()}` };
}

/** يفك الأرشيف بكلمة المرور ويستورد محتواه. */
export async function restoreBackupZip(base64: string, password: string): Promise<ImportResult> {
  try {
    const { data } = readEncryptedZip(base64ToBytes(base64), password, (d) => inflateSync(d));
    return await importBackup(utf8Decode(data));
  } catch (e) {
    if (e instanceof ZipError) {
      if (e.code === 'WRONG_PASSWORD') return { ok: false, products: 0, batches: 0, message: 'كلمة المرور غير صحيحة لهذا الملف' };
      return { ok: false, products: 0, batches: 0, message: 'الملف ليس نسخة احتياطية صالحة من رقيب' };
    }
    return { ok: false, products: 0, batches: 0, message: 'تعذّر قراءة النسخة الاحتياطية' };
  }
}
