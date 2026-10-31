import { visitorShop } from "@/server/auth";
import { loadState } from "@/server/repository";

export const dynamic = "force-dynamic";

/**
 * Manifiesto de la PWA con la marca de la barbería que el visitante tiene elegida.
 *
 * Se genera por pedido en vez de servir un archivo fijo: si fuera estático, toda barbería que
 * instalara la app en el celular vería el nombre de otra.
 */
const MAX_SHORT = 12;

function shortName(name: string): string {
  if (name.length <= MAX_SHORT) return name;
  let out = "";
  for (const word of name.split(/\s+/)) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > MAX_SHORT) break;
    out = next;
  }
  // Una sola palabra más larga que el límite: ahí sí hay que cortarla.
  return out || `${name.slice(0, MAX_SHORT - 1)}…`;
}

export async function GET() {
  const shop = await visitorShop();
  const name = shop ? (await loadState(shop.id)).state.businessInfo.name : "BarberApp";
  // Nombre corto: lo que entra abajo del ícono en el celular. Se corta por palabras, así
  // "Barbería Del Sur" queda como "Barbería Del" y no como "Barbería De…".
  const short = shortName(name);

  return Response.json(
    {
      id: shop ? `/b/${shop.slug}` : "/",
      name,
      short_name: short,
      description: `Reservá tu turno en ${name}.`,
      lang: "es-AR",
      start_url: shop ? `/b/${shop.slug}` : "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      theme_color: "#1D4ED8",
      // Pantalla de carga de la app instalada: el mismo navy del ícono.
      background_color: "#0A1020",
      categories: ["lifestyle", "business"],
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        { src: "/icons/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      ],
      shortcuts: [
        { name: "Reservar turno", url: "/cliente/reservar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        { name: "Agenda del día", url: "/admin/agenda", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } },
  );
}
