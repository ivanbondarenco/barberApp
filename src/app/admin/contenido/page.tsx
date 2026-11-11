"use client";

import { Check, Download, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Page } from "@/components/motion/Page";
import { Field } from "@/components/ui/Field";
import { Section } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { addDays, dayNumber, dayShort, longDate, monthShort, monthYear, shortDate, todayISO, workWeek } from "@/lib/dates";
import { buildSlots, openingHours, SLOT_STEP_MIN, weekSlots } from "@/lib/schedule";
import { canvasToFile, drawStory, drawWeekStory, isLightColor, shortTime, STORY_COLORS } from "@/lib/story-image";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const COLOR_KEY = "contenido:color";
/** Horarios marcados a mano en la imagen semanal: "fecha hora" → tachado o no. */
const MANUAL_KEY = "contenido:manual";
/** Días que se ofrecen para armar la imagen. */
const DAYS_AHEAD = 14;

type Mode = "dia" | "semana";

function readColor(): string {
  try {
    const saved = localStorage.getItem(COLOR_KEY);
    if (saved && /^#[0-9a-f]{6}$/i.test(saved)) return saved;
  } catch {}
  return STORY_COLORS[0].value;
}

function readManual(today: string): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(MANUAL_KEY) ?? "{}") as Record<string, unknown>;
    // Se descartan los de semanas pasadas: ya no salen en ninguna imagen.
    return Object.fromEntries(
      Object.entries(raw).filter(([k, v]) => typeof v === "boolean" && k.slice(0, 10) >= addDays(today, -7)),
    ) as Record<string, boolean>;
  } catch {
    return {};
  }
}

/** "Del 10 al 15 de Noviembre", o "Del 28 Oct al 2 Nov" si cruza de mes. */
function weekLabel(days: string[]): string {
  if (!days.length) return "";
  const first = days[0];
  const last = days[days.length - 1];
  if (monthShort(first) === monthShort(last)) return `Del ${dayNumber(first)} al ${dayNumber(last)} de ${monthYear(first).split(" ")[0]}`;
  return `Del ${dayNumber(first)} ${monthShort(first)} al ${dayNumber(last)} ${monthShort(last)}`;
}

/**
 * Contenido para redes: arma la imagen de los turnos libres de un día o de la semana entera,
 * lista para subir a la Historia de Instagram o al Estado de WhatsApp. En la semanal los
 * horarios ocupados salen tachados (o se ocultan), y se pueden tachar a mano.
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

  const shortestService = useMemo(() => {
    const active = services.filter((s) => s.active);
    return active.length ? Math.min(...active.map((s) => s.durationMin)) : SLOT_STEP_MIN;
  }, [services]);

  const [mode, setMode] = useState<Mode>("semana");
  const [date, setDate] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [hideTaken, setHideTaken] = useState(false);
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [barberId, setBarberId] = useState<string>("todos");
  const [color, setColor] = useState(STORY_COLORS[0].value);
  const [message, setMessage] = useState("¡Reservá tu turno!");
  const [origin, setOrigin] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setColor(readColor());
    setManual(readManual(todayISO()));
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
    const set = new Set<string>();
    for (const b of chosenBarbers) {
      for (const slot of buildSlots({ date: day, barberId: b.id, durationMin: shortestService, appointments, blocks, hours })) {
        if (slot.available) set.add(slot.time);
      }
    }
    return [...set].sort();
  }, [chosenBarbers, shortestService, day, appointments, blocks, hours]);

  // Semana de lunes a domingo; los días cerrados quedan afuera.
  const weekDays = useMemo(() => {
    const week = workWeek(today, weekOffset);
    return [...week, addDays(week[0], 6)];
  }, [today, weekOffset]);

  const week = useMemo(() => {
    const fromAgenda = weekSlots({
      days: weekDays,
      barberIds: chosenBarbers.map((b) => b.id),
      // Los mismos horarios que ve el cliente al reservar el servicio más corto.
      durationMin: shortestService,
      appointments,
      blocks,
      hours,
    });
    return fromAgenda.map((d) => ({
      ...d,
      // Lo que la agenda da por tomado (reservado, bloqueado o ya pasado) queda tachado siempre;
      // a mano solo se tachan horarios que la agenda tiene libres.
      slots: d.slots.map((s) => ({ ...s, auto: s.taken, taken: s.taken || manual[`${d.date} ${s.time}`] === true })),
    }));
  }, [weekDays, chosenBarbers, shortestService, appointments, blocks, hours, manual]);

  const toggleManual = (date: string, time: string) => {
    const key = `${date} ${time}`;
    setManual((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      try {
        localStorage.setItem(MANUAL_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetManual = () => {
    setManual({});
    try {
      localStorage.removeItem(MANUAL_KEY);
    } catch {}
  };

  const manualInWeek = week.some((d) => d.slots.some((s) => s.taken !== s.auto));
  // Para tachar a mano: solo los horarios que la agenda tiene libres (ni reservados ni pasados).
  const editable = week.map((d) => ({ date: d.date, slots: d.slots.filter((s) => !s.auto) })).filter((d) => d.slots.length > 0);
  const freeInWeek = week.reduce((n, d) => n + d.slots.filter((s) => !s.taken).length, 0);

  const dateLabel = day === today ? `Hoy · ${longDate(day)}` : day === addDays(today, 1) ? `Mañana · ${longDate(day)}` : longDate(day);
  const subtitle = selected !== "todos" && chosenBarbers[0] ? `con ${chosenBarbers[0].name}` : undefined;
  const footer = shop && origin ? `${origin}/b/${shop.slug}` : info.instagram ? `@${info.instagram.replace(/^@/, "")}` : undefined;
  const shopName = info.name || shop?.name || "Mi barbería";
  const wLabel = weekLabel(week.map((d) => d.date));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const fontFamily = getComputedStyle(document.body).fontFamily;
    const draw = () => {
      if (cancelled) return;
      if (mode === "dia") drawStory(canvas, { shopName, dateLabel, subtitle, times, message, footer, color, fontFamily });
      else
        drawWeekStory(canvas, {
          shopName,
          weekLabel: wLabel,
          subtitle,
          // Ocultando ocupados, un día que ya pasó saldría "Completo": mejor que no aparezca.
          days: (hideTaken ? week.filter((d) => d.date >= todayISO()) : week).map((d) => ({ label: dayShort(d.date).toUpperCase(), sub: String(dayNumber(d.date)), slots: d.slots })),
          hideTaken,
          message,
          footer,
          color,
          fontFamily,
        });
    };
    draw();
    // La tipografía de la app puede terminar de cargar después: se redibuja con ella.
    void document.fonts?.ready.then(draw);
    return () => {
      cancelled = true;
    };
  }, [mode, shopName, dateLabel, subtitle, times, message, footer, color, week, wLabel, hideTaken]);

  const fileName = mode === "dia" ? `turnos-${day}.png` : `turnos-semana-${weekDays[0]}.png`;

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

  const chip = (active: boolean) => cn("tap chip shrink-0 px-3 py-2 text-[13px]", active ? "bg-primary text-on-primary" : "bg-surface-low text-secondary");

  return (
    <Page className="gap-5 px-5 pb-6 pt-1">
      <p className="text-[13px] text-secondary">
        Generá una imagen con los turnos libres para subir a la Historia de Instagram o al Estado de WhatsApp. Se actualiza sola con la agenda.
      </p>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-5 lg:w-80 lg:shrink-0">
          <Section title="Formato">
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("semana")} aria-pressed={mode === "semana"} className={chip(mode === "semana")}>
                Toda la semana
              </button>
              <button type="button" onClick={() => setMode("dia")} aria-pressed={mode === "dia"} className={chip(mode === "dia")}>
                Un día
              </button>
            </div>
          </Section>

          {mode === "dia" ? (
            <Section title="Día">
              {days.length === 0 ? (
                <p className="text-[13px] text-secondary">No hay días abiertos en las próximas dos semanas. Revisá los horarios en Configuración.</p>
              ) : (
                <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
                  {days.map((d) => (
                    <button key={d} type="button" onClick={() => setDate(d)} aria-pressed={d === day} className={chip(d === day)}>
                      {d === addDays(today, 1) ? "Mañana" : shortDate(d)}
                    </button>
                  ))}
                </div>
              )}
            </Section>
          ) : (
            <>
              <Section title="Semana">
                <div className="flex gap-2">
                  {["Esta semana", "La próxima"].map((label, i) => (
                    <button key={label} type="button" onClick={() => setWeekOffset(i)} aria-pressed={weekOffset === i} className={chip(weekOffset === i)}>
                      {label}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Ocupados">
                <p className="mb-2 text-[12px] text-secondary">
                  Los horarios son los mismos que ofrece la reserva, según los días y franjas de Configuración.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setHideTaken(false)} aria-pressed={!hideTaken} className={chip(!hideTaken)}>
                    Tachar ocupados
                  </button>
                  <button type="button" onClick={() => setHideTaken(true)} aria-pressed={hideTaken} className={chip(hideTaken)}>
                    Ocultar ocupados
                  </button>
                </div>
              </Section>
            </>
          )}

          {isOwner && team.length > 1 && (
            <Section title="Barbero">
              <div className="flex flex-wrap gap-2">
                {[{ id: "todos", name: "Todos" }, ...team].map((b) => (
                  <button key={b.id} type="button" onClick={() => setBarberId(b.id)} aria-pressed={b.id === selected} className={chip(b.id === selected)}>
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

          {mode === "semana" && editable.length > 0 && (
            <Section title="Tachar a mano">
              <p className="mb-2 text-[12px] text-secondary">
                Los turnos reservados y lo que ya pasó se tachan solos. Acá están los horarios libres: tocá uno para tacharlo, por ejemplo si lo reservaron por otro lado.
              </p>
              <div className="flex flex-col gap-2.5">
                {editable.map((d) => (
                  <div key={d.date} className="flex items-start gap-2">
                    <span className="w-12 shrink-0 pt-1.5 text-[12px] font-semibold text-secondary">
                      {dayShort(d.date)} {dayNumber(d.date)}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {d.slots.map((s) => (
                        <button
                          key={s.time}
                          type="button"
                          onClick={() => toggleManual(d.date, s.time)}
                          aria-pressed={s.taken}
                          aria-label={`${shortTime(s.time)} ${s.taken ? "tachado" : "libre"}`}
                          className={cn(
                            "tap rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums",
                            s.taken ? "bg-surface-low text-secondary line-through opacity-60 ring-1 ring-primary" : "bg-primary/10 text-ink",
                          )}
                        >
                          {shortTime(s.time)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {manualInWeek && (
                <button type="button" onClick={resetManual} className="tap mt-2 text-[12px] font-semibold text-primary">
                  Volver a lo que dice la agenda
                </button>
              )}
            </Section>
          )}

          <div className="hidden flex-col gap-2 lg:flex">
            <Actions onShare={share} onDownload={download} />
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-3 lg:sticky lg:top-4">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={mode === "dia" ? `Vista previa: ${times.length} turnos disponibles el ${dateLabel}` : `Vista previa: ${freeInWeek} turnos disponibles, ${wLabel}`}
            className="aspect-[9/16] w-full max-w-[320px] rounded-2xl shadow-md"
          />
          <p className="text-[12px] text-secondary">
            {mode === "dia"
              ? times.length
                ? `${times.length} horarios libres`
                : "No quedan horarios libres ese día"
              : freeInWeek
                ? `${freeInWeek} horarios libres en la semana`
                : "No quedan horarios libres esta semana"}{" "}
            · 1080×1920
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
