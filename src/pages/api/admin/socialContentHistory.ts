import type { NextApiRequest, NextApiResponse } from "next";
import type { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

type PlatformResult = { ok: boolean; platformPostId?: string; message?: string; status?: string } | undefined;

type HistoryItem = {
  id: string;
  source: "automatico" | "manual";
  topic: string;
  videoUrl: string | null;
  instagram: PlatformResult;
  tiktok: PlatformResult;
  status: string;
  createdAt: string | null;
};

function toIso(ts: unknown): string | null {
  if (ts && typeof ts === "object" && typeof (ts as Timestamp).toDate === "function") {
    return (ts as Timestamp).toDate().toISOString();
  }
  return null;
}

const HISTORY_LIMIT = 25;

/**
 * Historial unificado de contenido para IG/TikTok: junta lo generado por el
 * cron diario (`socialContent`, un doc por horario disparado) y lo generado
 * a mano desde el panel (`socialContentManual`), ordenado por fecha
 * descendente. Pensado para que el admin pueda auditar qué se publicó,
 * cuándo, y si algún posteo falló.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const db = getAdminDb();
  if (!db) {
    return res.status(500).json({ error: "Firebase Admin SDK no configurado" });
  }

  try {
    const [autoSnap, manualSnap] = await Promise.all([
      db.collection("socialContent").orderBy("createdAt", "desc").limit(HISTORY_LIMIT).get(),
      db.collection("socialContentManual").orderBy("createdAt", "desc").limit(HISTORY_LIMIT).get(),
    ]);

    const items: HistoryItem[] = [
      ...autoSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          source: "automatico" as const,
          topic: d.topic || "(sin tema)",
          videoUrl: d.videoUrl || null,
          instagram: d.instagram,
          tiktok: d.tiktok,
          status: "publicado",
          createdAt: toIso(d.createdAt),
        };
      }),
      ...manualSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          source: "manual" as const,
          topic: d.topic || "(sin tema)",
          videoUrl: d.videoUrl || null,
          instagram: d.instagram,
          tiktok: d.tiktok,
          status: d.status || "draft",
          createdAt: toIso(d.createdAt),
        };
      }),
    ];

    items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return res.status(200).json({ ok: true, items: items.slice(0, HISTORY_LIMIT) });
  } catch (error) {
    console.error("Error obteniendo historial de contenido social:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "No se pudo obtener el historial", detail: message });
  }
}
