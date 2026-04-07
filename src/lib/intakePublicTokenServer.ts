import { timingSafeEqual } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

export function safeEqualToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export type IntakePublicTokenOk = {
  ok: true;
  db: Firestore;
  intakeData: Record<string, unknown>;
};

export type IntakePublicTokenErr = {
  ok: false;
  status: number;
  error: string;
};

/**
 * Valida clientId + token de vista pública (mismo que `/mi-plan/...?t=`).
 */
export async function assertIntakePublicToken(clientId: string, token: string): Promise<IntakePublicTokenOk | IntakePublicTokenErr> {
  const db = getAdminDb();
  if (!db) {
    return { ok: false, status: 500, error: "Servicio no disponible" };
  }
  const snap = await db.collection("intakeClients").doc(clientId).get();
  if (!snap.exists) {
    return { ok: false, status: 404, error: "No encontrado" };
  }
  const intakeData = (snap.data() || {}) as Record<string, unknown>;
  const stored = typeof intakeData.publicViewToken === "string" ? intakeData.publicViewToken : "";
  if (!stored || !safeEqualToken(stored, token)) {
    return { ok: false, status: 403, error: "Enlace inválido o caducado" };
  }
  return { ok: true, db, intakeData };
}
