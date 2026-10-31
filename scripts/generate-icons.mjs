// Genera los íconos PWA (PNG) a partir del ícono de la app: public/icons/app-icon.svg.
// El favicon (public/favicon.svg) se sirve tal cual, en SVG.
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = new URL("../public/icons/", import.meta.url);
const SOURCE = await readFile(new URL("app-icon.svg", OUT));
/** Fondo del ícono: rellena las esquinas donde el sistema no las recorta. */
const BACKGROUND = "#0A1020";

/**
 * - `rounded`: el ícono tal cual, con sus esquinas redondeadas y transparentes (Android "any").
 * - `fullBleed`: sobre un cuadrado lleno del color de fondo. iOS y las máscaras de Android
 *   recortan la forma por su cuenta; con esquinas transparentes quedarían bordes negros.
 *   `scale` achica el dibujo para que entre en la zona segura de un ícono maskable (~80%).
 */
async function render(size, { fullBleed = false, scale = 1 } = {}) {
  const inner = Math.round(size * scale);
  const icon = await sharp(SOURCE, { density: 384 }).resize(inner, inner).png().toBuffer();
  if (!fullBleed) return sharp(icon);
  return sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } }).composite([
    { input: icon, gravity: "center" },
  ]);
}

await mkdir(OUT, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "maskable-512.png", size: 512, fullBleed: true, scale: 0.8 },
  { file: "apple-touch-icon.png", size: 180, fullBleed: true },
];

for (const { file, size, ...options } of targets) {
  const image = await render(size, options);
  await image.png().toFile(fileURLToPath(new URL(file, OUT)));
  console.log(`✓ public/icons/${file}`);
}
