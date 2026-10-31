import {
  ArrowRight,
  BarChart3,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  Link2,
  MessageCircle,
  Percent,
  ReceiptText,
  ShoppingBag,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignupLink } from "@/components/auth/SignupLink";
import { LogoSeal } from "@/components/layout/Logo";
import { LegalLink } from "@/components/legal/LegalLink";
import { TRIAL_LABEL } from "@/lib/plan";

/**
 * Presentación de BarberApp para dueños de barberías: qué resuelve, cómo se empieza y cuánto
 * cuesta. Toda estática (sin estado ni datos del servidor) para que cargue al instante.
 *
 * Tema "Medianoche y blanco": bandas navy (encabezado, portada, precio, cierre y pie) y
 * secciones blancas en el medio, con un mockup de la agenda como protagonista. Sin negro puro
 * ni degradados.
 */

const LOGIN = "/auth/login";

export function Landing() {
  return (
    <div className="min-h-dvh bg-surface-lowest text-ink">
      <Nav />
      <main>
        <Hero />
        <Features />
        <Steps />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-night-line bg-night/95 pt-safe text-white backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
          <LogoSeal className="h-8 w-8" />
          BarberApp
        </Link>
        <div className="hidden items-center gap-6 text-sm font-medium text-night-muted md:flex">
          <a href="#funciones" className="hover:text-white">Funciones</a>
          <a href="#como-empezar" className="hover:text-white">Cómo empezar</a>
          <a href="#precio" className="hover:text-white">Precio</a>
          <a href="#preguntas" className="hover:text-white">Preguntas</a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={LOGIN} className="tap rounded-xl px-3 py-2 text-sm font-semibold hover:bg-white/10">
            Ingresar
          </Link>
          <SignupLink
            className="tap hidden rounded-xl bg-primary-bright px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary sm:inline-flex"
          >
            Probar gratis
          </SignupLink>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-night text-white">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#34d399]/15 px-3.5 py-1.5 text-[13px] font-bold text-[#6ee7b7]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6ee7b7]" aria-hidden />
            {TRIAL_LABEL} gratis para tu barbería
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
            Tu barbería.
            <br />
            <span className="text-night-accent">Una sola agenda.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-night-muted sm:text-lg">
            Turnos online, señas con Mercado Pago, recordatorios y tu equipo, todo desde el celular. Tus clientes
            reservan solos y vos te dedicás a cortar.
          </p>
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <SignupLink
              className="tap inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary-bright px-6 text-[15px] font-bold text-on-primary hover:bg-primary sm:w-auto"
            >
              Probar la demo gratis <ArrowRight size={18} aria-hidden />
            </SignupLink>
            <Link
              href={`${LOGIN}?tipo=cliente`}
              className="tap inline-flex min-h-13 w-full items-center justify-center rounded-2xl border border-night-line bg-white/5 px-6 text-[15px] font-semibold hover:bg-white/10 sm:w-auto"
            >
              Soy cliente, quiero reservar
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-night-muted">Sin tarjeta · Android, iPhone y compu · Se instala desde el navegador</p>
        </div>

        <AgendaMockup />
      </div>
    </section>
  );
}

/** La agenda del día como la ve el dueño: el producto, no una ilustración. */
function AgendaMockup() {
  const barbers = ["Nico", "Lucas", "Mati"];
  const slots: { time: string; cells: (Slot | null)[] }[] = [
    { time: "10:00", cells: [{ who: "Tomás R.", what: "Corte + barba", state: "paid" }, null, { who: "Franco G.", what: "Corte", state: "paid" }] },
    { time: "10:45", cells: [null, { who: "Juan P.", what: "Fade", state: "pending" }, null] },
    { time: "11:30", cells: [{ who: "Bruno S.", what: "Corte", state: "paid" }, { who: "Leo M.", what: "Barba", state: "paid" }, null] },
    { time: "12:15", cells: [null, null, { who: "Santi V.", what: "Corte + lavado", state: "pending" }] },
  ];

  return (
    <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-[22px] bg-surface-lowest text-ink shadow-[0_30px_80px_-20px_rgb(0_0_0/0.55)]">
      <div className="flex items-center gap-2 border-b border-surface-container bg-surface-low px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-surface-highest" />
        <span className="h-3 w-3 rounded-full bg-surface-highest" />
        <span className="h-3 w-3 rounded-full bg-surface-highest" />
        <div className="ml-3 flex gap-1 text-xs font-semibold">
          <span className="rounded-lg bg-surface-lowest px-3 py-1 text-primary shadow-xs">Agenda</span>
          <span className="hidden px-3 py-1 text-secondary sm:inline">Clientes</span>
          <span className="hidden px-3 py-1 text-secondary sm:inline">Finanzas</span>
        </div>
        <span className="ml-auto text-xs text-secondary">Hoy · sábado</span>
      </div>

      {/* En el celular la grilla se desliza de costado: enfocable para recorrerla con el teclado. */}
      <div tabIndex={0} role="region" aria-label="Ejemplo de agenda del día" className="no-scrollbar overflow-x-auto">
        <div className="min-w-[560px] p-4">
          <div className="grid grid-cols-[56px_repeat(3,1fr)] gap-2.5 pb-2.5 text-[13px] font-bold">
            <span />
            {barbers.map((b) => (
              <span key={b} className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-fixed text-[11px] text-primary">
                  {b[0]}
                </span>
                {b}
              </span>
            ))}
          </div>
          {slots.map((row) => (
            <div key={row.time} className="grid grid-cols-[56px_repeat(3,1fr)] gap-2.5 border-t border-surface-low py-2">
              <span className="pt-2.5 font-mono text-xs text-secondary">{row.time}</span>
              {row.cells.map((cell, i) =>
                cell ? <SlotCard key={i} {...cell} /> : <span key={i} className="min-h-[72px] rounded-xl border border-dashed border-surface-highest" />,
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Slot {
  who: string;
  what: string;
  state: "paid" | "pending";
}

function SlotCard({ who, what, state }: Slot) {
  return (
    <div className="min-h-[72px] rounded-xl bg-surface-low px-3 py-2.5">
      <p className="truncate text-[13px] font-bold">{who}</p>
      <p className="truncate text-xs text-secondary">{what}</p>
      <span
        className={
          state === "paid"
            ? "chip mt-1.5 bg-mint text-mint-ink"
            : "chip mt-1.5 bg-amber-container text-amber-ink"
        }
      >
        {state === "paid" ? "Seña abonada" : "Seña pendiente"}
      </span>
    </div>
  );
}

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-base leading-relaxed text-secondary">{children}</p>}
    </div>
  );
}

const FEATURES = [
  {
    icon: Link2,
    title: "Tu link de reservas",
    text: "Compartís un link y tus clientes eligen barbero, servicio y horario, a cualquier hora.",
  },
  {
    icon: CreditCard,
    title: "Señas con Mercado Pago",
    text: "La seña se cobra al reservar y entra directo a tu cuenta. Menos turnos que no vienen.",
  },
  {
    icon: MessageCircle,
    title: "Verificación por WhatsApp",
    text: "Cada cliente confirma su número con un código. Chau reservas falsas.",
  },
  {
    icon: CalendarDays,
    title: "Agenda del día y del mes",
    text: "Todos los turnos de tu equipo en una pantalla, con el estado de cada seña.",
  },
  {
    icon: Users,
    title: "Equipo y clientes",
    text: "Cada barbero con su agenda. Historial y datos de cada cliente a mano.",
  },
  {
    icon: Bell,
    title: "Recordatorios",
    text: "Avisos para que el cliente no se olvide del turno.",
  },
  {
    icon: ShoppingBag,
    title: "Tienda",
    text: "Tus productos para que el cliente los sume a la reserva y los retire en el sillón.",
  },
  {
    icon: BarChart3,
    title: "Finanzas",
    text: "Lo que entró por señas y por servicios, sin planillas.",
  },
  {
    icon: Percent,
    title: "Comisiones por barbero",
    text: "Porcentaje o monto fijo por servicio. Cada uno sabe cuánto lleva ganado.",
  },
  {
    icon: ReceiptText,
    title: "Sueldos y adelantos",
    text: "Liquidás el período en un toque, con los adelantos descontados y el recibo listo.",
  },
  {
    icon: BellRing,
    title: "Avisos al instante",
    text: "Notificación en el celular apenas entra un turno, para vos y para el barbero.",
  },
  {
    icon: MessageCircle,
    title: "Soporte por WhatsApp",
    text: "¿Una duda? Nos escribís desde el panel y te responde una persona.",
  },
];

function Features() {
  return (
    <section id="funciones" className="scroll-mt-16 border-b border-surface-high bg-surface-lowest">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow="Funciones" title="Todo lo de tu barbería, en un solo lugar.">
          Pensada para el día a día de un local: rápida en el celular y simple para tu equipo.
        </SectionHead>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-[18px] border border-surface-container bg-surface p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary">
                <Icon size={20} aria-hidden />
              </span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Creá tu barbería", text: "Nombre, dirección y WhatsApp. Te lleva un par de minutos." },
  { title: "Cargá servicios y equipo", text: "Precios, duración de cada servicio y los horarios de tus barberos." },
  { title: "Compartí tu link", text: "En Instagram, en WhatsApp o en un QR en el local. Los turnos empiezan a llegar solos." },
];

function Steps() {
  return (
    <section id="como-empezar" className="scroll-mt-16 border-b border-surface-high bg-surface-low">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow="Cómo empezar" title="Hoy creás tu barbería. Hoy recibís turnos." />
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card rounded-[18px] p-6">
              <span className="font-mono text-sm text-primary">0{i + 1}</span>
              <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const INCLUDED = [
  "Turnos online ilimitados",
  "Todo tu equipo de barberos",
  "Señas con tu Mercado Pago",
  "Verificación por WhatsApp",
  "Agenda, clientes, tienda y finanzas",
  "Comisiones y liquidación de sueldos",
  "Soporte por WhatsApp",
  "Sin comisión por turno ni por seña",
];

function Pricing() {
  return (
    <section id="precio" className="scroll-mt-16 border-b border-surface-high bg-surface-lowest">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <SectionHead eyebrow="Precio" title={<>Probala {TRIAL_LABEL} gratis.<br />Después, lo que salen dos cortes.</>}>
          Sin tarjeta para empezar. Pasada la prueba, pagás por mes el valor de 2 cortes de tu barbería: si tu corte
          sale $10.000, son $20.000 por mes. Por transferencia, Mercado Pago o en efectivo.
        </SectionHead>

        <div className="rounded-[26px] bg-night p-8 text-white shadow-[0_30px_70px_-30px_rgb(10_16_32/0.6)]">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-night-muted">El primer mes</p>
            <span className="rounded-full bg-[#34d399]/15 px-2.5 py-1 text-xs font-bold text-[#6ee7b7]">Gratis</span>
          </div>
          <p className="mt-1.5 text-5xl font-extrabold tracking-tight">$0</p>
          <div className="mt-5 rounded-2xl bg-night-soft px-5 py-4">
            <p className="text-[13px] font-semibold text-night-muted">Después</p>
            <p className="text-2xl font-extrabold tracking-tight">
              2 cortes <span className="text-[15px] font-semibold text-night-muted">/ mes</span>
            </p>
          </div>
          <ul className="mt-6 space-y-3">
            {INCLUDED.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-[#dce4f7]">
                <Check size={18} strokeWidth={2.5} className="shrink-0 text-[#6ee7b7]" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <SignupLink
            className="tap mt-7 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary-bright px-6 text-[15px] font-bold text-on-primary hover:bg-primary"
          >
            Empezar mi prueba gratis <ArrowRight size={18} aria-hidden />
          </SignupLink>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "¿Necesito tarjeta para la prueba?",
    a: "No. Creás tu barbería con tu email y empezás a usarla en el momento.",
  },
  {
    q: "¿A quién le llega la plata de las señas?",
    a: "A vos. Cada barbería vincula su propia cuenta de Mercado Pago y las señas entran directo ahí. BarberApp nunca toca esa plata.",
  },
  {
    q: "¿Mis clientes tienen que descargar algo?",
    a: "No. Reservan desde el navegador con tu link y, si quieren, la instalan en el celular como una app, sin pasar por ninguna tienda.",
  },
  {
    q: "¿Sirve si trabajo con varios barberos?",
    a: "Sí. Cada barbero tiene su agenda y sus horarios, y vos ves todo el local junto.",
  },
  {
    q: "¿Y si tengo una duda o algo no anda?",
    a: "Desde el menú de tu panel nos escribís por WhatsApp y te respondemos nosotros, no un bot.",
  },
  {
    q: `¿Cuánto cuesta después del ${TRIAL_LABEL} de prueba?`,
    a: "El valor de 2 cortes de tu barbería por mes, por transferencia, Mercado Pago o en efectivo. Sin comisiones por turno ni por seña.",
  },
];

function Faq() {
  return (
    <section id="preguntas" className="scroll-mt-16 border-b border-surface-high">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow="Preguntas" title="Lo que todos preguntan." />
        <div className="mt-9 flex flex-col gap-2.5">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group card rounded-2xl px-5">
              <summary className="flex min-h-15 cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown size={18} className="shrink-0 text-secondary transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-secondary">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-night">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <h2 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-on-primary sm:text-5xl">
          Menos WhatsApp.
          <br />
          <span className="text-night-accent">Más cortes.</span>
        </h2>
        <p className="mt-4 max-w-md text-night-muted">Creá tu barbería y probala gratis durante {TRIAL_LABEL}.</p>
        <SignupLink
          className="tap mt-8 inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-primary-bright px-8 text-[15px] font-bold text-on-primary hover:bg-primary"
        >
          Probar la demo gratis <ArrowRight size={18} aria-hidden />
        </SignupLink>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-night-line bg-night pb-safe">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-sm text-night-muted sm:flex-row sm:px-6">
        <span className="flex items-center gap-2 font-bold text-white">
          <LogoSeal className="h-6 w-6" /> BarberApp
        </span>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:ml-auto">
          <LegalLink doc="terminos" className="hover:text-white">Términos</LegalLink>
          <LegalLink doc="privacidad" className="hover:text-white">Privacidad</LegalLink>
          <Link href={LOGIN} className="hover:text-white">Ingresar</Link>
          <SignupLink className="hover:text-white">Crear mi barbería</SignupLink>
        </div>
      </div>
    </footer>
  );
}
