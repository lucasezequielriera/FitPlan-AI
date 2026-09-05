import fs from "fs";
import path from "path";

/**
 * `firebase-admin` es código de servidor. Si un componente o una página lo
 * alcanza —aunque sea a través de otro módulo— Turbopack falla al construir el
 * bundle del cliente, y el error no aparece en `tsc` ni en `npm run dev`: solo
 * en el build de producción.
 *
 * Pasó tres veces en la misma sesión (importando `exchangeRate.ts` desde
 * `PremiumPlanModal.tsx`, y `carouselScheduleStore.ts` desde el panel de
 * carruseles). Este test lo detecta sin tener que construir.
 */

const SRC = path.join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const ALL = walk(SRC);

/** Resuelve un import "@/..." o relativo al archivo real, o null si es un paquete. */
function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const cand of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

function importsOf(file: string): string[] {
  const src = fs.readFileSync(file, "utf8");
  // Se ignoran los `import type`: se borran en compilación y no llegan al bundle.
  return [...src.matchAll(/^\s*import\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
}

/** ¿Este archivo llega a firebase-admin por alguna cadena de imports? */
function reachesFirebaseAdmin(file: string, seen = new Set<string>()): string[] | null {
  if (seen.has(file)) return null;
  seen.add(file);
  for (const spec of importsOf(file)) {
    if (spec.startsWith("firebase-admin")) return [path.relative(process.cwd(), file)];
    const next = resolveImport(file, spec);
    if (!next) continue;
    const chain = reachesFirebaseAdmin(next, seen);
    if (chain) return [path.relative(process.cwd(), file), ...chain];
  }
  return null;
}

/** Código que se ejecuta en el navegador: componentes y páginas que no son API. */
function isClientCode(file: string): boolean {
  const rel = path.relative(SRC, file);
  if (rel.startsWith("pages/api/")) return false;
  if (rel.startsWith("__tests__/")) return false;
  return rel.startsWith("components/") || rel.startsWith("pages/");
}

describe("Seguridad del bundle de cliente", () => {
  it("ningún componente ni página llega a firebase-admin", () => {
    const ofensores = ALL.filter(isClientCode)
      .map((f) => reachesFirebaseAdmin(f))
      .filter((chain): chain is string[] => chain !== null)
      .map((chain) => chain.join(" → "));

    expect(ofensores).toEqual([]);
  });
});
