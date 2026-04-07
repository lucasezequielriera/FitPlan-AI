/** Clave estable para buscar vídeo/póster propio por nombre de ejercicio. */
export function normalizeExerciseMediaKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

const BLOCKED_HOST = /youtube\.com|youtu\.be|youtube-nocookie|vimeo\.com|tiktok\.com|dailymotion|facebook\.com\/watch/i;

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function isAllowedDirectMediaUrl(raw: string, kind: "video" | "image"): boolean {
  const s = raw.trim();
  if (s.length < 12 || s.length > 2048) return false;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return false;
  }
  const isHttps = u.protocol === "https:";
  const isHttpLocal = u.protocol === "http:" && isLocalDevHost(u.hostname);
  if (!isHttps && !isHttpLocal) return false;
  if (BLOCKED_HOST.test(u.hostname)) return false;
  const path = u.pathname.toLowerCase();
  if (kind === "video") {
    return /\.(mp4|webm|mov)(\?.*)?$/i.test(path);
  }
  return /\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i.test(path);
}

export function isAllowedVideoUrl(raw: string): boolean {
  return isAllowedDirectMediaUrl(raw.trim(), "video");
}

export function isAllowedPosterUrl(raw: string): boolean {
  return isAllowedDirectMediaUrl(raw, "image");
}

const REPO_IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i;

/**
 * Acepta solo el nombre de archivo o rutas relativas al repo y devuelve pathname bajo `/ejercicios/`.
 * Ejemplos: `curl-femoral.webp`, `public/ejercicios/x.gif`, `@public/ejercicios/x.gif`, `/ejercicios/x.png`.
 */
export function parseRepoEjerciciosMediaPath(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (s.startsWith("@")) s = s.slice(1).trim();
  if (/^https?:\/\//i.test(s)) return null;
  s = s.replace(/\\/g, "/");
  if (s.includes("..") || /[\0<>"]/.test(s)) return null;

  if (s.startsWith("/")) {
    if (!/^\/ejercicios\//i.test(s)) return null;
  } else if (s.toLowerCase().startsWith("public/")) {
    s = s.slice(7);
    if (!s.toLowerCase().startsWith("ejercicios/")) return null;
    s = `/${s}`;
  } else if (s.toLowerCase().startsWith("ejercicios/")) {
    s = `/${s}`;
  } else if (!s.includes("/")) {
    s = `/ejercicios/${s}`;
  } else {
    return null;
  }

  if (!/^\/ejercicios\/[a-zA-Z0-9._\-/]+$/i.test(s)) return null;
  if (!REPO_IMAGE_EXT.test(s)) return null;
  return s;
}

/**
 * Si `raw` ya es URL http(s) válida para imagen, la devuelve.
 * Si es nombre corto o ruta `public/ejercicios/...`, la resuelve contra `siteOrigin`.
 */
export function resolveCustomExerciseMediaInputToAbsoluteUrl(raw: string, siteOrigin: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return isAllowedPosterUrl(trimmed) ? trimmed : null;
  }
  const path = parseRepoEjerciciosMediaPath(trimmed);
  if (!path) return null;
  const origin = siteOrigin.replace(/\/$/, "");
  try {
    const href = new URL(path, `${origin}/`).href;
    return isAllowedPosterUrl(href) ? href : null;
  } catch {
    return null;
  }
}

export type ExerciseMediaOverride = {
  demo_video_url?: string;
  demo_poster_url?: string;
};
