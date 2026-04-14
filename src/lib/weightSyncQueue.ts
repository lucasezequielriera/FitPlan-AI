import type { RegistroPeso } from "@/types/savedPlan";

export type PendingWeightOp = {
  id: string;
  planId: string;
  type: "upsert" | "delete";
  fecha: string;
  peso?: number;
  createdAt: string;
};

const KEY_PREFIX = "fitplan:pending-weight-ops:";
export const WEIGHT_QUEUE_CHANGED_EVENT = "fitplan:weight-queue-changed";

function key(planId: string): string {
  return `${KEY_PREFIX}${planId}`;
}

function safeParse(raw: string | null): PendingWeightOp[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingWeightOp[]) : [];
  } catch {
    return [];
  }
}

export function loadPendingWeightOps(planId: string): PendingWeightOp[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(key(planId)));
}

export function savePendingWeightOps(planId: string, ops: PendingWeightOp[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(planId), JSON.stringify(ops));
  window.dispatchEvent(new Event(WEIGHT_QUEUE_CHANGED_EVENT));
}

export function enqueueWeightOp(op: PendingWeightOp): void {
  if (typeof window === "undefined") return;
  const ops = loadPendingWeightOps(op.planId);
  ops.push(op);
  savePendingWeightOps(op.planId, ops);
}

export function clearPendingWeightOps(planId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(planId));
  window.dispatchEvent(new Event(WEIGHT_QUEUE_CHANGED_EVENT));
}

export function getPendingWeightOpsTotalCount(): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;
    total += safeParse(localStorage.getItem(k)).length;
  }
  return total;
}

/** Apply pending ops over base list; newest op for same day wins. */
export function applyPendingWeightOps(base: RegistroPeso[], ops: PendingWeightOp[]): RegistroPeso[] {
  if (ops.length === 0) return base;
  const byDate = new Map<string, RegistroPeso>();
  for (const r of base) byDate.set(r.fecha, r);

  for (const op of ops) {
    if (op.type === "delete") {
      byDate.delete(op.fecha);
      continue;
    }
    if (op.type === "upsert" && typeof op.peso === "number" && op.peso > 0) {
      byDate.set(op.fecha, {
        fecha: op.fecha,
        peso: op.peso,
        timestamp: Date.now(),
      });
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
