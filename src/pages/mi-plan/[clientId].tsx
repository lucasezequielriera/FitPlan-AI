import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import IntakeClientPlanPublicView, { type PublicIntakePlanDetail } from "@/components/IntakeClientPlanPublicView";

type ApiPayload = {
  clientName: string | null;
  profile?: {
    nombre?: string | null;
    apellido?: string | null;
    email?: string | null;
    edad?: number | null;
    ciudad?: string | null;
    instagram?: string | null;
    whatsapp?: string | null;
    privacyConsentAccepted?: boolean | null;
  };
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
  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    nombre: "",
    apellido: "",
    email: "",
    edad: "",
    ciudad: "",
    instagram: "",
    whatsapp: "",
    privacyConsentAccepted: false,
  });

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
  const openEditData = () => {
    const p = data?.profile;
    setProfileError(null);
    setProfileDraft({
      nombre: p?.nombre || "",
      apellido: p?.apellido || "",
      email: p?.email || "",
      edad: typeof p?.edad === "number" ? String(p.edad) : "",
      ciudad: p?.ciudad || "",
      instagram: p?.instagram || "",
      whatsapp: p?.whatsapp || "",
      privacyConsentAccepted: p?.privacyConsentAccepted === true,
    });
    setEditOpen(true);
  };
  const saveProfile = async () => {
    if (!publicClientId || !publicToken) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      const response = await fetch(
        `/api/public/intake-client-profile?clientId=${encodeURIComponent(publicClientId)}&t=${encodeURIComponent(publicToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...profileDraft,
            edad: profileDraft.edad.trim() ? Number(profileDraft.edad) : null,
          }),
        }
      );
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        profile?: ApiPayload["profile"];
      };
      if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : `Error ${response.status}`);
      setData((prev) => {
        if (!prev) return prev;
        const nextName = [json.profile?.nombre, json.profile?.apellido].filter(Boolean).join(" ").trim() || prev.clientName;
        return {
          ...prev,
          clientName: nextName,
          profile: {
            ...prev.profile,
            ...json.profile,
          },
        };
      });
      setEditOpen(false);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "No se pudieron guardar los datos");
    } finally {
      setSavingProfile(false);
    }
  };

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
              <div className="mb-3 flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">
                  Hola{data.clientName ? `, ${data.clientName.split(" ")[0]}` : ""}
                </h1>
                <button
                  onClick={openEditData}
                  className="px-3 py-1.5 rounded-lg border border-cyan-300/30 bg-cyan-500/10 text-cyan-200 text-sm hover:bg-cyan-500/20 transition-colors"
                >
                  Editar Datos
                </button>
              </div>
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
      {editOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && !savingProfile && setEditOpen(false)}>
          <div className="w-full max-w-xl rounded-xl border border-white/10 bg-gray-900 p-5">
            <h2 className="text-lg font-semibold text-white">Editar datos esenciales</h2>
            <p className="text-xs text-white/60 mt-1">Estos datos no cambian tu plan. Solo mantienen tu perfil correcto.</p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["nombre", "Nombre"],
                ["apellido", "Apellido"],
                ["email", "Email"],
                ["edad", "Edad"],
                ["ciudad", "Ciudad"],
                ["instagram", "Instagram"],
                ["whatsapp", "WhatsApp"],
              ].map(([key, label]) => (
                <label key={key} className="text-sm text-white/80">
                  {label}
                  <input
                    type={key === "edad" ? "number" : "text"}
                    value={profileDraft[key as keyof typeof profileDraft]}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-white/35"
                  />
                </label>
              ))}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-xs text-white/75">
              <input
                type="checkbox"
                checked={profileDraft.privacyConsentAccepted}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, privacyConsentAccepted: e.target.checked }))}
              />
              Acepto el uso de estos datos para seguimiento de mi plan.
            </label>
            {profileError ? <p className="mt-3 text-sm text-red-300">{profileError}</p> : null}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setEditOpen(false)}
                disabled={savingProfile}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={() => void saveProfile()}
                disabled={savingProfile}
                className="flex-1 px-4 py-2 rounded-lg bg-cyan-500/25 border border-cyan-300/30 hover:bg-cyan-500/35 text-cyan-100 disabled:opacity-60"
              >
                {savingProfile ? "Guardando..." : "Guardar datos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
