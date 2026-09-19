import { Scissors } from "lucide-react";
import { cn } from "@/lib/cn";

/** Monograma circular D.S Studio (navy, sin negro puro). */
export function LogoSeal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="D.S Studio Barbería">
      <circle cx="60" cy="60" r="60" fill="#101C36" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="#DCE1FF" strokeOpacity="0.25" strokeWidth="1" />
      <text
        x="60"
        y="30"
        textAnchor="middle"
        fontSize="7"
        letterSpacing="2"
        fill="#DCE1FF"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="700"
      >
        BARBERSHOP
      </text>
      <text
        x="60"
        y="74"
        textAnchor="middle"
        fontSize="40"
        fill="#FFFFFF"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="600"
        letterSpacing="-1"
      >
        DS
      </text>
      <line x1="30" y1="84" x2="90" y2="84" stroke="#DCE1FF" strokeOpacity="0.5" strokeWidth="0.8" />
      <text
        x="60"
        y="95"
        textAnchor="middle"
        fontSize="7"
        letterSpacing="1.6"
        fill="#DCE1FF"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="600"
      >
        STUDIO · BARBERÍA
      </text>
    </svg>
  );
}

/** Marca cuadrada cobalto con tijera, usada en headers. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm",
        className,
      )}
      aria-hidden
    >
      <Scissors size={18} strokeWidth={2.2} />
    </span>
  );
}
