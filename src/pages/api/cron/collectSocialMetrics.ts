import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getInstagramAccessToken } from "@/lib/socialContent/instagramTokenStore";
import { fetchMediaMetrics } from "@/lib/socialContent/instagramInsights";

/**
 * Ventana de recolección: se siguen midiendo las piezas de los últimos 30
 * días. Un reel sigue acumulando alcance semanas después de publicarse, así
 * que una única lectura al día siguiente subestimaría bastante el resultado.
 */
const WINDOW_DAYS = 30;

function isAuthorized(req: NextApiRequest): boolean {
  if (req.headers["x-vercel-cron"] === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (req.headers.authorization || "") === `Bearer ${secret}`;
}

type Collectable = { ref: FirebaseFirestore.DocumentReference; mediaId: string };

/**
 * Junta las piezas publicadas con `platformPostId` de Instagram de las dos
 * colecciones (automáticas y manuales) dentro de la ventana de medición.
 *
 * Se filtra por `status == "published"` (igualdad simple) y la fecha se
 * compara en JS a propósito: combinar ambos filtros en la query exigiría un
 * índice compuesto en Firestore, y el volumen acá es de decenas de docs.
 */
async function collectablesFrom(db: Firestore, collection: string, since: number): Promise<Collectable[]> {
  const snap = await db.collection(collection).where("status", "==", "published").get();
  const out: Collectable[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const mediaId = data.instagram?.platformPostId;
    if (!mediaId || data.instagram?.ok !== true) continue;

    const publishedAt = data.publishedAt?.toMillis?.() ?? data.createdAt?.toMillis?.() ?? null;
    if (publishedAt !== null && publishedAt < since) continue;

    out.push({ ref: doc.ref, mediaId: String(mediaId) });
  }
  return out;
}

/**
 * Recolecta las métricas de Instagram de las piezas publicadas recientemente
 * y las guarda en su propio doc, para poder comparar después qué tema, qué
 * función de embudo y qué familia de gancho funcionan mejor.
 *
 * Corre una vez al día: las métricas de Instagram no se actualizan en tiempo
 * real y pedirlas más seguido sólo gasta cuota de la API sin aportar nada.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const db = getAdminDb();
  if (!db) return res.status(500).json({ error: "Firebase Admin SDK no configurado" });

  try {
    const accessToken = await getInstagramAccessToken(db);
    if (!accessToken) {
      return res.status(200).json({ ok: false, skipped: true, reason: "instagram_no_conectado" });
    }

    const since = Date.now() - WINDOW_DAYS * 86400000;
    const targets = [
      ...(await collectablesFrom(db, "socialContent", since)),
      ...(await collectablesFrom(db, "socialContentManual", since)),
    ];

    let updated = 0;
    let insightsBlocked = 0;
    const errors: string[] = [];

    for (const target of targets) {
      try {
        const metrics = await fetchMediaMetrics(target.mediaId, accessToken);
        if (!metrics.insightsAvailable) insightsBlocked++;
        await target.ref.set(
          { metrics: { ...metrics, collectedAt: FieldValue.serverTimestamp() } },
          { merge: true }
        );
        updated++;
      } catch (error) {
        errors.push(`${target.mediaId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return res.status(200).json({
      ok: true,
      checked: targets.length,
      updated,
      // Señal explícita de que falta `instagram_manage_insights`: sin él sólo
      // se guardan likes y comentarios, que son las señales de menor peso.
      insightsBlocked,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    console.error("Error recolectando métricas sociales:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "No se pudieron recolectar las métricas", detail: message });
  }
}
