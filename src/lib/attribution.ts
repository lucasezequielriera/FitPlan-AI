const ATTRIBUTION_KEY = "fitplan:attribution:v1";

type AttributionPayload = {
  firstTouch: Record<string, string>;
  lastTouch: Record<string, string>;
  firstSeenAt: number;
  lastSeenAt: number;
};

const TRACKED_QUERY_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "ttclid"] as const;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function toRecord(searchParams: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of TRACKED_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) out[key] = value;
  }
  return out;
}

export function persistAttributionFromUrl(rawUrl: string, referrer?: string): void {
  if (!isBrowser()) return;
  try {
    const url = new URL(rawUrl);
    const touch = toRecord(url.searchParams);
    if (referrer) {
      touch.referrer = referrer;
    }
    touch.landing_path = `${url.pathname}${url.search || ""}`;
    if (Object.keys(touch).length === 0) return;

    const existing = readAttribution();
    if (!existing) {
      const now = Date.now();
      const payload: AttributionPayload = {
        firstTouch: touch,
        lastTouch: touch,
        firstSeenAt: now,
        lastSeenAt: now,
      };
      window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(payload));
      return;
    }

    const updated: AttributionPayload = {
      ...existing,
      lastTouch: { ...existing.lastTouch, ...touch },
      lastSeenAt: Date.now(),
    };
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(updated));
  } catch {
    // ignore URL or storage errors
  }
}

export function readAttribution(): AttributionPayload | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AttributionPayload;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getAttributionForEvent(): Record<string, string> {
  const existing = readAttribution();
  if (!existing) return {};
  return {
    ...existing.firstTouch,
    ...existing.lastTouch,
  };
}

