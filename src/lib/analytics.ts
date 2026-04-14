import { getAttributionForEvent } from "@/lib/attribution";
import { readConsent } from "@/lib/consent";

export type AnalyticsEventName =
  | "page_view"
  | "view_content"
  | "lead"
  | "begin_checkout"
  | "purchase";

export type AnalyticsParams = Record<string, string | number | boolean | undefined>;
type ServerConversionUser = { email?: string };
type TrackOptions = { sendServer?: boolean; user?: ServerConversionUser };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: {
      track?: (event: string, payload?: Record<string, unknown>) => void;
      page?: () => void;
    };
  }
}

const GA4_EVENT_MAP: Record<AnalyticsEventName, string> = {
  page_view: "page_view",
  view_content: "view_content",
  lead: "generate_lead",
  begin_checkout: "begin_checkout",
  purchase: "purchase",
};

const META_EVENT_MAP: Record<AnalyticsEventName, string> = {
  page_view: "PageView",
  view_content: "ViewContent",
  lead: "Lead",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
};

const TIKTOK_EVENT_MAP: Record<AnalyticsEventName, string> = {
  page_view: "PageView",
  view_content: "ViewContent",
  lead: "SubmitForm",
  begin_checkout: "InitiateCheckout",
  purchase: "CompletePayment",
};

export function trackEvent(event: AnalyticsEventName, params: AnalyticsParams = {}, options: TrackOptions = {}): void {
  if (typeof window === "undefined") return;

  const consent = readConsent();
  const hasAnalyticsConsent = consent.analytics === true;
  const hasAdsConsent = consent.ads === true;

  if (!hasAnalyticsConsent && event !== "page_view") {
    return;
  }

  const attribution = getAttributionForEvent();
  const normalizedParams = Object.fromEntries(
    Object.entries({ ...params, ...attribution }).filter(([, value]) => value !== undefined),
  );

  if (window.gtag && hasAnalyticsConsent) {
    window.gtag("event", GA4_EVENT_MAP[event], normalizedParams);
  }

  if (window.fbq && hasAdsConsent) {
    window.fbq("track", META_EVENT_MAP[event], normalizedParams);
  }

  if (window.ttq?.track && hasAdsConsent) {
    window.ttq.track(TIKTOK_EVENT_MAP[event], normalizedParams);
  }

  if (options.sendServer && hasAdsConsent) {
    void fetch("/api/marketing/conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        params: normalizedParams,
        user: options.user,
        eventId:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      }),
    }).catch(() => {
      // ignore network errors for non-blocking telemetry
    });
  }
}

