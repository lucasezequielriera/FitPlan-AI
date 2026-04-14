import type { PlanAIResponse, UserInput, PlanMultiFase } from "@/types/plan";
import type { SavedPlan } from "@/types/savedPlan";

const PLAN_CACHE_PREFIX = "fitplan:last-plan:";
const DASHBOARD_PLANS_CACHE_PREFIX = "fitplan:dashboard-plans:";

type CachedPlanSnapshot = {
  savedAt: string;
  planId: string;
  user: UserInput;
  plan: PlanAIResponse;
  planMultiFase?: PlanMultiFase;
  planCreatedAt?: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadCachedPlanSnapshot(userId: string): CachedPlanSnapshot | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(`${PLAN_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedPlanSnapshot;
  } catch (error) {
    console.warn("No se pudo leer caché local del plan:", error);
    return null;
  }
}

export function saveCachedPlanSnapshot(userId: string, payload: Omit<CachedPlanSnapshot, "savedAt">): void {
  if (!isBrowser()) return;
  try {
    const record: CachedPlanSnapshot = {
      ...payload,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${PLAN_CACHE_PREFIX}${userId}`, JSON.stringify(record));
  } catch (error) {
    console.warn("No se pudo guardar caché local del plan:", error);
  }
}

export function loadCachedDashboardPlans(userId: string): SavedPlan[] | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(`${DASHBOARD_PLANS_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedPlan[]) : null;
  } catch (error) {
    console.warn("No se pudo leer caché local de dashboard:", error);
    return null;
  }
}

export function saveCachedDashboardPlans(userId: string, plans: SavedPlan[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(`${DASHBOARD_PLANS_CACHE_PREFIX}${userId}`, JSON.stringify(plans));
  } catch (error) {
    console.warn("No se pudo guardar caché local de dashboard:", error);
  }
}
