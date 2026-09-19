import type { ProductShape } from "@/lib/types";

/** Ilustración vectorial del envase (sin imágenes externas, funciona offline). */
export function ProductVisual({ shape, className }: { shape: ProductShape; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" fill="#EFF4FF" />
      <ellipse cx="50" cy="86" rx="30" ry="4" fill="#101C36" opacity="0.08" />
      {shape === "jar" && (
        <g>
          <rect x="24" y="44" width="52" height="40" rx="7" fill="#213145" />
          <rect x="22" y="34" width="56" height="14" rx="5" fill="#101C36" />
          <rect x="32" y="58" width="36" height="14" rx="2" fill="#DCE1FF" />
          <text x="50" y="68" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1D4ED8" fontFamily="Georgia, serif">
            DS
          </text>
        </g>
      )}
      {shape === "dropper" && (
        <g>
          <rect x="45" y="14" width="10" height="14" rx="4" fill="#101C36" />
          <rect x="41" y="26" width="18" height="10" rx="2" fill="#213145" />
          <rect x="33" y="36" width="34" height="48" rx="8" fill="#1E40AF" />
          <rect x="38" y="52" width="24" height="18" rx="2" fill="#DCE1FF" />
          <text x="50" y="64" textAnchor="middle" fontSize="7" fontWeight="700" fill="#101C36" fontFamily="Georgia, serif">
            DS
          </text>
        </g>
      )}
      {shape === "bottle" && (
        <g>
          <rect x="43" y="16" width="14" height="12" rx="2" fill="#101C36" />
          <path d="M40 28h20l6 10v42a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6V38z" fill="#D3E4FE" stroke="#1D4ED8" strokeWidth="2" />
          <rect x="38" y="50" width="24" height="20" rx="2" fill="#1D4ED8" />
          <text x="50" y="63" textAnchor="middle" fontSize="7" fontWeight="700" fill="#FFFFFF" fontFamily="Georgia, serif">
            DS
          </text>
        </g>
      )}
      {shape === "tube" && (
        <g>
          <path d="M30 20h40l-6 56H36z" fill="#FFFFFF" stroke="#C6C6CE" strokeWidth="1.5" />
          <rect x="40" y="76" width="20" height="10" rx="2" fill="#101C36" />
          <rect x="36" y="36" width="28" height="22" rx="2" fill="#1D4ED8" />
          <text x="50" y="50" textAnchor="middle" fontSize="7" fontWeight="700" fill="#FFFFFF" fontFamily="Georgia, serif">
            DS
          </text>
        </g>
      )}
    </svg>
  );
}
