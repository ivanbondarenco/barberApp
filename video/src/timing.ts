// Tiempos medidos sobre public/voz.mp3 (detección de silencios con ffmpeg).
// Si regenerás la voz, volvé a medir con:
//   npx remotion ffmpeg -i public/voz.mp3 -af silencedetect=noise=-30dB:d=0.12 -f null -
export const FPS = 30;
export const TOTAL = 43; // segundos (la voz dura 40.8 s + cierre)
export const f = (s: number) => Math.round(s * FPS);

export type Segment = { s: number; e: number; text: string };

export const SEGMENTS: Segment[] = [
  { s: 0.05, e: 1.61, text: "¿Seguís dando turnos por WhatsApp," },
  { s: 1.8, e: 3.35, text: "a mano, a cualquier hora?" },
  { s: 3.74, e: 4.89, text: "Clientes que no vienen." },
  { s: 5.25, e: 6.9, text: "Mensajes a las once de la noche." },
  { s: 7.15, e: 8.66, text: "Señas que nunca llegan." },
  { s: 9.17, e: 10.28, text: "Eso se terminó." },
  { s: 10.78, e: 15.3, text: "Con MiBarbería, tus clientes reservan solos, desde un link, sin crearse ninguna cuenta." },
  { s: 15.7, e: 17.15, text: "Eligen el día, el horario," },
  { s: 17.31, e: 17.75, text: "y listo." },
  { s: 18.16, e: 19.57, text: "Dejan la seña con Mercado Pago," },
  { s: 19.72, e: 21.42, text: "así el turno queda asegurado." },
  { s: 21.79, e: 25.08, text: "Y antes de cada turno, les llega un recordatorio automático por WhatsApp." },
  { s: 25.6, e: 26.49, text: "Menos faltazos," },
  { s: 26.61, e: 27.76, text: "más sillas ocupadas." },
  { s: 28.17, e: 32.35, text: "Además, manejás a tu equipo, los horarios y los sueldos desde un solo lugar." },
  { s: 32.59, e: 34.46, text: "Y hasta te arma el contenido para tus redes." },
  { s: 34.77, e: 36.03, text: "Vos dedicate a cortar." },
  { s: 36.33, e: 38.24, text: "De la agenda, nos encargamos nosotros." },
  { s: 38.65, e: 40.57, text: "Probala en mibarberia.live" },
];

export type Word = { text: string; s: number; e: number; seg: number };

export const norm = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.$/, "");

// Reparte cada frase entre sus palabras según su largo (aprox. de dicción).
export const buildWords = (segments: Segment[]): Word[] =>
  segments.flatMap((seg, si) => {
    const ws = seg.text.split(" ");
    const weights = ws.map((w) => norm(w).length + 1.5);
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = seg.s;
    return ws.map((text, i) => {
      const d = ((seg.e - seg.s) * weights[i]) / total;
      const word = { text, s: acc, e: acc + d, seg: si };
      acc += d;
      return word;
    });
  });

export type Chunk = { words: Word[]; s: number; e: number };

// Subtítulos de a 1–3 palabras, cortando en comas y puntos.
export const buildChunks = (segments: Segment[], words: Word[]): Chunk[] => {
  const out: Chunk[] = [];
  segments.forEach((seg, si) => {
    const ws = words.filter((w) => w.seg === si);
    const groups: Word[][] = [];
    let cur: Word[] = [];
    ws.forEach((w) => {
      cur.push(w);
      const chars = cur.map((c) => c.text).join(" ").length;
      if (cur.length === 3 || chars > 13 || /[,.?]$/.test(w.text)) {
        groups.push(cur);
        cur = [];
      }
    });
    if (cur.length) groups.push(cur);
    const next = segments[si + 1];
    groups.forEach((g, gi) => {
      const s = g[0].s;
      const e = gi < groups.length - 1 ? groups[gi + 1][0].s : Math.min(seg.e + 0.3, next ? next.s : seg.e + 1);
      out.push({ words: g, s, e });
    });
  });
  return out;
};

export const WORDS = buildWords(SEGMENTS);
export const CHUNKS = buildChunks(SEGMENTS, WORDS);

/** Momento (s) en que se dice `word`, buscando desde `after`. */
export const at = (word: string, after = 0, words: Word[] = WORDS) =>
  words.find((w) => w.s >= after - 0.01 && norm(w.text) === norm(word))?.s ?? after;
