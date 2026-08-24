import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = "brand&designs";

/**
 * La zancada. El trazo real ocupa 750x608 y su centro NO coincide con el del
 * lienzo, así que todo se compone a partir de este recuadro medido y no de un
 * cuadrado de 1024: es lo que evita que quede descentrado o se corte.
 */
const BOX = { x: 150, y: 264, w: 750, h: 608 };
const PATHS = `
  <path d="M150 852 C 214 700, 318 566, 456 470 C 386 618, 336 742, 316 866 Z"/>
  <path d="M556 872 C 636 662, 748 458, 900 264 C 852 500, 780 700, 690 872 Z"/>`;

const GRADS = {
  main: `<stop offset="0%" stop-color="#3B82F6"/><stop offset="52%" stop-color="#22D3EE"/><stop offset="100%" stop-color="#10E5B0"/>`,
  pro: `<stop offset="0%" stop-color="#B08D3F"/><stop offset="50%" stop-color="#E3C77E"/><stop offset="100%" stop-color="#9C7C33"/>`,
};

/** Marca sola, recorte ajustado al trazo. Para incrustar donde haga falta. */
function markSvg(fill, grad) {
  const g = grad ? `<defs><linearGradient id="g" x1="8%" y1="10%" x2="92%" y2="90%">${GRADS[grad]}</linearGradient></defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}" width="${BOX.w}" height="${BOX.h}">
${g}<g fill="${grad ? "url(#g)" : fill}">${PATHS}</g>
</svg>`;
}

/**
 * Icono cuadrado. La marca se escala para ocupar `ratio` del lado y se centra
 * por cálculo sobre su recuadro real, no sobre el lienzo original.
 */
function iconSvg({ fill, grad, bg, radius = 0, ratio = 0.62, size = 1024 }) {
  const scale = (size * ratio) / BOX.w;
  const w = BOX.w * scale;
  const h = BOX.h * scale;
  const tx = (size - w) / 2 - BOX.x * scale;
  const ty = (size - h) / 2 - BOX.y * scale;
  const g = grad ? `<defs><linearGradient id="g" x1="8%" y1="10%" x2="92%" y2="90%">${GRADS[grad]}</linearGradient></defs>` : "";
  const bgEl = bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
${g}${bgEl}<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})" fill="${grad ? "url(#g)" : fill}">${PATHS}</g>
</svg>`;
}

const SVGS = {
  // Marca suelta, siempre transparente
  "logo/svg/marca-negro.svg": markSvg("#0B1220"),
  "logo/svg/marca-blanco.svg": markSvg("#FFFFFF"),
  "logo/svg/marca-azul.svg": markSvg("#3B82F6"),
  "logo/svg/marca-gradiente.svg": markSvg(null, "main"),
  "logo/svg/marca-gradiente-pro.svg": markSvg(null, "pro"),
  "logo/svg/marca-lima.svg": markSvg("#cbff3d"),
  // Iconos cuadrados con fondo
  // A sangre y opacos: Apple rechaza iconos con transparencia o esquinas
  // redondeadas (el sistema aplica la máscara), e Instagram recorta en círculo,
  // así que un borde redondeado dejaría huecos.
  "app-icons/icono-oscuro.svg": iconSvg({ grad: "main", bg: "#080E18" }),
  "app-icons/icono-claro.svg": iconSvg({ fill: "#0B1220", bg: "#EDF1F7" }),
  "app-icons/icono-pro.svg": iconSvg({ grad: "pro", bg: "#0A0A0C" }),
  // Redondeados, para usar dentro de la web donde el borde no lo pone el sistema.
  "app-icons/icono-redondeado-oscuro.svg": iconSvg({ grad: "main", bg: "#080E18", radius: 230 }),
  "app-icons/icono-redondeado-claro.svg": iconSvg({ fill: "#0B1220", bg: "#EDF1F7", radius: 230 }),
  // Iconos cuadrados transparentes (mismo encuadre, sin fondo)
  "app-icons/icono-transparente-blanco.svg": iconSvg({ fill: "#FFFFFF" }),
  "app-icons/icono-transparente-negro.svg": iconSvg({ fill: "#0B1220" }),
  "app-icons/icono-transparente-gradiente.svg": iconSvg({ grad: "main" }),
  "app-icons/icono-transparente-gradiente-pro.svg": iconSvg({ grad: "pro" }),
};

for (const [rel, content] of Object.entries(SVGS)) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

const PNGS = [
  ["app-icons/icono-oscuro.svg", "app-icons/ios-1024.png", 1024],
  ["app-icons/icono-oscuro.svg", "app-icons/ios-180.png", 180],
  ["app-icons/icono-oscuro.svg", "app-icons/android-512.png", 512],
  ["app-icons/icono-oscuro.svg", "app-icons/android-192.png", 192],
  ["app-icons/icono-oscuro.svg", "app-icons/favicon-48.png", 48],
  ["app-icons/icono-oscuro.svg", "app-icons/favicon-32.png", 32],
  ["app-icons/icono-oscuro.svg", "app-icons/favicon-16.png", 16],
  ["app-icons/icono-claro.svg", "app-icons/ios-1024-claro.png", 1024],
  ["app-icons/icono-pro.svg", "app-icons/ios-1024-pro.png", 1024],
  ["app-icons/icono-transparente-blanco.svg", "app-icons/icono-transparente-blanco-1024.png", 1024],
  ["app-icons/icono-transparente-gradiente.svg", "app-icons/icono-transparente-gradiente-1024.png", 1024],
  ["app-icons/icono-transparente-negro.svg", "app-icons/icono-transparente-negro-1024.png", 1024],
  ["app-icons/icono-transparente-gradiente-pro.svg", "app-icons/icono-transparente-pro-1024.png", 1024],
  ["app-icons/icono-transparente-blanco.svg", "app-icons/icono-transparente-blanco-512.png", 512],
  ["app-icons/icono-transparente-gradiente.svg", "app-icons/icono-transparente-gradiente-512.png", 512],
  ["app-icons/icono-redondeado-oscuro.svg", "app-icons/icono-redondeado-1024.png", 1024],
  ["app-icons/icono-oscuro.svg", "redes/perfil-400.png", 400],
  // TikTok pide 1024x1024 para la foto de perfil.
  ["app-icons/icono-oscuro.svg", "redes/perfiles/tiktok-1024-opaco-oscuro.png", 1024],
  ["app-icons/icono-claro.svg", "redes/perfiles/tiktok-1024-opaco-claro.png", 1024],
  ["app-icons/icono-pro.svg", "redes/perfiles/tiktok-1024-opaco-pro.png", 1024],
  ["app-icons/icono-transparente-gradiente.svg", "redes/perfiles/tiktok-1024-transparente-gradiente.png", 1024],
  ["app-icons/icono-transparente-blanco.svg", "redes/perfiles/tiktok-1024-transparente-blanco.png", 1024],
  ["app-icons/icono-claro.svg", "redes/perfil-400-claro.png", 400],
  ["app-icons/icono-pro.svg", "redes/perfil-400-pro.png", 400],
  ["logo/svg/marca-blanco.svg", "redes/marca-de-agua-blanca-1024.png", 1024],
  ["logo/svg/marca-blanco.svg", "logo/png/marca-blanco-1024.png", 1024],
  ["logo/svg/marca-negro.svg", "logo/png/marca-negro-1024.png", 1024],
  ["logo/svg/marca-gradiente.svg", "logo/png/marca-gradiente-1024.png", 1024],
  ["logo/svg/marca-gradiente-pro.svg", "logo/png/marca-gradiente-pro-1024.png", 1024],
  ["logo/svg/marca-lima.svg", "logo/png/marca-lima-1024.png", 1024],
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
  rows.push(`${dest.padEnd(50)} ${meta.width}x${meta.height}`);
}
console.log(rows.join("\n"));
