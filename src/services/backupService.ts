import { getDB, exportSnapshot } from '../data/db/client';
import { isISODate, todayISO } from '../utils/dates';
import { logAudit } from '../data/repositories/auditRepo';
import { verifyInstallPassword } from './authService';
import { getNative, nativeErrorCode, nativeErrorText } from './native';
import type { StockMovement } from '../types/models';
import type { Batch, Product } from '../types/models';

type Backup = {
  app: 'raqeeb';
  version: number;
  exportedAt: string;
  products: Product[];
  batches: Batch[];
  movements?: StockMovement[];
};

const toProduct = (row: Record<string, unknown>): Product => ({
  id: Number(row.id),
  name: String(row.name ?? ''),
  barcode: row.barcode == null ? null : String(row.barcode),
  category: row.category == null ? null : String(row.category),
  minStock: Number(row.min_stock ?? 10),
  createdAt: String(row.created_at ?? ''),
  updatedAt: String(row.updated_at ?? ''),
  dirty: Number(row.dirty ?? 1),
  deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
});

const toBatch = (row: Record<string, unknown>): Batch => ({
  id: Number(row.id),
  productId: Number(row.product_id),
  batchNumber: String(row.batch_number ?? ''),
  quantity: Number(row.quantity ?? 0),
  productionDate: row.production_date == null ? null : String(row.production_date),
  expiryDate: String(row.expiry_date ?? ''),
  purchasePrice: row.purchase_price == null ? null : Number(row.purchase_price),
  sellingPrice: row.selling_price == null ? null : Number(row.selling_price),
  supplier: row.supplier == null ? null : String(row.supplier),
  notes: row.notes == null ? null : String(row.notes),
  location: row.location == null ? null : String(row.location),
  isSold: Number(row.is_sold ?? 0),
  createdAt: String(row.created_at ?? ''),
  updatedAt: String(row.updated_at ?? ''),
  dirty: Number(row.dirty ?? 1),
  deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
});

const toMovement = (row: Record<string, unknown>): StockMovement => ({
  id: Number(row.id),
  batchId: Number(row.batch_id),
  productId: Number(row.product_id),
  type: String(row.type) as StockMovement['type'],
  quantity: Number(row.quantity),
  reason: row.reason == null ? null : String(row.reason),
  createdAt: String(row.created_at ?? ''),
});

export function buildBackup(): string {
  const snapshot = exportSnapshot();
  const backup: Backup = {
    app: 'raqeeb',
    version: 1,
    exportedAt: snapshot.exportedAt,
    products: snapshot.products.map((row) => toProduct(row as Record<string, unknown>)),
    batches: snapshot.batches.map((row) => toBatch(row as Record<string, unknown>)),
    movements: snapshot.movements.map((row) => toMovement(row as Record<string, unknown>)),
  };
  return JSON.stringify(backup, null, 2);
}

export type ImportResult = { ok: boolean; products: number; batches: number; message: string };

/** استيراد احتياطي بعد التحقق من البنية، داخل معاملة واحدة. */
export async function importBackup(text: string): Promise<ImportResult> {
  let parsed: Partial<Backup>;
  try {
    parsed = JSON.parse(text) as Partial<Backup>;
  } catch {
    return { ok: false, products: 0, batches: 0, message: 'الملف ليس JSON صالحاً' };
  }
  if (parsed.app !== 'raqeeb' || !Array.isArray(parsed.products) || !Array.isArray(parsed.batches)) {
    return { ok: false, products: 0, batches: 0, message: 'صيغة النسخة الاحتياطية غير صحيحة' };
  }
  if (parsed.batches.some((b) => !isISODate(b.expiryDate))) {
    return { ok: false, products: 0, batches: 0, message: 'توجد تواريخ انتهاء غير صالحة في الملف' };
  }

  const db = getDB();
  await db.transaction(async (tx) => {
    await tx.execute('DELETE FROM sync_queue');
    await tx.execute('DELETE FROM stock_movements');
    await tx.execute('DELETE FROM batches');
    await tx.execute('DELETE FROM products');
    for (const p of parsed.products ?? []) {
      await tx.execute(
        `INSERT INTO products (id, name, barcode, category, min_stock, created_at, updated_at, dirty, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.barcode, p.category, p.minStock, p.createdAt, p.updatedAt, 1, p.deletedAt],
      );
    }
    for (const b of parsed.batches ?? []) {
      await tx.execute(
        `INSERT INTO batches (id, product_id, batch_number, quantity, production_date, expiry_date,
          purchase_price, selling_price, supplier, notes, location, is_sold, created_at, updated_at, dirty, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.id, b.productId, b.batchNumber, b.quantity, b.productionDate, b.expiryDate, b.purchasePrice,
          b.sellingPrice, b.supplier, b.notes, b.location ?? null, b.isSold, b.createdAt, b.updatedAt, 1, b.deletedAt],
      );
    }
    for (const m of parsed.movements ?? []) {
      await tx.execute(
        `INSERT INTO stock_movements (id, batch_id, product_id, type, quantity, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.batchId, m.productId, m.type, m.quantity, m.reason, m.createdAt],
      );
    }
  });
  logAudit('import', 'backup', null, `${parsed.products.length} منتج / ${parsed.batches.length} تشغيلة`);
  return {
    ok: true,
    products: parsed.products.length,
    batches: parsed.batches.length,
    message: `تم استيراد ${parsed.products.length} منتجاً و${parsed.batches.length} تشغيلة`,
  };
}

// ───────────────────────── نسخة مضغوطة ومشفّرة بكلمة التثبيت ─────────────────────────

export const BACKUP_EXTENSION = 'rqb';

export function backupFileName(): string {
  return `raqeeb-backup-${todayISO()}.${BACKUP_EXTENSION}`;
}

export type EncryptedBackup = { base64: string; filename: string };

/** يتحقق من كلمة التثبيت ثم يبني ملفاً مضغوطاً ومشفّراً (AES-256) بها. */
export async function createEncryptedBackup(password: string): Promise<EncryptedBackup> {
  if (!(await verifyInstallPassword(password))) throw new Error('كلمة التثبيت غير صحيحة');
  const native = getNative();
  if (!native?.encryptBackup) throw new Error('التشفير غير متاح في هذه النسخة من التطبيق');
  const base64 = await native.encryptBackup(buildBackup(), password.trim());
  return { base64, filename: backupFileName() };
}

export async function saveBackupToDevice(file: EncryptedBackup): Promise<'saved' | 'canceled'> {
  const native = getNative();
  if (!native?.saveFile) throw new Error('الحفظ غير متاح في هذه النسخة من التطبيق');
  try {
    await native.saveFile(file.base64, file.filename, 'application/octet-stream');
    return 'saved';
  } catch (e) {
    if (nativeErrorCode(e) === 'CANCELED') return 'canceled';
    throw new Error(`تعذّر حفظ الملف: ${nativeErrorText(e)}`);
  }
}

export async function shareBackup(file: EncryptedBackup): Promise<void> {
  const native = getNative();
  if (!native?.shareFile) throw new Error('المشاركة غير متاحة في هذه النسخة من التطبيق');
  try {
    await native.shareFile(file.base64, file.filename, 'application/octet-stream', null, 'نسخة احتياطية من رقيب');
  } catch (e) {
    throw new Error(`تعذّرت المشاركة: ${nativeErrorText(e)}`);
  }
}

/** يتحقق من كلمة التثبيت أولاً، وإن كانت خاطئة لا يفتح أي ملف. */
export async function authorizeRestore(password: string): Promise<void> {
  if (!(await verifyInstallPassword(password))) throw new Error('كلمة التثبيت غير صحيحة. لا يمكن الاستيراد.');
}

export type PreparedRestore = { json: string; products: number; batches: number; exportedAt: string };

/** يختار ملفاً من الجهاز ويفك تشفيره بكلمة التثبيت. يعيد null إن ألغى المستخدم. */
export async function pickAndDecryptBackup(password: string): Promise<PreparedRestore | null> {
  const native = getNative();
  if (!native?.pickFile || !native.decryptBackup) throw new Error('الاستيراد غير متاح في هذه النسخة من التطبيق');
  let base64: string;
  try {
    base64 = await native.pickFile();
  } catch (e) {
    if (nativeErrorCode(e) === 'CANCELED') return null;
    throw new Error(`تعذّر فتح الملف: ${nativeErrorText(e)}`);
  }
  let json: string;
  try {
    json = await native.decryptBackup(base64, password.trim());
  } catch (e) {
    const code = nativeErrorCode(e);
    if (code === 'WRONG_PASSWORD') {
      throw new Error('لا يمكن فتح هذه النسخة: أُخذت بكلمة تثبيت مختلفة أو الملف معدَّل');
    }
    if (code === 'BAD_FILE') throw new Error('هذا الملف ليس نسخة احتياطية من رقيب أو أنه تالف');
    throw new Error(`تعذّر فك التشفير: ${nativeErrorText(e)}`);
  }
  let parsed: Partial<Backup>;
  try {
    parsed = JSON.parse(json) as Partial<Backup>;
  } catch {
    throw new Error('محتوى النسخة تالف');
  }
  if (parsed.app !== 'raqeeb' || !Array.isArray(parsed.products) || !Array.isArray(parsed.batches)) {
    throw new Error('صيغة النسخة الاحتياطية غير صحيحة');
  }
  return { json, products: parsed.products.length, batches: parsed.batches.length, exportedAt: String(parsed.exportedAt ?? '') };
}
