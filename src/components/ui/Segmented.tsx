"use client";

import * as m from "motion/react-m";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** Control segmentado con indicador que se desliza entre opciones. */
export function Segmented<T extends string>({ options, value, onChange, label, size = "md", className }: SegmentedProps<T>) {
  const layoutId = useId();
  return (
    <div role="tablist" aria-label={label} className={cn("flex rounded-full bg-surface-low p-1", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full font-semibold transition-colors",
              size === "sm" ? "min-h-10 px-2.5 text-xs" : "min-h-11 px-3 text-[13px]",
              active ? "text-on-primary" : "text-secondary hover:text-ink",
            )}
          >
            {active && (
              <m.span
                layoutId={layoutId}
                transition={spring.layout}
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
                aria-hidden
              />
            )}
            <span className="relative">{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={cn(
                  "relative rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                  active ? "bg-primary-strong text-on-primary" : "bg-surface-high text-ink",
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
