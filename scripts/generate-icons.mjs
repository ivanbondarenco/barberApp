// Genera los íconos PWA (PNG) a partir de un SVG con la marca D.S Studio.
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = new URL("../public/icons/", import.meta.url);

/** padding: proporción de zona segura (maskable necesita ~20%). */
function svg(size, padding) {
  const inner = size * (1 - padding * 2);
  const offset = size * padding;
  const s = inner / 120;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${padding ? 0 : size * 0.22}" fill="#1D4ED8"/>
  <g transform="translate(${offset} ${offset}) scale(${s})">
    <text x="60" y="76" text-anchor="middle" font-size="54" fill="#FFFFFF"
      font-family="Georgia, 'Times New Roman', serif" font-weight="700" letter-spacing="-2">DS</text>
    <line x1="28" y1="88" x2="92" y2="88" stroke="#DCE1FF" stroke-width="2" stroke-opacity="0.7"/>
    <text x="60" y="102" text-anchor="middle" font-size="9.5" fill="#DCE1FF"
      font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="2.4">STUDIO</text>
  </g>
</svg>`;
}

await mkdir(OUT, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, padding: 0.04 },
  { file: "icon-512.png", size: 512, padding: 0.04 },
  { file: "maskable-512.png", size: 512, padding: 0.16 },
  { file: "apple-touch-icon.png", size: 180, padding: 0.08 },
];

for (const { file, size, padding } of targets) {
  await sharp(Buffer.from(svg(size, padding))).png().toFile(fileURLToPath(new URL(file, OUT)));
  console.log(`✓ public/icons/${file}`);
}
