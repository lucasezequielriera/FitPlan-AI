import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import IntakeClientPlanPublicView, { type PublicIntakePlanDetail } from "@/components/IntakeClientPlanPublicView";

type ApiPayload = {
  clientName: string | null;
  checkinRequest?: {
    active?: boolean;
    note?: string | null;
  };
  weightRequest?: {
    active?: boolean;
  };
  latestWeightKg?: number | null;
  latestWeightAt?: string | null;
  latestWellnessCheckinAt?: string | null;
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
  const [wellnessOpen, setWellnessOpen] = useState(false);
  const [savingWellness, setSavingWellness] = useState(false);
  const [wellnessError, setWellnessError] = useState<string | null>(null);
  const [wellnessDraft, setWellnessDraft] = useState({
    energia: 3,
    sueno: 3,
    hambre: 3,
    dolor: 2,
    estres: 3,
    motivacion: 3,
    notas: "",
  });
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightKgDraft, setWeightKgDraft] = useState("");
  const [weightNoteDraft, setWeightNoteDraft] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
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
  useEffect(() => {
    if (data?.checkinRequest?.active) {
      setWellnessOpen(true);
      setWellnessError(null);
    }
  }, [data?.checkinRequest?.active]);
  useEffect(() => {
    if (data?.weightRequest?.active) {
      setWeightOpen(true);
      setWeightError(null);
      setWeightKgDraft(data.latestWeightKg ? String(data.latestWeightKg) : "");
    }
  }, [data?.weightRequest?.active, data?.latestWeightKg]);

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

  const submitWellnessCheckin = async () => {
    if (!publicClientId || !publicToken) return;
    setSavingWellness(true);
    setWellnessError(null);
    try {
      const response = await fetch(
        `/api/public/intake-client-checkin?clientId=${encodeURIComponent(publicClientId)}&t=${encodeURIComponent(publicToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wellnessDraft),
        }
      );
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : `Error ${response.status}`);
      setData((prev) =>
        prev
          ? {
              ...prev,
              checkinRequest: { ...(prev.checkinRequest || {}), active: false },
              latestWellnessCheckinAt: new Date().toISOString(),
            }
          : prev
      );
      setWellnessOpen(false);
    } catch (e) {
      setWellnessError(e instanceof Error ? e.message : "No se pudo guardar el check-in");
    } finally {
      setSavingWellness(false);
    }
  };

  const submitWeight = async () => {
    if (!publicClientId || !publicToken) return;
    setSavingWeight(true);
    setWeightError(null);
    try {
      const response = await fetch(
        `/api/public/intake-client-weight?clientId=${encodeURIComponent(publicClientId)}&t=${encodeURIComponent(publicToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weightKg: Number(weightKgDraft.replace(",", ".")),
            note: weightNoteDraft,
          }),
        }
      );
      const json = (await response.json().catch(() => ({}))) as { error?: string; weightKg?: number };
      if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : `Error ${response.status}`);
      setData((prev) =>
        prev
          ? {
              ...prev,
              weightRequest: { ...(prev.weightRequest || {}), active: false },
              latestWeightKg: typeof json.weightKg === "number" ? json.weightKg : prev.latestWeightKg ?? null,
              latestWeightAt: new Date().toISOString(),
            }
          : prev
      );
      setWeightOpen(false);
    } catch (e) {
      setWeightError(e instanceof Error ? e.message : "No se pudo guardar el peso");
    } finally {
      setSavingWeight(false);
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
              <div className="h-10 w-10 rounded-full border-2 border-[var(--info)]/40 border-t-[var(--info)] animate-spin" />
              <p className="text-sm text-white/60">Cargando tu plan…</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
          ) : data?.plan ? (
            <>
              <div className="mb-3 flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">
                  Hola{data.clientName ? `, ${data.clientName.split(" ")[0]}` : ""}
                </h1>
                <button
                  onClick={openEditData}
                  className="px-3 py-1.5 rounded-lg border border-info/30 bg-info/10 text-info text-sm hover:bg-info/20 transition-colors"
                >
                  Editar Datos
                </button>
              </div>
              <p className="text-sm text-white/60 mb-6">Aquí tienes tu plan actual. Puedes volver a esta página cuando quieras.</p>
              {data.checkinRequest?.active ? (
                <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3">
                  <p className="text-sm text-warning">
                    Tu coach te pidió completar un check-in rápido de bienestar para ajustar mejor tu plan.
                  </p>
                  {data.checkinRequest.note ? (
                    <p className="text-xs text-warning/80 mt-1">Nota del coach: {data.checkinRequest.note}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setWellnessOpen(true)}
                    className="mt-2 px-3 py-1.5 rounded-lg border border-warning/40 bg-warning/20 text-warning text-xs hover:bg-warning/30"
                  >
                    Completar check-in ahora
                  </button>
                </div>
              ) : null}
              {data.weightRequest?.active ? (
                <div className="mb-4 rounded-xl border border-info/30 bg-info/10 p-3">
                  <p className="text-sm text-info">
                    Tu coach te pidió registrar tu peso actual para actualizar el seguimiento mensual.
                  </p>
                  <button
                    type="button"
                    onClick={() => setWeightOpen(true)}
                    className="mt-2 px-3 py-1.5 rounded-lg border border-info/40 bg-info/20 text-info text-xs hover:bg-info/30"
                  >
                    Registrar peso ahora
                  </button>
                </div>
              ) : null}
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
              ].map(([key, label]) => {
                const k = key as
                  | "nombre"
                  | "apellido"
                  | "email"
                  | "edad"
                  | "ciudad"
                  | "instagram"
                  | "whatsapp";
                return (
                <label key={key} className="text-sm text-white/80">
                  {label}
                  <input
                    type={key === "edad" ? "number" : "text"}
                    value={profileDraft[k]}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-white/35"
                  />
                </label>
                );
              })}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-xs text-white/75">
              <input
                type="checkbox"
                checked={profileDraft.privacyConsentAccepted}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, privacyConsentAccepted: e.target.checked }))}
              />
              Acepto el uso de estos datos para seguimiento de mi plan.
            </label>
            {profileError ? <p className="mt-3 text-sm text-danger">{profileError}</p> : null}
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
                className="flex-1 px-4 py-2 rounded-lg bg-info/25 border border-info/30 hover:bg-info/35 text-info disabled:opacity-60"
              >
                {savingProfile ? "Guardando..." : "Guardar datos"}
              </button>
            </div>
          </div>
        </div>
      )}
      {wellnessOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && !savingWellness && setWellnessOpen(false)}
        >
          <div className="w-full max-w-xl rounded-xl border border-white/10 bg-gray-900 p-5">
            <h2 className="text-lg font-semibold text-white">Check-in de bienestar</h2>
            <p className="text-xs text-white/60 mt-1">
              Te toma menos de 1 minuto. Esto ayuda a tu coach a prevenir fatiga y ajustar cargas.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["energia", "Energía"],
                ["sueno", "Sueño"],
                ["hambre", "Hambre"],
                ["dolor", "Dolor muscular/articular"],
                ["estres", "Estrés"],
                ["motivacion", "Motivación"],
              ].map(([k, label]) => {
                const key = k as "energia" | "sueno" | "hambre" | "dolor" | "estres" | "motivacion";
                return (
                  <label key={k} className="text-sm text-white/85">
                    {label} (1-5)
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={wellnessDraft[key]}
                      onChange={(e) =>
                        setWellnessDraft((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full"
                    />
                    <span className="text-xs text-white/70">Valor: {wellnessDraft[key]}</span>
                  </label>
                );
              })}
            </div>
            <label className="mt-3 block text-sm text-white/85">
              Nota opcional
              <textarea
                rows={3}
                value={wellnessDraft.notas}
                onChange={(e) => setWellnessDraft((prev) => ({ ...prev, notas: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder-white/35"
                placeholder="Ej: dormí poco por trabajo nocturno esta semana."
              />
            </label>
            {wellnessError ? <p className="mt-3 text-sm text-danger">{wellnessError}</p> : null}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setWellnessOpen(false)}
                disabled={savingWellness}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-60"
              >
                Más tarde
              </button>
              <button
                onClick={() => void submitWellnessCheckin()}
                disabled={savingWellness}
                className="flex-1 px-4 py-2 rounded-lg bg-success/25 border border-success/30 hover:bg-success/35 text-success disabled:opacity-60"
              >
                {savingWellness ? "Guardando..." : "Enviar check-in"}
              </button>
            </div>
          </div>
        </div>
      )}
      {weightOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && !savingWeight && setWeightOpen(false)}
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-gray-900 p-5">
            <h2 className="text-lg font-semibold text-white">Registrar peso</h2>
            <p className="text-xs text-white/60 mt-1">Este dato se guarda para ver tu evolución en el tiempo.</p>
            <label className="mt-4 block text-sm text-white/85">
              Peso actual (kg)
              <input
                type="number"
                step="0.1"
                min="30"
                max="350"
                value={weightKgDraft}
                onChange={(e) => setWeightKgDraft(e.target.value)}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
            </label>
            <label className="mt-3 block text-sm text-white/85">
              Nota (opcional)
              <textarea
                rows={2}
                value={weightNoteDraft}
                onChange={(e) => setWeightNoteDraft(e.target.value)}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                placeholder="Ej: semana con menos sueño, retención de líquidos, etc."
              />
            </label>
            {weightError ? <p className="mt-3 text-sm text-danger">{weightError}</p> : null}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setWeightOpen(false)}
                disabled={savingWeight}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-60"
              >
                Más tarde
              </button>
              <button
                onClick={() => void submitWeight()}
                disabled={savingWeight || !weightKgDraft.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-info/25 border border-info/30 hover:bg-info/35 text-info disabled:opacity-60"
              >
                {savingWeight ? "Guardando..." : "Guardar peso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
