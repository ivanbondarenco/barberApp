import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { Check, Link2, MessageCircle, Moon, Wallet } from "lucide-react";
import { buildChunks, buildWords, Segment } from "./timing";
import { Captions } from "./captions";
import { Background } from "./Reel";
import { Angles, Face, Fx, HandProp, Nico, NICO_W } from "./Nico";
import { C, lin, LogoMark, Phone, PHONE_W, Scene, sp, useT } from "./ui";

const { fontFamily } = loadFont("normal", { weights: ["300", "500", "600", "700", "800"], subsets: ["latin"] });

// Medido sobre public/voz-nico.mp3 con silencedetect.
export const NICO_TOTAL = 38.5;
const SEGS: Segment[] = [
  { s: 0.05, e: 0.85, text: "Este es Nico." },
  { s: 1.26, e: 2.56, text: "Nico tiene una barbería." },
  { s: 2.96, e: 4.21, text: "Son las once de la noche," },
  { s: 4.37, e: 6.32, text: "y Nico sigue contestando mensajes." },
  { s: 6.78, e: 7.67, text: "¿Tenés lugar mañana?" },
  { s: 8.04, e: 8.52, text: "¿A qué hora?" },
  { s: 8.84, e: 9.75, text: "¿Me pasás el alias?" },
  { s: 10.2, e: 11.66, text: "Al otro día, a las diez," },
  { s: 11.91, e: 12.74, text: "la silla vacía." },
  { s: 13.15, e: 14.0, text: "El cliente no vino." },
  { s: 14.36, e: 15.15, text: "Y la seña..." },
  { s: 15.41, e: 16.02, text: "nunca llegó." },
  { s: 16.45, e: 17.89, text: "Nico estaba quemado." },
  { s: 18.32, e: 19.94, text: "Hasta que probó MiBarbería." },
  { s: 20.22, e: 21.82, text: "Ahora sus clientes reservan solos," },
  { s: 21.94, e: 22.52, text: "desde un link." },
  { s: 22.82, e: 24.37, text: "Pagan la seña con Mercado Pago." },
  { s: 24.62, e: 27.1, text: "Y un día antes, les llega el recordatorio por WhatsApp." },
  { s: 27.46, e: 29.57, text: "Nico ya no contesta mensajes a la noche." },
  { s: 29.87, e: 30.55, text: "Cena tranquilo." },
  { s: 30.86, e: 31.6, text: "Y al otro día," },
  { s: 31.75, e: 32.88, text: "la agenda está llena." },
  { s: 33.27, e: 33.95, text: "Sé como Nico." },
  { s: 34.25, e: 36.04, text: "Probala en mibarberia.live" },
];
const CHUNKS = buildChunks(SEGS, buildWords(SEGS));
const KEYWORDS = new Set(["nico", "quemado", "link", "mercado", "pago", "whatsapp", "llena", "tranquilo", "vacia", "nunca"]);

/* ───────────── Poses y línea de tiempo del personaje ───────────── */

const HANG_L: Angles = [12, -8];
const HANG_R: Angles = [-12, 8];
const HIP_L: Angles = [35, -80];
const WAVE_R: Angles = [-140, -20];
const SCISSORS_UP_R: Angles = [-120, -40];
const PHONE_R: Angles = [25, 115];
const WATCH_L: Angles = [-20, -120];
const UP_R: Angles = [-150, -10];
const PIZZA_R: Angles = [-172, -98];
const CUT_R: Angles = [-40, -90];
const THUMB_R: Angles = [-60, -100];

type Anim = "wave" | "snip" | "shake" | "nod" | "chew" | null;
type Key = {
  t: number;
  pos?: { x: number; y: number; s: number };
  l: Angles;
  r: Angles;
  lProp?: HandProp;
  rProp?: HandProp;
  face: Face;
  anim?: Anim;
  fx?: Fx;
};

const HAPPY: Face = { eyes: "happy", mouth: "grin", brows: "up", blush: true };
const KEYS: Key[] = [
  { t: 0, l: HIP_L, r: WAVE_R, face: HAPPY, anim: "wave" },
  { t: 1.2, l: HIP_L, r: SCISSORS_UP_R, rProp: "scissors", face: { eyes: "open", mouth: "grin", brows: "up" }, anim: "snip" },
  { t: 2.9, l: HANG_L, r: PHONE_R, rProp: "phone", face: { eyes: "tired", mouth: "wavy", brows: "sad", bags: true, look: [0, 9] } },
  { t: 6.7, l: HANG_L, r: PHONE_R, rProp: "phone", face: { eyes: "tired", mouth: "o", brows: "sad", bags: true, look: [0, 9] } },
  { t: 8.8, l: HANG_L, r: PHONE_R, rProp: "phone", face: { eyes: "tired", mouth: "flat", brows: "sad", bags: true, look: [0, 9] }, fx: "sweat" },
  { t: 10.1, pos: { x: -170, y: 0, s: 1 }, l: WATCH_L, lProp: "watch", r: HANG_R, face: { eyes: "open", mouth: "flat", brows: "neutral", look: [-8, 9] } },
  { t: 11.85, pos: { x: -170, y: 0, s: 1 }, l: HANG_L, r: HANG_R, face: { eyes: "open", mouth: "flat", brows: "sad", look: [11, 0] } },
  { t: 13.1, pos: { x: -170, y: 0, s: 1 }, l: HIP_L, r: HANG_R, face: { eyes: "open", mouth: "frown", brows: "angry", look: [11, 0] } },
  { t: 14.3, pos: { x: -170, y: 0, s: 1 }, l: HANG_L, r: PHONE_R, rProp: "phone", face: { eyes: "open", mouth: "o", brows: "up", look: [0, 9] } },
  { t: 15.35, pos: { x: -170, y: 0, s: 1 }, l: HANG_L, r: PHONE_R, rProp: "phone", face: { eyes: "open", mouth: "frown", brows: "angry", look: [0, 9] } },
  { t: 16.4, pos: { x: 0, y: -60, s: 1.14 }, l: HANG_L, r: HANG_R, face: { eyes: "open", mouth: "frown", brows: "angry", red: 1 }, anim: "shake", fx: "smoke" },
  { t: 18.25, l: HANG_L, r: UP_R, rProp: "phoneApp", face: { eyes: "open", mouth: "o", brows: "up" }, fx: "bulb" },
  { t: 18.9, l: HANG_L, r: UP_R, rProp: "phoneApp", face: HAPPY, fx: "bulb" },
  { t: 20.1, pos: { x: -250, y: 230, s: 0.8 }, l: HIP_L, r: UP_R, rProp: "point", face: { eyes: "open", mouth: "grin", brows: "up", look: [6, -6] }, anim: "nod" },
  { t: 27.35, l: HANG_L, r: PIZZA_R, rProp: "pizza", face: { eyes: "happy", mouth: "smile", brows: "neutral", blush: true } },
  { t: 29.8, l: HANG_L, r: PIZZA_R, rProp: "pizza", face: { eyes: "happy", mouth: "chew", brows: "neutral", blush: true }, anim: "chew" },
  { t: 30.8, pos: { x: -120, y: 0, s: 1 }, l: HIP_L, r: CUT_R, rProp: "scissors", face: { eyes: "open", mouth: "grin", brows: "up", look: [8, 0] }, anim: "snip" },
  { t: 33.2, l: HIP_L, r: THUMB_R, rProp: "thumb", face: { eyes: "wink", mouth: "grin", brows: "up", blush: true } },
  { t: 34.2, pos: { x: 0, y: 260, s: 0.9 }, l: HIP_L, r: UP_R, rProp: "point", face: { eyes: "open", mouth: "grin", brows: "up", look: [4, -8] } },
];

const BASE = { x: 0, y: 0, s: 1 };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

const NicoActor: React.FC = () => {
  const t = useT();
  let i = 0;
  while (i + 1 < KEYS.length && KEYS[i + 1].t <= t) i++;
  const k = KEYS[i];
  const prev = KEYS[Math.max(0, i - 1)];
  const p = i === 0 ? 1 : interpolate(t, [k.t, k.t + 0.35], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const pos0 = prev.pos ?? BASE;
  const pos1 = k.pos ?? BASE;
  const pos = { x: mix(pos0.x, pos1.x, p), y: mix(pos0.y, pos1.y, p), s: mix(pos0.s, pos1.s, p) };
  const l: Angles = [mix(prev.l[0], k.l[0], p), mix(prev.l[1], k.l[1], p)];
  const r: Angles = [mix(prev.r[0], k.r[0], p), mix(prev.r[1], k.r[1], p)];
  let headTilt = 0;
  if (k.anim === "wave") r[1] += Math.sin(t * 12) * 26;
  if (k.anim === "shake") pos.x += Math.sin(t * 55) * 7;
  if (k.anim === "nod") headTilt = Math.sin(t * 5) * 4;
  if (k.anim === "chew") r[1] += Math.sin(t * 7) * 5;
  // Las cosas en la mano cambian a mitad de la transición, no de golpe.
  const rProp = p < 0.5 && prev.rProp !== k.rProp ? prev.rProp ?? null : k.rProp ?? null;
  const lProp = p < 0.5 && prev.lProp !== k.lProp ? prev.lProp ?? null : k.lProp ?? null;
  let j = i;
  while (j > 0 && KEYS[j - 1].fx === k.fx) j--;
  const fxStart = KEYS[j].t;
  const enter = sp(t, 0, { damping: 13 });
  const bob = Math.sin(t * 2.2) * 5;
  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - NICO_W) / 2,
        top: 790,
        transformOrigin: "50% 100%",
        transform: `translate(${pos.x}px, ${pos.y + bob + (1 - enter) * 900}px) scale(${pos.s})`,
        filter: "drop-shadow(0 30px 50px rgba(0,0,0,.45))",
        zIndex: 10,
      }}
    >
      <Nico t={t} face={k.face} l={l} r={r} lProp={lProp} rProp={rProp} fx={k.fx ?? null} fxP={lin(t, fxStart, fxStart + 0.4)} headTilt={headTilt} snip={k.anim === "snip"} />
    </div>
  );
};

/* ───────────── Escenarios ───────────── */

const Shop: React.FC<{ clock?: string; sign?: number }> = ({ clock, sign = 1 }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg,#1b2a5c 0%,#16224a 62%,#3a2a24 62%,#2b1f1a 100%)" }}>
      <div style={{ position: "absolute", left: 70, top: 330, width: 74, height: 560, borderRadius: 37, overflow: "hidden", border: "8px solid #cbd5e1", background: `repeating-linear-gradient(135deg,#e11d48 0 34px,#fff 34px 68px,#2563eb 68px 102px,#fff 102px 136px)`, backgroundPositionY: `${t * 120}px` }} />
      <div style={{ position: "absolute", left: 300, right: 300, top: 150, textAlign: "center", fontSize: 64, fontWeight: 800, letterSpacing: 10, color: C.accent, opacity: 0.25 + 0.75 * sign, textShadow: `0 0 ${30 * sign}px ${C.accent}, 0 0 ${70 * sign}px ${C.primaryBright}` }}>
        BARBERÍA
      </div>
      <div style={{ position: "absolute", right: 70, top: 300, width: 300, height: 440, borderRadius: 150, background: "linear-gradient(140deg,#c7d6ff,#7d93c9)", border: "12px solid #a0794f", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 40, top: -40, width: 50, height: 600, background: "rgba(255,255,255,.35)", transform: "rotate(25deg)" }} />
        <div style={{ position: "absolute", left: 130, top: -40, width: 22, height: 600, background: "rgba(255,255,255,.25)", transform: "rotate(25deg)" }} />
      </div>
      {clock && <WallClock label={clock} style={{ left: 220, top: 330 }} />}
    </AbsoluteFill>
  );
};

const Night: React.FC<{ clock?: string; cozy?: boolean }> = ({ clock, cozy }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: cozy ? "linear-gradient(180deg,#241a3a,#151026)" : "linear-gradient(180deg,#0b1024,#070a18)" }}>
      <div style={{ position: "absolute", right: 90, top: 250, width: 340, height: 430, borderRadius: 24, border: "14px solid #2a3355", background: "linear-gradient(180deg,#0d1a40,#1a2f6b)", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 50, top: 50, width: 110, height: 110, borderRadius: 99, background: "#fdf6d8", boxShadow: "0 0 70px rgba(253,246,216,.6)" }} />
        <div style={{ position: "absolute", right: 30, top: 35, width: 100, height: 100, borderRadius: 99, background: "#13235a" }} />
        {[[40, 60], [120, 140], [60, 260], [200, 330], [250, 220], [150, 40]].map(([x, y], i) => (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 8, height: 8, borderRadius: 9, background: "#fff", opacity: 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)) }} />
        ))}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 12, marginLeft: -6, background: "#2a3355" }} />
      </div>
      {cozy && <div style={{ position: "absolute", left: -200, top: 200, width: 900, height: 900, borderRadius: 999, background: "radial-gradient(circle, rgba(255,190,110,.28), transparent 65%)" }} />}
      {clock && <WallClock label={clock} style={{ left: 90, top: 170 }} night />}
    </AbsoluteFill>
  );
};

const WallClock: React.FC<{ label: string; style: React.CSSProperties; night?: boolean }> = ({ label, style, night }) => (
  <div style={{ position: "absolute", padding: "18px 32px", borderRadius: 26, background: night ? "#111827" : "#0f172a", border: "6px solid #334155", color: night ? "#ff5d5d" : "#5dffa5", fontSize: 76, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: 2, textShadow: `0 0 24px ${night ? "#ff5d5d" : "#5dffa5"}`, ...style }}>
    {label}
  </div>
);

const Burst: React.FC<{ color: string }> = ({ color }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: color, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "50%", top: "48%", width: 3000, height: 3000, marginLeft: -1500, marginTop: -1500, transform: `rotate(${t * 20}deg)`, background: "repeating-conic-gradient(rgba(255,255,255,.07) 0 10deg, transparent 10deg 20deg)" }} />
    </AbsoluteFill>
  );
};

/* ───────────── Elementos de cada momento ───────────── */

const Bubble: React.FC<{ at: number; text: string; style: React.CSSProperties; big?: boolean }> = ({ at, text, style, big }) => {
  const t = useT();
  const p = sp(t, at, { damping: 11, stiffness: 220 });
  return (
    <div style={{ position: "absolute", padding: big ? "26px 38px" : "16px 26px", borderRadius: big ? "34px 34px 34px 8px" : 26, background: big ? "#fff" : "#202c33", color: big ? C.ink : "#e9edef", fontSize: big ? 50 : 32, fontWeight: big ? 800 : 600, boxShadow: "0 20px 50px rgba(0,0,0,.45)", transform: `scale(${p})`, opacity: Math.min(1, p * 2), whiteSpace: "nowrap", zIndex: 20, ...style }}>
      {text}
    </div>
  );
};

const NightChaos: React.FC = () => {
  const t = useT();
  const smalls = ["Hola!", "?", "Holaaa", "¿Hoy?", "Dale", "¿Cuánto?", "…", "Confirmame", "¿Viernes?", "Ya llego"];
  const count = Math.round(interpolate(t, [4.4, 9.7], [3, 99], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill>
      {smalls.map((s, i) => (
        <Bubble key={i} at={4.4 + i * 0.22} text={s} style={{ left: [60, 700, 120, 760, 40, 640, 300, 820, 180, 560][i], top: [720, 700, 560, 560, 870, 880, 620, 760, 1000, 1010][i] }} />
      ))}
      <Bubble big at={6.78} text="¿Tenés lugar mañana?" style={{ left: 150, top: 340 }} />
      <Bubble big at={8.04} text="¿A qué hora?" style={{ left: 520, top: 470 }} />
      <Bubble big at={8.84} text="¿Me pasás el alias?" style={{ left: 110, top: 600 }} />
      <div style={{ position: "absolute", left: 640, top: 1050, minWidth: 110, height: 110, padding: "0 20px", borderRadius: 99, background: "#ef4444", color: "#fff", fontSize: 50, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", opacity: lin(t, 4.4, 4.6), transform: `scale(${1 + 0.1 * Math.max(0, Math.sin(t * 18))})`, zIndex: 20 }}>
        {count >= 99 ? "99+" : count}
      </div>
    </AbsoluteFill>
  );
};

const BarberChair: React.FC = () => (
  <svg width={380} height={620} viewBox="0 0 380 620" style={{ position: "absolute", right: 40, top: 1000 }}>
    <rect x={80} y={20} width={220} height={260} rx={50} fill="#b3262e" />
    <rect x={100} y={40} width={180} height={220} rx={40} fill="#cf3a42" />
    <rect x={40} y={270} width={300} height={90} rx={30} fill="#b3262e" />
    <rect x={20} y={240} width={70} height={30} rx={15} fill="#cbd5e1" />
    <rect x={290} y={240} width={70} height={30} rx={15} fill="#cbd5e1" />
    <rect x={170} y={360} width={40} height={160} fill="#94a3b8" />
    <ellipse cx={190} cy={540} rx={140} ry={30} fill="#64748b" />
  </svg>
);

const EmptyChair: React.FC = () => {
  const t = useT();
  const stamp = sp(t, 13.15, { damping: 9, stiffness: 260 });
  const sena = sp(t, 14.36, { damping: 13 });
  const never = t >= 15.41;
  return (
    <AbsoluteFill>
      <div style={{ opacity: lin(t, 10.3, 10.6) }}>
        <BarberChair />
      </div>
      <div style={{ position: "absolute", right: 120, top: 900, color: C.nightMuted, fontSize: 42, fontStyle: "italic", fontWeight: 600, opacity: lin(t, 12.0, 12.2) * (1 - lin(t, 13.1, 13.2)), transform: `translateY(${Math.sin(t * 9) * 6}px)` }}>
        cri… cri…
      </div>
      <div style={{ position: "absolute", right: 60, top: 1080, padding: "16px 34px", border: "10px solid #ef4444", borderRadius: 20, color: "#ef4444", fontSize: 84, fontWeight: 800, letterSpacing: 4, transform: `rotate(-12deg) scale(${2 - stamp})`, opacity: Math.min(1, stamp * 2), background: "rgba(10,16,32,.6)", zIndex: 30 }}>
        NO VINO
      </div>
      <div style={{ position: "absolute", left: 140, right: 140, top: 560, padding: "30px 40px", borderRadius: 34, background: "#fff", display: "flex", alignItems: "center", gap: 26, boxShadow: "0 30px 60px rgba(0,0,0,.45)", transform: `translateY(${(1 - sena) * -200}px)`, opacity: Math.min(1, sena * 2), zIndex: 30 }}>
        <div style={{ width: 90, height: 90, borderRadius: 24, background: never ? "#fee2e2" : C.surfaceContainer, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Wallet size={50} color={never ? "#ef4444" : C.primary} />
        </div>
        <div>
          <div style={{ fontSize: 30, color: C.muted, fontWeight: 700 }}>Seña del turno 10:00</div>
          <div style={{ fontSize: 50, fontWeight: 800, color: never ? "#ef4444" : C.ink }}>{never ? "No llegó ✕" : `Pendiente${".".repeat(1 + (Math.floor(t * 4) % 3))}`}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Features: React.FC = () => {
  const t = useT();
  const screen = t < 22.82 ? 0 : t < 24.62 ? 1 : 2;
  const enter = sp(t, 20.15, { damping: 15 });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 110, left: (1080 - PHONE_W) / 2, transform: `scale(${0.74 * enter})`, transformOrigin: "50% 0" }}>
        <Phone bg={screen === 2 ? "linear-gradient(170deg,#1a2a6c 0%, #2b1a55 55%, #0a1020 100%)" : C.surface} dark={screen === 2}>
          {screen === 0 && <BookingScreen />}
          {screen === 1 && <PaidScreen />}
          {screen === 2 && <ReminderScreen />}
        </Phone>
      </div>
      <div style={{ position: "absolute", top: 230, left: 690, display: "flex", alignItems: "center", gap: 10, padding: "14px 22px", borderRadius: 22, background: C.accent, color: C.night, fontSize: 30, fontWeight: 800, transform: `rotate(6deg) scale(${sp(t, 21.94, { damping: 10 })})` }}>
        <Link2 size={32} strokeWidth={3} /> un link
      </div>
    </AbsoluteFill>
  );
};

const BookingScreen: React.FC = () => {
  const t = useT();
  const slots = ["9:00", "9:45", "10:30", "11:15", "16:00", "16:45", "17:30", "18:15", "19:00"];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "110px 30px 0", color: C.ink }}>
      <div style={{ fontSize: 38, fontWeight: 800 }}>Reservá tu turno</div>
      <div style={{ fontSize: 24, color: C.muted, marginTop: 4 }}>Barbería de Nico · Jueves 13</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 34 }}>
        {slots.map((s, i) => {
          const taken = t >= 20.5 + i * 0.18;
          return (
            <div key={s} style={{ height: 80, borderRadius: 18, background: taken ? C.primary : C.surfaceLow, color: taken ? "#fff" : C.ink, fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${taken ? 1 + 0.1 * (1 - lin(t, 20.5 + i * 0.18, 20.75 + i * 0.18)) : 1})` }}>
              {taken ? <Check size={34} strokeWidth={3.4} /> : s}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 34, padding: 26, borderRadius: 24, background: C.mint, color: C.mintInk, fontSize: 28, fontWeight: 800, textAlign: "center", opacity: lin(t, 21.6, 21.9) }}>
        9 turnos reservados solos
      </div>
    </div>
  );
};

const PaidScreen: React.FC = () => {
  const t = useT();
  const p = sp(t, 23.2, { damping: 10 });
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.ink }}>
      <div style={{ width: 210, height: 210, borderRadius: 999, background: C.mp, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${t < 23.2 ? 0.9 + 0.05 * Math.sin(t * 12) : 1})` }}>
        {t < 23.2 ? <Wallet size={110} color="#fff" /> : <Check size={130} color="#fff" strokeWidth={3.4} style={{ transform: `scale(${p})` }} />}
      </div>
      <div style={{ fontSize: 44, fontWeight: 800, marginTop: 40 }}>{t < 23.2 ? "Pagando seña…" : "¡Seña acreditada!"}</div>
      <div style={{ fontSize: 28, color: C.muted, marginTop: 10 }}>$5.000 · Mercado Pago</div>
    </div>
  );
};

const ReminderScreen: React.FC = () => {
  const t = useT();
  const n = sp(t, 24.9, { damping: 15 });
  return (
    <>
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 26, fontWeight: 600, opacity: 0.85 }}>miércoles 12</div>
        <div style={{ fontSize: 140, fontWeight: 300, lineHeight: 1.05 }}>20:00</div>
      </div>
      <div style={{ position: "absolute", top: 420, left: 22, right: 22, borderRadius: 34, background: "rgba(255,255,255,.2)", padding: "22px 24px", color: "#fff", transform: `translateY(${(1 - n) * -380}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: C.wa, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageCircle size={32} color="#fff" fill="#fff" />
          </div>
          <div style={{ flex: 1, fontSize: 22, fontWeight: 700 }}>WhatsApp</div>
          <div style={{ fontSize: 20, opacity: 0.7 }}>ahora</div>
        </div>
        <div style={{ fontSize: 26, lineHeight: 1.35, marginTop: 12 }}>Hola Juan! Te recordamos que mañana tenés turno a las 10:30 hs con Nico.</div>
      </div>
    </>
  );
};

const Dinner: React.FC = () => {
  const t = useT();
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1560, bottom: 0, background: "linear-gradient(180deg,#7a4b2c,#5a3520)", borderTop: "14px solid #94603a", zIndex: 15 }}>
        <div style={{ position: "absolute", left: 330, top: 40, width: 420, height: 70, borderRadius: "50%", background: "#f1f5f9", boxShadow: "0 10px 0 #cbd5e1" }} />
        <div style={{ position: "absolute", right: 70, top: 46, width: 170, height: 46, borderRadius: 12, background: "#0f172a", border: "4px solid #475569" }} />
      </div>
      <div style={{ position: "absolute", right: 90, top: 1440, color: C.nightMuted, fontSize: 56, fontWeight: 800, opacity: lin(t, 28.3, 28.6), transform: `translateY(${-((t * 30) % 40)}px)`, zIndex: 16 }}>
        z<span style={{ fontSize: 44 }}>z</span>
        <span style={{ fontSize: 34 }}>z</span>
      </div>
      <div style={{ position: "absolute", left: 80, top: 760, display: "flex", alignItems: "center", gap: 14, padding: "18px 28px", borderRadius: 24, background: "rgba(18,26,46,.9)", color: "#fff", fontSize: 34, fontWeight: 800, opacity: lin(t, 27.6, 27.9) }}>
        <Moon size={36} color={C.amber} /> 0 mensajes
      </div>
    </AbsoluteFill>
  );
};

const FullAgenda: React.FC = () => {
  const t = useT();
  const rows = ["9:00 Martín", "9:45 Lucas", "10:30 Juan", "11:15 Sofi", "16:00 Fede", "16:45 Tomi", "17:30 Nahuel"];
  const stamp = sp(t, 32.1, { damping: 9, stiffness: 260 });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", right: 50, top: 260, width: 430, padding: "28px 30px", borderRadius: 34, background: "#fff", boxShadow: "0 30px 60px rgba(0,0,0,.45)", color: C.ink }}>
        <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 14 }}>Agenda · Jueves</div>
        {rows.map((r, i) => {
          const on = t >= 31.0 + i * 0.13;
          return (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderTop: `2px solid ${C.surfaceLow}`, fontSize: 28, fontWeight: 700, opacity: on ? 1 : 0.25 }}>
              <div style={{ width: 36, height: 36, borderRadius: 99, background: on ? C.green : C.surfaceContainer, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {on && <Check size={24} color="#fff" strokeWidth={3.6} />}
              </div>
              {r}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", right: 70, top: 830, padding: "14px 30px", border: `10px solid ${C.green}`, borderRadius: 20, color: C.green, fontSize: 64, fontWeight: 800, letterSpacing: 3, transform: `rotate(-8deg) scale(${2 - stamp})`, opacity: Math.min(1, stamp * 2), background: "rgba(10,16,32,.75)" }}>
        AGENDA LLENA
      </div>
    </AbsoluteFill>
  );
};

const Name: React.FC = () => {
  const t = useT();
  const p = sp(t, 0.3, { damping: 10 });
  return (
    <div style={{ position: "absolute", left: 200, top: 600, padding: "18px 34px", borderRadius: 24, background: "#fff", color: C.ink, fontSize: 54, fontWeight: 800, transform: `rotate(-6deg) scale(${p})`, boxShadow: "0 20px 40px rgba(0,0,0,.4)", zIndex: 20 }}>
      Nico
    </div>
  );
};

const NicoCTA: React.FC = () => {
  const t = useT();
  const url = "mibarberia.live";
  const typed = url.slice(0, Math.round(lin(t, 34.6, 35.6, 0, url.length, (x) => x)));
  const logo = sp(t, 34.25, { damping: 11 });
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 170 }}>
      <div style={{ transform: `scale(${logo})` }}>
        <LogoMark size={200} draw={lin(t, 34.3, 35)} />
      </div>
      <div style={{ color: "#fff", fontSize: 92, fontWeight: 800, letterSpacing: -3, marginTop: 24, opacity: lin(t, 34.4, 34.7) }}>MiBarbería</div>
      <div style={{ marginTop: 34, padding: "28px 54px", borderRadius: 999, background: "#fff", color: C.ink, fontSize: 70, fontWeight: 800, minWidth: 640, textAlign: "center", opacity: lin(t, 34.5, 34.7), transform: `scale(${1 + 0.04 * Math.sin(t * 7) * lin(t, 35.8, 36.1)})`, boxShadow: "0 30px 80px rgba(143,174,255,.35)" }}>
        {typed}
        <span style={{ color: C.primary, opacity: Math.sin(t * 12) > 0 || typed.length < url.length ? 1 : 0 }}>|</span>
      </div>
      <div style={{ marginTop: 30, color: C.accent, fontSize: 48, fontWeight: 800, opacity: lin(t, 35.9, 36.2) }}>Sé como Nico →</div>
    </AbsoluteFill>
  );
};

/* ───────────── Composición ───────────── */

export const NicoReel: React.FC = () => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily, overflow: "hidden" }}>
      <Scene start={0} end={3.0} zoom={false}>
        <Shop sign={lin(t, 1.26, 1.6)} />
        <Name />
      </Scene>
      <Scene start={2.9} end={10.25} zoom={false}>
        <Night clock="23:00" />
        <NightChaos />
      </Scene>
      <Scene start={10.1} end={16.5} zoom={false}>
        <Shop clock="10:00" />
        <EmptyChair />
      </Scene>
      <Scene start={16.4} end={18.35} zoom={false}>
        <Burst color="#3a0d12" />
      </Scene>
      <Scene start={18.25} end={20.2} zoom={false}>
        <Burst color={C.primary} />
      </Scene>
      <Scene start={20.1} end={27.45} zoom={false}>
        <Background />
        <Features />
      </Scene>
      <Scene start={27.35} end={30.9} zoom={false}>
        <Night clock="21:30" cozy />
      </Scene>
      <Scene start={30.8} end={33.3} zoom={false}>
        <Shop />
        <FullAgenda />
      </Scene>
      <Scene start={33.2} end={NICO_TOTAL} zoom={false}>
        <Burst color={C.night} />
      </Scene>
      <NicoActor />
      <Scene start={27.35} end={30.9} zoom={false}>
        <Dinner />
      </Scene>
      <Scene start={34.2} end={NICO_TOTAL} zoom={false}>
        <NicoCTA />
      </Scene>
      <Captions chunks={CHUNKS} hide={[[34.2, 99]]} keywords={KEYWORDS} top={(t) => (t >= 20.15 && t < 27.4 ? 990 : 1430)} />
      <Audio src={staticFile("voz-nico.mp3")} />
    </AbsoluteFill>
  );
};
