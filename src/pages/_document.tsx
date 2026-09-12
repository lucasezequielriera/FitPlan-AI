import Document, { Html, Head, Main, NextScript, type DocumentContext, type DocumentInitialProps } from "next/document";

/**
 * El `lang` del `<html>` se deriva de la ruta.
 *
 * Estaba fijo en "es", así que `/en`, `/en/transformacion-fitplan` y
 * `/en/formulario-de-inicio` se servían declarando español (issue #29). Eso
 * afecta a dos cosas reales: un lector de pantalla pronuncia el inglés con
 * fonética española, y los buscadores reciben una señal de idioma que
 * contradice al `hreflang` de esas mismas páginas.
 *
 * Las rutas en inglés son manuales (no se usa el i18n nativo de Next), así que
 * no hay `locale` en el contexto y hay que mirar el path.
 */
type Props = DocumentInitialProps & { lang: string };

/** Idioma del documento a partir de la ruta servida. */
export function langForPath(path: string | undefined): string {
  if (!path) return "es";
  // `/en` y todo lo que cuelgue de él. `/entrenamiento` NO debe contar, de ahí
  // que se exija el final de cadena o una barra después.
  return /^\/en(\/|$|\?)/.test(path) ? "en" : "es";
}

export default class MiDocumento extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext): Promise<Props> {
    const initialProps = await Document.getInitialProps(ctx);
    // `asPath` incluye la ruta real servida; `pathname` puede traer el patrón
    // dinámico. Para esto sirve cualquiera de los dos, pero asPath es el que
    // refleja lo que pidió el visitante.
    return { ...initialProps, lang: langForPath(ctx.asPath ?? ctx.pathname) };
  }

  render() {
    return (
      <Html lang={this.props.lang} dir="ltr">
        <Head>
          <meta charSet="utf-8" />
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          <meta name="google-site-verification" content="AIU1Vt4igVkJkeerKrtEXN7CIczzApOEcfqpsJ3LL-I" />
          <meta name="facebook-domain-verification" content="ylgimnmeue1bdmd6qmfupenmz2b8nz" />
          <meta name="tiktok-developers-site-verification" content="cdhWGT09M37yU804mz7pkqEnHyNIMyoo" />

          {/* Favicons - .ico first for max compatibility */}
          <link rel="icon" href="/favicon.ico" sizes="32x32" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="apple-touch-icon" sizes="180x180" href="/brand/icon-social.png" />

          {/* Author credit */}
          <link rel="author" href="/humans.txt" />
          <link rel="author" href="https://www.lucasriera.com" />

          {/* Preconnect to critical origins */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
          <link rel="dns-prefetch" href="https://www.googleapis.com" />
        </Head>
        <body className="antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
