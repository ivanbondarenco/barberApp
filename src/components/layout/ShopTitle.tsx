"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * Pone el nombre de la barbería en la pestaña y en la app instalada.
 *
 * El título base es genérico porque el HTML se sirve igual para todas; la marca del local se
 * conoce recién cuando el estado llega, así que se ajusta acá.
 */
export function ShopTitle() {
  const name = useAppStore((s) => s.shop?.name);

  useEffect(() => {
    if (name) document.title = name;
  }, [name]);

  return null;
}
