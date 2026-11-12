"use client";

import { AtSign, ChevronDown, Clock, Mail, MapPin, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { cn } from "@/lib/cn";
import { whatsappLink } from "@/lib/format";
import { depositPercent } from "@/lib/pricing";
import { formatDayHours } from "@/lib/schedule";
import { useAppStore } from "@/store/useAppStore";
import { useBookingRules } from "@/store/useRules";

/** Preguntas frecuentes con las reglas reales del local: seña, efectivo y medios habilitados. */
function buildFaq(opts: { rate: number; allowCash: boolean; mercadopagoReady: boolean; cancelHours: number; cashHours: number }) {
  const online = opts.mercadopagoReady ? "con Mercado Pago o por transferencia" : "por transferencia";
  const faq: { q: string; a: string }[] = [];
  if (opts.rate > 0) {
    faq.push({
      q: "¿Por qué tengo que pagar una seña?",
      a: `Cada turno bloquea un sillón exclusivo para vos. La seña del ${depositPercent(opts.rate)} confirma la reserva y se descuenta del total.`,
    });
  }
  faq.push({
    q: "¿Cómo reprogramo o cancelo?",
    a:
      `Desde Mis Turnos → Reprogramar o Cancelar, hasta ${opts.cancelHours} horas antes.` +
      (opts.rate > 0 ? " La seña queda como crédito a favor." : "") +
      " Si reservaste sin cuenta, escribinos por WhatsApp.",
  });
  if (opts.rate > 0) {
    faq.push({
      q: "¿Puedo pagar la seña en efectivo?",
      a: opts.allowCash
        ? `Sí, en el local hasta ${opts.cashHours} horas antes del turno. Para turnos más cercanos, la seña se abona ${online}.`
        : `No: este local pide la seña online, ${online}.`,
    });
  }
  faq.push({
    q: "¿Cómo retiro productos de la tienda?",
    a: "Sumalos a tu turno desde la Tienda. Te los entregamos en el sillón y se agregan al saldo a pagar.",
  });
  if (opts.rate > 0 && opts.mercadopagoReady) {
    faq.push({
      q: "Pagué con Mercado Pago y no veo la seña",
      a: "La acreditación puede demorar unos minutos. Si pasaron más de 30, escribinos por WhatsApp con el comprobante.",
    });
  }
  faq.push({
    q: "¿Puedo elegir barbero?",
    a: "Sí. Al reservar, tocá “Cambiar” sobre la ficha del barbero para ver el equipo disponible.",
  });
  return faq;
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function AyudaPage() {
  const info = useAppStore((s) => s.businessInfo);
  const hours = useAppStore((s) => s.businessHours);
  const { rate, allowCash } = useAppStore((s) => s.depositSettings);
  const mercadopagoReady = useAppStore((s) => s.integrations.mercadopagoReady);
  const rules = useBookingRules();
  const faq = buildFaq({ rate, allowCash, mercadopagoReady, cancelHours: rules.cancelHours, cashHours: rules.cashDeadlineHours });
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
          <p className="flex items-start gap-1.5 text-[13px] text-secondary">
            <MapPin size={14} className="mt-px shrink-0 text-primary" />
            <span>
              <strong className="block text-ink">{info.address}</strong>
              {info.neighborhood}
            </span>
          </p>
          <p className="flex items-start gap-1.5 text-[13px] text-secondary">
            <Clock size={14} className="mt-px shrink-0 text-primary" />
            <span>
              <strong className="block text-ink">
                Lun–Vie {weekday.closed ? "cerrado" : formatDayHours(weekday, "–")}
              </strong>
              Sáb {saturday.closed ? "cerrado" : formatDayHours(saturday, "–")} · {DAY_NAMES[0]} {hours[0].closed ? "cerrado" : formatDayHours(hours[0], "–")}
            </span>
          </p>
          {info.email && (
            <a href={`mailto:${info.email}`} className="flex min-h-11 min-w-0 items-center gap-1.5 text-[13px] font-semibold text-primary">
              <Mail size={14} className="shrink-0" /> <span className="truncate">{info.email}</span>
            </a>
          )}
          {info.instagram && (
            <a
              href={`https://instagram.com/${info.instagram.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 min-w-0 items-center gap-1.5 text-[13px] font-semibold text-primary"
            >
              <AtSign size={14} className="shrink-0" /> <span className="truncate">{info.instagram}</span>
            </a>
          )}
        </section>

        <h2 className="section-title px-0.5">Preguntas frecuentes</h2>
        <ul className="flex flex-col gap-1.5">
          {faq.map((item, i) => {
            const expanded = open === i;
            return (
              <li key={item.q} className="card overflow-hidden">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : i)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold"
                >
                  {item.q}
                  <ChevronDown size={16} className={cn("shrink-0 text-secondary transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded && <p className="px-3 pb-2.5 text-[13px] leading-relaxed text-secondary">{item.a}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </PublicShell>
  );
}
