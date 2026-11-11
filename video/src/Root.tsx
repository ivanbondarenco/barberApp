import React from "react";
import { Composition } from "remotion";
import { Reel } from "./Reel";
import { NicoReel, NICO_TOTAL } from "./NicoReel";
import { f, FPS, TOTAL } from "./timing";

export const Root: React.FC = () => (
  <>
    <Composition id="Reel" component={Reel} durationInFrames={f(TOTAL)} fps={FPS} width={1080} height={1920} />
    <Composition id="Nico" component={NicoReel} durationInFrames={f(NICO_TOTAL)} fps={FPS} width={1080} height={1920} />
  </>
);
