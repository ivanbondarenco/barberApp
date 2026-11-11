import React from "react";
import { Lightbulb, Scissors } from "lucide-react";
import { C } from "./ui";

/* Nico, el barbero. Personaje 2D en SVG (viewBox de 800×900, cabeza centrada en x=300). */

export type Eyes = "open" | "tired" | "happy" | "wink";
export type Mouth = "smile" | "grin" | "frown" | "flat" | "o" | "wavy" | "chew";
export type Brows = "neutral" | "sad" | "angry" | "up";
export type Face = { eyes: Eyes; mouth: Mouth; brows: Brows; bags?: boolean; blush?: boolean; red?: number; look?: [number, number] };
export type HandProp = "phone" | "phoneApp" | "scissors" | "pizza" | "thumb" | "point" | "watch" | null;
export type Fx = "smoke" | "bulb" | "sweat" | null;
export type Angles = [number, number]; // [hombro, codo] en grados; 0 = brazo colgando

const SKIN = "#e8a77c";
const SKIN_SHADE = "#cf8a60";
const HAIR = "#24170f";
const BEARD = "#4a3020";
const SHIRT = "#f2f4fa";
const APRON = "#1d2a4d";
const LIP = "#5c1620";
const LIPLINE = "#f3c3a2";
const L1 = 150;
const L2 = 140;

export const NICO_W = 760;
export const NICO_H = Math.round((NICO_W * 900) / 800);

export const Nico: React.FC<{
  t: number;
  face: Face;
  l: Angles;
  r: Angles;
  lProp?: HandProp;
  rProp?: HandProp;
  fx?: Fx;
  fxP?: number;
  headTilt?: number;
  snip?: boolean;
}> = ({ t, face, l, r, lProp = null, rProp = null, fx = null, fxP = 1, headTilt = 0, snip = false }) => {
  const blink = t % 3.3 < 0.12 ? 0.1 : 1;
  const [lx, ly] = face.look ?? [0, 0];
  const tilt = headTilt + Math.sin(t * 1.8) * 1.5;
  return (
    <svg width={NICO_W} height={NICO_H} viewBox="-100 0 800 900" style={{ overflow: "visible" }}>
      {/* torso */}
      <rect x={258} y={360} width={84} height={150} rx={30} fill={SKIN_SHADE} />
      <path d="M 60 900 L 70 620 Q 80 500 210 488 L 390 488 Q 520 500 530 620 L 540 900 Z" fill={SHIRT} />
      <path d="M 248 488 Q 300 570 352 488 Z" fill={SKIN_SHADE} />
      <path d="M 170 610 L 430 610 L 462 900 L 138 900 Z" fill={APRON} />
      <path d="M 190 615 L 238 492 M 410 615 L 362 492" stroke={APRON} strokeWidth={22} strokeLinecap="round" />
      <text x={300} y={672} textAnchor="middle" fontSize={40} fontWeight={800} fill={C.accent} letterSpacing={4}>
        NICO
      </text>
      <rect x={240} y={712} width={120} height={86} rx={14} fill="#24345e" />
      <Scissors x={272} y={727} size={56} color={C.accent} strokeWidth={2.4} />

      {/* cabeza */}
      <g transform={`rotate(${tilt} 300 430)`}>
        <ellipse cx={178} cy={285} rx={22} ry={32} fill={SKIN_SHADE} />
        <ellipse cx={422} cy={285} rx={22} ry={32} fill={SKIN_SHADE} />
        <ellipse cx={300} cy={270} rx={122} ry={142} fill={SKIN} />
        {/* pelo: degradé + jopo */}
        <path d="M 180 262 Q 172 128 300 112 Q 428 128 420 262 Q 412 190 300 182 Q 188 190 180 262 Z" fill={HAIR} />
        <path d="M 196 176 Q 222 62 334 78 Q 432 92 410 178 Q 356 136 292 146 Q 232 152 196 176 Z" fill="#2f2016" />
        <path d="M 250 104 Q 300 80 360 96" stroke="#4a3426" strokeWidth={8} fill="none" strokeLinecap="round" />
        {/* barba */}
        <path d="M 180 282 Q 178 412 300 434 Q 422 412 420 282 Q 414 334 382 344 Q 340 334 300 338 Q 260 334 218 344 Q 186 334 180 282 Z" fill={BEARD} />
        {/* nariz */}
        <path d="M 302 282 Q 286 318 296 326 Q 308 330 318 322" stroke={SKIN_SHADE} strokeWidth={7} fill="none" strokeLinecap="round" />
        {/* ojos */}
        <Eye x={255} y={262} kind={face.eyes === "wink" ? "open" : face.eyes} blink={blink} lx={lx} ly={ly} />
        <Eye x={345} y={262} kind={face.eyes === "wink" ? "happy" : face.eyes} blink={blink} lx={lx} ly={ly} />
        {face.bags && (
          <path d="M 232 292 Q 255 304 278 292 M 322 292 Q 345 304 368 292" stroke="#a8694a" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8} />
        )}
        <Brow x={255} side={-1} kind={face.brows} />
        <Brow x={345} side={1} kind={face.brows} />
        {face.blush && (
          <>
            <ellipse cx={222} cy={318} rx={24} ry={13} fill="#ff7a6b" opacity={0.35} />
            <ellipse cx={378} cy={318} rx={24} ry={13} fill="#ff7a6b" opacity={0.35} />
          </>
        )}
        {/* bigote y boca */}
        <path d="M 246 356 Q 272 334 300 346 Q 328 334 354 356 Q 328 352 300 354 Q 272 352 246 356 Z" fill="#33210f" />
        <MouthShape kind={face.mouth} t={t} />
        {!!face.red && <ellipse cx={300} cy={270} rx={122} ry={142} fill="#ff2d2d" opacity={face.red * 0.32} />}
        <Effect fx={fx} t={t} p={fxP} />
      </g>

      <Arm x={150} y={560} a={l} prop={lProp} t={t} snip={false} />
      <Arm x={450} y={560} a={r} prop={rProp} t={t} snip={snip} />
    </svg>
  );
};

const Eye: React.FC<{ x: number; y: number; kind: Eyes; blink: number; lx: number; ly: number }> = ({ x, y, kind, blink, lx, ly }) => {
  if (kind === "happy" || kind === "wink") {
    return <path d={`M ${x - 20} ${y + 6} Q ${x} ${y - 16} ${x + 20} ${y + 6}`} stroke="#1a1a1a" strokeWidth={8} fill="none" strokeLinecap="round" />;
  }
  const ry = 23 * blink;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={20} ry={ry} fill="#fff" />
      {blink > 0.5 && (
        <>
          <circle cx={x + lx} cy={y + ly} r={11} fill="#1a1a1a" />
          <circle cx={x + lx + 4} cy={y + ly - 4} r={3.5} fill="#fff" />
        </>
      )}
      {kind === "tired" && <path d={`M ${x - 24} ${y - 26} L ${x + 24} ${y - 26} L ${x + 24} ${y - 2} Q ${x} ${y + 4} ${x - 24} ${y - 2} Z`} fill={SKIN} />}
      {kind === "tired" && <path d={`M ${x - 22} ${y - 2} Q ${x} ${y + 4} ${x + 22} ${y - 2}`} stroke="#1a1a1a" strokeWidth={4} fill="none" />}
    </g>
  );
};

const Brow: React.FC<{ x: number; side: -1 | 1; kind: Brows }> = ({ x, side, kind }) => {
  const rot = kind === "angry" ? -side * 18 : kind === "sad" ? side * 16 : 0;
  const dy = kind === "up" ? -16 : kind === "angry" ? 6 : 0;
  return <rect x={x - 28} y={214 + dy} width={56} height={13} rx={6.5} fill={HAIR} transform={`rotate(${rot} ${x} ${220 + dy})`} />;
};

const MouthShape: React.FC<{ kind: Mouth; t: number }> = ({ kind, t }) => {
  const cx = 300;
  const cy = 376;
  switch (kind) {
    case "grin":
      return (
        <g>
          <path d={`M ${cx - 40} ${cy - 8} Q ${cx} ${cy + 42} ${cx + 40} ${cy - 8} Z`} fill={LIP} />
          <path d={`M ${cx - 36} ${cy - 6} L ${cx + 36} ${cy - 6} L ${cx + 30} ${cy + 4} L ${cx - 30} ${cy + 4} Z`} fill="#fff" />
        </g>
      );
    case "smile":
      return <path d={`M ${cx - 32} ${cy - 6} Q ${cx} ${cy + 22} ${cx + 32} ${cy - 6}`} stroke={LIPLINE} strokeWidth={8} fill="none" strokeLinecap="round" />;
    case "frown":
      return <path d={`M ${cx - 28} ${cy + 12} Q ${cx} ${cy - 10} ${cx + 28} ${cy + 12}`} stroke={LIPLINE} strokeWidth={8} fill="none" strokeLinecap="round" />;
    case "flat":
      return <path d={`M ${cx - 24} ${cy + 2} L ${cx + 24} ${cy + 2}`} stroke={LIPLINE} strokeWidth={8} strokeLinecap="round" />;
    case "o":
      return <ellipse cx={cx} cy={cy + 6} rx={15} ry={19} fill={LIP} stroke={LIPLINE} strokeWidth={4} />;
    case "wavy":
      return (
        <path
          d={`M ${cx - 32} ${cy + 4} q 8 -10 16 0 t 16 0 t 16 0 t 16 0`}
          stroke={LIPLINE}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "chew": {
      const o = 6 + Math.abs(Math.sin(t * 7)) * 12;
      return <ellipse cx={cx} cy={cy + 4} rx={22} ry={o} fill={LIP} stroke={LIPLINE} strokeWidth={4} />;
    }
  }
};

const Effect: React.FC<{ fx: Fx; t: number; p: number }> = ({ fx, t, p }) => {
  if (fx === "smoke") {
    return (
      <g>
        {Array.from({ length: 7 }).map((_, i) => {
          const c = (t * 0.9 + i / 7) % 1;
          return (
            <circle
              key={i}
              cx={300 + (i - 3) * 34 + Math.sin(i * 2 + t * 3) * 26}
              cy={96 - c * 240}
              r={20 + c * 42}
              fill="#9aa3b5"
              opacity={(1 - c) * 0.75 * p}
            />
          );
        })}
      </g>
    );
  }
  if (fx === "bulb") {
    const s = Math.min(1, p * 1.2);
    return (
      <g transform={`translate(300 -40) scale(${s})`}>
        <circle r={110} fill={C.amber} opacity={0.22 + 0.08 * Math.sin(t * 10)} />
        <Lightbulb x={-75} y={-75} size={150} color={C.amber} fill="#fff3c4" strokeWidth={1.8} />
      </g>
    );
  }
  if (fx === "sweat") {
    const y = 180 + ((t * 0.8) % 1) * 60;
    return <path d={`M 432 ${y} q -16 26 0 34 q 16 -8 0 -34 Z`} fill="#8fd3ff" opacity={p} />;
  }
  return null;
};

const Arm: React.FC<{ x: number; y: number; a: Angles; prop: HandProp; t: number; snip: boolean }> = ({ x, y, a, prop, t, snip }) => {
  const [a1, a2] = a;
  return (
    <g transform={`translate(${x} ${y}) rotate(${a1})`}>
      <line x1={0} y1={0} x2={0} y2={L1} stroke={SKIN} strokeWidth={60} strokeLinecap="round" />
      <line x1={0} y1={0} x2={0} y2={70} stroke={SHIRT} strokeWidth={80} strokeLinecap="round" />
      <g transform={`translate(0 ${L1}) rotate(${a2})`}>
        <line x1={0} y1={0} x2={0} y2={L2} stroke={SKIN} strokeWidth={56} strokeLinecap="round" />
        {prop === "watch" && (
          <g>
            <rect x={-34} y={L2 - 46} width={68} height={30} rx={8} fill="#111827" />
            <circle cx={0} cy={L2 - 31} r={13} fill={C.accent} />
          </g>
        )}
        <g transform={`translate(0 ${L2 + 8})`}>
          <g transform={`rotate(${-(a1 + a2)})`}>
            {prop === "point" && <rect x={-10} y={-92} width={22} height={70} rx={11} fill={SKIN} />}
            {prop === "thumb" && <rect x={-12} y={-80} width={26} height={60} rx={13} fill={SKIN} />}
          </g>
          <circle r={36} fill={SKIN} />
          <g transform={`rotate(${-(a1 + a2)})`}>
            <Prop prop={prop} t={t} snip={snip} />
          </g>
        </g>
      </g>
    </g>
  );
};

const Prop: React.FC<{ prop: HandProp; t: number; snip: boolean }> = ({ prop, t, snip }) => {
  switch (prop) {
    case "phone":
      return (
        <g>
          <ellipse cx={0} cy={-90} rx={80} ry={110} fill="#8fd3ff" opacity={0.18} />
          <rect x={-48} y={-178} width={96} height={176} rx={18} fill="#0f172a" stroke="#475569" strokeWidth={4} />
          <rect x={-34} y={-164} width={28} height={28} rx={8} fill="#1e293b" />
          <circle cx={-28} cy={-14} r={15} fill={SKIN_SHADE} />
        </g>
      );
    case "phoneApp":
      return (
        <g>
          <rect x={-58} y={-210} width={116} height={208} rx={20} fill="#0f172a" stroke="#475569" strokeWidth={4} />
          <rect x={-48} y={-198} width={96} height={184} rx={13} fill={C.night} />
          <g transform="translate(-26 -134)" fill="none" stroke={C.accent} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4L26 34L44 4" />
            <path d="M26 34L13 50M26 34L39 50" />
            <circle cx="9" cy="56" r="8" />
            <circle cx="43" cy="56" r="8" />
          </g>
          <circle cx={-34} cy={-14} r={15} fill={SKIN_SHADE} />
        </g>
      );
    case "scissors": {
      const rot = snip ? Math.sin(t * 26) * 16 : 0;
      return (
        <g transform={`rotate(${-35 + rot})`}>
          <Scissors x={-70} y={-150} size={140} color="#e2e8f0" strokeWidth={2.6} />
        </g>
      );
    }
    case "pizza":
      return (
        <g transform="rotate(-20)">
          <path d="M -60 -50 L 50 -10 L 15 60 Z" fill="#f6c453" />
          <path d="M 50 -10 L 15 60" stroke="#c98a3a" strokeWidth={18} strokeLinecap="round" />
          <circle cx={-10} cy={-14} r={10} fill="#c0392b" />
          <circle cx={18} cy={14} r={9} fill="#c0392b" />
          <circle cx={-28} cy={-34} r={7} fill="#c0392b" />
        </g>
      );
    default:
      return null;
  }
};
