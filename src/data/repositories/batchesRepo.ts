import { getDB } from '../db/client';
import { mapBatch } from '../db/mappers';
import { daysUntilExpiry } from '../../domain/expiry';
import { classifyFor } from '../../config/thresholds';
import { logAudit } from './auditRepo';
import type { Batch, BatchDraft, BatchWithProduct, DashboardStats, StatusLevel } from '../../types/models';
import { enqueue } from './syncRepo';
import { lowStockProducts } from './productsRepo';

type Row = Record<string, any>;

const BASE_QUERY = `
  SELECT b.*, p.name AS product_name, p.category AS product_category
  FROM batches b
  JOIN products p ON p.id = b.product_id
  WHERE b.deleted_at IS NULL AND p.deleted_at IS NULL
`;

function toBatchWithProduct(row: Row): BatchWithProduct {
  const batch = mapBatch(row);
  const daysLeft = daysUntilExpiry(batch.expiryDate);
  return {
    ...batch,
    productName: String(row.product_name ?? ''),
    category: row.product_category == null ? null : String(row.product_category),
    daysLeft,
    status: classifyFor(daysLeft, row.product_category == null ? null : String(row.product_category)),
  };
}

export function listBatches(query = '', filter: StatusLevel | 'all' = 'all'): BatchWithProduct[] {
  const q = query.trim();
  let sql = BASE_QUERY;
  const params: (string | number)[] = [];
  if (q) {
    sql += ' AND (p.name LIKE ? OR b.batch_number LIKE ? OR b.supplier LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY b.expiry_date ASC';
  let rows = getDB().executeSync(sql, params).rows.map((row) => toBatchWithProduct(row as Row));
  if (filter !== 'all') rows = rows.filter((batch) => batch.status === filter);
  return rows;
}

export function listBatchesForProduct(productId: number): BatchWithProduct[] {
  const rows = getDB()
    .executeSync(`${BASE_QUERY} AND b.product_id = ? ORDER BY b.expiry_date ASC`, [productId])
    .rows;
  return rows.map((row) => toBatchWithProduct(row as Row));
}

export function getBatch(id: number): Batch | null {
  const rows = getDB().executeSync('SELECT * FROM batches WHERE id = ? AND deleted_at IS NULL', [id]).rows;
  return rows.length ? mapBatch(rows[0]) : null;
}

export function createBatch(draft: BatchDraft): number {
  const db = getDB();
  const now = new Date().toISOString();
  const result = db.executeSync(
    `INSERT INTO batches
      (product_id, batch_number, quantity, production_date, expiry_date, supplier, notes, location, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.productId,
      draft.batchNumber.trim(),
      Number(draft.quantity) || 0,
      draft.productionDate.trim() || null,
      draft.expiryDate,
      draft.supplier.trim() || null,
      draft.notes.trim() || null,
      draft.location.trim() || null,
      now,
      now,
    ],
  );
  const id = Number(result.insertId ?? 0);
  enqueue('batches', id, 'create', { id, productId: draft.productId });
  logAudit('create', 'batch', id, `${draft.batchNumber} · ${draft.expiryDate}`);
  return id;
}

export function updateBatch(id: number, draft: BatchDraft): void {
  getDB().executeSync(
    `UPDATE batches SET
      product_id = ?, batch_number = ?, quantity = ?, production_date = ?, expiry_date = ?,
      supplier = ?, notes = ?, location = ?, updated_at = ?, dirty = 1
     WHERE id = ?`,
    [
      draft.productId,
      draft.batchNumber.trim(),
      Number(draft.quantity) || 0,
      draft.productionDate.trim() || null,
      draft.expiryDate,
      draft.supplier.trim() || null,
      draft.notes.trim() || null,
      draft.location.trim() || null,
      new Date().toISOString(),
      id,
    ],
  );
  enqueue('batches', id, 'update', { id, productId: draft.productId });
  logAudit('update', 'batch', id, `${draft.batchNumber} · ${draft.expiryDate}`);
}

export function deleteBatch(id: number): void {
  const now = new Date().toISOString();
  getDB().executeSync('UPDATE batches SET deleted_at = ?, dirty = 1, updated_at = ? WHERE id = ?', [now, now, id]);
  enqueue('batches', id, 'delete', { id });
  logAudit('delete', 'batch', id);
}

/** التشغيلات الفعّالة: كمية > 0 وغير مباعة، الأقرب انتهاءً أولاً. */
export function activeBatches(): BatchWithProduct[] {
  return listBatches('', 'all').filter((b) => b.quantity > 0 && b.isSold === 0);
}

export function dashboardStats(): DashboardStats {
  const db = getDB();
  const totalProducts = Number(db.executeSync('SELECT COUNT(*) AS c FROM products WHERE deleted_at IS NULL').rows[0]?.c ?? 0);
  const active = activeBatches();
  const count = (s: StatusLevel) => active.filter((b) => b.status === s).length;
  const expiredCount = count('expired');
  const critical = count('critical');
  return {
    totalProducts,
    totalBatches: active.length,
    lowStock: lowStockProducts().length,
    expiringSoon: critical + count('warning'),
    expiredCount,
    criticalCount: expiredCount + critical,
  };
}

/** التشغيلات التي تحتاج متابعة (غير الممتازة)، مرتّبة حسب القرب. */
export function attentionBatches(limit = 10): BatchWithProduct[] {
  return activeBatches().filter((b) => b.status !== 'good').slice(0, limit);
}
