#!/usr/bin/env node
/**
 * Exporta las plantillas de social-media/plantillas a videos verticales y PNG listos para subir.
 *
 *   node social-media/render.mjs            → todo
 *   node social-media/render.mjs gancho     → solo los trabajos cuyo nombre contiene "gancho"
 *   node social-media/render.mjs --lista    → muestra los trabajos sin renderizar
 *
 * Cómo funciona: abre cada plantilla en Chromium (el de Playwright, ya instalado para los tests),
 * congela todas las animaciones CSS y avanza cuadro por cuadro a 30 fps. Cada cuadro va a ffmpeg.
 * Así el video sale exacto, sin cuadros en blanco ni tirones, aunque la compu esté ocupada.
 *
 * Formato de salida:
 *   - Si hay un ffmpeg instalado en el sistema → MP4 H.264 (sube directo a Instagram, TikTok y YouTube).
 *   - Si no → WebM con el ffmpeg que trae Playwright (TikTok y YouTube lo aceptan; para Instagram,
 *     pasalo por CapCut o instalá ffmpeg: `winget install ffmpeg`).
 *
 * Los textos de cada video se cambian en la lista TRABAJOS, con los parámetros de cada plantilla.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { HISTORIAS, POSTS } from "./contenido-perfil.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "export");
const FPS = 30;

/** Dominio real del link de reservas. Cambialo acá y se actualiza en todas las piezas. */
const LINK = "tudominio.com/b/tu-barberia";

// ─── Trabajos ────────────────────────────────────────────────────────────────────────────────
// video: plantilla animada → export/videos/<nombre>.mp4|webm
// png:   plantilla quieta  → export/<carpeta>/<nombre>.png (se fotografía el último cuadro)

const V = (nombre, plantilla, segundos, params = {}) => ({ tipo: "video", nombre, plantilla, segundos, params });
const P = (nombre, plantilla, params = {}, size = [1080, 1920], carpeta = "portadas") => ({ tipo: "png", nombre, plantilla, params, size, carpeta });

const TRABAJOS = [
  // Ganchos (primeros 3 s). Se pegan delante de una toma real o se usan solos.
  V("gancho-01-cuaderno", "hook", 3.6, { tag: "Para barberos", texto: "¿Seguís anotando turnos en un *cuaderno?*", sub: "Mirá esto antes del próximo sábado." }),
  V("gancho-02-plantado", "hook", 3.6, { tag: "Te pasó", texto: "Te dejaron *plantado* un sábado a las 11.", sub: "Esto no vuelve a pasar." }),
  V("gancho-03-whatsapp", "hook", 3.6, { tag: "Para dueños", texto: "Cortás con una mano y contestás *WhatsApp* con la otra.", sub: "Hay otra forma." }),
  V("gancho-04-comisiones", "hook", 3.6, { tag: "Fin de mes", texto: "¿Cuánto le debés a cada *barbero?*", sub: "Respondé en 3 segundos." }),
  V("gancho-05-precio", "hook", 3.6, { tag: "Precio real", texto: "Una app de turnos que cuesta *2 cortes.*", sub: "Ni uno más." }),
  V("gancho-06-noche", "hook", 3.6, { tag: "Son las 23:40", texto: "Y te siguen pidiendo *turno* por mensaje.", sub: "Que reserven solos." }),

  // Demos de producto
  V("demo-agenda", "agenda", 7.5),
  V("demo-notificaciones", "notificaciones", 7),
  V("demo-antes-despues", "antes-despues", 7.5),
  V("demo-precio", "precio", 10),
  V("demo-ausencias", "ausencias", 7),
  V("demo-pasos", "pasos", 6.5, { link: LINK }),

  // Cierre de todos los videos
  V("cierre-link-bio", "cierre", 4),
  V("cierre-palabra-clave", "cierre", 4, { boton: "Comentá AGENDA", pie: "Te mandamos el link por mensaje" }),

  // Portadas de la grilla (una por guion de guiones.md)
  P("portada-01", "portada", { num: "#01", titulo: "Chau *cuaderno* de turnos" }),
  P("portada-02", "portada", { num: "#02", titulo: "El cliente que *no vino*" }),
  P("portada-03", "portada", { num: "#03", titulo: "Turnos mientras *cortás*" }),
  P("portada-04", "portada", { num: "#04", titulo: "Cuánto *sale* de verdad" }),
  P("portada-05", "portada", { num: "#05", titulo: "Comisiones en *un toque*" }),
  P("portada-06", "portada", { num: "#06", titulo: "Tu link en *2 minutos*" }),
  P("portada-07", "portada", { serie: "POV", num: "#07", titulo: "Sábado *sin* WhatsApp" }),
  P("portada-08", "portada", { serie: "Mitos", num: "#08", titulo: "¿Mis clientes *descargan* algo?" }),
  P("portada-09", "portada", { serie: "Números", num: "#09", titulo: "Lo que te cuesta un *sillón vacío*" }),
  P("portada-10", "portada", { serie: "Equipo", num: "#10", titulo: "3 barberos, *una agenda*" }),
  P("portada-11", "portada", { serie: "Tienda", num: "#11", titulo: "Vendé la cera *antes* del corte" }),
  P("portada-12", "portada", { serie: "Barberos reales", num: "#12", titulo: "Lo probó un mes y *esto pasó*" }),

  // Perfil y destacados (1080 × 1080, se ven en círculo)
  ...["perfil", "agenda", "sena", "precio", "empezar", "clientes", "ayuda"].map((icono) =>
    P(icono === "perfil" ? "foto-perfil" : `destacado-${icono}`, "destacado", { icono }, [1080, 1080], "perfil"),
  ),
  // Tapa del destacado "Perfil" (distinta de la foto de perfil para que no se repita el sello).
  P("destacado-perfil", "destacado", { icono: "tijera" }, [1080, 1080], "perfil"),

  // Historias destacadas → export/historias/<destacado>/01.png, 02.png…  (textos en contenido-perfil.mjs)
  ...Object.entries(HISTORIAS).flatMap(([destacado, historias]) =>
    historias.map((h, i) => P(`${destacado}/${pad(i + 1)}`, "historia", h, [1080, 1920], "historias")),
  ),

  // Posts de carrusel → export/posts/<post>/01.png, 02.png…
  ...Object.entries(POSTS).flatMap(([post, slides]) =>
    slides.map((s, i) => P(`${post}/${pad(i + 1)}`, "post", { pag: `${i + 1}/${slides.length}`, ...s }, [1080, 1350], "posts")),
  ),
];

function pad(n) {
  return String(n).padStart(2, "0");
}

// ─── Motor ───────────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes("--lista")) {
  for (const t of TRABAJOS) console.log(`${t.tipo.padEnd(5)} ${t.nombre}`);
  process.exit(0);
}
const filtro = args.find((a) => !a.startsWith("--"));
const trabajos = TRABAJOS.filter((t) => !filtro || `${t.carpeta ?? "videos"}/${t.nombre}`.includes(filtro));
if (!trabajos.length) {
  console.error(`Ningún trabajo coincide con "${filtro}". Probá con --lista.`);
  process.exit(1);
}

const encoder = findEncoder();
if (trabajos.some((t) => t.tipo === "video")) {
  console.log(encoder.mp4 ? "ffmpeg del sistema → MP4 H.264" : "ffmpeg de Playwright → WebM (instalá ffmpeg para MP4)");
}

const browser = await launch();
try {
  for (const t of trabajos) {
    const [w, h] = t.size ?? [1080, 1920];
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const url = pathToFileURL(join(ROOT, "plantillas", `${t.plantilla}.html`));
    url.search = new URLSearchParams(t.params).toString();
    await page.goto(url.href, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
      document.getAnimations().forEach((a) => a.pause());
    });

    if (t.tipo === "png") {
      const file = join(OUT, t.carpeta, `${t.nombre}.png`);
      mkdirSync(dirname(file), { recursive: true });
      await seek(page, 60);
      await page.screenshot({ path: file });
      console.log(`✓ ${t.carpeta}/${t.nombre}.png`);
    } else {
      const dir = join(OUT, "videos");
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${t.nombre}.${encoder.mp4 ? "mp4" : "webm"}`);
      const ff = spawn(encoder.bin, encoder.args(file), { stdio: ["pipe", "ignore", "inherit"] });
      const done = new Promise((ok, fail) => ff.on("close", (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg salió con ${c}`)))));
      const frames = Math.round(t.segundos * FPS);
      for (let f = 0; f < frames; f++) {
        await seek(page, f / FPS);
        const jpg = await page.screenshot({ type: "jpeg", quality: 95 });
        if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
      }
      ff.stdin.end();
      await done;
      console.log(`✓ videos/${t.nombre} (${t.segundos}s)`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

/** El Chromium de Playwright si está descargado; si no, el Chrome o el Edge de la compu. */
async function launch() {
  for (const channel of [undefined, "chrome", "msedge"]) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch {}
  }
  console.error("No encontré ningún navegador. Corré `npx playwright install chromium`.");
  process.exit(1);
}

/** Pone todas las animaciones de la página en el segundo `s`. */
function seek(page, s) {
  return page.evaluate((ms) => {
    document.getAnimations().forEach((a) => {
      a.pause();
      a.currentTime = ms;
    });
  }, s * 1000);
}

function findEncoder() {
  const input = ["-loglevel", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "pipe:0", "-an"];
  if (spawnSync("ffmpeg", ["-version"]).status === 0) {
    return {
      mp4: true,
      bin: "ffmpeg",
      args: (out) => [...input, "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
    };
  }
  const bin = playwrightFfmpeg();
  if (!bin) {
    console.error("No encontré ffmpeg. Instalalo (winget install ffmpeg) o corré `npx playwright install ffmpeg`.");
    process.exit(1);
  }
  return {
    mp4: false,
    bin,
    args: (out) => [...input, "-c:v", "vp8", "-b:v", "12M", "-crf", "4", "-qmin", "0", "-qmax", "24", "-deadline", "good", "-cpu-used", "1", "-auto-alt-ref", "0", out],
  };
}

function playwrightFfmpeg() {
  const bases = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "ms-playwright"),
    join(homedir(), "Library", "Caches", "ms-playwright"),
    join(homedir(), ".cache", "ms-playwright"),
  ].filter(Boolean);
  for (const base of bases) {
    if (!existsSync(base)) continue;
    for (const d of readdirSync(base).filter((n) => n.startsWith("ffmpeg")).sort().reverse()) {
      for (const exe of ["ffmpeg-win64.exe", "ffmpeg-linux", "ffmpeg-mac"]) {
        const p = join(base, d, exe);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}
