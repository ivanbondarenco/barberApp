"use client";

import * as m from "motion/react-m";
import { AtSign, CalendarPlus, Clock, MapPin, MessageSquareText, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { LogoSeal } from "@/components/layout/Logo";
import { homeFor, ScreenLoader } from "@/components/layout/RoleGuard";
import { NAV, Page } from "@/components/motion/Page";
import { cn } from "@/lib/cn";
import { money, whatsappLink } from "@/lib/format";
import { fadeUp, listItem } from "@/lib/motion";
import { FREE_CANCELLATION_HOURS } from "@/lib/pricing";
import { useAppStore, useHydrated } from "@/store/useAppStore";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Carta pública de la barbería: lo que ve alguien que abre el link del local sin tener cuenta.
 *
 * Es la pantalla que convierte. Antes de pedirle a nadie que se registre, muestra qué hacen,
 * cuánto sale, cuándo abren y dónde quedan.
 */
export default function LocalPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const synced = useAppStore((s) => s.synced);
  const session = useAppStore((s) => s.session);
  const shop = useAppStore((s) => s.shop);
  const info = useAppStore((s) => s.businessInfo);
  const hours = useAppStore((s) => s.businessHours);
  const allServices = useAppStore((s) => s.services);
  const allBarbers = useAppStore((s) => s.barbers);
  const depositRate = useAppStore((s) => s.depositSettings.rate);

  useEffect(() => {
    void useAppStore.getState().refresh(true);
  }, []);

  // Sin barbería elegida no hay carta que mostrar: al selector.
  useEffect(() => {
    if (hydrated && synced && !shop) router.replace("/auth/login");
  }, [hydrated, synced, shop, router]);

  const services = useMemo(() => allServices.filter((s) => s.active), [allServices]);
  const barbers = useMemo(() => allBarbers.filter((b) => b.active), [allBarbers]);

  if (!hydrated || !shop) return <ScreenLoader />;

  const reservarHref = session ? homeFor(session) : "/auth/login";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface shadow-md lg:my-8 lg:min-h-0 lg:max-w-[720px] lg:rounded-3xl">
      <Page className="gap-5 px-5 pb-28 pt-8">
        <m.header variants={fadeUp} initial="hidden" animate="show" className="flex flex-col items-center text-center">
          <LogoSeal className="h-20 w-20 drop-shadow-md" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{info.name}</h1>
          {info.address && (
            <p className="mt-1 flex items-center gap-1.5 text-[15px] text-secondary">
              <MapPin size={15} aria-hidden /> {info.address}
              {info.neighborhood ? `, ${info.neighborhood}` : ""}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {info.whatsapp && (
              <a
                href={whatsappLink(info.whatsapp, `Hola ${info.name}, quería consultar por un turno`)}
                target="_blank"
                rel="noreferrer"
                className="chip bg-surface-lowest py-1.5 text-primary shadow-xs"
              >
                <MessageSquareText size={13} /> WhatsApp
              </a>
            )}
            {info.instagram && (
              <a
                href={`https://instagram.com/${info.instagram.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                className="chip bg-surface-lowest py-1.5 text-primary shadow-xs"
              >
                <AtSign size={13} /> {info.instagram}
              </a>
            )}
          </div>
        </m.header>

        {/* Servicios y precios: lo que la gente realmente viene a ver. */}
        <section>
          <h2 className="text-caps mb-2 text-secondary">Servicios</h2>
          {services.length === 0 ? (
            <p className="rounded-2xl bg-surface-lowest px-4 py-6 text-center text-sm text-secondary shadow-xs">
              El local todavía no publicó su lista de servicios.
            </p>
          ) : (
            <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
              {services.map((s, i) => (
                <m.li key={s.id} custom={i} variants={listItem} initial="hidden" animate="show" className="row">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{s.name}</span>
                    <span className="block truncate text-[13px] text-secondary">
                      {s.durationMin} min{s.description ? ` · ${s.description}` : ""}
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">{money(s.price)}</span>
                </m.li>
              ))}
            </ul>
          )}
        </section>

        {barbers.length > 0 && (
          <section>
            <h2 className="text-caps mb-2 text-secondary">Equipo</h2>
            <ul className="flex flex-wrap gap-2">
              {barbers.map((b) => (
                <li key={b.id} className="flex items-center gap-2 rounded-2xl bg-surface-lowest px-3 py-2 shadow-xs">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary">
                    {b.initials}
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold">{b.name}</span>
                    <span className="block text-[12px] text-secondary">{b.title}</span>
                    {!!b.reviews && (
                      <span className="flex items-center gap-1 text-[12px] text-secondary">
                        <Star size={11} className="fill-primary text-primary" aria-hidden />
                        {b.rating?.toFixed(1)} · {b.reviews} {b.reviews === 1 ? "reseña" : "reseñas"}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-caps mb-2 text-secondary">Horarios</h2>
          <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            {ORDER.map((i) => {
              const day = hours[i];
              return (
                <li key={i} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[14px]">{DAYS[i]}</span>
                  <span className={cn("text-[14px] tabular-nums", day?.closed ? "text-secondary" : "font-medium")}>
                    {day?.closed ? "Cerrado" : `${day.open} – ${day.close}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex items-start gap-2 rounded-2xl bg-surface-lowest px-4 py-3 shadow-xs">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <p className="text-[13px] text-secondary">
            {depositRate > 0 ? (
              <>
                Para confirmar el turno se abona una seña del{" "}
                <strong className="text-ink">{Math.round(depositRate * 100)}%</strong>, que se descuenta del total.
                Cancelás sin cargo hasta {FREE_CANCELLATION_HOURS} h antes.{" "}
              </>
            ) : (
              <>Reservás sin seña. Si no podés venir, avisá con tiempo así el horario queda libre. </>
            )}
            <Link href="/politicas" className="font-semibold text-primary">
              Ver políticas
            </Link>
          </p>
        </section>

        <p className="flex items-center justify-center gap-1.5 text-[13px] text-secondary">
          <Clock size={14} aria-hidden /> Reservá en menos de un minuto
        </p>
      </Page>

      <div className="pb-safe sticky bottom-0 z-10 border-t border-surface-high bg-surface-lowest/95 px-5 py-3 backdrop-blur-xl">
        <Link href={reservarHref} transitionTypes={[...NAV.forward]} className="tap btn-primary">
          <CalendarPlus size={17} /> {session ? "Ir a mi cuenta" : "Reservar turno"}
        </Link>
      </div>
    </div>
  );
}
