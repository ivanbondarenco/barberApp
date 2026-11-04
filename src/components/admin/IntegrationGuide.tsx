"use client";

import { ExternalLink, Info } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";

type GuideKey = "whatsapp";

interface Step {
  title: string;
  detail: ReactNode;
}

interface Guide {
  title: string;
  subtitle: string;
  intro: string;
  steps: Step[];
  note: string;
  link: { href: string; label: string };
}

/**
 * Tutorial de vinculación de WhatsApp. (Mercado Pago no lo necesita: se conecta con un botón.)
 *
 * El dueño de la barbería no conoce el panel de Meta: sin estos pasos, los
 * campos de credenciales quedan vacíos para siempre. Van en el orden exacto en que hay que hacer
 * las cosas, con el nombre literal de cada botón de esos paneles.
 */
const GUIDES: Record<GuideKey, Guide> = {
  whatsapp: {
    title: "Cómo vincular WhatsApp",
    subtitle: "Para mandar los códigos de verificación",
    intro:
      "Los códigos salen por WhatsApp Cloud API, el servicio oficial de Meta. Para este volumen es gratis, pero hay que dar de alta un número y una plantilla aprobada.",
    steps: [
      {
        title: "Entrá a Meta for Developers",
        detail: (
          <>
            Iniciá sesión en <span className="font-mono text-[12px]">developers.facebook.com</span> con tu cuenta de
            Facebook y aceptá las condiciones de desarrollador.
          </>
        ),
      },
      {
        title: "Creá una app y agregale WhatsApp",
        detail: (
          <>
            <strong>Mis apps</strong> → <strong>Crear app</strong> → tipo <strong>Empresa</strong>. Después, en la
            lista de productos, agregá <strong>WhatsApp</strong>.
          </>
        ),
      },
      {
        title: "Dá de alta el número de la barbería",
        detail: (
          <>
            En <strong>WhatsApp → Configuración de la API</strong> agregá y verificá el número. Tiene que ser uno que
            no esté usándose en la app común de WhatsApp: si lo usás ahí, primero borrá esa cuenta.
          </>
        ),
      },
      {
        title: "Copiá el Phone number ID",
        detail: (
          <>
            En esa misma pantalla, debajo del número, aparece el{" "}
            <strong>identificador del número de teléfono</strong>. Es un número largo y no es el celular: copialo en{" "}
            <em>Phone number ID</em>.
          </>
        ),
      },
      {
        title: "Generá un token permanente",
        detail: (
          <>
            <strong>Configuración del negocio</strong> → <strong>Usuarios del sistema</strong> → creá uno con rol
            administrador → <strong>Generar token</strong>: elegí tu app, los permisos{" "}
            <span className="font-mono text-[12px]">whatsapp_business_messaging</span> y{" "}
            <span className="font-mono text-[12px]">whatsapp_business_management</span>, y vencimiento{" "}
            <strong>nunca</strong>. El token de prueba que muestra la app dura 24 horas y después deja de andar.
          </>
        ),
      },
      {
        title: "Creá la plantilla de autenticación",
        detail: (
          <>
            En <strong>WhatsApp Manager → Plantillas de mensajes</strong> creá una con categoría{" "}
            <strong>Autenticación</strong> y copia del código de un toque. Poné el nombre que le diste (por defecto{" "}
            <span className="font-mono text-[12px]">otp_code</span>) y el idioma (
            <span className="font-mono text-[12px]">es_AR</span>) en los campos de acá arriba.
          </>
        ),
      },
      {
        title: "Guardá y probá",
        detail: (
          <>
            Cuando Meta apruebe la plantilla, tocá <strong>Guardar WhatsApp</strong> y probá con{" "}
            <em>Olvidé mi contraseña</em> desde tu celular.
          </>
        ),
      },
    ],
    note: "Meta no deja mandar el código como mensaje de texto libre: si la plantilla no está aprobada como plantilla de autenticación, el envío falla aunque el token esté bien.",
    link: { href: "https://developers.facebook.com/apps", label: "Abrir Meta for Developers" },
  },
};

/** Botón de info al lado del título de la conexión: abre el tutorial paso a paso. */
export function IntegrationGuideButton({ guide }: { guide: GuideKey }) {
  const [open, setOpen] = useState(false);
  const data = GUIDES[guide];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={data.title}
        className="tap flex h-8 w-8 items-center justify-center rounded-full bg-surface-low text-secondary transition-colors hover:text-primary"
      >
        <Info size={16} aria-hidden />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={data.title}
        subtitle={data.subtitle}
        footer={
          <button type="button" onClick={() => setOpen(false)} className="tap btn-primary">
            Entendido
          </button>
        }
      >
        <p className="text-[13px] leading-relaxed text-secondary">{data.intro}</p>

        <ol className="mt-4 flex flex-col gap-3">
          {data.steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-on-primary"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-tight">{step.title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-secondary">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-4 rounded-2xl bg-surface-low p-3 text-[13px] leading-relaxed text-secondary">{data.note}</p>

        <a href={data.link.href} target="_blank" rel="noreferrer" className="tap btn-secondary mt-3">
          <ExternalLink size={16} aria-hidden /> {data.link.label}
        </a>
      </Sheet>
    </>
  );
}
