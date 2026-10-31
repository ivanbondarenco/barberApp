import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/plan";
import type { LegalDocContent, LegalSection } from "./LegalDoc";
import { TRIAL_LABEL } from "@/lib/plan";

const SECTIONS: LegalSection[] = [
  {
    title: "Qué es BarberApp",
    body: (
      <p>
        BarberApp es un sistema para que las barberías gestionen sus turnos, señas, equipo, clientes, productos y
        finanzas. BarberApp brinda la herramienta: no es parte de la relación entre la barbería y sus clientes, ni
        presta los servicios que la barbería ofrece.
      </p>
    ),
  },
  {
    title: "Cuenta y prueba gratis",
    body: (
      <>
        <p>
          Al crear una barbería, quien la registra queda como dueño de la cuenta y es responsable de los datos que
          carga y de las personas a las que les da acceso.
        </p>
        <p>
          Cada barbería tiene {TRIAL_LABEL} de prueba gratis, contado desde el día en que se crea. Para la prueba no hace
          falta tarjeta ni ningún pago.
        </p>
      </>
    ),
  },
  {
    title: "Precio y forma de pago",
    body: (
      <>
        <p>
          Terminada la prueba, el servicio se abona por mes y por adelantado. El precio mensual equivale al valor de 2
          cortes de pelo según la lista de precios de la barbería al momento de abonar.
        </p>
        <p>Se puede pagar por transferencia, Mercado Pago o en efectivo.</p>
        <p>
          BarberApp no cobra comisión por turno ni por seña. Las comisiones de Mercado Pago por los cobros de la
          barbería son de Mercado Pago y las paga la barbería, según su contrato con esa empresa.
        </p>
      </>
    ),
  },
  {
    title: "Falta de pago",
    body: (
      <p>
        Si la barbería no abona el mes, se le corta el acceso al sistema. Mientras dure la suspensión, ni el equipo
        ni los clientes de esa barbería pueden usarlo, incluidas las reservas online. El acceso se restablece al
        regularizar el pago.
      </p>
    ),
  },
  {
    title: "Señas y cobros a los clientes",
    body: (
      <p>
        Cada barbería vincula su propia cuenta de Mercado Pago, y las señas entran directo a esa cuenta. BarberApp no
        recibe, retiene ni administra esa plata, y no responde por devoluciones, contracargos o reclamos sobre cobros:
        se resuelven entre la barbería, su cliente y Mercado Pago. Las reglas de seña, cancelación y ausencias las fija
        cada barbería y se muestran en sus{" "}
        <Link href="/politicas" className="font-semibold text-primary">
          políticas de seña
        </Link>
        .
      </p>
    ),
  },
  {
    title: "Responsabilidades de la barbería",
    body: (
      <ul className="flex list-disc flex-col gap-1 pl-5">
        <li>Que sus precios, horarios, servicios y políticas estén correctos y actualizados.</li>
        <li>La atención a sus clientes y el cumplimiento de los turnos.</li>
        <li>Cuidar las contraseñas de su cuenta y las credenciales de Mercado Pago y WhatsApp que carga.</li>
        <li>Usar los datos de sus clientes solo para gestionar sus turnos y su atención.</li>
      </ul>
    ),
  },
  {
    title: "Uso aceptable",
    body: (
      <p>
        No se permite usar BarberApp para enviar mensajes no solicitados, cargar datos de terceros sin su
        consentimiento, intentar acceder a información de otras barberías o afectar el funcionamiento del sistema. Ante
        un uso así, BarberApp puede suspender la cuenta.
      </p>
    ),
  },
  {
    title: "Disponibilidad",
    body: (
      <p>
        Trabajamos para que el sistema esté siempre disponible y hacemos copias de seguridad diarias, pero puede haber
        interrupciones por mantenimiento o por fallas de terceros (hosting, Mercado Pago, WhatsApp, correo). BarberApp
        no responde por pérdidas derivadas de esas interrupciones.
      </p>
    ),
  },
  {
    title: "Baja",
    body: (
      <p>
        La barbería puede dejar de usar BarberApp cuando quiera; alcanza con no abonar el mes siguiente. Si además
        quiere que borremos sus datos, puede pedirlo a {CONTACT_EMAIL}.
      </p>
    ),
  },
  {
    title: "Cambios en estos términos",
    body: (
      <p>
        Si cambiamos estos términos o el precio, lo avisamos por email a los dueños de cada barbería con al menos 30
        días de anticipación. Seguir usando el sistema después de esa fecha implica aceptar los cambios.
      </p>
    ),
  },
  {
    title: "Ley aplicable",
    body: <p>Estos términos se rigen por las leyes de la República Argentina.</p>,
  },
];

export const TERMS: LegalDocContent = {
  title: "Términos y condiciones",
  updated: "31 de octubre de 2026",
  intro: <p>Estas son las condiciones para usar BarberApp. Al crear una barbería o una cuenta, las aceptás.</p>,
  sections: SECTIONS,
};
