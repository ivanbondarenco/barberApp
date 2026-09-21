"use client";

import type { ReactNode } from "react";
import { OwnerOnly } from "@/components/layout/RoleGuard";

/** Pantalla del dueño: un barbero que entre por URL vuelve a su agenda. */
export default function Layout({ children }: { children: ReactNode }) {
  return <OwnerOnly>{children}</OwnerOnly>;
}
