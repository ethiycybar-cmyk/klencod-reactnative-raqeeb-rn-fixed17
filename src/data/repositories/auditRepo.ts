import { getDB } from '../db/client';
import type { AuditEntry } from '../../types/models';

/** يسجّل عملية في سجل التدقيق. لا يرمي أخطاء حتى لا يعطّل العملية الأصلية. */
export function logAudit(action: string, entity: string, entityId: number | null, details = ''): void {
  try {
    getDB().executeSync(
      'INSERT INTO audit_log (action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?)',
      [action, entity, entityId, details || null, new Date().toISOString()],
    );
  } catch {
    // السجل مساعد؛ فشله لا يجب أن يمنع العمل.
  }
}

export function listAudit(limit = 200): AuditEntry[] {
  const rows = getDB().executeSync('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?', [limit]).rows;
  return rows.map((r) => ({
    id: Number(r.id),
    action: String(r.action),
    entity: String(r.entity),
    entityId: r.entity_id == null ? null : Number(r.entity_id),
    details: r.details == null ? null : String(r.details),
    createdAt: String(r.created_at),
  }));
}
