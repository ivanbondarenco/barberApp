import React from "react";
import { Chunk, norm } from "./timing";
import { C, lin, sp, useT } from "./ui";

/** Subtítulos estilo Reels: de a pocas palabras, la que se dice resaltada. */
export const Captions: React.FC<{
  chunks: Chunk[];
  hide: [number, number][];
  keywords: Set<string>;
  top?: number | ((t: number) => number);
}> = ({ chunks, hide, keywords, top: topProp = 1385 }) => {
  const t = useT();
  const top = typeof topProp === "function" ? topProp(t) : topProp;
  if (hide.some(([a, b]) => t >= a && t < b)) return null;
  const chunk = chunks.find((c) => t >= c.s && t < c.e);
  if (!chunk) return null;
  const p = sp(t, chunk.s, { damping: 12, stiffness: 260 });
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 60,
        right: 60,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: 34,
        transform: `scale(${0.8 + 0.2 * p}) translateY(${(1 - p) * 30}px)`,
        opacity: lin(t, chunk.s, chunk.s + 0.06),
        zIndex: 50,
      }}
    >
      {chunk.words.map((w, i) => {
        const active = t >= w.s && (t < w.e || i === chunk.words.length - 1);
        const key = keywords.has(norm(w.text));
        return (
          <span
            key={i}
            style={{
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.12,
              textTransform: "uppercase",
              letterSpacing: -1,
              color: key ? C.amber : active ? C.accent : "#fff",
              transform: `scale(${active ? 1.1 : 1})`,
              display: "inline-block",
              WebkitTextStroke: `14px ${C.night}`,
              paintOrder: "stroke fill",
              textShadow: "0 8px 30px rgba(0,0,0,.6)",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
