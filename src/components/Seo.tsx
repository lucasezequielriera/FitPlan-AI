import Head from "next/head";

export const SITE_URL = "https://www.fitplan-ai.com";

type SeoProps = {
  /** Título único de la página. Sin el sufijo de marca: se añade solo. */
  title: string;
  /**
   * Descripción única, de 120 a 160 caracteres. Por debajo de ~120 los
   * buscadores la marcan como demasiado corta y suelen reescribirla ellos,
   * con lo que se pierde el control del texto que aparece en resultados.
   */
  description: string;
  /** Ruta de esta página sin dominio, ej. "/legal/terms". */
  path: string;
  /** Ruta de la versión en español, si esta página tiene par bilingüe. */
  esPath?: string;
  /** Ruta de la versión en inglés, si esta página tiene par bilingüe. */
  enPath?: string;
  locale?: "es" | "en";
  /** Páginas privadas o sin valor de búsqueda (pagos, planes de cliente). */
  noindex?: boolean;
  image?: string;
};

/**
 * Etiquetas SEO por página.
 *
 * Existe porque `_app.tsx` define un título y una descripción por defecto que
 * heredan todas las páginas sin `<Head>` propio: el resultado eran varias
 * URLs compartiendo exactamente el mismo título y la misma descripción, que
 * es justo lo que penalizan los buscadores (y lo que reportaba Bing).
 *
 * Añade además dos cosas que no estaban en ninguna página:
 * - `canonical`, para que las variantes de una misma URL no compitan entre sí.
 * - `hreflang`, para que las versiones en español e inglés se declaren como
 *   traducciones y no como contenido duplicado.
 */
export default function Seo({
  title,
  description,
  path,
  esPath,
  enPath,
  locale = "es",
  noindex = false,
  image,
}: SeoProps) {
  const fullTitle = title.includes("FitPlan") ? title : `${title} | FitPlan`;
  const canonical = `${SITE_URL}${path}`;
  const ogImage = image || `${SITE_URL}/brand/icon-social.png`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {esPath && <link rel="alternate" hrefLang="es" href={`${SITE_URL}${esPath}`} />}
      {enPath && <link rel="alternate" hrefLang="en" href={`${SITE_URL}${enPath}`} />}
      {esPath && <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}${esPath}`} />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={locale === "en" ? "en_US" : "es_ES"} />

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Head>
  );
}
