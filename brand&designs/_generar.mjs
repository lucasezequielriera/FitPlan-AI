import fs from "fs";
import path from "path";
import sharp from "sharp";

/**
 * Generador de assets de marca de FitPlan — FUENTE ÚNICA DE VERDAD.
 * ------------------------------------------------------------------
 * Todo lo que hay en brand&designs/ y los assets de marca de public/
 * salen de acá. No editar esos archivos a mano: se pisan al correr
 *
 *     node "brand&designs/_generar.mjs"
 *
 * Paleta: "FitPlan Volt" (ver DESIGN_SYSTEM.md). El mark va en lima
 * sólido — el degradado no funciona sobre este trazo (el stop claro cae
 * en una zona que el trazo no ocupa y el logo sale coral/magenta).
 */

const ROOT = "brand&designs";

/** Lima de marca (--accent) y negro neutro de fondo (--background). */
const LIMA = "#cbff3d";
const NEGRO = "#08090c";
const BLANCO = "#FFFFFF";
/** Monocromo oscuro para fondos claros (impresión, ropa, favicon claro). */
const TINTA = "#0B1220";
/** Fondo claro para las variantes sobre blanco. */
const PAPEL = "#EDF1F7";

/**
 * La zancada. El trazo real ocupa 750x608 y su centro NO coincide con el del
 * lienzo, así que todo se compone a partir de este recuadro medido y no de un
 * cuadrado de 1024: es lo que evita que quede descentrado o se corte.
 */
const BOX = { x: 150, y: 264, w: 750, h: 608 };
const PATHS = `
  <path d="M150 852 C 214 700, 318 566, 456 470 C 386 618, 336 742, 316 866 Z"/>
  <path d="M556 872 C 636 662, 748 458, 900 264 C 852 500, 780 700, 690 872 Z"/>`;

/** Marca sola, recorte ajustado al trazo. Para incrustar donde haga falta. */
function markSvg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}" width="${BOX.w}" height="${BOX.h}">
<g fill="${fill}">${PATHS}</g>
</svg>`;
}

/**
 * Icono cuadrado. La marca se escala para ocupar `ratio` del lado y se centra
 * por cálculo sobre su recuadro real, no sobre el lienzo original.
 */
function iconSvg({ fill = LIMA, bg = null, radius = 0, ratio = 0.62, size = 1024 }) {
  const scale = (size * ratio) / BOX.w;
  const w = BOX.w * scale;
  const h = BOX.h * scale;
  const tx = (size - w) / 2 - BOX.x * scale;
  const ty = (size - h) / 2 - BOX.y * scale;
  const bgEl = bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
${bgEl}<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})" fill="${fill}">${PATHS}</g>
</svg>`;
}

// ---------------------------------------------------------------------------
// SVG fuente
// ---------------------------------------------------------------------------

const SVGS = {
  // --- La marca sola, siempre con fondo transparente ---
  "logo/svg/marca-lima.svg": markSvg(LIMA),
  "logo/svg/marca-blanco.svg": markSvg(BLANCO),
  "logo/svg/marca-negro.svg": markSvg(TINTA),

  // --- Íconos cuadrados: transparente y sobre negro ---
  // A sangre y opacos: Apple rechaza íconos con transparencia o esquinas
  // redondeadas (el sistema aplica su propia máscara), e Instagram recorta en
  // círculo, así que un borde redondeado dejaría huecos.
  "app-icons/icono-negro.svg": iconSvg({ bg: NEGRO }),
  "app-icons/icono-transparente.svg": iconSvg({}),
  "app-icons/icono-claro.svg": iconSvg({ fill: TINTA, bg: PAPEL }),
  // Redondeado: para usar dentro de la web, donde el borde no lo pone el sistema.
  "app-icons/icono-redondeado-negro.svg": iconSvg({ bg: NEGRO, radius: 230 }),
  // Maskable de PWA: Android recorta hasta ~20% del borde, así que la marca va
  // más chica para que no se coma el trazo.
  "app-icons/icono-maskable.svg": iconSvg({ bg: NEGRO, ratio: 0.48 }),
};

for (const [rel, content] of Object.entries(SVGS)) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

// ---------------------------------------------------------------------------
// PNG derivados. [origen, destino, tamaño]
// ---------------------------------------------------------------------------

const CUADRADO_TRANSPARENTE = "app-icons/icono-transparente.svg";
const CUADRADO_NEGRO = "app-icons/icono-negro.svg";

const PNGS = [
  // --- La marca sola ---
  ["logo/svg/marca-lima.svg", "logo/png/marca-lima-1024.png", 1024],
  ["logo/svg/marca-blanco.svg", "logo/png/marca-blanco-1024.png", 1024],
  ["logo/svg/marca-negro.svg", "logo/png/marca-negro-1024.png", 1024],

  // --- Íconos de app ---
  [CUADRADO_NEGRO, "app-icons/ios-1024.png", 1024],
  [CUADRADO_NEGRO, "app-icons/ios-180.png", 180],
  [CUADRADO_NEGRO, "app-icons/android-512.png", 512],
  [CUADRADO_NEGRO, "app-icons/android-192.png", 192],
  ["app-icons/icono-maskable.svg", "app-icons/maskable-512.png", 512],
  [CUADRADO_NEGRO, "app-icons/favicon-48.png", 48],
  [CUADRADO_NEGRO, "app-icons/favicon-32.png", 32],
  [CUADRADO_NEGRO, "app-icons/favicon-16.png", 16],
  [CUADRADO_TRANSPARENTE, "app-icons/icono-transparente-1024.png", 1024],
  [CUADRADO_TRANSPARENTE, "app-icons/icono-transparente-512.png", 512],

  // --- Redes sociales: cada una con su tamaño de perfil recomendado,
  //     en transparente y sobre negro. ---
  [CUADRADO_TRANSPARENTE, "redes/instagram/perfil-1000-transparente.png", 1000],
  [CUADRADO_NEGRO, "redes/instagram/perfil-1000-negro.png", 1000],
  [CUADRADO_TRANSPARENTE, "redes/tiktok/perfil-1024-transparente.png", 1024],
  [CUADRADO_NEGRO, "redes/tiktok/perfil-1024-negro.png", 1024],
  [CUADRADO_TRANSPARENTE, "redes/x/perfil-400-transparente.png", 400],
  [CUADRADO_NEGRO, "redes/x/perfil-400-negro.png", 400],
  [CUADRADO_TRANSPARENTE, "redes/facebook/perfil-500-transparente.png", 500],
  [CUADRADO_NEGRO, "redes/facebook/perfil-500-negro.png", 500],
  [CUADRADO_TRANSPARENTE, "redes/linkedin/perfil-400-transparente.png", 400],
  [CUADRADO_NEGRO, "redes/linkedin/perfil-400-negro.png", 400],
  [CUADRADO_TRANSPARENTE, "redes/youtube/perfil-800-transparente.png", 800],
  [CUADRADO_NEGRO, "redes/youtube/perfil-800-negro.png", 800],
  // Gmail/WhatsApp: la foto se ve chica y recortada en círculo.
  [CUADRADO_TRANSPARENTE, "redes/gmail/perfil-500-transparente.png", 500],
  [CUADRADO_NEGRO, "redes/gmail/perfil-500-negro.png", 500],
  [CUADRADO_TRANSPARENTE, "redes/gmail/perfil-250-transparente.png", 250],
  [CUADRADO_NEGRO, "redes/gmail/perfil-250-negro.png", 250],

  // --- Marca de agua para vídeo/imagen ---
  ["logo/svg/marca-blanco.svg", "redes/marca-de-agua-blanca-1024.png", 1024],
  ["logo/svg/marca-lima.svg", "redes/marca-de-agua-lima-1024.png", 1024],

  // --- Vestuario: alta resolución, monocromo para estampado ---
  ["logo/svg/marca-negro.svg", "ropa/marca-negro-4000.png", 4000],
  ["logo/svg/marca-blanco.svg", "ropa/marca-blanco-4000.png", 4000],
];

const rows = [];
for (const [src, dest, size] of PNGS) {
  // La marca suelta no es cuadrada: se ajusta a lo ancho y conserva proporción.
  const isSquare = src.includes("app-icons/");
  const img = sharp(path.join(ROOT, src), { density: 600 });
  const buf = isSquare
    ? await img.resize(size, size).png().toBuffer()
    : await img.resize({ width: size }).png().toBuffer();
  const p = path.join(ROOT, dest);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
  const meta = await sharp(buf).metadata();
  rows.push(`${dest.padEnd(52)} ${meta.width}x${meta.height}`);
}

// ---------------------------------------------------------------------------
// favicon.ico — sharp no escribe .ico, así que se arma el contenedor a mano.
// (Antes se generaba fuera de este script y por eso quedó desactualizado con
// el logo viejo mientras todo lo demás ya estaba en lima.)
// ---------------------------------------------------------------------------

async function buildIco(srcSvg, destRel, sizes = [16, 32, 48]) {
  const pngs = [];
  for (const s of sizes) {
    pngs.push(await sharp(path.join(ROOT, srcSvg), { density: 600 }).resize(s, s).png().toBuffer());
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + 16 * sizes.length;
  const entries = pngs.map((png, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 0); // ancho (0 = 256)
    e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 1); // alto
    e.writeUInt8(0, 2); // colores de paleta
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por píxel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });

  const p = path.join(ROOT, destRel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.concat([header, ...entries, ...pngs]));
  rows.push(`${destRel.padEnd(52)} ${sizes.join("/")}`);
}

await buildIco(CUADRADO_NEGRO, "app-icons/favicon.ico");


// ---------------------------------------------------------------------------
// colores/ — se derivan de src/styles/globals.css, que es donde vive la paleta
// de verdad. Antes eran archivos escritos a mano y se quedaron atrás: el
// `tokens.css` que se entregaba seguía describiendo la paleta azul/cian y un
// tema "Pro" dorado que ya no existe (issue #24). Cualquiera que abriera la
// carpeta de marca para saber los colores de FitPlan se llevaba los viejos.
//
// Generarlos evita el problema de raíz: no pueden desviarse de lo que la app
// pinta de verdad, porque salen de ahí.
// ---------------------------------------------------------------------------

/** Tokens con valor hexadecimal literal del `:root` de globals.css. */
function leerTokensDeLaApp() {
  const css = fs.readFileSync("src/styles/globals.css", "utf8");
  const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
  const tokens = new Map();
  for (const m of root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens.set(m[1], m[2].toLowerCase());
  }
  return tokens;
}

const TOKENS_APP = leerTokensDeLaApp();

const tokensCss = [
  "/**",
  " * Colores de FitPlan AI — paleta \"Volt\".",
  " *",
  " * GENERADO. No editar a mano: sale de src/styles/globals.css al correr",
  " * `node \"brand&designs/_generar.mjs\"`. Editar aquí se pierde, y peor: haría",
  " * que este archivo volviera a mentir sobre los colores reales de la app,",
  " * que es justo lo que motivó el issue #24.",
  " */",
  "",
  ":root {",
  ...[...TOKENS_APP].map(([nombre, hex]) => `  --${nombre}: ${hex};`),
  "}",
  "",
].join("\n");

fs.mkdirSync(path.join(ROOT, "colores"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "colores/tokens.css"), tokensCss);
rows.push(`→ ${ROOT}/colores/tokens.css (${TOKENS_APP.size} tokens)`);

// paleta.png — una muestra por token, para mirarla de un vistazo.
{
  const entradas = [...TOKENS_APP];
  const COL = 220, FILA = 120, PORFILA = 4;
  const filas = Math.ceil(entradas.length / PORFILA);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${COL * PORFILA}" height="${FILA * filas}">
    <rect width="100%" height="100%" fill="${NEGRO}"/>
    ${entradas.map(([nombre, hex], i) => {
      const x = (i % PORFILA) * COL, y = Math.floor(i / PORFILA) * FILA;
      return `<rect x="${x + 12}" y="${y + 12}" width="${COL - 24}" height="${FILA - 46}" rx="10" fill="${hex}"/>
        <text x="${x + 14}" y="${y + FILA - 16}" font-family="monospace" font-size="13" fill="#f5f7f2">--${nombre}</text>
        <text x="${x + 14}" y="${y + FILA - 2}" font-family="monospace" font-size="11" fill="#f5f7f2" opacity="0.6">${hex}</text>`;
    }).join("")}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(ROOT, "colores/paleta.png"));
  rows.push(`→ ${ROOT}/colores/paleta.png`);
}

// ---------------------------------------------------------------------------
// Copia a public/ — la app sirve estos archivos. Se copian desde acá para que
// no puedan quedar desincronizados con los entregables de marca.
// ---------------------------------------------------------------------------

const A_PUBLIC = [
  ["app-icons/icono-redondeado-negro.svg", "public/favicon.svg"],
  ["app-icons/favicon.ico", "public/favicon.ico"],
  ["app-icons/icono-negro.svg", "public/brand/icon-social.svg"],
  ["app-icons/ios-1024.png", "public/brand/icon-social.png"],
  ["app-icons/icono-transparente.svg", "public/brand/icon-social-transparent.svg"],
  ["app-icons/icono-transparente-1024.png", "public/brand/icon-social-transparent.png"],
  ["app-icons/android-192.png", "public/brand/icon-192.png"],
  ["app-icons/android-512.png", "public/brand/icon-512.png"],
  ["app-icons/maskable-512.png", "public/brand/icon-maskable-512.png"],
];

for (const [src, dest] of A_PUBLIC) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, src), dest);
  rows.push(`→ ${dest}`);
}

console.log(rows.join("\n"));
