"use client";

import { Check, Download, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Page } from "@/components/motion/Page";
import { Field } from "@/components/ui/Field";
import { Section } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { addDays, longDate, shortDate, todayISO } from "@/lib/dates";
import { buildSlots, openingHours, SLOT_STEP_MIN } from "@/lib/schedule";
import { canvasToFile, drawStory, isLightColor, STORY_COLORS } from "@/lib/story-image";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const COLOR_KEY = "contenido:color";
/** Días que se ofrecen para armar la imagen. */
const DAYS_AHEAD = 14;

function readColor(): string {
  try {
    const saved = localStorage.getItem(COLOR_KEY);
    if (saved && /^#[0-9a-f]{6}$/i.test(saved)) return saved;
  } catch {}
  return STORY_COLORS[0].value;
}

/**
 * Contenido para redes: arma la imagen de los turnos libres de un día, lista para subir a la
 * Historia de Instagram o al Estado de WhatsApp. El dueño elige día, barbero y color.
 */
export default function ContenidoPage() {
  const session = useAppStore((s) => s.session);
  const shop = useAppStore((s) => s.shop);
  const info = useAppStore((s) => s.businessInfo);
  const hours = useAppStore((s) => s.businessHours);
  const barbers = useAppStore((s) => s.barbers);
  const services = useAppStore((s) => s.services);
  const appointments = useAppStore((s) => s.appointments);
  const blocks = useAppStore((s) => s.blocks);
  const isOwner = session?.role === "admin";

  const team = useMemo(
    () =>
      barbers
        .filter((b) => b.active && (isOwner || b.id === session?.barberId))
        .sort((a, b) => a.chair - b.chair),
    [barbers, isOwner, session?.barberId],
  );

  const today = todayISO();
  const days = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = addDays(today, i);
      if (openingHours(d, hours)) list.push(d);
    }
    return list;
  }, [today, hours]);

  const [date, setDate] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string>("todos");
  const [color, setColor] = useState(STORY_COLORS[0].value);
  const [message, setMessage] = useState("¡Reservá tu turno!");
  const [origin, setOrigin] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setColor(readColor());
    setOrigin(window.location.host);
  }, []);

  const pickColor = (value: string) => {
    setColor(value);
    try {
      localStorage.setItem(COLOR_KEY, value);
    } catch {}
  };

  const day = date && days.includes(date) ? date : (days[0] ?? today);
  // Un barbero solo arma la imagen de su propio sillón.
  const selected = isOwner ? barberId : (session?.barberId ?? "todos");
  const chosenBarbers = selected === "todos" ? team : team.filter((b) => b.id === selected);

  // Horarios en los que entra al menos el servicio más corto, con cualquiera de los barberos elegidos.
  const times = useMemo(() => {
    const active = services.filter((s) => s.active);
    const duration = active.length ? Math.min(...active.map((s) => s.durationMin)) : SLOT_STEP_MIN;
    const set = new Set<string>();
    for (const b of chosenBarbers) {
      for (const slot of buildSlots({ date: day, barberId: b.id, durationMin: duration, appointments, blocks, hours })) {
        if (slot.available) set.add(slot.time);
      }
    }
    return [...set].sort();
  }, [chosenBarbers, services, day, appointments, blocks, hours]);

  const dateLabel = day === today ? `Hoy · ${longDate(day)}` : day === addDays(today, 1) ? `Mañana · ${longDate(day)}` : longDate(day);
  const subtitle = selected !== "todos" && chosenBarbers[0] ? `con ${chosenBarbers[0].name}` : undefined;
  const footer = shop && origin ? `${origin}/b/${shop.slug}` : info.instagram ? `@${info.instagram.replace(/^@/, "")}` : undefined;
  const shopName = info.name || shop?.name || "Mi barbería";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const fontFamily = getComputedStyle(document.body).fontFamily;
    const draw = () => !cancelled && drawStory(canvas, { shopName, dateLabel, subtitle, times, message, footer, color, fontFamily });
    draw();
    // La tipografía de la app puede terminar de cargar después: se redibuja con ella.
    void document.fonts?.ready.then(draw);
    return () => {
      cancelled = true;
    };
  }, [shopName, dateLabel, subtitle, times, message, footer, color]);

  const fileName = `turnos-${day}.png`;

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const file = await canvasToFile(canvas, fileName);
    if (!file) return toast("No se pudo generar la imagen", "error");
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const file = await canvasToFile(canvas, fileName);
    if (!file) return toast("No se pudo generar la imagen", "error");
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Turnos disponibles · ${shopName}` });
      } catch {
        // El usuario cerró el menú de compartir.
      }
      return;
    }
    toast("Este dispositivo no permite compartir imágenes. Se descargó para que la subas.", "info");
    await download();
  };

  return (
    <Page className="gap-5 px-5 pb-6 pt-1">
      <p className="text-[13px] text-secondary">
        Generá una imagen con los turnos libres para subir a la Historia de Instagram o al Estado de WhatsApp. Se actualiza sola con la agenda.
      </p>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-5 lg:w-80 lg:shrink-0">
          <Section title="Día">
            {days.length === 0 ? (
              <p className="text-[13px] text-secondary">No hay días abiertos en las próximas dos semanas. Revisá los horarios en Configuración.</p>
            ) : (
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDate(d)}
                    aria-pressed={d === day}
                    className={cn("tap chip shrink-0 px-3 py-2 text-[13px]", d === day ? "bg-primary text-on-primary" : "bg-surface-low text-secondary")}
                  >
                    {d === addDays(today, 1) ? "Mañana" : shortDate(d)}
                  </button>
                ))}
              </div>
            )}
          </Section>

          {isOwner && team.length > 1 && (
            <Section title="Barbero">
              <div className="flex flex-wrap gap-2">
                {[{ id: "todos", name: "Todos" }, ...team].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBarberId(b.id)}
                    aria-pressed={b.id === selected}
                    className={cn("tap chip px-3 py-2 text-[13px]", b.id === selected ? "bg-primary text-on-primary" : "bg-surface-low text-secondary")}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Color">
            <div className="flex flex-wrap items-center gap-2.5">
              {STORY_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => pickColor(c.value)}
                  aria-label={c.name}
                  aria-pressed={color.toLowerCase() === c.value.toLowerCase()}
                  className="tap grid size-10 place-items-center rounded-full ring-1 ring-black/10"
                  style={{ background: c.value }}
                >
                  {color.toLowerCase() === c.value.toLowerCase() && <Check size={18} color={isLightColor(c.value) ? "#0B0F19" : "#FFFFFF"} strokeWidth={3} />}
                </button>
              ))}
              <label className="tap relative grid size-10 cursor-pointer place-items-center overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} title="Otro color">
                <span className="sr-only">Elegir otro color</span>
                <input type="color" value={color} onChange={(e) => pickColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
            </div>
          </Section>

          <Field label="Mensaje" htmlFor="contenido-mensaje">
            <input id="contenido-mensaje" value={message} maxLength={40} onChange={(e) => setMessage(e.target.value)} className="field" placeholder="¡Reservá tu turno!" />
          </Field>

          <div className="hidden flex-col gap-2 lg:flex">
            <Actions onShare={share} onDownload={download} />
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-3">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Vista previa: ${times.length} turnos disponibles el ${dateLabel}`}
            className="aspect-[9/16] w-full max-w-[320px] rounded-2xl shadow-md"
          />
          <p className="text-[12px] text-secondary">
            {times.length ? `${times.length} horarios libres` : "No quedan horarios libres ese día"} · 1080×1920
          </p>
          <div className="flex w-full max-w-[320px] flex-col gap-2 lg:hidden">
            <Actions onShare={share} onDownload={download} />
          </div>
        </div>
      </div>
    </Page>
  );
}

function Actions({ onShare, onDownload }: { onShare: () => void; onDownload: () => void }) {
  return (
    <>
      <button type="button" onClick={onShare} className="tap btn-primary flex items-center justify-center gap-2">
        <Share2 size={18} /> Compartir en Historia / Estado
      </button>
      <button type="button" onClick={onDownload} className="tap flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface-low text-[14px] font-semibold text-ink">
        <Download size={18} /> Descargar imagen
      </button>
    </>
  );
}
