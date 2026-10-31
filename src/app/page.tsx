import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";
import { SessionRedirect } from "@/components/landing/SessionRedirect";

export const metadata: Metadata = {
  title: "BarberApp · Turnos, señas y equipo para tu barbería",
  description:
    "Agenda online, señas con Mercado Pago y recordatorios para tu barbería. Probala 1 mes gratis; después, el valor de 2 cortes por mes.",
};

/**
 * Punto de entrada: la presentación de BarberApp para quien llega por primera vez. El ingreso
 * vive en /auth/login, y con sesión abierta `SessionRedirect` manda a cada uno a su pantalla.
 */
export default function Home() {
  return (
    <>
      <SessionRedirect />
      <Landing />
    </>
  );
}
