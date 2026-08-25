import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient, adminFetch } from "@/lib/adminAuthClient";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSubTabs } from "@/components/admin/AdminSubTabs";
import { useAdminFadeUp } from "@/components/admin/adminMotion";

type ActivityItem = {
  id: string;
  source: "system" | "users";
  type: string;
  label: string;
  message: string;
  userName?: string;
  userEmail?: string;
  provider?: string;
  amount?: number;
  currency?: string;
  createdAt: string | null;
};

export default function AdminActividadPage() {
  const router = useRouter();
  const fadeUp = useAdminFadeUp();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "users" | "payments" | "fatigue" | "risk" | "emails">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (authLoading) return;
      if (!authUser) {
        router.replace("/");
        return;
      }
      const ok = await getIsAdminClient();
      setAllowed(ok);
      setChecking(false);
      if (!ok) router.replace("/");
    };
    void run();
  }, [authUser, authLoading, router]);

  useEffect(() => {
    if (!router.isReady || filtersInitialized) return;
    const rawCat = typeof router.query.cat === "string" ? router.query.cat : "all";
    const allowedCats = new Set(["all", "users", "payments", "fatigue", "risk", "emails"]);
    const cat = allowedCats.has(rawCat) ? (rawCat as "all" | "users" | "payments" | "fatigue" | "risk" | "emails") : "all";
    const q = typeof router.query.q === "string" ? router.query.q : "";
    setCategoryFilter(cat);
    setSearchQuery(q);
    setFiltersInitialized(true);
  }, [router.isReady, router.query.cat, router.query.q, filtersInitialized]);

  useEffect(() => {
    if (!router.isReady || !filtersInitialized) return;
    const nextQuery: Record<string, string> = {};
    if (categoryFilter !== "all") nextQuery.cat = categoryFilter;
    if (searchQuery.trim()) nextQuery.q = searchQuery.trim();

    const currentCat = typeof router.query.cat === "string" ? router.query.cat : "";
    const currentQ = typeof router.query.q === "string" ? router.query.q : "";
    const nextCat = nextQuery.cat || "";
    const nextQ = nextQuery.q || "";
    if (currentCat === nextCat && currentQ === nextQ) return;

    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true }
    );
  }, [router, router.isReady, router.pathname, router.query.cat, router.query.q, categoryFilter, searchQuery, filtersInitialized]);

  useEffect(() => {
    const load = async () => {
      if (!allowed || !authUser) return;
      try {
        setLoading(true);
        const response = await adminFetch(`/api/admin/activityHistory?adminUserId=${authUser.uid}`);
        if (!response.ok) throw new Error("No se pudo cargar el historial");
        const data = await response.json();
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [allowed, authUser]);

  const groupedByDay = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredItems = items.filter((item) => {
      const categoryMatches =
        categoryFilter === "all"
          ? true
          : categoryFilter === "users"
          ? item.type === "user_registered"
          : categoryFilter === "payments"
          ? item.type === "payment_success"
          : categoryFilter === "fatigue"
          ? item.type === "coach_alert"
          : categoryFilter === "risk"
          ? item.type === "adherence_risk_weekly"
          : item.type === "weekly_digest_sent" || item.type === "weekly_digest_failed";

      if (!categoryMatches) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        item.userName,
        item.userEmail,
        item.message,
        item.provider,
        item.label,
        item.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });

    return filteredItems.reduce<Record<string, ActivityItem[]>>((acc, item) => {
      const date = item.createdAt ? new Date(item.createdAt) : null;
      const key = date
        ? date.toLocaleDateString("es-AR", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "Sin fecha";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [items, categoryFilter, searchQuery]);

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--info)]/30 border-t-[var(--info)]" />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <AdminShell active="clientes">
      <motion.div {...fadeUp}>
        <AdminPageHeader
          kicker="Admin · Historial"
          title="Actividad y notificaciones"
          subtitle="Registro completo de eventos recientes, agrupado por fecha y hora."
        />
        <AdminSubTabs
          tabs={[
            { label: "FitPlan", href: "/admin/clientes-fitplan", active: false },
            { label: "1:1", href: "/admin/clientes-1-1", active: false },
            { label: "Actividad", href: "/admin/actividad", active: true },
          ]}
        />

        <div className="mt-5 mb-4 rounded-2xl border border-border bg-surface-2 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[
              ["all", "Todo"],
              ["users", "Usuarios"],
              ["payments", "Cobros"],
              ["fatigue", "Fatiga"],
              ["risk", "Riesgo"],
              ["emails", "Emails"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategoryFilter(id as "all" | "users" | "payments" | "fatigue" | "risk" | "emails")}
                className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                  categoryFilter === id
                    ? "border-accent/40 bg-accent/12 text-accent"
                    : "border-border bg-surface text-text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, email, tipo o contenido..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-surface-2 p-6 text-sm text-text-muted">
            Cargando historial...
          </div>
        ) : Object.keys(groupedByDay).length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface-2 p-6 text-sm text-text-muted">
            No hay resultados para los filtros aplicados.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedByDay).map(([dayKey, dayItems]) => (
              <section key={dayKey} className="rounded-2xl border border-border bg-surface-2 p-3 sm:p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{dayKey}</p>
                <div className="space-y-2">
                  {dayItems.map((item) => {
                    const date = item.createdAt ? new Date(item.createdAt) : null;
                    const hour = date
                      ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
                      : "--:--";
                    return (
                      <article key={item.id} className="rounded-xl border border-border bg-surface px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{hour}</p>
                          <p className="text-[11px] uppercase tracking-wide text-text-muted">
                            {item.label}
                            {item.provider ? ` · ${item.provider}` : ""}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-foreground">
                          {item.userName || item.userEmail || "Usuario"} · {item.message}
                        </p>
                        {(typeof item.amount === "number" || item.currency) && (
                          <p className="mt-1 text-xs text-text-muted">
                            Monto: {item.amount ?? 0} {item.currency || ""}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </motion.div>
    </AdminShell>
  );
}
