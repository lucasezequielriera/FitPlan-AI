import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = "brand&designs";

/** La zancada: dos masas en tensión, una que empuja y otra que despega. */
const MARK = `
  <path d="M150 852 C 214 700, 318 566, 456 470 C 386 618, 336 742, 316 866 Z"/>
  <path d="M556 872 C 636 662, 748 458, 900 264 C 852 500, 780 700, 690 872 Z"/>`;

const GRAD = `<defs><linearGradient id="g" x1="8%" y1="10%" x2="92%" y2="90%">
    <stop offset="0%" stop-color="#3B82F6"/><stop offset="52%" stop-color="#22D3EE"/><stop offset="100%" stop-color="#10E5B0"/>
  </linearGradient></defs>`;

const GRAD_PRO = `<defs><linearGradient id="g" x1="8%" y1="10%" x2="92%" y2="90%">
    <stop offset="0%" stop-color="#B08D3F"/><stop offset="50%" stop-color="#E3C77E"/><stop offset="100%" stop-color="#9C7C33"/>
  </linearGradient></defs>`;

/** bg=null deja el fondo transparente. */
function svg({ fill, bg = null, grad = null, pad = 0, radius = 0 }) {
  const size = 1024;
  const inner = size - pad * 2;
  const bgEl = bg
    ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
${grad || ""}${bgEl}
<g transform="translate(${pad} ${pad}) scale(${inner / size})" fill="${fill}">${MARK}</g>
</svg>`;
}

const SVGS = {
  "logo/svg/zancada-negro.svg":            svg({ fill: "#0B1220" }),
  "logo/svg/zancada-blanco.svg":           svg({ fill: "#FFFFFF" }),
  "logo/svg/zancada-gradiente.svg":        svg({ fill: "url(#g)", grad: GRAD }),
  "logo/svg/zancada-gradiente-pro.svg":    svg({ fill: "url(#g)", grad: GRAD_PRO }),
  "logo/svg/zancada-azul.svg":             svg({ fill: "#3B82F6" }),
  "app-icons/icono-fondo-oscuro.svg":      svg({ fill: "url(#g)", grad: GRAD, bg: "#080E18", pad: 150, radius: 230 }),
  "app-icons/icono-fondo-claro.svg":       svg({ fill: "#0B1220", bg: "#EDF1F7", pad: 150, radius: 230 }),
  "app-icons/icono-pro.svg":               svg({ fill: "url(#g)", grad: GRAD_PRO, bg: "#0A0A0C", pad: 150, radius: 230 }),
};

for (const [rel, content] of Object.entries(SVGS)) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

/** [origen svg, destino png, tamaño] */
const PNGS = [
  // Iconos de aplicación
  ["app-icons/icono-fondo-oscuro.svg", "app-icons/ios-1024.png", 1024],
  ["app-icons/icono-fondo-oscuro.svg", "app-icons/ios-180.png", 180],
  ["app-icons/icono-fondo-oscuro.svg", "app-icons/android-512.png", 512],
  ["app-icons/icono-fondo-oscuro.svg", "app-icons/android-192.png", 192],
  ["app-icons/icono-fondo-oscuro.svg", "app-icons/favicon-48.png", 48],
  ["app-icons/icono-fondo-oscuro.svg", "app-icons/favicon-32.png", 32],
  ["app-icons/icono-fondo-oscuro.svg", "app-icons/favicon-16.png", 16],
  ["app-icons/icono-fondo-claro.svg",  "app-icons/ios-1024-claro.png", 1024],
  ["app-icons/icono-pro.svg",          "app-icons/ios-1024-pro.png", 1024],
  // Redes sociales
  ["app-icons/icono-fondo-oscuro.svg", "redes/perfil-400.png", 400],
  ["app-icons/icono-fondo-claro.svg",  "redes/perfil-400-claro.png", 400],
  ["app-icons/icono-pro.svg",          "redes/perfil-400-pro.png", 400],
  // Marca de agua para vídeo (transparente)
  ["logo/svg/zancada-blanco.svg",      "redes/marca-de-agua-blanca-512.png", 512],
  // Símbolo suelto, fondo transparente
  ["logo/svg/zancada-blanco.svg",      "logo/png/zancada-blanco-1024.png", 1024],
  ["logo/svg/zancada-negro.svg",       "logo/png/zancada-negro-1024.png", 1024],
  ["logo/svg/zancada-gradiente.svg",   "logo/png/zancada-gradiente-1024.png", 1024],
  ["logo/svg/zancada-gradiente-pro.svg","logo/png/zancada-gradiente-pro-1024.png", 1024],
  // Ropa: alta resolución, una sola tinta
  ["logo/svg/zancada-negro.svg",       "ropa/zancada-negro-4000.png", 4000],
  ["logo/svg/zancada-blanco.svg",      "ropa/zancada-blanco-4000.png", 4000],
];

const out = [];
for (const [src, dest, size] of PNGS) {
  const buf = await sharp(path.join(ROOT, src), { density: 600 }).resize(size, size).png().toBuffer();
  const p = path.join(ROOT, dest);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
  out.push(`${dest.padEnd(42)} ${size}px  ${(buf.length / 1024).toFixed(0)} KB`);
}
console.log(out.join("\n"));
