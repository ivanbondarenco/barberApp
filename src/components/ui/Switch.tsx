"use client";

import * as m from "motion/react-m";
import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label: string;
  locked?: boolean;
  className?: string;
}

/** Interruptor con área táctil de 44px y perilla con resorte. */
export function Switch({ checked, onChange, label, locked, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={locked || undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (!locked) onChange?.(!checked);
      }}
      className={cn("group -my-2 -mr-1 flex h-11 w-14 shrink-0 items-center justify-center", locked && "cursor-not-allowed", className)}
    >
      <span
        className={cn(
          "flex h-7 w-12 items-center rounded-full p-0.5 transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2",
          checked ? "justify-end bg-primary" : "justify-start bg-[#b9bcc8]",
        )}
      >
        <m.span
          layout
          transition={{ type: "spring", damping: 26, stiffness: 520 }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-lowest shadow-sm"
        >
          {locked && <Lock size={11} className="text-primary" aria-hidden />}
        </m.span>
      </span>
    </button>
  );
}
