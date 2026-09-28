import { LoginScreen } from "@/components/auth/LoginScreen";

/**
 * Punto de entrada: sin sesión se ve directamente el ingreso. Con sesión, `LoginScreen` manda a
 * cada uno a su pantalla (agenda del local, reservar, o elegir barbería si todavía no tiene).
 */
export default function Home() {
  return <LoginScreen />;
}
