import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";

type Body = {
  event?: "lead" | "begin_checkout" | "purchase";
  params?: Record<string, string | number | boolean>;
  user?: { email?: string };
  eventId?: string;
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function getClientIp(req: NextApiRequest): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.socket.remoteAddress;
}

function getMetaEventName(event: NonNullable<Body["event"]>): string {
  if (event === "lead") return "Lead";
  if (event === "begin_checkout") return "InitiateCheckout";
  return "Purchase";
}

function getTikTokEventName(event: NonNullable<Body["event"]>): string {
  if (event === "lead") return "SubmitForm";
  if (event === "begin_checkout") return "InitiateCheckout";
  return "CompletePayment";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = (req.body || {}) as Body;
  if (!body.event) return res.status(400).json({ error: "Missing event" });

  const eventId = body.eventId || crypto.randomUUID();
  const nowUnix = Math.floor(Date.now() / 1000);
  const url = typeof body.params?.page_location === "string" ? body.params.page_location : undefined;
  const userAgent = req.headers["user-agent"] || "";
  const clientIp = getClientIp(req);

  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const metaToken = process.env.META_CONVERSIONS_API_TOKEN;
  const tikTokPixelId = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  const tikTokToken = process.env.TIKTOK_EVENTS_API_ACCESS_TOKEN;

  const tasks: Promise<unknown>[] = [];

  if (metaPixelId && metaToken) {
    const payload = {
      data: [
        {
          event_name: getMetaEventName(body.event),
          event_time: nowUnix,
          event_id: eventId,
          action_source: "website",
          event_source_url: url,
          user_data: {
            client_user_agent: userAgent,
            client_ip_address: clientIp,
            ...(body.user?.email ? { em: [sha256(body.user.email)] } : {}),
          },
          custom_data: body.params || {},
        },
      ],
    };
    tasks.push(
      fetch(`https://graph.facebook.com/v19.0/${metaPixelId}/events?access_token=${metaToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }

  if (tikTokPixelId && tikTokToken) {
    const payload = {
      event_source: "web",
      event_source_id: tikTokPixelId,
      data: [
        {
          event: getTikTokEventName(body.event),
          event_id: eventId,
          timestamp: nowUnix,
          context: {
            page: { url },
            user: {
              external_id: body.user?.email ? sha256(body.user.email) : undefined,
            },
            ip: clientIp,
            user_agent: userAgent,
          },
          properties: body.params || {},
        },
      ],
    };
    tasks.push(
      fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": tikTokToken,
        },
        body: JSON.stringify(payload),
      }),
    );
  }

  try {
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
    return res.status(200).json({ ok: true, sent: tasks.length, eventId });
  } catch (error) {
    return res.status(200).json({ ok: false, error: error instanceof Error ? error.message : "Unknown error", eventId });
  }
}

