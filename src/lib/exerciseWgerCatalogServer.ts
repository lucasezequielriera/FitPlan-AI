import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

export const EXERCISE_WGER_CATALOG_COLLECTION = "exerciseWgerCatalog";

export type CatalogMediaSource = "wger" | "custom";

export type ExerciseWgerCatalogDoc = {
  normKey: string;
  label: string;
  source: CatalogMediaSource;
  wgerExerciseId?: number;
  customImageUrl?: string;
  updatedAt?: Timestamp;
};

export type CatalogPin =
  | { kind: "wger"; id: number; label: string }
  | { kind: "custom"; url: string; label: string };

let cached: { at: number; map: Map<string, CatalogPin> } | null = null;
const TTL_MS = 90_000;

export async function loadExerciseMediaCatalogMap(): Promise<Map<string, CatalogPin>> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) {
    return cached.map;
  }

  const map = new Map<string, CatalogPin>();
  const db = getAdminDb();
  if (!db) {
    cached = { at: now, map };
    return map;
  }

  const snap = await db.collection(EXERCISE_WGER_CATALOG_COLLECTION).get();
  snap.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    const normKey = typeof d.normKey === "string" ? d.normKey.trim() : doc.id.trim();
    const label = typeof d.label === "string" ? d.label.trim() : normKey;
    if (!normKey) return;

    const declared = d.source === "custom" ? "custom" : d.source === "wger" ? "wger" : null;
    const customUrl = typeof d.customImageUrl === "string" ? d.customImageUrl.trim() : "";
    const idRaw = d.wgerExerciseId;
    const wgerId = typeof idRaw === "number" ? idRaw : Number(idRaw);

    if (declared === "custom" && customUrl) {
      map.set(normKey, { kind: "custom", url: customUrl, label: label || normKey });
      return;
    }
    if (declared === "wger" && Number.isFinite(wgerId) && wgerId >= 1) {
      map.set(normKey, { kind: "wger", id: Math.floor(wgerId), label: label || normKey });
      return;
    }

    if (customUrl) {
      map.set(normKey, { kind: "custom", url: customUrl, label: label || normKey });
      return;
    }
    if (Number.isFinite(wgerId) && wgerId >= 1) {
      map.set(normKey, { kind: "wger", id: Math.floor(wgerId), label: label || normKey });
    }
  });

  cached = { at: now, map };
  return map;
}

export function invalidateExerciseWgerCatalogCache(): void {
  cached = null;
}

export async function adminUpsertExerciseCatalogEntry(
  normKey: string,
  label: string,
  payload: { kind: "wger"; wgerExerciseId: number } | { kind: "custom"; customImageUrl: string }
): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error("Firestore admin no disponible");
  const ref = db.collection(EXERCISE_WGER_CATALOG_COLLECTION).doc(normKey);
  const base = {
    normKey,
    label: label.trim().slice(0, 200),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (payload.kind === "wger") {
    await ref.set(
      {
        ...base,
        source: "wger" as const,
        wgerExerciseId: payload.wgerExerciseId,
        customImageUrl: FieldValue.delete(),
      },
      { merge: true }
    );
  } else {
    await ref.set(
      {
        ...base,
        source: "custom" as const,
        customImageUrl: payload.customImageUrl.trim().slice(0, 2048),
        wgerExerciseId: FieldValue.delete(),
      },
      { merge: true }
    );
  }
  invalidateExerciseWgerCatalogCache();
}

export async function adminDeleteExerciseWgerCatalogEntry(normKey: string): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error("Firestore admin no disponible");
  await db.collection(EXERCISE_WGER_CATALOG_COLLECTION).doc(normKey).delete();
  invalidateExerciseWgerCatalogCache();
}

export async function adminListExerciseWgerCatalog(): Promise<ExerciseWgerCatalogDoc[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection(EXERCISE_WGER_CATALOG_COLLECTION).get();
  const out: ExerciseWgerCatalogDoc[] = [];
  snap.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    const normKey = typeof d.normKey === "string" ? d.normKey : doc.id;
    const label = typeof d.label === "string" ? d.label : normKey;
    const customUrl = typeof d.customImageUrl === "string" ? d.customImageUrl.trim() : "";
    const idRaw = d.wgerExerciseId;
    const wgerExerciseId = typeof idRaw === "number" ? idRaw : Number(idRaw);
    const hasWger = Number.isFinite(wgerExerciseId) && wgerExerciseId >= 1;
    let source: CatalogMediaSource = "wger";
    if (d.source === "custom") source = "custom";
    else if (d.source === "wger") source = "wger";
    else if (customUrl && !hasWger) source = "custom";
    if (!normKey) return;
    const row: ExerciseWgerCatalogDoc = {
      normKey,
      label,
      source,
      updatedAt: d.updatedAt as Timestamp,
    };
    if (hasWger) row.wgerExerciseId = Math.floor(wgerExerciseId);
    if (customUrl) row.customImageUrl = customUrl;
    out.push(row);
  });
  out.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return out;
}
