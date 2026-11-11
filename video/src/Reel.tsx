import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { CHUNKS } from "./timing";
import { Captions } from "./captions";
import { C, Scene, useT } from "./ui";
import { Admin, Booking, Cut, CTA, Deposit, Ending, Hook, Problems, Reminder } from "./scenes";

const { fontFamily } = loadFont("normal", { weights: ["300", "500", "600", "700", "800"], subsets: ["latin"] });

// Tramos donde la escena ya muestra el texto en grande: ahí no van subtítulos.
const NO_CAPTIONS: [number, number][] = [
  [9.0, 10.7],
  [34.6, 99],
];
const KEYWORDS = new Set(["whatsapp", "link", "cuenta", "mercado", "pago", "faltazos", "sillas", "sueldos", "redes", "equipo", "horarios", "listo", "asegurado"]);

export const Reel: React.FC = () => (
  <AbsoluteFill style={{ background: C.night, fontFamily, overflow: "hidden" }}>
    <Background />
    <Scene start={0} end={3.6}>
      <Hook />
    </Scene>
    <Scene start={3.6} end={9.05}>
      <Problems />
    </Scene>
    <Scene start={9.05} end={10.7} zoom={false}>
      <Ending />
    </Scene>
    <Scene start={10.65} end={18.05}>
      <Booking />
    </Scene>
    <Scene start={18.0} end={21.7}>
      <Deposit />
    </Scene>
    <Scene start={21.65} end={28.15}>
      <Reminder />
    </Scene>
    <Scene start={28.1} end={34.7}>
      <Admin />
    </Scene>
    <Scene start={34.65} end={38.55}>
      <Cut />
    </Scene>
    <Scene start={38.5} end={43}>
      <CTA />
    </Scene>
    <Captions chunks={CHUNKS} hide={NO_CAPTIONS} keywords={KEYWORDS} />
    <Audio src={staticFile("voz.mp3")} />
  </AbsoluteFill>
);

export const Background: React.FC = () => {
  const t = useT();
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", width: 1100, height: 1100, borderRadius: 999, left: -350 + Math.sin(t * 0.5) * 120, top: -300 + Math.cos(t * 0.4) * 100, background: "radial-gradient(circle, rgba(29,78,216,.38), transparent 65%)" }} />
      <div style={{ position: "absolute", width: 1000, height: 1000, borderRadius: 999, right: -380 + Math.cos(t * 0.45) * 120, bottom: 100 + Math.sin(t * 0.35) * 140, background: "radial-gradient(circle, rgba(143,174,255,.2), transparent 65%)" }} />
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(143,174,255,.12) 2px, transparent 2px)", backgroundSize: "54px 54px", opacity: 0.6 }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)" }} />
    </AbsoluteFill>
  );
};
