import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalDoc, type LegalSection } from "@/components/legal/LegalDoc";

export const metadata: Metadata = { title: "Política de privacidad · BarberApp" };

const SECTIONS: LegalSection[] = [
  {
    title: "Qué datos guardamos",
    body: (
      <ul className="flex list-disc flex-col gap-1 pl-5">
        <li>De las barberías: nombre, dirección, teléfono, servicios, precios, horarios y equipo.</li>
        <li>De dueños, barberos y clientes: nombre, email, teléfono y contraseña (guardada de forma irreversible).</li>
        <li>De los turnos: fecha, servicio, barbero, estado, señas, productos reservados y reseñas.</li>
        <li>
          Las credenciales de Mercado Pago y WhatsApp de cada barbería, guardadas cifradas. Nunca se vuelven a mostrar
          completas.
        </li>
      </ul>
    ),
  },
  {
    title: "Para qué los usamos",
    body: (
      <ul className="flex list-disc flex-col gap-1 pl-5">
        <li>Gestionar reservas, señas, recordatorios y la agenda de cada barbería.</li>
        <li>Verificar teléfonos con códigos por WhatsApp y enviar mails de la cuenta y de los turnos.</li>
        <li>Detectar errores y mantener el sistema seguro.</li>
      </ul>
    ),
  },
  {
    title: "Quién es responsable de los datos",
    body: (
      <p>
        Los datos de los clientes de una barbería son de esa barbería: los carga y los usa para atenderlos, y BarberApp
        los procesa por su cuenta. Una barbería no ve los datos ni los turnos de otra.
      </p>
    ),
  },
  {
    title: "Con quién los compartimos",
    body: (
      <>
        <p>No vendemos ni cedemos datos. Solo los compartimos con los servicios que hacen funcionar el sistema:</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Mercado Pago, para cobrar las señas en la cuenta de cada barbería.</li>
          <li>Meta (WhatsApp), para enviar los códigos de verificación.</li>
          <li>El proveedor de correo, para enviar los mails.</li>
          <li>El proveedor de hosting donde funciona el sistema.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Seguridad y conservación",
    body: (
      <p>
        Las conexiones van cifradas (HTTPS), las contraseñas no se guardan en texto legible y las credenciales de pago
        se guardan cifradas. Hacemos copias de seguridad diarias. Conservamos los datos mientras la cuenta esté activa;
        si se pide la baja, se borran, salvo lo que la ley obligue a conservar.
      </p>
    ),
  },
  {
    title: "Tus derechos",
    body: (
      <>
        <p>
          Podés pedir acceso, corrección o eliminación de tus datos escribiendo a {CONTACT_EMAIL}. Si sos cliente de una
          barbería, también podés pedírselo directamente a ella.
        </p>
        <p>
          Estos derechos están protegidos por la Ley 25.326 de Protección de Datos Personales. La Agencia de Acceso a la
          Información Pública, órgano de control de esa ley, atiende las denuncias y reclamos por incumplimientos.
        </p>
      </>
    ),
  },
  {
    title: "Almacenamiento en tu dispositivo",
    body: (
      <p>
        Usamos cookies para mantener tu sesión abierta y recordar la barbería elegida, y el almacenamiento del navegador
        para preferencias y para que la app funcione sin conexión. No usamos cookies de publicidad.
      </p>
    ),
  },
  {
    title: "Cambios en esta política",
    body: <p>Si cambiamos esta política, publicamos la nueva versión acá con su fecha de actualización.</p>,
  },
];

export default function PrivacidadPage() {
  return (
    <LegalDoc
      title="Política de privacidad"
      updated="31 de octubre de 2026"
      intro={<p>Cómo cuidamos los datos de las barberías y de sus clientes en BarberApp.</p>}
      sections={SECTIONS}
    />
  );
}
