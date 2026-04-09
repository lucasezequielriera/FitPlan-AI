import React, { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  isAllowedPosterUrl,
  normalizeExerciseMediaKey,
  resolveExerciseVideoSource,
  type ExerciseMediaOverride,
} from "@/lib/exerciseMedia";

const CldVideoPlayer = dynamic(
  () => import("next-cloudinary").then((m) => m.CldVideoPlayer),
  {
    ssr: false,
    loading: () => <p className="text-[10px] text-white/50">Cargando reproductor…</p>,
  }
);

type WgerPayload = {
  source: "wger" | "custom";
  wgerExerciseId: number | null;
  imageUrl: string;
  matchedName: string;
  licenseShortName: string;
  licenseUrl: string | null;
  licenseAuthor: string | null;
};

type LoadState = "idle" | "loading" | "ready" | "empty" | "error";

function resolveOwnPosterUrl(
  inline: string | undefined | null,
  override: ExerciseMediaOverride | null | undefined
): string | null {
  const v = (inline?.trim() || override?.demo_poster_url?.trim() || "") as string;
  return isAllowedPosterUrl(v) ? v : null;
}

type Props = {
  exerciseName: string;
  /** Campos en el ejercicio del plan (prioridad sobre overrides del plan). */
  demoVideoUrl?: string | null;
  demoPosterUrl?: string | null;
  /** Mapa `plan.training_plan.exercise_media_overrides` o entrada ya resuelta. */
  planMediaOverrides?: Record<string, ExerciseMediaOverride> | null;
};

/**
 * Vídeo propio (HTTPS, Cloudinary u otro host permitido) o ilustración wger. Sin YouTube.
 */
export default function ExerciseDemoMedia({
  exerciseName,
  demoVideoUrl,
  demoPosterUrl,
  planMediaOverrides,
}: Props) {
  const override = useMemo(() => {
    const k = normalizeExerciseMediaKey(exerciseName);
    return planMediaOverrides?.[k] ?? null;
  }, [exerciseName, planMediaOverrides]);

  const resolvedVideo = useMemo(
    () => resolveExerciseVideoSource(demoVideoUrl, override),
    [demoVideoUrl, override]
  );
  const ownPoster = useMemo(
    () => resolveOwnPosterUrl(demoPosterUrl, override),
    [demoPosterUrl, override]
  );

  const cloudName =
    typeof process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME === "string"
      ? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.trim()
      : "";

  const hasOwnVideo = Boolean(resolvedVideo);
  const [lightbox, setLightbox] = useState<"wger" | "video" | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [wger, setWger] = useState<WgerPayload | null>(null);

  const loadWger = useCallback(async () => {
    if (state === "loading" || state === "ready" || state === "empty") return;
    setState("loading");
    try {
      const r = await fetch(`/api/exercise-media?q=${encodeURIComponent(exerciseName)}`);
      if (!r.ok) {
        setState("error");
        return;
      }
      const j = (await r.json()) as { media?: WgerPayload | null };
      if (j.media?.imageUrl) {
        setWger(j.media);
        setState("ready");
      } else {
        setWger(null);
        setState("empty");
      }
    } catch {
      setState("error");
    }
  }, [exerciseName, state]);

  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const el = e.currentTarget;
    if (el.open) {
      if (!hasOwnVideo) void loadWger();
    } else {
      setLightbox(null);
      if (state === "error") setState("idle");
    }
  };

  const onToggleWgerOnly = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open) void loadWger();
  };

  const summaryLabel = hasOwnVideo ? "Forma del movimiento (vídeo del equipo)" : "Forma del movimiento (ilustración)";

  const renderVideoPlayer = (opts: { compact: boolean }) => {
    if (!resolvedVideo) return null;
    if (resolvedVideo.kind === "direct") {
      return (
        <video
          src={resolvedVideo.url}
          poster={ownPoster || undefined}
          className={
            opts.compact
              ? "w-full max-h-52 rounded-md border border-emerald-500/25 bg-black/50 object-contain"
              : "max-w-full max-h-[85vh] rounded-lg shadow-2xl"
          }
          controls
          playsInline
          preload="metadata"
          autoPlay={!opts.compact}
        />
      );
    }
    if (!cloudName) {
      return (
        <p className="text-xs text-amber-200/90">
          Falta <code className="text-amber-100/90">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> en el servidor para reproducir
          vídeos de Cloudinary.
        </p>
      );
    }
    return (
      <div className={opts.compact ? "w-full max-h-52 overflow-hidden rounded-md border border-emerald-500/25 bg-black/50" : "w-full max-w-3xl"}>
        <CldVideoPlayer
          src={resolvedVideo.publicId}
          width={opts.compact ? 720 : 1080}
          height={opts.compact ? 1280 : 1920}
          className={opts.compact ? "w-full max-h-52" : "w-full max-h-[85vh]"}
          poster={ownPoster || undefined}
          logo={false}
        />
      </div>
    );
  };

  return (
    <>
      <details className="mt-2 group" onToggle={onToggle}>
        <summary className="text-xs font-medium text-sky-300 cursor-pointer hover:text-sky-200 list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-sky-500/40 bg-sky-500/10 text-[10px] text-sky-200 group-open:rotate-90 transition-transform">
            ▶
          </span>
          {summaryLabel}
        </summary>
        <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 space-y-3">
          {hasOwnVideo && resolvedVideo ? (
            <div className="space-y-2">
              <p className="text-[10px] text-emerald-200/90">
                {resolvedVideo.kind === "cloudinary"
                  ? "Vídeo desde Cloudinary (calidad adaptativa)."
                  : "Vídeo proporcionado por tu plan (enlace HTTPS directo, sin YouTube)."}
              </p>
              {renderVideoPlayer({ compact: true })}
              <button
                type="button"
                onClick={() => setLightbox("video")}
                className="text-[11px] text-emerald-300/90 hover:text-emerald-200 underline"
              >
                Ampliar en pantalla completa
              </button>
            </div>
          ) : null}

          {!hasOwnVideo && (state === "idle" || state === "loading") ? (
            <p className="text-xs text-white/50">Buscando ilustración en catálogo profesional…</p>
          ) : null}
          {!hasOwnVideo && state === "error" ? (
            <p className="text-xs text-amber-200/90">No se pudo cargar la ilustración. Intenta más tarde.</p>
          ) : null}
          {!hasOwnVideo && state === "empty" ? (
            <p className="text-xs text-white/55">
              No hay ilustración fiable en el catálogo para este nombre. Tu coach puede subir un vídeo propio (HTTPS .mp4 / .webm)
              desde el panel de administración.
            </p>
          ) : null}
          {!hasOwnVideo && state === "ready" && wger ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setLightbox("wger")}
                className="block w-full text-left rounded-md overflow-hidden border border-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={wger.imageUrl}
                  alt={`Ilustración orientativa: ${wger.matchedName}`}
                  className="w-full max-h-48 object-contain bg-black/40"
                  loading="lazy"
                  decoding="async"
                />
                <span className="block text-[10px] text-white/45 px-2 py-1">Pulsa para ampliar</span>
              </button>
              <p className="text-[10px] leading-relaxed text-white/45">
                {wger.source === "custom" ? (
                  <>
                    Imagen o GIF del catálogo interno («{wger.matchedName}»). {wger.licenseShortName}. No sustituye supervisión en
                    persona.
                  </>
                ) : (
                  <>
                    Ilustración orientativa del banco{" "}
                    <a href="https://wger.de" target="_blank" rel="noopener noreferrer" className="text-sky-400/90 underline">
                      wger
                    </a>{" "}
                    (comunidad, licencia abierta). Coincidencia aproximada: «{wger.matchedName}».{" "}
                    {wger.licenseUrl ? (
                      <>
                        Licencia:{" "}
                        <a href={wger.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400/90 underline">
                          {wger.licenseShortName}
                        </a>
                        .
                      </>
                    ) : (
                      <>Licencia: {wger.licenseShortName}.</>
                    )}
                    {wger.licenseAuthor ? <> Crédito en wger: {wger.licenseAuthor}.</> : null} No sustituye supervisión en persona.
                  </>
                )}
              </p>
            </div>
          ) : null}

          {hasOwnVideo ? (
            <details className="rounded-md border border-white/10 bg-white/[0.03]" onToggle={onToggleWgerOnly}>
              <summary className="text-[11px] text-white/55 cursor-pointer px-2 py-1.5 hover:text-white/75">
                Ver también ilustración de referencia (catálogo público)
              </summary>
              <div className="px-2 pb-2 pt-0 space-y-2">
                {(state === "idle" || state === "loading") && (
                  <p className="text-[11px] text-white/45">Cargando…</p>
                )}
                {state === "ready" && wger ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={wger.imageUrl}
                      alt={wger.matchedName}
                      className="w-full max-h-40 object-contain rounded bg-black/40"
                      loading="lazy"
                    />
                    <p className="text-[10px] text-white/40">
                      {wger.source === "custom" ? "Catálogo · " : "wger · "}
                      {wger.matchedName}
                    </p>
                  </>
                ) : null}
                {state === "empty" ? (
                  <p className="text-[11px] text-white/45">No hay coincidencia en catálogo.</p>
                ) : null}
                {state === "error" ? (
                  <p className="text-[11px] text-amber-200/80">Error al cargar catálogo.</p>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      </details>

      {lightbox === "wger" && wger ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ilustración ampliada"
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white text-sm px-3 py-1 rounded-lg bg-white/10 z-[10001]"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            Cerrar
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wger.imageUrl}
            alt={wger.matchedName}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="mt-3 text-xs text-white/60 max-w-md text-center">{wger.matchedName}</p>
        </div>
      ) : null}

      {lightbox === "video" && resolvedVideo ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vídeo ampliado"
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white text-sm px-3 py-1 rounded-lg bg-white/10 z-[10001]"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            Cerrar
          </button>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl flex flex-col items-center">
            {resolvedVideo.kind === "direct" ? (
              <video
                src={resolvedVideo.url}
                poster={ownPoster || undefined}
                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
                controls
                autoPlay
                playsInline
              />
            ) : cloudName ? (
              <CldVideoPlayer
                src={resolvedVideo.publicId}
                width={1080}
                height={1920}
                className="max-w-full max-h-[85vh]"
                poster={ownPoster || undefined}
                logo={false}
              />
            ) : (
              <p className="text-sm text-amber-200">Configura NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.</p>
            )}
            <p className="mt-3 text-xs text-white/60 max-w-md text-center">{exerciseName}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
