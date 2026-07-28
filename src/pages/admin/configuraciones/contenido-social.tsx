import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient, adminFetch } from "@/lib/adminAuthClient";
import Navbar from "@/components/Navbar";
import { FaArrowLeft, FaMagic, FaVideo, FaPaperPlane, FaLightbulb, FaClock, FaPlus, FaTrash } from "react-icons/fa";

// Argentina no tiene horario de verano desde 2009 (UTC-3 fijo), así que la
// conversión es una resta/suma simple sin lógica de DST.
const AR_UTC_OFFSET_HOURS = 3;

function utcToArLocal(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const localH = (h - AR_UTC_OFFSET_HOURS + 24) % 24;
  return `${String(localH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function arLocalToUtc(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const utcH = (h + AR_UTC_OFFSET_HOURS) % 24;
  return `${String(utcH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type PreviewCopy = {
  scenes: { headline: string; subtext?: string }[];
  instagramCaption: string;
  tiktokCaption: string;
  hashtags: string[];
  narration: string;
  altText: string;
};

type PreviewState = {
  draftId: string;
  videoUrl: string;
  copy: PreviewCopy;
};

type PublishResult = {
  instagram: { ok: boolean; platformPostId?: string; message?: string };
  tiktok: { ok: boolean; platformPostId?: string; message?: string };
};

export default function AdminContenidoSocialPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [topic, setTopic] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleTimesLocal, setScheduleTimesLocal] = useState<string[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);

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
    if (!allowed) return;
    const loadSchedule = async () => {
      try {
        const resp = await adminFetch("/api/admin/socialScheduleGet");
        const data = await resp.json();
        if (resp.ok) {
          setScheduleEnabled(data.enabled);
          setScheduleTimesLocal((data.timesUtc || []).map(utcToArLocal));
        }
      } catch {
        // silencioso: si falla, se muestran los defaults y el admin puede reintentar guardando
      } finally {
        setScheduleLoading(false);
      }
    };
    void loadSchedule();
  }, [allowed]);

  const handleAddTime = () => {
    setScheduleTimesLocal((prev) => [...prev, "11:00"]);
    setScheduleSaved(false);
  };

  const handleRemoveTime = (index: number) => {
    setScheduleTimesLocal((prev) => prev.filter((_, i) => i !== index));
    setScheduleSaved(false);
  };

  const handleTimeChange = (index: number, value: string) => {
    setScheduleTimesLocal((prev) => prev.map((t, i) => (i === index ? value : t)));
    setScheduleSaved(false);
  };

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    setError(null);
    setScheduleSaved(false);
    try {
      const timesUtc = scheduleTimesLocal.filter(Boolean).map(arLocalToUtc);
      const resp = await adminFetch("/api/admin/socialScheduleUpdate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: scheduleEnabled, timesUtc }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo guardar la configuración");
      setScheduleSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar la configuración de horarios");
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleSuggestTopic = async () => {
    setSuggesting(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/socialContentSuggestTopic", { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo sugerir un tema");
      setTopic(data.topic);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al sugerir tema");
    } finally {
      setSuggesting(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Escribí un tema o pedile una sugerencia a la IA primero.");
      return;
    }
    setGenerating(true);
    setError(null);
    setPreview(null);
    setPublishResult(null);
    try {
      const resp = await adminFetch("/api/admin/socialContentGeneratePreview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo generar el contenido");
      setPreview({ draftId: data.draftId, videoUrl: data.videoUrl, copy: data.copy });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el contenido");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!preview) return;
    setPublishing(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/socialContentPublishDraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: preview.draftId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo publicar");
      setPublishResult({ instagram: data.instagram, tiktok: data.tiktok });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setPublishing(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-400" />
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-8">
          <Link
            href="/admin/configuraciones"
            className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white/85 transition-colors mb-4"
          >
            <FaArrowLeft className="text-xs" />
            Volver a configuraciones
          </Link>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-info/20 border border-info/35 text-info">
              <FaVideo className="text-lg" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">Generador de contenido</h1>
              <p className="text-sm text-white/55 mt-1">Creá un video para Instagram/TikTok con el tema que quieras, revisalo, y publicalo.</p>
            </div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Tema del post</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder='Ej: "por qué el cardio en ayunas no es lo que creés"'
                className="flex-1 rounded-lg bg-black/25 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-info/50"
              />
              <button
                type="button"
                onClick={handleSuggestTopic}
                disabled={suggesting}
                className="btn btn-secondary whitespace-nowrap disabled:opacity-50"
              >
                <FaLightbulb className="text-xs" />
                {suggesting ? "Pensando..." : "Sugerime un tema"}
              </button>
            </div>
          </div>

          {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="btn btn-primary w-full sm:w-auto disabled:opacity-50"
          >
            <FaMagic className="text-xs" />
            {generating ? "Generando video... (puede tardar un minuto)" : "Generar video"}
          </button>
        </motion.div>

        {preview && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5 mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Preview</h2>
            <div className="flex flex-col sm:flex-row gap-5">
              <video
                src={preview.videoUrl}
                controls
                loop
                className="w-full sm:w-64 rounded-lg border border-white/10 bg-black"
                style={{ aspectRatio: "9/16" }}
              />
              <div className="flex-1 min-w-0 space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45 mb-1">Narración (audio del video)</p>
                  <p className="text-white/85 whitespace-pre-wrap italic">&ldquo;{preview.copy.narration}&rdquo;</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45 mb-1">Caption Instagram</p>
                  <p className="text-white/85 whitespace-pre-wrap">{preview.copy.instagramCaption}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45 mb-1">Caption TikTok</p>
                  <p className="text-white/85 whitespace-pre-wrap">{preview.copy.tiktokCaption}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45 mb-1">Hashtags</p>
                  <p className="text-info">{preview.copy.hashtags.map((h) => `#${h}`).join(" ")}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45 mb-1">Alt text (accesibilidad)</p>
                  <p className="text-white/60">{preview.copy.altText}</p>
                </div>
              </div>
            </div>

            {!publishResult ? (
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="btn btn-success w-full sm:w-auto disabled:opacity-50"
              >
                <FaPaperPlane className="text-xs" />
                {publishing ? "Publicando..." : "Publicar"}
              </button>
            ) : (
              <div className="space-y-2">
                <div className={`badge ${publishResult.instagram.ok ? "badge-success" : "badge-warning"}`}>
                  Instagram: {publishResult.instagram.ok ? "publicado ✅" : publishResult.instagram.message}
                </div>
                <div className={`badge ${publishResult.tiktok.ok ? "badge-success" : "badge-warning"}`}>
                  TikTok: {publishResult.tiktok.ok ? "publicado ✅" : publishResult.tiktok.message}
                </div>
              </div>
            )}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5 mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 border border-warning/25 text-warning">
              <FaClock />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Reels automáticos diarios</h2>
              <p className="text-sm text-white/50">Cuántos se publican por día y a qué hora (Argentina, UTC-3). Elige el tema solo, rotando.</p>
            </div>
          </div>

          {scheduleLoading ? (
            <p className="text-sm text-white/50">Cargando...</p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => {
                    setScheduleEnabled(e.target.checked);
                    setScheduleSaved(false);
                  }}
                  className="h-4 w-4"
                />
                Publicación automática activada
              </label>

              <div className="space-y-2">
                {scheduleTimesLocal.map((time, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => handleTimeChange(index, e.target.value)}
                      className="rounded-lg bg-black/25 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-warning/50"
                    />
                    <span className="text-xs text-white/40">hora Argentina</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTime(index)}
                      className="ml-auto p-2 rounded-lg text-danger/90 hover:bg-danger/15"
                      title="Quitar horario"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                  </div>
                ))}
                {scheduleTimesLocal.length === 0 && (
                  <p className="text-sm text-white/40">No hay horarios configurados — la publicación automática no hace nada hasta que agregues al menos uno.</p>
                )}
              </div>

              <button type="button" onClick={handleAddTime} className="btn btn-secondary text-sm">
                <FaPlus className="text-xs" />
                Agregar horario
              </button>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={scheduleSaving}
                  className="btn btn-primary disabled:opacity-50"
                >
                  {scheduleSaving ? "Guardando..." : "Guardar configuración"}
                </button>
                {scheduleSaved && <span className="text-sm text-success">Guardado ✅</span>}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
