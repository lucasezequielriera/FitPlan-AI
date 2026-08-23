/**
 * Cliente compartido para leer issues de GitHub del repo de FitPlan
 * (`GITHUB_TOKEN` + `GITHUB_REPO`, formato "owner/repo").
 *
 * Usado por `src/pages/api/cron/weeklyDigest.ts` (sección "decisiones
 * pendientes") y por `src/pages/api/admin/githubIssues.ts` (panel de
 * backlog). Se centraliza acá para no duplicar el fetch paginado ni el
 * manejo de rate limit — cualquier otro consumidor futuro debería colgarse
 * de `fetchAllGithubIssues`, no repetir el fetch a mano.
 */

const GITHUB_API_BASE = "https://api.github.com";
const PER_PAGE = 100;
/** Salvavidas: nunca deberíamos tener más de 2000 issues en este repo. */
const MAX_PAGES = 20;

export type GithubIssue = {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  labels: string[];
  createdAt: string;
  closedAt: string | null;
  /**
   * Cuerpo del issue. Importa para los issues bloqueados esperando decisión
   * (`decision:lucas`): ahí es donde el agente que escaló deja qué hay que
   * decidir y qué recomienda, así que el panel lo muestra sin obligar a
   * abrir GitHub.
   */
  body: string | null;
};

export type GithubIssuesFetchResult =
  | { configured: false; reason: string }
  | { configured: true; rateLimited: true; resetAt: string | null }
  | { configured: true; rateLimited: false; issues: GithubIssue[] };

type RawGithubLabel = string | { name?: string };

type RawGithubIssue = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels?: RawGithubLabel[];
  created_at: string;
  closed_at: string | null;
  body?: string | null;
  pull_request?: unknown;
};

function normalizeLabels(labels: RawGithubLabel[] | undefined): string[] {
  if (!labels) return [];
  return labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter((name): name is string => !!name);
}

/**
 * Trae TODOS los issues del repo (abiertos + cerrados, paginado), excluyendo
 * pull requests (la API de "issues" de GitHub los devuelve mezclados).
 *
 * No lanza excepción cuando falta config o cuando GitHub responde rate
 * limit: devuelve un resultado tipado para que cada caller decida cómo
 * mostrarlo (nunca "inventar" datos ni romper el endpoint que lo llama).
 * Sí puede lanzar ante otros errores HTTP inesperados — el caller decide si
 * los atrapa.
 */
export async function fetchAllGithubIssues(): Promise<GithubIssuesFetchResult> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return {
      configured: false,
      reason: "Faltan las variables de entorno GITHUB_TOKEN y/o GITHUB_REPO.",
    };
  }

  const issues: GithubIssue[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const resp = await fetch(
      `${GITHUB_API_BASE}/repos/${repo}/issues?state=all&per_page=${PER_PAGE}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (resp.status === 403 || resp.status === 429) {
      const remaining = resp.headers.get("x-ratelimit-remaining");
      if (remaining === "0" || resp.status === 429) {
        const resetHeader = resp.headers.get("x-ratelimit-reset");
        const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000).toISOString() : null;
        return { configured: true, rateLimited: true, resetAt };
      }
    }

    if (!resp.ok) {
      throw new Error(`GitHub API respondió HTTP ${resp.status} al listar issues (repo=${repo})`);
    }

    const data = (await resp.json()) as RawGithubIssue[];
    for (const item of data) {
      if ("pull_request" in item && item.pull_request) continue; // excluir PRs
      issues.push({
        number: item.number,
        title: item.title,
        url: item.html_url,
        state: item.state === "closed" ? "closed" : "open",
        labels: normalizeLabels(item.labels),
        createdAt: item.created_at,
        closedAt: item.closed_at,
        body: item.body ?? null,
      });
    }

    if (data.length < PER_PAGE) break;
    page++;
  }

  return { configured: true, rateLimited: false, issues };
}

const PRIORITY_PREFIX = "prioridad:";
const DOMAIN_PREFIX = "dominio:";

/** Extrae el valor de `prioridad:alta|media|baja` de la lista de labels, si existe. */
export function extractPriority(labels: string[]): string | null {
  const label = labels.find((l) => l.startsWith(PRIORITY_PREFIX));
  return label ? label.slice(PRIORITY_PREFIX.length) : null;
}

/** Extrae el valor de `dominio:*` de la lista de labels, si existe. */
export function extractDomain(labels: string[]): string | null {
  const label = labels.find((l) => l.startsWith(DOMAIN_PREFIX));
  return label ? label.slice(DOMAIN_PREFIX.length) : null;
}

/**
 * Label con el que los agentes marcan un issue que quedó bloqueado esperando
 * una decisión de Lucas. Es la fuente del apartado de decisiones pendientes
 * del panel de backlog: sin este label, un issue trabado es invisible y se
 * queda parado sin que nadie se entere.
 */
export const DECISION_LABEL = "decision:lucas";

export function needsDecision(labels: string[]): boolean {
  return labels.includes(DECISION_LABEL);
}
