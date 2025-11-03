import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function exportPng(svgPath, outPath, size = 1080) {
  const svgFull = resolve(root, svgPath);
  const outFull = resolve(root, outPath);
  const svg = await readFile(svgFull);
  await sharp(svg, { density: 384 }) // alta densidad para nitidez
    .png({ compressionLevel: 9 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(outFull);
  console.log(`✅ Exportado ${outPath}`);
}

async function run() {
  await exportPng('public/brand/icon-social.svg', 'public/brand/icon-social.png', 1080);
  await exportPng('public/brand/icon-social-transparent.svg', 'public/brand/icon-social-transparent.png', 1080);
}

run().catch((e) => {
  console.error('❌ Error exportando PNGs:', e);
  process.exit(1);
});


