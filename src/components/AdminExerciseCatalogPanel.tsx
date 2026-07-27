import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getAuthSafe } from "@/lib/firebase";
import { adminFetch } from "@/lib/adminAuthClient";
import {
  FaDumbbell,
  FaExclamationTriangle,
  FaImage,
  FaPlus,
  FaSearch,
  FaTags,
  FaTimes,
  FaTrash,
  FaVideo,
} from "react-icons/fa";

type CatalogEntry = {
  normKey: string;
  label: string;
  source: "wger" | "custom";
  wgerExerciseId?: number;
  customImageUrl?: string;
};

type SearchHit = { id: number; name: string; imageUrl: string };

type PlanMuscleGroup = {
  key: string;
  label: string;
  exercises: { normKey: string; label: string; inCatalog: boolean }[];
  missingInCatalog: number;
};

type PlanAllExercise = { normKey: string; label: string; inCatalog: boolean; muscleLabels: string[] };

type PlanIndexResponse = {
  muscleGroups?: PlanMuscleGroup[];
  allExercises?: PlanAllExercise[];
  meta?: {
    catalogEntryCount: number;
    uniqueInPlans: number;
    intakeDocsScanned: number;
    intakeDocsWithTraining: number;
    planesDocsScanned: number;
    planesDocsWithTraining: number;
  };
  error?: string;
};

type CoverageMeta = {
  notInCatalogCount?: number;
  probedThisRequest?: number;
  skippedDueToProbesLimit?: number;
  noMediaAmongProbed?: number;
  libraryOkAmongProbed?: number;
  maxResolve?: number;
};

export type AdminExerciseCatalogPanelProps =
  | { variant: "page" }
  | { variant: "modal"; isOpen: boolean; onClose: () => void };

export default function AdminExerciseCatalogPanel(props: AdminExerciseCatalogPanelProps) {
  const isPage = props.variant === "page";
  const isOpen = isPage ? true : props.isOpen;
  const onClose = isPage ? () => {} : props.onClose;
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaMode, setMediaMode] = useState<"wger" | "custom" | "video">("wger");
  const [newLabel, setNewLabel] = useState("");
  const [newId, setNewId] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customExt, setCustomExt] = useState<".webp" | ".gif">(".webp");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [planIndexLoading, setPlanIndexLoading] = useState(false);
  const [planIndexError, setPlanIndexError] = useState<string | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<PlanMuscleGroup[]>([]);
  const [allPlanExercises, setAllPlanExercises] = useState<PlanAllExercise[]>([]);
  const [planIndexMeta, setPlanIndexMeta] = useState<PlanIndexResponse["meta"] | null>(null);
  const [selectedMuscleKey, setSelectedMuscleKey] = useState<string | "all" | "no_media">("all");
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [probedNormKeys, setProbedNormKeys] = useState<Set<string>>(new Set());
  const [noMediaNormKeys, setNoMediaNormKeys] = useState<Set<string>>(new Set());
  const [coverageRan, setCoverageRan] = useState(false);
  const [coverageMeta, setCoverageMeta] = useState<CoverageMeta | null>(null);

  const load = useCallback(async () => {
    const auth = getAuthSafe();
    if (!auth?.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const r = await adminFetch(`/api/admin/exerciseWgerCatalog?userId=${encodeURIComponent(auth.currentUser.uid)}`);
      const j = (await r.json()) as { entries?: CatalogEntry[]; error?: string };
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setEntries(Array.isArray(j.entries) ? j.entries : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlanExerciseIndex = useCallback(async () => {
    const auth = getAuthSafe();
    if (!auth?.currentUser) return;
    setPlanIndexLoading(true);
    setPlanIndexError(null);
    try {
      const r = await adminFetch(
        `/api/admin/exerciseCatalogPlanMuscleIndex?userId=${encodeURIComponent(auth.currentUser.uid)}`
      );
      const j = (await r.json()) as PlanIndexResponse & { error?: string };
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMuscleGroups(Array.isArray(j.muscleGroups) ? j.muscleGroups : []);
      setAllPlanExercises(Array.isArray(j.allExercises) ? j.allExercises : []);
      setPlanIndexMeta(j.meta ?? null);
    } catch (e) {
      setPlanIndexError(e instanceof Error ? e.message : "No se pudo cargar el índice");
      setMuscleGroups([]);
      setAllPlanExercises([]);
      setPlanIndexMeta(null);
    } finally {
      setPlanIndexLoading(false);
    }
  }, []);

  const loadMediaCoverage = useCallback(async () => {
    const auth = getAuthSafe();
    if (!auth?.currentUser) return;
    setCoverageLoading(true);
    setCoverageError(null);
    try {
      const r = await adminFetch(
        `/api/admin/exerciseCatalogMediaCoverage?userId=${encodeURIComponent(auth.currentUser.uid)}`
      );
      const j = (await r.json()) as {
        noMediaAnywhere?: { normKey: string }[];
        probedNormKeys?: string[];
        meta?: CoverageMeta;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const nm = new Set((j.noMediaAnywhere || []).map((x) => x.normKey));
      const probed = new Set(j.probedNormKeys || []);
      setNoMediaNormKeys(nm);
      setProbedNormKeys(probed);
      setCoverageMeta(j.meta ?? null);
      setCoverageRan(true);
    } catch (e) {
      setCoverageError(e instanceof Error ? e.message : "No se pudo comprobar cobertura");
      setNoMediaNormKeys(new Set());
      setProbedNormKeys(new Set());
      setCoverageMeta(null);
      setCoverageRan(false);
    } finally {
      setCoverageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void load();
    void loadPlanExerciseIndex();
    setSelectedMuscleKey("all");
    setCoverageError(null);
    setNoMediaNormKeys(new Set());
    setProbedNormKeys(new Set());
    setCoverageRan(false);
    setCoverageMeta(null);
  }, [isOpen, load, loadPlanExerciseIndex]);

  const runSearch = async () => {
    const auth = getAuthSafe();
    const q = searchQ.trim();
    if (!auth?.currentUser || q.length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const r = await adminFetch(
        `/api/admin/wgerExerciseSearch?userId=${encodeURIComponent(auth.currentUser.uid)}&q=${encodeURIComponent(q)}&limit=14`
      );
      const j = (await r.json()) as { results?: SearchHit[]; error?: string };
      if (!r.ok) throw new Error(j.error || "Búsqueda fallida");
      setSearchResults(Array.isArray(j.results) ? j.results : []);
    } catch (e) {
      setSearchResults([]);
      setError(e instanceof Error ? e.message : "Búsqueda fallida");
    } finally {
      setSearching(false);
    }
  };

  const appendSelectedExtIfNeeded = (raw: string): string => {
    const s = raw.trim();
    if (!s) return s;
    // Vídeo o recurso ya con extensión final: no concatenar .webp/.gif
    if (/\.(mp4|webm|mov|m4v|mkv)(\?.*)?$/i.test(s)) return s;
    if (/\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i.test(s)) return s;
    if (s.endsWith("/")) return s;
    return `${s}${customExt}`;
  };

  const handleSave = async () => {
    const auth = getAuthSafe();
    if (!auth?.currentUser) {
      setError("Iniciá sesión como administrador para guardar.");
      return;
    }
    const lab = newLabel.trim();
    if (lab.length < 2) {
      setError("Indica el nombre del ejercicio tal como aparece en los planes.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mediaMode === "custom" || mediaMode === "video") {
        const url = mediaMode === "video" ? customUrl.trim() : appendSelectedExtIfNeeded(customUrl);
        if (!url) {
          setError(mediaMode === "video" ? "Pegá la URL del vídeo." : "Indica una URL o archivo en public/ejercicios/.");
          setSaving(false);
          return;
        }
        const r = await adminFetch("/api/admin/exerciseWgerCatalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: auth.currentUser.uid,
            label: lab,
            mode: "custom",
            customImageUrl: url,
          }),
        });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(j.error || "No se pudo guardar");
        setCustomUrl("");
        setCustomExt(".webp");
      } else {
        const idNum = Number(newId.trim());
        if (!Number.isFinite(idNum) || idNum < 1) {
          setError("Indica un ID numérico wger (exerciseinfo) válido.");
          setSaving(false);
          return;
        }
        const r = await adminFetch("/api/admin/exerciseWgerCatalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: auth.currentUser.uid,
            label: lab,
            mode: "wger",
            wgerExerciseId: Math.floor(idNum),
          }),
        });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(j.error || "No se pudo guardar");
        setNewId("");
      }
      setNewLabel("");
      await load();
      await loadPlanExerciseIndex();
      setCoverageRan(false);
      setNoMediaNormKeys(new Set());
      setProbedNormKeys(new Set());
      setCoverageMeta(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (normKey: string) => {
    const auth = getAuthSafe();
    if (!auth?.currentUser) return;
    if (!confirm("¿Quitar esta asignación del catálogo global?")) return;
    setError(null);
    try {
      const r = await adminFetch("/api/admin/exerciseWgerCatalog", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: auth.currentUser.uid, normKey }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error || "No se pudo eliminar");
      await load();
      await loadPlanExerciseIndex();
      setCoverageRan(false);
      setNoMediaNormKeys(new Set());
      setProbedNormKeys(new Set());
      setCoverageMeta(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  };

  const pickSearchHit = (hit: SearchHit) => {
    setMediaMode("wger");
    setNewId(String(hit.id));
    if (!newLabel.trim()) {
      setNewLabel(hit.name);
    }
  };

  const pickPlanExercise = (row: { normKey: string; label: string; inCatalog: boolean }) => {
    setNewLabel(row.label);
    const entry = entries.find((e) => e.normKey === row.normKey);
    if (!entry) return;
    if (entry.source === "wger") {
      setMediaMode("wger");
      setNewId(entry.wgerExerciseId != null ? String(entry.wgerExerciseId) : "");
      setCustomUrl("");
    } else {
      const url = entry.customImageUrl?.trim() || "";
      setCustomUrl(url);
      if (/\.(mp4|webm|mov|m4v|mkv)(\?.*)?$/i.test(url)) {
        setMediaMode("video");
      } else {
        setMediaMode("custom");
        if (/\.gif(\?.*)?$/i.test(url)) {
          setCustomExt(".gif");
        } else {
          setCustomExt(".webp");
        }
      }
    }
  };

  const planExercisePriority = (e: PlanAllExercise): number => {
    if (e.inCatalog) return 2;
    if (coverageRan && noMediaNormKeys.has(e.normKey)) return 0;
    return 1;
  };

  const sortedPlanExercises = [...allPlanExercises].sort((a, b) => {
    if (coverageRan) {
      const d = planExercisePriority(a) - planExercisePriority(b);
      if (d !== 0) return d;
    }
    if (a.inCatalog !== b.inCatalog) return a.inCatalog ? 1 : -1;
    return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
  });

  const visiblePlanExercises =
    selectedMuscleKey === "no_media"
      ? sortedPlanExercises
          .filter((e) => noMediaNormKeys.has(e.normKey))
          .map((e) => ({
            normKey: e.normKey,
            label: e.label,
            inCatalog: e.inCatalog,
            muscleHint: e.muscleLabels.length ? e.muscleLabels.join(" · ") : null,
          }))
      : selectedMuscleKey === "all"
        ? sortedPlanExercises.map((e) => ({
            normKey: e.normKey,
            label: e.label,
            inCatalog: e.inCatalog,
            muscleHint: e.muscleLabels.length ? e.muscleLabels.join(" · ") : null,
          }))
        : (muscleGroups.find((g) => g.key === selectedMuscleKey)?.exercises || []).map((e) => ({
            ...e,
            muscleHint: null as string | null,
          }));

  const totalMissingAll = allPlanExercises.filter((e) => !e.inCatalog).length;
  const noMediaCount = noMediaNormKeys.size;

  const planListScrollClass = isPage ? "max-h-96 sm:max-h-[28rem]" : "max-h-52";

  if (!isOpen) return null;

  const panelBody = (
    <>
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <FaDumbbell className="text-cyan-400 text-lg shrink-0" />
          <div className="min-w-0">
            <h2 className={`font-semibold text-white ${isPage ? "text-xl sm:text-2xl" : "text-lg"}`}>Catálogo global de ejercicios</h2>
            <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
              Cada entrada fija la ilustración para ese nombre: bien un ID de wger, bien imagen o GIF en{" "}
              <code className="text-violet-300/90">public/ejercicios/</code> (podés poner solo el nombre del archivo o la URL completa). El
              nombre del ejercicio debe coincidir con el plan (típicamente lo que va antes del ·). Los vídeos de técnica se enlazan con
              Cloudinary o URL directa en el plan (sección «Vídeos propios del coach» en el detalle del plan).
            </p>
          </div>
        </div>
        {!isPage && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 shrink-0"
            aria-label="Cerrar"
          >
            <FaTimes />
          </button>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto px-5 py-4 space-y-6 ${isPage ? "min-h-[60vh]" : ""}`}>
          {error && (
            <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
          )}

          <div className="rounded-lg border border-warning/25 bg-warning/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <FaTags className="text-warning/90 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/90">Ejercicios que aparecen en planes</p>
                <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
                  Agrupados por <span className="text-white/60">muscle_group</span> (planes intake recientes y planes de app). Tocá un nombre para copiarlo abajo.{" "}
                  <span className="text-success/80">En catálogo</span> = asignación tuya; podés pulsar{" "}
                  <span className="text-white/55">Comprobar wger</span> para ver cuáles no tienen ni catálogo ni coincidencia automática en wger.
                </p>
                {planIndexMeta && (
                  <p className="text-[10px] text-white/35 mt-1.5 font-mono">
                    {planIndexMeta.uniqueInPlans} nombres únicos · {planIndexMeta.catalogEntryCount} entradas catálogo · intake {planIndexMeta.intakeDocsWithTraining}/
                    {planIndexMeta.intakeDocsScanned} con entreno · planes {planIndexMeta.planesDocsWithTraining}/{planIndexMeta.planesDocsScanned}
                  </p>
                )}
              </div>
            </div>
            {planIndexError && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{planIndexError}</div>
            )}
            {planIndexLoading ? (
              <p className="text-sm text-white/45">Cargando índice desde Firestore…</p>
            ) : muscleGroups.length === 0 && allPlanExercises.length === 0 ? (
              <p className="text-sm text-white/45">No se encontraron ejercicios de entrenamiento en los planes escaneados.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadMediaCoverage()}
                    disabled={coverageLoading || planIndexLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-danger/35 bg-danger/15 text-danger hover:bg-danger/25 disabled:opacity-50"
                  >
                    <FaSearch className="text-[10px]" />
                    {coverageLoading ? "Consultando wger…" : "Comprobar wger"}
                  </button>
                  {coverageRan && noMediaCount > 0 && (
                    <span className="text-[11px] text-danger/90 flex items-center gap-1">
                      <FaExclamationTriangle className="text-[10px] shrink-0" />
                      {noMediaCount} sin ilustración (ni catálogo ni wger)
                    </span>
                  )}
                </div>
                {coverageError && (
                  <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{coverageError}</div>
                )}
                {coverageMeta && coverageRan && (
                  <p className="text-[10px] text-white/40 font-mono leading-relaxed">
                    Sin catálogo en planes: {coverageMeta.notInCatalogCount ?? "—"} · Consultados wger esta vez: {coverageMeta.probedThisRequest ?? "—"}
                    {(coverageMeta.skippedDueToProbesLimit ?? 0) > 0
                      ? ` · Sin consultar aún: ${coverageMeta.skippedDueToProbesLimit} (límite ${coverageMeta.maxResolve ?? 20} por petición; repetí o subí ?maxResolve= en la API)`
                      : null}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMuscleKey("all")}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      selectedMuscleKey === "all"
                        ? "bg-warning/30 border-warning/50 text-warning"
                        : "bg-black/35 border-white/12 text-white/55 hover:text-white/75"
                    }`}
                  >
                    Todas ({allPlanExercises.length}
                    {totalMissingAll > 0 ? (
                      <span className="text-warning/90"> · {totalMissingAll} sin catálogo</span>
                    ) : null}
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMuscleKey("no_media")}
                    disabled={!coverageRan || noMediaCount === 0}
                    title={!coverageRan ? "Primero pulsá Comprobar wger" : undefined}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors max-w-[220px] truncate ${
                      selectedMuscleKey === "no_media"
                        ? "bg-danger/30 border-danger/45 text-danger"
                        : "bg-black/35 border-white/12 text-white/55 hover:text-white/75 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    Solo sin ilustración ({noMediaCount})
                  </button>
                  {muscleGroups.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setSelectedMuscleKey(g.key)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors max-w-[200px] truncate ${
                        selectedMuscleKey === g.key
                          ? "bg-cyan-500/25 border-cyan-400/45 text-cyan-100"
                          : "bg-black/35 border-white/12 text-white/55 hover:text-white/75"
                      }`}
                      title={g.label}
                    >
                      {g.label}
                      {g.missingInCatalog > 0 ? (
                        <span className="text-warning/85"> · {g.missingInCatalog} sin cat.</span>
                      ) : (
                        <span className="text-white/35"> · ok</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className={`${planListScrollClass} overflow-y-auto rounded-lg border border-white/10 bg-black/30 divide-y divide-white/5`}>
                  {visiblePlanExercises.length === 0 ? (
                    <p className="p-3 text-xs text-white/45">Sin ejercicios en este grupo.</p>
                  ) : (
                    visiblePlanExercises.map((row) => (
                      <button
                        key={row.normKey}
                        type="button"
                        onClick={() => pickPlanExercise(row)}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 flex flex-wrap items-center gap-2 gap-y-1"
                      >
                        <span
                          className={`shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${
                            row.inCatalog
                              ? "bg-success/20 text-success border border-success/25"
                              : coverageRan && noMediaNormKeys.has(row.normKey)
                                ? "bg-danger/20 text-danger border border-danger/35"
                                : coverageRan && probedNormKeys.has(row.normKey)
                                  ? "bg-info/20 text-info border border-info/30"
                                  : coverageRan
                                    ? "bg-white/10 text-white/55 border border-white/15"
                                    : "bg-warning/20 text-warning border border-warning/30"
                          }`}
                        >
                          {row.inCatalog ? (
                            "En catálogo"
                          ) : !coverageRan ? (
                            "Falta cat."
                          ) : noMediaNormKeys.has(row.normKey) ? (
                            <>
                              <FaExclamationTriangle className="text-[9px]" />
                              Sin ilustración
                            </>
                          ) : probedNormKeys.has(row.normKey) ? (
                            "Solo wger"
                          ) : (
                            "Sin chequear"
                          )}
                        </span>
                        <span className="text-sm text-white/90 flex-1 min-w-[120px]">{row.label}</span>
                        {row.muscleHint ? (
                          <span className="text-[10px] text-white/40 w-full sm:w-auto sm:ml-auto truncate" title={row.muscleHint}>
                            {row.muscleHint}
                          </span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-medium text-white/90">Buscar en wger</p>
            <div className="flex flex-wrap gap-2">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runSearch()}
                placeholder="Ej. leg curl, bench press, jalón…"
                className="flex-1 min-w-[200px] rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/35"
              />
              <button
                type="button"
                onClick={() => void runSearch()}
                disabled={searching || searchQ.trim().length < 2}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/25 border border-cyan-400/40 text-cyan-100 text-sm font-medium hover:bg-cyan-500/35 disabled:opacity-50"
              >
                <FaSearch className="text-xs" />
                {searching ? "Buscando…" : "Buscar"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                {searchResults.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => pickSearchHit(hit)}
                    className="text-left rounded-lg border border-white/10 bg-black/30 overflow-hidden hover:border-cyan-500/50 transition-colors"
                  >
                    <div className="aspect-[4/3] bg-black/50 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={hit.imageUrl} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                    </div>
                    <div className="px-2 py-1.5 text-[10px] text-white/80 leading-tight">
                      <span className="font-mono text-cyan-300/90">#{hit.id}</span> {hit.name}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-white/45">
              Pulsa una tarjeta para modo wger: rellena el ID y cambia el nombre si hace falta que coincida con el plan.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-sm font-medium text-white/90">Añadir o actualizar</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMediaMode("wger")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  mediaMode === "wger"
                    ? "bg-cyan-500/25 border-cyan-400/50 text-cyan-100"
                    : "bg-black/30 border-white/15 text-white/60 hover:text-white/80"
                }`}
              >
                Por ID wger
              </button>
              <button
                type="button"
                onClick={() => setMediaMode("custom")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  mediaMode === "custom"
                    ? "bg-violet-500/25 border-violet-400/50 text-violet-100"
                    : "bg-black/30 border-white/15 text-white/60 hover:text-white/80"
                }`}
              >
                <FaImage className="text-[10px]" />
                Imagen / GIF
              </button>
              <button
                type="button"
                onClick={() => setMediaMode("video")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  mediaMode === "video"
                    ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-100"
                    : "bg-black/30 border-white/15 text-white/60 hover:text-white/80"
                }`}
              >
                <FaVideo className="text-[10px]" />
                Vídeo (URL)
              </button>
            </div>
            {mediaMode === "custom" ? (
              <p className="text-[11px] text-violet-200/70">
                Imágenes en <code className="text-violet-300/80">public/ejercicios/</code> o URL https; si no ponés extensión se añade .webp o .gif según el botón de abajo.
              </p>
            ) : mediaMode === "video" ? (
              <p className="text-[11px] text-emerald-200/80">
                Pegá la URL completa del vídeo (p. ej. Cloudinary <code className="text-emerald-300/80">…/video/upload/…mp4</code>). No se añade ninguna extensión automática.
              </p>
            ) : null}
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Nombre en el plan (ej. Hip thrust · 4 series → usa «Hip thrust» o el texto completo según salga en el plan)"
              className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/35"
            />
            {mediaMode === "wger" ? (
              <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="ID wger (exerciseinfo)"
                className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white font-mono placeholder:text-white/35"
              />
            ) : mediaMode === "video" ? (
              <div className="space-y-2">
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/…/video/upload/…/archivo.mp4"
                  className="w-full rounded-lg bg-black/40 border border-emerald-500/25 px-3 py-2 text-sm text-white placeholder:text-white/35"
                />
                <p className="text-[11px] text-white/45 leading-relaxed">
                  También .webm / .mov por https. Sin YouTube ni Vimeo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="curl-femoral-tumbado  o  public/ejercicios/curl-femoral-tumbado  o  https://…"
                  className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/35"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-white/55">Si falta extensión:</span>
                  <button
                    type="button"
                    onClick={() => setCustomExt(".webp")}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border ${
                      customExt === ".webp"
                        ? "bg-violet-500/25 border-violet-400/50 text-violet-100"
                        : "bg-black/30 border-white/15 text-white/60 hover:text-white/80"
                    }`}
                  >
                    .webp
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomExt(".gif")}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border ${
                      customExt === ".gif"
                        ? "bg-violet-500/25 border-violet-400/50 text-violet-100"
                        : "bg-black/30 border-white/15 text-white/60 hover:text-white/80"
                    }`}
                  >
                    .gif
                  </button>
                  <span className="text-[11px] text-white/45">se concatena al nombre corto</span>
                </div>
                <p className="text-[11px] text-white/45 leading-relaxed">
                  Archivo en <code className="text-violet-300/80">public/ejercicios/</code>: podés escribir solo el nombre (
                  <code className="text-violet-300/80">mi-ejercicio</code>), o ruta completa, o URL https de imagen. Sin YouTube ni Vimeo.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/25 border border-emerald-400/40 text-emerald-100 text-sm font-medium hover:bg-emerald-500/35 disabled:opacity-50"
            >
              <FaPlus className="text-xs" />
              {saving ? "Guardando…" : "Guardar en catálogo"}
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-white/90">Entradas guardadas ({entries.length})</p>
              <button type="button" onClick={() => void load()} className="text-xs text-cyan-300 hover:text-cyan-200">
                Recargar
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-white/50">Cargando…</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-white/50">Aún no hay asignaciones. La app seguirá usando solo la búsqueda automática.</p>
            ) : (
              <ul className="space-y-2">
                {entries.map((row) => (
                  <li
                    key={row.normKey}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm"
                  >
                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${
                        row.source === "custom"
                          ? "bg-violet-500/25 text-violet-200 border border-violet-400/30"
                          : "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30"
                      }`}
                    >
                      {row.source === "custom" ? "Propio" : "wger"}
                    </span>
                    {row.source === "custom" ? (
                      <span className="font-mono text-[11px] text-violet-200/90 truncate max-w-[220px]" title={row.customImageUrl}>
                        {row.customImageUrl || "—"}
                      </span>
                    ) : (
                      <span className="font-mono text-cyan-300/90 shrink-0">#{row.wgerExerciseId ?? "—"}</span>
                    )}
                    <span className="text-white/90 flex-1 min-w-[140px]">{row.label}</span>
                    <span className="text-[10px] text-white/40 truncate max-w-[180px]" title={row.normKey}>
                      {row.normKey}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row.normKey)}
                      className="p-2 rounded-lg text-danger/90 hover:bg-danger/15 shrink-0"
                      aria-label="Eliminar"
                    >
                      <FaTrash className="text-sm" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
    </>
  );

  if (isPage) {
    return (
      <div className="rounded-xl border border-white/15 bg-gray-900 overflow-hidden flex flex-col shadow-2xl w-full max-w-5xl mx-auto">
        {panelBody}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900 border border-white/15 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {panelBody}
      </motion.div>
    </div>
  );
}
