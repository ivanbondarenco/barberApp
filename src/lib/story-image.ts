/**
 * Imagen de "turnos disponibles" para subir a la Historia de Instagram o al Estado de WhatsApp.
 *
 * Se dibuja en un canvas del navegador a 1080×1920 (9:16, el formato de los dos). Lo de arriba
 * y abajo del todo lo tapan los controles de cada app, así que el contenido queda en la franja
 * del medio.
 */

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export const STORY_COLORS = [
  { name: "Azul", value: "#1D4ED8" },
  { name: "Negro", value: "#111827" },
  { name: "Bordó", value: "#7F1D1D" },
  { name: "Verde", value: "#065F46" },
  { name: "Violeta", value: "#5B21B6" },
  { name: "Naranja", value: "#EA580C" },
  { name: "Rosa", value: "#DB2777" },
  { name: "Dorado", value: "#B8860B" },
  { name: "Crema", value: "#F5EBDD" },
];

export interface StoryContent {
  shopName: string;
  /** "Hoy · Martes 4 Noviembre" */
  dateLabel: string;
  /** "con Juan", o vacío si son todos los barberos. */
  subtitle?: string;
  times: string[];
  /** Llamado a la acción, ej. "¡Reservá tu turno!" */
  message: string;
  /** Link o usuario para reservar, ej. "barberapp.com/b/del-sur". */
  footer?: string;
  color: string;
  fontFamily?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean.padEnd(6, "0");
  const n = Number.parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** Luminancia relativa (WCAG) para decidir si el texto va blanco o oscuro. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightColor(hex: string): boolean {
  return luminance(hex) > 0.4;
}

/** Parte un texto en líneas que entren en `maxWidth`, como mucho `maxLines`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Grilla de horarios: la menor cantidad de columnas que hace entrar todo en el alto disponible. */
function layoutGrid(count: number, width: number, height: number) {
  const gap = 26;
  for (const cols of [3, 4, 5]) {
    const pillH = cols === 3 ? 118 : cols === 4 ? 100 : 88;
    const rows = Math.ceil(count / cols);
    if (rows * pillH + (rows - 1) * gap <= height) return { cols, rows, pillH, gap, pillW: (width - (cols - 1) * gap) / cols, shown: count };
  }
  const cols = 5;
  const pillH = 88;
  const rows = Math.max(1, Math.floor((height + gap) / (pillH + gap)));
  // Se deja el último lugar para el "+N".
  return { cols, rows, pillH, gap, pillW: (width - (cols - 1) * gap) / cols, shown: rows * cols - 1 };
}

/** Fondo: el color elegido hacia una versión más profunda, con dos círculos de adorno. */
function paintBackground(ctx: CanvasRenderingContext2D, color: string) {
  const W = STORY_WIDTH;
  const H = STORY_HEIGHT;
  const light = isLightColor(color);
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, shade(color, light ? 0.25 : 0.12));
  bg.addColorStop(1, shade(color, light ? -0.08 : -0.5));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = light ? "rgba(11,15,25,0.05)" : "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.arc(W + 60, 280, 380, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-120, H - 260, 340, 0, Math.PI * 2);
  ctx.fill();
}

/** Tinta, texto suave y relleno/borde de las tarjetas según si el fondo es claro u oscuro. */
function palette(color: string) {
  const light = isLightColor(color);
  return {
    ink: light ? "#0B0F19" : "#FFFFFF",
    soft: light ? "rgba(11,15,25,0.68)" : "rgba(255,255,255,0.78)",
    pillFill: light ? "rgba(11,15,25,0.08)" : "rgba(255,255,255,0.14)",
    pillStroke: light ? "rgba(11,15,25,0.16)" : "rgba(255,255,255,0.28)",
  };
}

/** Pie: llamado a la acción y dónde reservar. */
function paintFooter(ctx: CanvasRenderingContext2D, font: string, color: string, message: string, footer?: string) {
  const { ink, soft } = palette(color);
  const W = STORY_WIDTH;
  const inner = W - 180;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink;
  ctx.font = `800 54px ${font}`;
  let fy = 1610;
  for (const line of wrap(ctx, message, inner, 2)) {
    ctx.fillText(line, W / 2, fy);
    fy += 64;
  }
  if (footer) {
    ctx.fillStyle = soft;
    ctx.font = `500 36px ${font}`;
    ctx.fillText(wrap(ctx, footer, inner, 1)[0], W / 2, fy + 6);
  }
}

export function drawStory(canvas: HTMLCanvasElement, c: StoryContent) {
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = STORY_WIDTH;
  const font = c.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const { ink, soft, pillFill, pillStroke } = palette(c.color);
  paintBackground(ctx, c.color);

  const padX = 90;
  const inner = W - padX * 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Encabezado.
  let y = 330;
  ctx.fillStyle = soft;
  ctx.font = `700 34px ${font}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("TURNOS DISPONIBLES", W / 2, y);
  ctx.letterSpacing = "0px";

  y += 100;
  ctx.fillStyle = ink;
  ctx.font = `800 84px ${font}`;
  for (const line of wrap(ctx, c.shopName, inner, 2)) {
    ctx.fillText(line, W / 2, y);
    y += 96;
  }

  y += 10;
  ctx.font = `600 50px ${font}`;
  ctx.fillText(c.dateLabel, W / 2, y);
  if (c.subtitle) {
    y += 64;
    ctx.fillStyle = soft;
    ctx.font = `500 40px ${font}`;
    ctx.fillText(c.subtitle, W / 2, y);
  }

  // Horarios.
  const gridTop = y + 80;
  const gridBottom = 1500;
  if (!c.times.length) {
    ctx.fillStyle = soft;
    ctx.font = `600 52px ${font}`;
    ctx.fillText("Agenda completa", W / 2, (gridTop + gridBottom) / 2);
  } else {
    const g = layoutGrid(c.times.length, inner, gridBottom - gridTop);
    const shown = c.times.slice(0, g.shown);
    const extra = c.times.length - shown.length;
    const cells = extra > 0 ? [...shown, `+${extra}`] : shown;
    const rows = Math.ceil(cells.length / g.cols);
    const gridH = rows * g.pillH + (rows - 1) * g.gap;
    const top = gridTop + Math.max(0, (gridBottom - gridTop - gridH) / 2);
    ctx.font = `700 ${Math.round(g.pillH * 0.42)}px ${font}`;
    ctx.textBaseline = "middle";
    cells.forEach((t, i) => {
      const row = Math.floor(i / g.cols);
      const inRow = Math.min(g.cols, cells.length - row * g.cols);
      // La última fila incompleta va centrada.
      const rowOffset = ((g.cols - inRow) * (g.pillW + g.gap)) / 2;
      const x = padX + rowOffset + (i % g.cols) * (g.pillW + g.gap);
      const py = top + row * (g.pillH + g.gap);
      roundRect(ctx, x, py, g.pillW, g.pillH, g.pillH / 2);
      ctx.fillStyle = pillFill;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = pillStroke;
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.fillText(t, x + g.pillW / 2, py + g.pillH / 2 + 2);
    });
    ctx.textBaseline = "alphabetic";
  }

  paintFooter(ctx, font, c.color, c.message, c.footer);
}

export interface WeekStoryDay {
  /** "LUN" */
  label: string;
  /** Número del día, "10". */
  sub: string;
  slots: { time: string; taken: boolean }[];
}

export interface WeekStoryContent {
  shopName: string;
  /** "Del 10 al 15 de Noviembre" */
  weekLabel: string;
  /** "con Juan", o vacío si son todos los barberos. */
  subtitle?: string;
  days: WeekStoryDay[];
  /** true: los ocupados no aparecen; false: aparecen tachados. */
  hideTaken: boolean;
  message: string;
  footer?: string;
  color: string;
  fontFamily?: string;
}

/** "09:00" → "9:00", más corto para que entre la semana entera. */
export const shortTime = (t: string) => t.replace(/^0(\d)/, "$1");

/** Reparte los horarios en renglones que entren en `maxWidth`. */
function tokenLines(ctx: CanvasRenderingContext2D, tokens: string[], maxWidth: number, gap: number): number[] {
  // Devuelve cuántos horarios van en cada renglón.
  const counts: number[] = [];
  let n = 0;
  let width = 0;
  for (const t of tokens) {
    const w = ctx.measureText(t).width;
    if (n && width + gap + w > maxWidth) {
      counts.push(n);
      n = 0;
      width = 0;
    }
    width += (n ? gap : 0) + w;
    n++;
  }
  if (n) counts.push(n);
  return counts;
}

/**
 * Imagen de la semana: un renglón por día, con un círculo para el día y una tarjeta con los
 * horarios. Los ocupados se tachan, o no se muestran si `hideTaken`.
 */
export function drawWeekStory(canvas: HTMLCanvasElement, c: WeekStoryContent) {
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = STORY_WIDTH;
  const font = c.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const { ink, soft, pillFill, pillStroke } = palette(c.color);
  paintBackground(ctx, c.color);

  const padX = 80;
  const inner = W - padX * 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Encabezado, más compacto que el del día para dejarle lugar a la semana.
  let y = 270;
  ctx.fillStyle = soft;
  ctx.font = `700 32px ${font}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("TURNOS DISPONIBLES", W / 2, y);
  ctx.letterSpacing = "0px";
  y += 86;
  ctx.fillStyle = ink;
  ctx.font = `800 72px ${font}`;
  ctx.fillText(wrap(ctx, c.shopName, inner, 1)[0], W / 2, y);
  y += 64;
  ctx.font = `600 40px ${font}`;
  ctx.fillText(wrap(ctx, c.subtitle ? `${c.weekLabel} · ${c.subtitle}` : c.weekLabel, inner, 1)[0], W / 2, y);

  const listTop = y + 50;
  const listBottom = 1520;
  const days = c.days;
  if (!days.length) {
    ctx.fillStyle = soft;
    ctx.font = `600 52px ${font}`;
    ctx.fillText("No hay días abiertos", W / 2, (listTop + listBottom) / 2);
    paintFooter(ctx, font, c.color, c.message, c.footer);
    return;
  }

  const gap = days.length > 6 ? 16 : 22;
  const maxRowH = (listBottom - listTop - (days.length - 1) * gap) / days.length;
  const circle = Math.min(136, maxRowH);
  const cardX = padX + circle + 22;
  const cardW = W - padX - cardX;
  const textW = cardW - 44;
  const visible = days.map((d) => (c.hideTaken ? d.slots.filter((s) => !s.taken) : d.slots));

  // La letra más grande con la que todos los días entran en su renglón.
  let fs = 44;
  let counts: number[][] = [];
  let rowH = maxRowH;
  for (; ; fs -= 2) {
    ctx.font = `600 ${fs}px ${font}`;
    counts = visible.map((list) => tokenLines(ctx, list.map((s) => shortTime(s.time)), textW, fs * 0.75));
    const needed = Math.max(circle, ...counts.map((l) => Math.max(1, l.length) * fs * 1.4 + fs * 1.1));
    if (needed <= maxRowH || fs <= 18) {
      rowH = Math.min(maxRowH, needed);
      break;
    }
  }
  const lineH = fs * 1.4;
  const tokenGap = fs * 0.75;
  const listH = days.length * rowH + (days.length - 1) * gap;
  const top = listTop + Math.max(0, (listBottom - listTop - listH) / 2);

  days.forEach((d, i) => {
    const ry = top + i * (rowH + gap);
    const cy = ry + rowH / 2;

    // Círculo con el día.
    const r = circle / 2;
    ctx.beginPath();
    ctx.arc(padX + r, cy, r - 3, 0, Math.PI * 2);
    ctx.fillStyle = pillFill;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = soft;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    ctx.font = `800 ${Math.round(circle * 0.25)}px ${font}`;
    ctx.fillText(d.label, padX + r, cy - circle * 0.1);
    ctx.fillStyle = soft;
    ctx.font = `600 ${Math.round(circle * 0.19)}px ${font}`;
    ctx.fillText(d.sub, padX + r, cy + circle * 0.17);

    // Tarjeta con los horarios.
    roundRect(ctx, cardX, ry, cardW, rowH, Math.min(32, rowH / 2));
    ctx.fillStyle = pillFill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = pillStroke;
    ctx.stroke();

    ctx.font = `600 ${fs}px ${font}`;
    const list = visible[i];
    if (!list.length) {
      ctx.fillStyle = soft;
      ctx.fillText("Completo", cardX + cardW / 2, cy);
      return;
    }
    ctx.textAlign = "left";
    const lines = counts[i];
    const blockTop = cy - (lines.length * lineH) / 2;
    let k = 0;
    lines.forEach((n, li) => {
      const line = list.slice(k, k + n);
      k += n;
      const ly = blockTop + li * lineH + lineH / 2;
      const widths = line.map((s) => ctx.measureText(shortTime(s.time)).width);
      const total = widths.reduce((a, b) => a + b, 0) + tokenGap * (line.length - 1);
      let x = cardX + (cardW - total) / 2;
      line.forEach((s, ti) => {
        const label = shortTime(s.time);
        ctx.fillStyle = ink;
        if (s.taken) {
          // Tachado: el horario se apaga y una raya lo cruza.
          ctx.globalAlpha = 0.4;
          ctx.fillText(label, x, ly);
          ctx.globalAlpha = 0.95;
          ctx.strokeStyle = ink;
          ctx.lineWidth = Math.max(3, fs * 0.09);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x - 5, ly);
          ctx.lineTo(x + widths[ti] + 5, ly);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          ctx.fillText(label, x, ly);
        }
        x += widths[ti] + tokenGap;
      });
    });
  });

  paintFooter(ctx, font, c.color, c.message, c.footer);
}

export function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ? new File([blob], name, { type: "image/png" }) : null), "image/png"),
  );
}
