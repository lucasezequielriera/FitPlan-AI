import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="es" dir="ltr">
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="google-site-verification" content="AIU1Vt4igVkJkeerKrtEXN7CIczzApOEcfqpsJ3LL-I" />
        <meta name="facebook-domain-verification" content="ylgimnmeue1bdmd6qmfupenmz2b8nz" />

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
