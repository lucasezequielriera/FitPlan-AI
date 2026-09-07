import { useState } from "react";
import {
  DAYS_MAX,
  DAYS_MIN,
  DIVISION_LABELS,
  EQUIPMENT_LABELS,
  RUNNING_BASE_LABELS,
  STRENGTH_BASE_LABELS,
  emptyProfile,
  validateProfile,
  type Division,
  type Equipment,
  type HyroxProfile,
  type RunningBase,
  type StrengthBase,
} from "@/lib/hyrox/profile";
import { hyroxCopy, type HyroxLocale } from "@/lib/hyrox/copy";

/**
 * Formulario del perfil HYROX.
 *
 * Seis preguntas y tres opcionales. Cada campo que se añade cuesta usuarios que
 * abandonan, así que solo está lo que cambia el plan de verdad: todo lo demás
 * se deduce en el generador.
 */
export function HyroxProfileForm({
  initial,
  locale,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: HyroxProfile | null;
  locale: HyroxLocale;
  saving: boolean;
  onSubmit: (profile: HyroxProfile) => void;
  onCancel?: () => void;
}) {
  const c = hyroxCopy(locale);
  const [form, setForm] = useState<Partial<HyroxProfile>>(initial ?? emptyProfile());
  const [issues, setIssues] = useState<ReturnType<typeof validateProfile>>([]);

  const set = <K extends keyof HyroxProfile>(key: K, value: HyroxProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const errorFor = (field: keyof HyroxProfile) => issues.find((i) => i.field === field)?.message;

  const handleSubmit = () => {
    const found = validateProfile(form);
    setIssues(found);
    if (found.length === 0) onSubmit(form as HyroxProfile);
  };

  return (
    <div className="card-surface rounded-2xl p-5 sm:p-6">
      <h2 className="text-xl font-bold text-[var(--foreground)]">{c.formTitle}</h2>

      <div className="mt-5 space-y-5">
        <Field label={c.raceDate} error={errorFor("raceDate")}>
          <input
            type="date"
            value={form.raceDate ?? ""}
            onChange={(e) => set("raceDate", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label={c.division}>
          <Choices
            value={form.division ?? "individual"}
            options={Object.entries(DIVISION_LABELS) as Array<[Division, string]>}
            onChange={(v) => set("division", v)}
          />
        </Field>

        <Field label={c.category}>
          <Choices
            value={form.category ?? "hombre"}
            options={[
              ["hombre", "Hombre"],
              ["mujer", "Mujer"],
            ]}
            onChange={(v) => set("category", v)}
          />
        </Field>

        <Field label={c.daysPerWeek} error={errorFor("daysPerWeek")}>
          <Choices
            value={String(form.daysPerWeek ?? 4)}
            options={Array.from({ length: DAYS_MAX - DAYS_MIN + 1 }, (_, i) => {
              const n = DAYS_MIN + i;
              return [String(n), String(n)] as [string, string];
            })}
            onChange={(v) => set("daysPerWeek", Number(v))}
          />
        </Field>

        <Field label={c.runningBase}>
          <Stack
            value={form.runningBase ?? "poca"}
            options={Object.entries(RUNNING_BASE_LABELS) as Array<[RunningBase, string]>}
            onChange={(v) => set("runningBase", v)}
          />
        </Field>

        <Field label={c.strengthBase}>
          <Stack
            value={form.strengthBase ?? "intermedio"}
            options={Object.entries(STRENGTH_BASE_LABELS) as Array<[StrengthBase, string]>}
            onChange={(v) => set("strengthBase", v)}
          />
        </Field>

        <Field label={c.equipment}>
          <Stack
            value={form.equipment ?? "gimnasio"}
            options={Object.entries(EQUIPMENT_LABELS) as Array<[Equipment, string]>}
            onChange={(v) => set("equipment", v)}
          />
        </Field>

        <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={form.hasRacedBefore === true}
            onChange={(e) => set("hasRacedBefore", e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          {c.hasRaced}
        </label>

        <Field label={c.current5k} hint={c.current5kHint} error={errorFor("current5kMinutes")}>
          <input
            type="number"
            inputMode="numeric"
            min={12}
            max={60}
            value={form.current5kMinutes ?? ""}
            onChange={(e) => set("current5kMinutes", e.target.value === "" ? null : Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label={c.goalMinutes} hint={c.goalHint} error={errorFor("goalMinutes")}>
          <input
            type="number"
            inputMode="numeric"
            min={45}
            max={180}
            value={form.goalMinutes ?? ""}
            onChange={(e) => set("goalMinutes", e.target.value === "" ? null : Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label={c.limitations}>
          <textarea
            rows={2}
            maxLength={500}
            value={form.limitations ?? ""}
            onChange={(e) => set("limitations", e.target.value || null)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={handleSubmit} disabled={saving} className="btn btn-primary disabled:opacity-50">
          {saving ? c.saving : c.submit}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            {locale === "en" ? "Cancel" : "Cancelar"}
          </button>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--foreground)]">{label}</label>
      {hint && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1.5 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

/** Opciones cortas, en fila. */
function Choices<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          style={
            value === key
              ? { background: "var(--accent)", color: "var(--accent-ink)" }
              : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Opciones largas, apiladas: se leen mejor que en fila y no se cortan en móvil. */
function Stack<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className="block w-full rounded-xl px-4 py-3 text-left text-sm transition-colors"
          style={
            value === key
              ? { background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 600 }
              : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
