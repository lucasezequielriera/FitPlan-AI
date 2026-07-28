import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";
import { getInstagramAccessToken, getStoredInstagramToken } from "@/lib/socialContent/instagramTokenStore";

type ServiceStatus = {
  key: string;
  name: string;
  category: "ia" | "publicacion" | "pagos" | "infraestructura";
  configured: boolean;
  /** null = no se pudo verificar en vivo (p.ej. no configurado) */
  ok: boolean | null;
  detail: string;
  credit?: { label: string; value: string };
};

async function checkFirebase(): Promise<ServiceStatus> {
  const db = getAdminDb();
  return {
    key: "firebase",
    name: "Firebase (Auth + Firestore)",
    category: "infraestructura",
    configured: !!db,
    ok: !!db,
    detail: db ? "Admin SDK conectado correctamente." : "No se pudo inicializar el Admin SDK.",
  };
}

async function checkOpenAI(): Promise<ServiceStatus> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { key: "openai", name: "OpenAI (copy de reels)", category: "ia", configured: false, ok: null, detail: "Falta OPENAI_API_KEY." };
  }
  try {
    const resp = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    return {
      key: "openai",
      name: "OpenAI (copy de reels)",
      category: "ia",
      configured: true,
      ok: resp.ok,
      detail: resp.ok ? "API key válida." : `La API respondió HTTP ${resp.status}.`,
    };
  } catch (err) {
    return {
      key: "openai",
      name: "OpenAI (copy de reels)",
      category: "ia",
      configured: true,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkHeygen(): Promise<ServiceStatus> {
  const apiKey = process.env.HEYGEN_API_KEY;
  const avatarId = process.env.HEYGEN_AVATAR_ID;
  const voiceId = process.env.HEYGEN_VOICE_ID;
  if (!apiKey || !avatarId || !voiceId) {
    return {
      key: "heygen",
      name: "HeyGen (avatar + voz clonada)",
      category: "ia",
      configured: false,
      ok: null,
      detail: "Faltan HEYGEN_API_KEY / HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID.",
    };
  }
  try {
    const resp = await fetch("https://api.heygen.com/v3/users/me", { headers: { "X-Api-Key": apiKey } });
    const data = await resp.json();
    const wallet = data?.data?.wallet;
    const balance = typeof wallet?.remaining_balance === "number" ? wallet.remaining_balance : null;
    const currency = typeof wallet?.currency === "string" ? wallet.currency.toUpperCase() : "USD";
    return {
      key: "heygen",
      name: "HeyGen (avatar + voz clonada)",
      category: "ia",
      configured: true,
      ok: resp.ok,
      detail: resp.ok ? "Cuenta conectada." : `La API respondió HTTP ${resp.status}.`,
      credit: balance !== null ? { label: "Saldo en wallet", value: `$${balance.toFixed(2)} ${currency}` } : undefined,
    };
  } catch (err) {
    return {
      key: "heygen",
      name: "HeyGen (avatar + voz clonada)",
      category: "ia",
      configured: true,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkCloudinary(): Promise<ServiceStatus> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return {
      key: "cloudinary",
      name: "Cloudinary (hosting de videos/imágenes)",
      category: "infraestructura",
      configured: false,
      ok: null,
      detail: "Faltan las variables de Cloudinary.",
    };
  }
  try {
    const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/usage`, {
      headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}` },
    });
    const data = await resp.json();
    const used = typeof data?.credits?.usage === "number" ? data.credits.usage : null;
    const limit = typeof data?.credits?.limit === "number" ? data.credits.limit : null;
    const pct = typeof data?.credits?.used_percent === "number" ? data.credits.used_percent : null;
    return {
      key: "cloudinary",
      name: "Cloudinary (hosting de videos/imágenes)",
      category: "infraestructura",
      configured: true,
      ok: resp.ok,
      detail: resp.ok ? `Plan ${data.plan || "?"}.` : `La API respondió HTTP ${resp.status}.`,
      credit:
        used !== null && limit !== null
          ? { label: "Créditos usados", value: `${used.toFixed(2)} / ${limit.toFixed(0)} (${pct?.toFixed(1) ?? "?"}%)` }
          : undefined,
    };
  } catch (err) {
    return {
      key: "cloudinary",
      name: "Cloudinary (hosting de videos/imágenes)",
      category: "infraestructura",
      configured: true,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkInstagram(): Promise<ServiceStatus> {
  const db = getAdminDb();
  if (!db) {
    return {
      key: "instagram",
      name: "Instagram (publicación de reels)",
      category: "publicacion",
      configured: false,
      ok: null,
      detail: "Firebase Admin SDK no disponible.",
    };
  }
  const token = await getInstagramAccessToken(db);
  if (!token) {
    return {
      key: "instagram",
      name: "Instagram (publicación de reels)",
      category: "publicacion",
      configured: false,
      ok: null,
      detail: "Falta INSTAGRAM_ACCESS_TOKEN.",
    };
  }
  try {
    const stored = await getStoredInstagramToken(db);
    const resp = await fetch(`https://graph.facebook.com/v21.0/me?fields=id&access_token=${token}`);
    let detail = resp.ok ? "Token válido." : `La API respondió HTTP ${resp.status}.`;
    if (stored?.expiresAt) {
      const daysLeft = Math.round((stored.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      detail += ` Vence en ~${daysLeft} día(s) (se renueva solo con el cron diario).`;
    }
    return { key: "instagram", name: "Instagram (publicación de reels)", category: "publicacion", configured: true, ok: resp.ok, detail };
  } catch (err) {
    return {
      key: "instagram",
      name: "Instagram (publicación de reels)",
      category: "publicacion",
      configured: true,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkTikTok(): Promise<ServiceStatus> {
  const configured = !!(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_OPEN_ID);
  return {
    key: "tiktok",
    name: "TikTok (publicación de reels)",
    category: "publicacion",
    configured,
    ok: configured ? null : null,
    detail: configured ? "Configurado (sin chequeo en vivo)." : "Todavía no configurado — pendiente, a propósito.",
  };
}

async function checkStripe(): Promise<ServiceStatus> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { key: "stripe", name: "Stripe (pagos)", category: "pagos", configured: false, ok: null, detail: "Falta STRIPE_SECRET_KEY." };
  }
  try {
    const resp = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}` },
    });
    const data = await resp.json();
    const available = Array.isArray(data?.available) ? data.available : [];
    const totals = available.map((a: { amount: number; currency: string }) => `${(a.amount / 100).toFixed(2)} ${a.currency.toUpperCase()}`);
    return {
      key: "stripe",
      name: "Stripe (pagos)",
      category: "pagos",
      configured: true,
      ok: resp.ok,
      detail: resp.ok ? `Modo ${data.livemode ? "live" : "test"}.` : `La API respondió HTTP ${resp.status}.`,
      credit: totals.length ? { label: "Balance disponible", value: totals.join(", ") } : undefined,
    };
  } catch (err) {
    return { key: "stripe", name: "Stripe (pagos)", category: "pagos", configured: true, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkMercadoPago(): Promise<ServiceStatus> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    return {
      key: "mercadopago",
      name: "MercadoPago (pagos)",
      category: "pagos",
      configured: false,
      ok: null,
      detail: "Falta MERCADOPAGO_ACCESS_TOKEN.",
    };
  }
  try {
    const resp = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    return {
      key: "mercadopago",
      name: "MercadoPago (pagos)",
      category: "pagos",
      configured: true,
      ok: resp.ok,
      detail: resp.ok ? `Cuenta: ${data.nickname || data.id}.` : `La API respondió HTTP ${resp.status}.`,
    };
  } catch (err) {
    return {
      key: "mercadopago",
      name: "MercadoPago (pagos)",
      category: "pagos",
      configured: true,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkTelegram(): Promise<ServiceStatus> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      key: "telegram",
      name: "Telegram (notificaciones)",
      category: "infraestructura",
      configured: false,
      ok: null,
      detail: "Falta TELEGRAM_BOT_TOKEN.",
    };
  }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await resp.json();
    return {
      key: "telegram",
      name: "Telegram (notificaciones)",
      category: "infraestructura",
      configured: true,
      ok: !!data.ok,
      detail: data.ok ? `Bot @${data.result?.username}.` : "Token inválido.",
    };
  } catch (err) {
    return {
      key: "telegram",
      name: "Telegram (notificaciones)",
      category: "infraestructura",
      configured: true,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkCronJobOrg(): Promise<ServiceStatus> {
  const apiKey = process.env.CRONJOB_ORG_API_KEY;
  if (!apiKey) {
    return {
      key: "cronjoborg",
      name: "cron-job.org (disparador del scheduler)",
      category: "infraestructura",
      configured: false,
      ok: null,
      detail: "Falta CRONJOB_ORG_API_KEY.",
    };
  }
  try {
    const resp = await fetch("https://api.cron-job.org/jobs", { headers: { Authorization: `Bearer ${apiKey}` } });
    const data = await resp.json();
    const job = Array.isArray(data?.jobs) ? data.jobs[0] : null;
    if (!resp.ok || !job) {
      return {
        key: "cronjoborg",
        name: "cron-job.org (disparador del scheduler)",
        category: "infraestructura",
        configured: true,
        ok: false,
        detail: resp.ok ? "No se encontró ningún job configurado." : `La API respondió HTTP ${resp.status}.`,
      };
    }
    const lastOk = job.lastStatus === 1;
    const lastExecution = job.lastExecution ? new Date(job.lastExecution * 1000).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : null;
    return {
      key: "cronjoborg",
      name: "cron-job.org (disparador del scheduler)",
      category: "infraestructura",
      configured: true,
      ok: job.enabled && lastOk,
      detail: !job.enabled
        ? "El job está desactivado en cron-job.org."
        : lastExecution
          ? `${lastOk ? "OK" : "Con errores"} — última corrida: ${lastExecution} (hora España).`
          : "Activo, todavía sin ejecuciones.",
    };
  } catch (err) {
    return {
      key: "cronjoborg",
      name: "cron-job.org (disparador del scheduler)",
      category: "infraestructura",
      configured: true,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Chequea en vivo el estado de cada servicio externo que usa FitPlan AI, y
 * el crédito/balance restante en los que son pagos por uso (HeyGen,
 * Cloudinary, Stripe). Cada check está aislado (nunca tira excepción hacia
 * afuera) para que un servicio caído no rompa el resto del panel.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const services = await Promise.all([
    checkFirebase(),
    checkOpenAI(),
    checkHeygen(),
    checkCloudinary(),
    checkInstagram(),
    checkTikTok(),
    checkStripe(),
    checkMercadoPago(),
    checkTelegram(),
    checkCronJobOrg(),
  ]);

  return res.status(200).json({ ok: true, checkedAt: new Date().toISOString(), services });
}
