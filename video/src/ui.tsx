import React, { createContext, useContext } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame } from "remotion";
import { BatteryFull, Signal, Wifi } from "lucide-react";
import { f, FPS } from "./timing";

export const C = {
  night: "#0a1020",
  nightSoft: "#121a2e",
  nightLine: "#1e2842",
  nightMuted: "#a3aec7",
  accent: "#8faeff",
  primary: "#1d4ed8",
  primaryBright: "#2563eb",
  primaryFixed: "#dce1ff",
  ink: "#101c36",
  muted: "#62636c",
  surface: "#f8f9ff",
  surfaceLow: "#f0f3ff",
  surfaceContainer: "#e5eeff",
  outline: "#c6c6ce",
  mint: "#e3f7ee",
  mintInk: "#0f7a55",
  green: "#22c55e",
  red: "#ff6b6b",
  amber: "#ffc857",
  mp: "#009ee3",
  wa: "#25D366",
};

const SceneStart = createContext(0);

/** Tiempo absoluto (s) del video, también dentro de una escena. */
export const useT = () => {
  const frame = useCurrentFrame();
  return useContext(SceneStart) + frame / FPS;
};

/** Resorte 0→1 que arranca en `at` (s). */
export const sp = (t: number, at: number, config: Partial<{ damping: number; stiffness: number; mass: number }> = {}) =>
  t < at ? 0 : spring({ frame: (t - at) * FPS, fps: FPS, config: { damping: 14, stiffness: 170, mass: 0.7, ...config } });

/** Interpolación con easing entre los tiempos a y b. */
export const lin = (t: number, a: number, b: number, from = 0, to = 1, easing = Easing.out(Easing.cubic)) =>
  interpolate(t, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

export const Scene: React.FC<{ start: number; end: number; children: React.ReactNode; zoom?: boolean }> = ({
  start,
  end,
  children,
  zoom = true,
}) => (
  <Sequence from={f(start)} durationInFrames={f(end) - f(start)} layout="none">
    <SceneStart.Provider value={start}>
      <SceneFade start={start} end={end} zoom={zoom}>
        {children}
      </SceneFade>
    </SceneStart.Provider>
  </Sequence>
);

const SceneFade: React.FC<{ start: number; end: number; zoom: boolean; children: React.ReactNode }> = ({
  start,
  end,
  zoom,
  children,
}) => {
  const t = useT();
  const inP = lin(t, start, start + 0.22);
  const outP = lin(t, end - 0.22, end, 0, 1, Easing.in(Easing.cubic));
  const scale = zoom ? interpolate(inP, [0, 1], [1.06, 1]) * interpolate(outP, [0, 1], [1, 0.94]) : 1;
  return (
    <AbsoluteFill style={{ opacity: inP * (1 - outP), transform: `scale(${scale})`, filter: `blur(${outP * 8}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

export const PHONE_W = 540;
export const PHONE_H = Math.round(PHONE_W * 2.05);

export const Phone: React.FC<{
  children: React.ReactNode;
  bg?: string;
  dark?: boolean;
  style?: React.CSSProperties;
  time?: string;
}> = ({ children, bg = C.surface, dark = false, style, time = "9:41" }) => {
  const fg = dark ? "#fff" : C.ink;
  return (
    <div
      style={{
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: 86,
        padding: 14,
        background: "linear-gradient(145deg,#2a3350,#111827)",
        boxShadow: "0 60px 120px rgba(0,0,0,.55), 0 0 0 2px #39445f inset, 0 0 90px rgba(143,174,255,.18)",
        position: "relative",
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 72,
          overflow: "hidden",
          background: bg,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 74,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 48px 0",
            color: fg,
            fontWeight: 700,
            fontSize: 24,
            zIndex: 20,
          }}
        >
          <span>{time}</span>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Signal size={22} strokeWidth={2.6} />
            <Wifi size={22} strokeWidth={2.6} />
            <BatteryFull size={28} strokeWidth={2.2} />
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            top: 18,
            left: "50%",
            width: 150,
            height: 42,
            marginLeft: -75,
            borderRadius: 30,
            background: "#000",
            zIndex: 30,
          }}
        />
        {children}
      </div>
    </div>
  );
};

/** Toque de dedo: aro que se achica y onda expansiva, centrado en el padre. */
export const Tap: React.FC<{ t: number; at: number; color?: string }> = ({ t, at, color = "rgba(29,78,216,.35)" }) => {
  if (t < at - 0.25 || t > at + 0.6) return null;
  const appear = lin(t, at - 0.25, at - 0.05);
  const ripple = lin(t, at, at + 0.55);
  const press = t < at ? 1 : interpolate(lin(t, at, at + 0.15), [0, 1], [0.8, 1]);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          width: 70,
          height: 70,
          borderRadius: 999,
          background: "rgba(255,255,255,.55)",
          border: "3px solid rgba(16,28,54,.35)",
          opacity: appear * (1 - ripple),
          transform: `scale(${press})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 70,
          height: 70,
          borderRadius: 999,
          background: color,
          opacity: t >= at ? 1 - ripple : 0,
          transform: `scale(${1 + ripple * 2.4})`,
        }}
      />
    </div>
  );
};

export const LogoMark: React.FC<{ size: number; draw?: number; bg?: boolean }> = ({ size, draw = 1, bg = true }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    {bg && <rect width="64" height="64" rx="14" fill={C.night} stroke={C.nightLine} strokeWidth={0.8} />}
    <g
      fill="none"
      stroke={C.accent}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      style={{ strokeDasharray: 1, strokeDashoffset: 1 - draw }}
    >
      <path pathLength={1} d="M20 15L32 36L44 15" />
      <path pathLength={1} d="M32 36L23 47M32 36L41 47" />
      <circle pathLength={1} cx="19.5" cy="51" r="6.5" />
      <circle pathLength={1} cx="44.5" cy="51" r="6.5" />
    </g>
  </svg>
);

export const Sticker: React.FC<{ t: number; at: number; until?: number; rotate?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  t,
  at,
  until = 999,
  rotate = -6,
  style,
  children,
}) => {
  const p = sp(t, at, { damping: 11, stiffness: 200 }) * (1 - lin(t, until, until + 0.2));
  return (
    <div
      style={{
        position: "absolute",
        padding: "22px 34px",
        borderRadius: 28,
        background: "#fff",
        color: C.ink,
        fontSize: 40,
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 24px 50px rgba(0,0,0,.45)",
        transform: `scale(${p}) rotate(${rotate * p}deg)`,
        opacity: Math.min(1, p * 2),
        zIndex: 40,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
