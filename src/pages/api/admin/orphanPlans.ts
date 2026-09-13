import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { clasificarPlanes, trocear, type PlanRef } from "@/lib/admin/orphanPlans";

/**
 * Planes huérfanos: los que quedaron con un `userId` que ya no existe (#5).
 *
 * GET  → los lista, sin tocar nada.
 * POST → archiva y borra EXACTAMENTE los ids que se le pasan.
 *
 * El borrado nunca ocurre solo: ni al cargar la vista, ni por cron. Lo dispara
 * Lucas sobre una lista que ha visto. Y aun así se vuelve a comprobar cada id
 * antes de borrarlo, porque entre que se pintó la lista y se pulsó el botón
 * pueden haber pasado horas.
 */

/** `auth.getUsers` acepta como mucho 100 identificadores por llamada. */
const LOTE_AUTH = 100;
/** `getAll` de Firestore con miles de refs se vuelve pesado; se trocea igual. */
const LOTE_FIRESTORE = 200;
/** Tope por petición de borrado. No es un límite técnico: es un freno. */
const MAX_BORRADO = 200;

type PlanConDatos = PlanRef & { createdAt: string | null; resumen: string };

function aIso(valor: unknown): string | null {
  if (!valor) return null;
  if (typeof valor === "object" && valor && "toDate" in valor && typeof (valor as { toDate: unknown }).toDate === "function") {
    return (valor as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

/** Una línea para que en el panel se vea de qué plan se trata. */
function resumirPlan(data: Record<string, unknown>): string {
  const plan = data.plan;
  if (plan && typeof plan === "object") {
    const posible = (plan as Record<string, unknown>).nombre ?? (plan as Record<string, unknown>).titulo;
    if (typeof posible === "string" && posible.trim()) return posible.trim().slice(0, 80);
  }
  const source = typeof data.source === "string" ? data.source : null;
  return source ? `origen: ${source}` : "sin descripción";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const db = getAdminDb();
    const adminAuth = getAdminAuth();
    if (!db || !adminAuth) {
      return res.status(501).json({ error: "Firebase Admin SDK no configurado" });
    }

    // ── Detección, común a los dos métodos ──────────────────────────────────
    const snap = await db.collection("planes").get();
    const planes: PlanConDatos[] = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        userId: typeof data.userId === "string" ? data.userId : null,
        createdAt: aIso(data.createdAt),
        resumen: resumirPlan(data),
      };
    });

    const uids = [...new Set(planes.map((p) => (p.userId || "").trim()).filter(Boolean))];

    // ¿Cuáles tienen documento en `usuarios`?
    const usuariosVivos = new Set<string>();
    for (const lote of trocear(uids, LOTE_FIRESTORE)) {
      const docs = await db.getAll(...lote.map((uid) => db.collection("usuarios").doc(uid)));
      docs.forEach((d) => { if (d.exists) usuariosVivos.add(d.id); });
    }

    // ¿Cuáles tienen cuenta en Auth? `comprobados` registra para qué UIDs se
    // pudo llegar a una respuesta. Si un lote falla, sus UIDs NO entran, y
    // `clasificarPlanes` los tratará como "tiene dueño" por precaución.
    const cuentasVivas = new Set<string>();
    const comprobados = new Set<string>();
    const lotesFallidos: string[] = [];
    for (const lote of trocear(uids, LOTE_AUTH)) {
      try {
        const resultado = await adminAuth.getUsers(lote.map((uid) => ({ uid })));
        resultado.users.forEach((u) => cuentasVivas.add(u.uid));
        lote.forEach((uid) => comprobados.add(uid));
      } catch (error) {
        console.error(`⚠️ No se pudo comprobar un lote de ${lote.length} UID(s) en Auth:`, error);
        lotesFallidos.push(...lote);
      }
    }

    const { huerfanos, sinDuenyo, conDuenyo } = clasificarPlanes(
      planes,
      usuariosVivos,
      cuentasVivas,
      comprobados
    );
    const porId = new Map(planes.map((p) => [p.id, p]));

    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        totalPlanes: planes.length,
        conDuenyo,
        huerfanos: huerfanos.map((h) => porId.get(h.id)),
        sinDuenyo: sinDuenyo.map((h) => porId.get(h.id)),
        // Se dice en voz alta: si hubo lotes que Auth no pudo responder, la
        // lista está incompleta a propósito y hay que volver a mirarla luego.
        comprobacionIncompleta: lotesFallidos.length > 0,
        uidsSinComprobar: lotesFallidos.length,
      });
    }

    // ── Borrado ─────────────────────────────────────────────────────────────
    const idsPedidos = Array.isArray(req.body?.planIds) ? (req.body.planIds as unknown[]) : null;
    if (!idsPedidos || idsPedidos.length === 0) {
      return res.status(400).json({ error: "Hay que indicar qué planes borrar en `planIds`" });
    }
    if (idsPedidos.length > MAX_BORRADO) {
      return res.status(400).json({ error: `No se pueden borrar más de ${MAX_BORRADO} planes de una vez` });
    }

    // Solo se borra lo que la detección de ESTA petición considera borrable.
    // Un id que llegue por el cuerpo y no esté aquí se rechaza: puede ser una
    // lista vieja, o un intento de colar el plan de alguien vivo.
    const borrables = new Set([...huerfanos, ...sinDuenyo].map((p) => p.id));

    const borrados: string[] = [];
    const rechazados: string[] = [];
    const fallidos: { id: string; motivo: string }[] = [];

    for (const bruto of idsPedidos) {
      const id = String(bruto);
      if (!borrables.has(id)) {
        rechazados.push(id);
        continue;
      }
      const plan = porId.get(id);
      try {
        const ref = db.collection("planes").doc(id);
        const doc = await ref.get();
        if (!doc.exists) {
          // Ya no está. No es un fallo.
          borrados.push(id);
          continue;
        }
        // Archivar ANTES de borrar, y solo borrar si el archivado funcionó.
        // Es el mismo principio que #12: no dar por hecho un paso que puede
        // fallar. Aquí además hace el borrado reversible.
        await db.collection("planesArchivados").doc(id).set({
          ...doc.data(),
          archivadoEn: FieldValue.serverTimestamp(),
          archivadoPor: auth.uid,
          motivo: plan?.userId ? "huérfano: userId sin usuario ni cuenta" : "sin userId",
          userIdOriginal: plan?.userId ?? null,
        });
        await ref.delete();
        borrados.push(id);
      } catch (error) {
        console.error(`❌ No se pudo archivar/borrar el plan ${id}:`, error);
        fallidos.push({ id, motivo: error instanceof Error ? error.message : "Error desconocido" });
      }
    }

    console.log(`🧹 ${auth.uid} archivó y borró ${borrados.length} plan(es) huérfano(s)`);
    return res.status(fallidos.length > 0 ? 207 : 200).json({
      borrados: borrados.length,
      rechazados,
      fallidos,
    });
  } catch (error) {
    console.error("Error al procesar planes huérfanos:", error);
    return res.status(500).json({
      error: "No se pudieron procesar los planes huérfanos",
      detail: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}
