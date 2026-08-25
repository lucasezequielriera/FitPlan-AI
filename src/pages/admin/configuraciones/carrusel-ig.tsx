import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient, adminFetch } from "@/lib/adminAuthClient";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSubTabs } from "@/components/admin/AdminSubTabs";
import { useAdminFadeUp } from "@/components/admin/adminMotion";
import { FaMagic, FaPaperPlane, FaClock, FaTimes, FaPlus, FaTrash } from "react-icons/fa";

const MADRID_TZ = "Europe/Madrid";

function offsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MADRID_TZ,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - date.getTime()) / 60000;
}

/** Convierte un <input type="datetime-local"> (hora de Madrid) a ISO UTC. */
function madridLocalToUtcIso(value: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const guess = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm)));
  const off = offsetMinutes(guess);
  return new Date(guess.getTime() - off * 60000).toISOString();
}

function formatMadrid(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: MADRID_TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

type Draft = {
  draftId: string;
  topic: string;
  imageUrls: string[];
  caption: string;
  slideCount: number;
};

const MIN_SLIDES = 3;
const MAX_SLIDES = 10;

export default function AdminCarruselIgPage() {
  const router = useRouter();
  const fadeUp = useAdminFadeUp();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [scheduleFor, setScheduleFor] = useState("");
  const [scheduledIso, setScheduledIso] = useState<string | null>(null);

  const [priceLabel, setPriceLabel] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [autoTimes, setAutoTimes] = useState<string[]>([]);
  const [autoSlides, setAutoSlides] = useState(5);
  const [autoLoading, setAutoLoading] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (authLoading) return;
      if (!authUser) { router.replace("/"); return; }
      const ok = await getIsAdminClient();
      setAllowed(ok);
      setChecking(false);
      if (!ok) router.replace("/");
    };
    void run();
  }, [authUser, authLoading, router]);

  useEffect(() => {
    if (!allowed) return;
    const load = async () => {
      try {
        const resp = await adminFetch("/api/admin/carouselSchedule");
        const data = await resp.json();
        if (resp.ok) {
          setAutoEnabled(data.enabled);
          setAutoTimes(data.timesLocal || []);
          setAutoSlides(data.slideCount || 5);
          // El precio configurado para los automáticos es también el valor de
          // partida al generar a mano, para que ambos digan lo mismo.
          setPriceLabel(data.priceLabel || "");
        }
      } catch {
        // Silencioso: la generación manual funciona igual sin esta config.
      } finally {
        setAutoLoading(false);
      }
    };
    void load();
  }, [allowed]);

  const handleSaveAuto = async () => {
    setAutoSaving(true);
    setError(null);
    setAutoSaved(false);
    try {
      const resp = await adminFetch("/api/admin/carouselSchedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: autoEnabled,
          timesLocal: autoTimes.filter(Boolean),
          slideCount: autoSlides,
          priceLabel: priceLabel.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo guardar");
      setAutoSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar la configuración");
    } finally {
      setAutoSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setNotice(null);
    setDraft(null);
    setScheduledIso(null);
    try {
      const resp = await adminFetch("/api/admin/carouselGenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sin tema, lo elige la IA.
        body: JSON.stringify({ topic: topic.trim() || undefined, slideCount, priceLabel: priceLabel.trim() || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || data.error || "No se pudo generar el carrusel");
      setDraft(data);
      if (!topic.trim()) setTopic(data.topic);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el carrusel");
    } finally {
      setGenerating(false);
    }
  };

  const callPublish = async (body: Record<string, unknown>, okMessage: string) => {
    if (!draft) return;
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const resp = await adminFetch("/api/admin/carouselPublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.draftId, ...body }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || data.error || data.instagram?.message || "No se pudo completar");
      setNotice(okMessage);
      setScheduledIso(data.status === "scheduled" ? data.scheduledFor : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedule = () => {
    const iso = madridLocalToUtcIso(scheduleFor);
    if (!iso) { setError("Elige una fecha y hora válidas"); return; }
    void callPublish({ scheduledFor: iso }, "Carrusel programado ✅");
  };

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }
  if (!allowed) return null;

  return (
    <AdminShell active="contenido">
      <motion.div {...fadeUp}>
        <AdminPageHeader
          kicker="Contenido"
          title="Generador de contenido"
          subtitle="Carruseles de imágenes para Instagram con el formato de marca."
        />
        <AdminSubTabs
          tabs={[
            { label: "Generador", href: "/admin/configuraciones/contenido-social", active: false },
            { label: "Carrusel IG", href: "/admin/configuraciones/carrusel-ig", active: true },
            { label: "Métricas", href: "/admin/metricas-rs", active: false },
          ]}
        />

        {error && <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
        {notice && <div className="mt-6 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{notice}</div>}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5 mt-6 space-y-4">
          <div>
            <label htmlFor="topic" className="block text-sm text-white/75 mb-1.5">Tema del carrusel</label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Déjalo vacío y lo elige la IA"
              className="w-full rounded-lg bg-black/25 border border-white/15 px-3 py-2.5 text-sm text-white outline-none focus:border-info/50"
            />
            <p className="text-xs text-white/40 mt-1.5">
              Cuanto más específico, mejor. &ldquo;Por qué la báscula no mide tu progreso&rdquo; funciona mucho mejor que &ldquo;nutrición&rdquo;.
            </p>
          </div>

          <div>
            <label htmlFor="count" className="block text-sm text-white/75 mb-1.5">
              Número de diapositivas: <span className="tabular-nums text-white">{slideCount}</span>
            </label>
            <input
              id="count"
              type="range"
              min={MIN_SLIDES}
              max={MAX_SLIDES}
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-white/35">
              <span>{MIN_SLIDES} mín.</span>
              <span>{MAX_SLIDES} máx. (límite de Instagram)</span>
            </div>
          </div>

          <div>
            <label htmlFor="price" className="block text-sm text-white/75 mb-1.5">Texto de precio (última diapositiva)</label>
            <input
              id="price"
              type="text"
              value={priceLabel}
              onChange={(e) => setPriceLabel(e.target.value)}
              maxLength={60}
              placeholder="Premium desde 2,08 €/mes"
              className="w-full rounded-lg bg-black/25 border border-white/15 px-3 py-2.5 text-sm text-white outline-none focus:border-info/50"
            />
            <p className="text-xs text-white/40 mt-1.5">
              Tiene que coincidir con lo que se cobra en el checkout. Un precio publicado que no cuadra genera disputas de cobro y reseñas negativas.
            </p>
          </div>

          <button type="button" onClick={handleGenerate} disabled={generating} className="btn btn-primary disabled:opacity-50">
            <FaMagic className={generating ? "animate-pulse" : ""} />
            {generating ? "Generando… (puede tardar ~1 min)" : "Generar carrusel"}
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5 mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 border border-warning/25 text-warning">
              <FaClock />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Carruseles automáticos</h2>
              <p className="text-sm text-white/50">Se generan y publican solos a estas horas (hora España), con tema elegido por la IA.</p>
            </div>
          </div>

          {autoLoading ? (
            <p className="text-sm text-white/50">Cargando…</p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={autoEnabled}
                  onChange={(e) => { setAutoEnabled(e.target.checked); setAutoSaved(false); }}
                  className="h-4 w-4"
                />
                Publicación automática activada
              </label>

              <div className="space-y-2">
                {autoTimes.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={t}
                      onChange={(e) => {
                        setAutoTimes((prev) => prev.map((x, j) => (j === i ? e.target.value : x)));
                        setAutoSaved(false);
                      }}
                      className="rounded-lg bg-black/25 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-warning/50"
                    />
                    <span className="text-xs text-white/40">hora España</span>
                    <button
                      type="button"
                      onClick={() => { setAutoTimes((prev) => prev.filter((_, j) => j !== i)); setAutoSaved(false); }}
                      className="ml-auto p-2 rounded-lg text-danger/90 hover:bg-danger/15"
                      title="Quitar horario"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                  </div>
                ))}
                {autoTimes.length === 0 && (
                  <p className="text-sm text-white/40">Sin horarios: no se publicará ningún carrusel automático.</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => { setAutoTimes((prev) => [...prev, "09:30"]); setAutoSaved(false); }}
                className="btn btn-secondary text-sm"
              >
                <FaPlus className="text-xs" />
                Agregar horario
              </button>

              <div>
                <label htmlFor="autoCount" className="block text-sm text-white/75 mb-1.5">
                  Diapositivas por carrusel automático: <span className="tabular-nums text-white">{autoSlides}</span>
                </label>
                <input
                  id="autoCount"
                  type="range"
                  min={MIN_SLIDES}
                  max={MAX_SLIDES}
                  value={autoSlides}
                  onChange={(e) => { setAutoSlides(Number(e.target.value)); setAutoSaved(false); }}
                  className="w-full accent-amber-500"
                />
              </div>

              <p className="text-xs text-white/40">
                El precio de arriba se usa también en los automáticos: al guardar aquí queda fijado para ambos.
              </p>

              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={handleSaveAuto} disabled={autoSaving} className="btn btn-primary disabled:opacity-50">
                  {autoSaving ? "Guardando…" : "Guardar configuración"}
                </button>
                {autoSaved && <span className="text-sm text-success">Guardado ✅</span>}
              </div>
            </>
          )}
        </motion.div>

        {draft && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5 mt-6 space-y-4">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-white">Previsualización</h2>
              <span className="text-xs text-white/45">{draft.slideCount} diapositivas · {draft.topic}</span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {draft.imageUrls.map((url, i) => (
                <div key={url} className="relative shrink-0">
                  <Image
                    src={url}
                    alt={`Diapositiva ${i + 1}`}
                    width={216}
                    height={270}
                    unoptimized
                    className="rounded-lg border border-white/10"
                  />
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded bg-black/70 text-white/80">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs text-white/45 mb-1.5">Pie de foto</p>
              <pre className="whitespace-pre-wrap text-sm text-white/80 bg-black/25 border border-white/10 rounded-lg p-3 max-h-56 overflow-y-auto">
                {draft.caption}
              </pre>
            </div>

            {scheduledIso ? (
              <div className="flex items-center gap-3 flex-wrap rounded-lg border border-info/30 bg-info/10 px-3 py-2.5">
                <FaClock className="text-info" />
                <span className="text-sm text-white/85">Programado para el {formatMadrid(scheduledIso)} (hora España)</span>
                <button
                  type="button"
                  onClick={() => void callPublish({ cancel: true }, "Programación cancelada")}
                  disabled={publishing}
                  className="ml-auto btn btn-secondary text-sm disabled:opacity-50"
                >
                  <FaTimes className="text-xs" />
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void callPublish({}, "Carrusel publicado en Instagram ✅")}
                  disabled={publishing}
                  className="btn btn-primary disabled:opacity-50 self-start"
                >
                  <FaPaperPlane />
                  {publishing ? "Publicando…" : "Publicar ahora"}
                </button>

                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label htmlFor="when" className="block text-xs text-white/45 mb-1.5">O programarlo (hora España)</label>
                    <input
                      id="when"
                      type="datetime-local"
                      value={scheduleFor}
                      onChange={(e) => setScheduleFor(e.target.value)}
                      className="rounded-lg bg-black/25 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-info/50"
                    />
                  </div>
                  <button type="button" onClick={handleSchedule} disabled={publishing || !scheduleFor} className="btn btn-secondary disabled:opacity-50">
                    <FaClock className="text-xs" />
                    Programar
                  </button>
                </div>
                <p className="text-xs text-white/40">
                  Los programados los publica el mismo cron que los reels, que corre cada 10 minutos.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </AdminShell>
  );
}
