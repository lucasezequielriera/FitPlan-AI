/**
 * IndexNow: avisa a Bing (y a Yandex, Seznam y demás motores que lo
 * implementan) de que una URL ha cambiado, en vez de esperar a que pasen a
 * rastrearla por su cuenta.
 *
 * La verificación es por archivo: el motor comprueba que
 * https://www.fitplan-ai.com/<clave>.txt existe y contiene exactamente la
 * clave. Por eso la clave no es un secreto — es pública por diseño y vive en
 * `public/`. Si se cambia aquí, hay que renombrar también ese archivo.
 */
export const INDEXNOW_KEY = "a1f7c93e5b8d42061c7fa9e3d5b81420";

const HOST = "www.fitplan-ai.com";
const SITE_URL = `https://${HOST}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

export type IndexNowResult = {
  ok: boolean;
  status: number;
  submitted: number;
  message: string;
};

/**
 * Interpretación de los códigos que devuelve IndexNow. Se traducen a mensajes
 * accionables porque un 403 (clave no encontrada) y un 422 (URL que no
 * pertenece al host) se arreglan de formas completamente distintas.
 */
function describeStatus(status: number): { ok: boolean; message: string } {
  switch (status) {
    case 200:
      return { ok: true, message: "URLs enviadas correctamente." };
    case 202:
      return { ok: true, message: "URLs aceptadas; la clave aún se está validando." };
    case 400:
      return { ok: false, message: "Petición mal formada." };
    case 403:
      return { ok: false, message: `Clave no válida: comprueba que ${SITE_URL}/${INDEXNOW_KEY}.txt es accesible y contiene la clave.` };
    case 422:
      return { ok: false, message: "Alguna URL no pertenece al dominio declarado." };
    case 429:
      return { ok: false, message: "Demasiadas peticiones. Espera antes de reintentar." };
    default:
      return { ok: false, message: `Respuesta inesperada de IndexNow (${status}).` };
  }
}

/**
 * Envía un lote de URLs a IndexNow. Acepta rutas ("/plan") o URLs completas.
 * El protocolo admite hasta 10.000 URLs por petición, muy por encima de lo
 * que este sitio necesita.
 */
export async function submitUrlsToIndexNow(urls: string[]): Promise<IndexNowResult> {
  const urlList = urls
    .map((u) => (u.startsWith("http") ? u : `${SITE_URL}${u.startsWith("/") ? u : `/${u}`}`))
    .filter((u) => u.startsWith(SITE_URL));

  if (urlList.length === 0) {
    return { ok: false, status: 0, submitted: 0, message: "No hay URLs válidas que enviar." };
  }

  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  });

  const { ok, message } = describeStatus(resp.status);
  return { ok, status: resp.status, submitted: urlList.length, message };
}

/**
 * Páginas públicas indexables. Deliberadamente NO incluye /dashboard, /plan,
 * /mi-plan/* ni /payment/*: requieren sesión o no aportan nada en búsqueda, y
 * enviarlas solo gasta cuota y ensucia el índice.
 */
export const INDEXABLE_PATHS = [
  "/",
  "/en",
  // La landing de HYROX. NO se incluye "/hyrox/plan": es la app tras login y
  // sirve un esqueleto vacío sin sesión, así que en el índice solo estorba.
  "/hyrox",
  "/transformacion-fitplan",
  "/en/transformacion-fitplan",
  "/formulario-de-inicio",
  "/en/formulario-de-inicio",
  "/create-plan",
  "/legal/terms",
  "/legal/privacy",
  "/legal/disclaimer",
  "/legal/cookies",
  "/legal/refund",
  "/legal/liability",
  "/legal/contact",
];
