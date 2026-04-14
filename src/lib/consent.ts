export type ConsentPreferences = {
  analytics: boolean;
  ads: boolean;
  updatedAt: number;
};

export const CONSENT_STORAGE_KEY = "fitplan:consent:v1";
export const CONSENT_CHANGED_EVENT = "fitplan:consent-changed";

export const DEFAULT_CONSENT: ConsentPreferences = {
  analytics: false,
  ads: false,
  updatedAt: 0,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readConsent(): ConsentPreferences {
  if (!isBrowser()) return DEFAULT_CONSENT;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return DEFAULT_CONSENT;
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
    return {
      analytics: parsed.analytics === true,
      ads: parsed.ads === true,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return DEFAULT_CONSENT;
  }
}

export function hasConsentDecision(): boolean {
  return readConsent().updatedAt > 0;
}

export function writeConsent(next: Pick<ConsentPreferences, "analytics" | "ads">): ConsentPreferences {
  const payload: ConsentPreferences = {
    analytics: next.analytics,
    ads: next.ads,
    updatedAt: Date.now(),
  };
  if (!isBrowser()) return payload;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: payload }));
  } catch {
    // ignore write errors
  }
  return payload;
}

