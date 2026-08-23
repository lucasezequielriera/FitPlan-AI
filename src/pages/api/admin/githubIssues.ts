import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuthServer";
import {
  extractDomain,
  extractPriority,
  fetchAllGithubIssues,
  needsDecision,
  type GithubIssue,
} from "@/lib/githubIssues";

/** Orden fijo de la taxonomía de dominios — "sin-asignar" siempre va al final. */
const DOMAIN_ORDER = ["backend", "frontend", "diseno", "marketing", "atencion"] as const;
const UNASSIGNED_DOMAIN = "sin-asignar";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type BacklogIssue = {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  priority: string | null;
  labels: string[];
  createdAt: string;
  closedAt: string | null;
  /**
   * Si el issue está cerrado: días entre createdAt y closedAt (cuánto tardó
   * en cerrarse). Si sigue abierto: días entre createdAt y ahora (cuánto
   * lleva abierto). Redondeado hacia abajo, mínimo 0.
   */
  durationDays: number;
};

type BacklogGroup = {
  domain: string;
  issues: BacklogIssue[];
};

/**
 * Issue bloqueado esperando una decisión de Lucas. Lleva el dominio del
 * agente que lo escaló y un extracto del cuerpo, que es donde ese agente
 * dejó qué hay que decidir y qué recomienda.
 */
type PendingDecision = BacklogIssue & {
  domain: string;
  /** Extracto del cuerpo del issue, recortado para que la tarjeta sea legible. */
  excerpt: string | null;
  /** Días que lleva esperando una decisión. */
  waitingDays: number;
};

const EXCERPT_MAX_CHARS = 600;

function buildExcerpt(body: string | null): string | null {
  if (!body) return null;
  const clean = body.trim();
  if (!clean) return null;
  return clean.length > EXCERPT_MAX_CHARS ? `${clean.slice(0, EXCERPT_MAX_CHARS).trimEnd()}…` : clean;
}

function toBacklogIssue(issue: GithubIssue, now: number): BacklogIssue {
  const createdMs = Date.parse(issue.createdAt);
  const endMs = issue.closedAt ? Date.parse(issue.closedAt) : now;
  const durationDays = Number.isFinite(createdMs) && Number.isFinite(endMs)
    ? Math.max(0, Math.floor((endMs - createdMs) / MS_PER_DAY))
    : 0;

  return {
    number: issue.number,
    title: issue.title,
    url: issue.url,
    state: issue.state,
    priority: extractPriority(issue.labels),
    labels: issue.labels,
    createdAt: issue.createdAt,
    closedAt: issue.closedAt,
    durationDays,
  };
}

/**
 * Panel de backlog del admin: agrupa los issues de GitHub del repo por
 * label `dominio:*`. Solo lectura — el módulo de fetch/paginación/rate
 * limit vive en `src/lib/githubIssues.ts` y también lo usa
 * `src/pages/api/cron/weeklyDigest.ts`, para no duplicar esa lógica.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const checkedAt = new Date().toISOString();

  try {
    const result = await fetchAllGithubIssues();

    if (!result.configured) {
      return res.status(200).json({
        configured: false,
        reason: result.reason,
        checkedAt,
      });
    }

    if (result.rateLimited) {
      return res.status(200).json({
        configured: true,
        rateLimited: true,
        reason: "GitHub devolvió rate limit al listar los issues. Reintentar más tarde.",
        rateLimitResetAt: result.resetAt,
        checkedAt,
      });
    }

    const now = Date.now();
    const groupsByDomain = new Map<string, BacklogIssue[]>();
    for (const domain of DOMAIN_ORDER) groupsByDomain.set(domain, []);
    groupsByDomain.set(UNASSIGNED_DOMAIN, []);

    let open = 0;
    let closed = 0;
    const pendingDecisions: PendingDecision[] = [];

    for (const issue of result.issues) {
      if (issue.state === "open") open++;
      else closed++;

      const domain = extractDomain(issue.labels);
      const key = domain && groupsByDomain.has(domain) ? domain : (domain ?? UNASSIGNED_DOMAIN);
      if (!groupsByDomain.has(key)) groupsByDomain.set(key, []);
      const backlogIssue = toBacklogIssue(issue, now);
      groupsByDomain.get(key)!.push(backlogIssue);

      // Un issue bloqueado aparece EN LOS DOS lados: en su grupo de dominio
      // (es trabajo de ese equipo) y acá (está esperando a Lucas). Solo los
      // abiertos: uno cerrado ya no espera nada aunque conserve el label.
      if (issue.state === "open" && needsDecision(issue.labels)) {
        pendingDecisions.push({
          ...backlogIssue,
          domain: key,
          excerpt: buildExcerpt(issue.body),
          waitingDays: backlogIssue.durationDays,
        });
      }
    }

    // El que más tiempo lleva esperando va primero: es el que más urge
    // destrabar, porque puede tener trabajo de un equipo entero detenido atrás.
    pendingDecisions.sort((a, b) => b.waitingDays - a.waitingDays);

    // Orden fijo de la taxonomía primero, después cualquier dominio no
    // previsto que haya aparecido como label suelto, y "sin-asignar" al final.
    const extraDomains = Array.from(groupsByDomain.keys()).filter(
      (key) => !DOMAIN_ORDER.includes(key as (typeof DOMAIN_ORDER)[number]) && key !== UNASSIGNED_DOMAIN
    );
    const orderedDomains = [...DOMAIN_ORDER, ...extraDomains, UNASSIGNED_DOMAIN];

    const groups: BacklogGroup[] = orderedDomains
      .filter((domain) => groupsByDomain.has(domain))
      .map((domain) => ({
        domain,
        issues: groupsByDomain.get(domain)!.sort((a, b) => b.number - a.number),
      }));

    return res.status(200).json({
      configured: true,
      rateLimited: false,
      checkedAt,
      totals: { total: result.issues.length, open, closed, pendingDecisions: pendingDecisions.length },
      pendingDecisions,
      groups,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error leyendo issues de GitHub para el panel de backlog:", error);
    return res.status(502).json({
      configured: true,
      error: "No se pudo leer el backlog de GitHub",
      detail: message,
      checkedAt,
    });
  }
}
