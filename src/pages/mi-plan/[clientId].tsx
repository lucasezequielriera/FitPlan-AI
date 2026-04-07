import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import IntakeClientPlanPublicView, { type PublicIntakePlanDetail } from "@/components/IntakeClientPlanPublicView";

type ApiPayload = {
  clientName: string | null;
  plan: PublicIntakePlanDetail & {
    nutritionTargets?: Record<string, unknown> | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    intakeClientId?: string | null;
  };
};

export default function MiPlanIntakePage() {
  const router = useRouter();
  const { clientId } = router.query;
  const publicClientId = typeof clientId === "string" ? clientId : "";
  const publicToken = typeof router.query.t === "string" ? router.query.t : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiPayload | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const id = typeof clientId === "string" ? clientId : "";
    const token = typeof router.query.t === "string" ? router.query.t : "";
    if (!id || !token) {
      setLoading(false);
      setError("Falta el enlace completo (incluye el token al final).");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await fetch(
          `/api/public/intake-client-plan?clientId=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`
        );
        const json = (await res.json().catch(() => ({}))) as ApiPayload & { error?: string };
        if (!res.ok) {
          throw new Error(typeof json.error === "string" ? json.error : `Error ${res.status}`);
        }
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo cargar el plan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, clientId, router.query.t]);

  const title = data?.clientName ? `Mi plan · ${data.clientName}` : "Mi plan · FitPlan";

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white">
        <header className="border-b border-white/10 bg-black/20 px-4 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <p className="text-lg font-semibold bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              FitPlan
            </p>
            <p className="text-xs text-white/50">Tu nutrición y entrenamiento</p>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-10 w-10 rounded-full border-2 border-cyan-400/40 border-t-cyan-200 animate-spin" />
              <p className="text-sm text-white/60">Cargando tu plan…</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
          ) : data?.plan ? (
            <>
              <h1 className="text-2xl font-bold text-white mb-1">
                Hola{data.clientName ? `, ${data.clientName.split(" ")[0]}` : ""}
              </h1>
              <p className="text-sm text-white/60 mb-6">Aquí tienes tu plan actual. Puedes volver a esta página cuando quieras.</p>
              <IntakeClientPlanPublicView
                clientName={data.clientName}
                plan={data.plan}
                clientId={publicClientId}
                viewToken={publicToken}
              />
            </>
          ) : (
            <p className="text-white/60 text-sm">No hay datos.</p>
          )}
        </main>
      </div>
    </>
  );
}
