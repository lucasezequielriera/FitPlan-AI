import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon SVG con el mismo ícono del navbar (manzana) */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* Fallback PNG para navegadores que no soportan SVG en favicon */}
        <link rel="icon" type="image/png" href="/icon.PNG" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon.PNG" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
