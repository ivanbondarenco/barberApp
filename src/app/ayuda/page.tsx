"use client";

import { AtSign, ChevronDown, Clock, Mail, MapPin, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { cn } from "@/lib/cn";
import { whatsappLink } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const FAQ = [
  {
    q: "¿Por qué tengo que pagar una seña?",
    a: "Cada turno bloquea un sillón exclusivo para vos. La seña del 50% confirma la reserva y se descuenta del total.",
  },
  {
    q: "¿Cómo reprogramo o cancelo?",
    a: "Desde Mis Turnos → Reprogramar o Cancelar, hasta 3 horas antes. La seña queda como crédito a favor.",
  },
  {
    q: "¿Puedo pagar la seña en efectivo?",
    a: "Sí, en recepción hasta 4 horas antes del turno. Para turnos más cercanos, la seña se abona online.",
  },
  {
    q: "¿Cómo retiro productos de la tienda?",
    a: "Sumalos a tu turno desde la Tienda. Te los entregamos en el sillón y se agregan al saldo a pagar.",
  },
  {
    q: "Pagué con Mercado Pago y no veo la seña",
    a: "La acreditación puede demorar unos minutos. Si pasaron más de 30, escribinos por WhatsApp con el comprobante.",
  },
  {
    q: "¿Puedo elegir barbero?",
    a: "Sí. En Nueva Reserva tocá “Cambiar” sobre la ficha del barbero para ver el equipo disponible.",
  },
];

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function AyudaPage() {
  const info = useAppStore((s) => s.businessInfo);
  const hours = useAppStore((s) => s.businessHours);
  const [open, setOpen] = useState<number | null>(0);

  const weekday = hours[1];
  const saturday = hours[6];

  return (
    <PublicShell title="Ayuda y contacto">
      <div className="flex flex-col gap-2.5 px-4 py-3">
        <section className="card grid grid-cols-2 gap-2 p-3" aria-label="Contacto">
          <a
            href={whatsappLink(info.whatsapp, `Hola ${info.name}, necesito ayuda con mi turno`)}
            target="_blank"
            rel="noreferrer"
            className="tap col-span-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-on-primary shadow-sm"
          >
            <MessageSquareText size={18} /> Escribinos por WhatsApp
          </a>
          <p className="flex items-start gap-1.5 text-[11px] text-secondary">
            <MapPin size={14} className="mt-px shrink-0 text-primary" />
            <span>
              <strong className="block text-ink">{info.address}</strong>
              {info.neighborhood}
            </span>
          </p>
          <p className="flex items-start gap-1.5 text-[11px] text-secondary">
            <Clock size={14} className="mt-px shrink-0 text-primary" />
            <span>
              <strong className="block text-ink">
                Lun–Vie {weekday.closed ? "cerrado" : `${weekday.open}–${weekday.close}`}
              </strong>
              Sáb {saturday.closed ? "cerrado" : `${saturday.open}–${saturday.close}`} · {DAY_NAMES[0]} {hours[0].closed ? "cerrado" : `${hours[0].open}–${hours[0].close}`}
            </span>
          </p>
          <a href={`mailto:${info.email}`} className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <Mail size={14} /> {info.email}
          </a>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <AtSign size={14} /> {info.instagram}
          </span>
        </section>

        <h2 className="px-0.5 text-[15px] font-semibold">Preguntas frecuentes</h2>
        <ul className="flex flex-col gap-1.5">
          {FAQ.map((item, i) => {
            const expanded = open === i;
            return (
              <li key={item.q} className="card overflow-hidden">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : i)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] font-semibold"
                >
                  {item.q}
                  <ChevronDown size={16} className={cn("shrink-0 text-secondary transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded && <p className="px-3 pb-2.5 text-xs leading-relaxed text-secondary">{item.a}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </PublicShell>
  );
}
