import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "@/components/Navbar";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient } from "@/lib/adminAuthClient";
import { FaArrowLeft } from "react-icons/fa";

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
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "users" | "payments" | "fatigue" | "risk" | "emails">("all");
  const [searchQuery, setSearchQuery] = useState("");

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
    const load = async () => {
      if (!allowed || !authUser) return;
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/activityHistory?adminUserId=${authUser.uid}`);
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
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-200" />
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white/90"
        >
          <FaArrowLeft className="text-xs" />
          Volver al panel
        </Link>

        <div className="mb-5 rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-[#0b1e37] via-[#0f2847] to-[#0f3d3a] p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/90">Admin · Historial</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Actividad y notificaciones</h1>
          <p className="mt-1 text-sm text-white/65">Registro completo de eventos recientes, agrupado por fecha y hora.</p>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
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
                    ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100"
                    : "border-white/15 bg-white/5 text-white/70 hover:text-white"
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
            className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-cyan-500/45"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            Cargando historial...
          </div>
        ) : Object.keys(groupedByDay).length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No hay resultados para los filtros aplicados.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedByDay).map(([dayKey, dayItems]) => (
              <section key={dayKey} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/85">{dayKey}</p>
                <div className="space-y-2">
                  {dayItems.map((item) => {
                    const date = item.createdAt ? new Date(item.createdAt) : null;
                    const hour = date
                      ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
                      : "--:--";
                    return (
                      <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{hour}</p>
                          <p className="text-[11px] uppercase tracking-wide text-cyan-200/85">
                            {item.label}
                            {item.provider ? ` · ${item.provider}` : ""}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-white/90">
                          {item.userName || item.userEmail || "Usuario"} · {item.message}
                        </p>
                        {(typeof item.amount === "number" || item.currency) && (
                          <p className="mt-1 text-xs text-white/60">
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
      </div>
    </div>
  );
}
