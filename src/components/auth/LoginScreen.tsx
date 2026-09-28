"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LogoSeal } from "@/components/layout/Logo";
import { homeFor, ScreenLoader } from "@/components/layout/RoleGuard";
import { NAV } from "@/components/motion/Page";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { fadeUp } from "@/lib/motion";
import { loginPasswordSchema } from "@/lib/password";
import { useAppStore, useHydrated, type LoginRole } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const schema = z.object({
  identifier: z.string().trim().min(3, "Ingresá tu email"),
  password: loginPasswordSchema,
});
type Values = z.infer<typeof schema>;

/** Última solapa usada: cada persona vuelve a ver directamente la suya. */
const TAB_KEY = "ds-login-tab";

function savedTab(): LoginRole {
  try {
    return localStorage.getItem(TAB_KEY) === "staff" ? "staff" : "cliente";
  } catch {
    return "cliente";
  }
}

/**
 * Ingreso. Es lo primero que se ve al abrir la app sin sesión: una solapa para clientes
 * (email y contraseña) y otra para el staff, que además puede crear su barbería.
 */
export function LoginScreen() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAppStore((s) => s.session);
  const shop = useAppStore((s) => s.shop);
  const synced = useAppStore((s) => s.synced);
  const login = useAppStore((s) => s.login);
  const [role, setRole] = useState<LoginRole>("cliente");
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // El link de una barbería (/b/<slug>) trae a un cliente: esa solapa manda sobre la recordada.
    const tipo = params.get("tipo");
    setRole(tipo === "cliente" ? "cliente" : tipo === "barbero" ? "staff" : savedTab());
    void useAppStore.getState().refresh(true);
    // Vuelta del link del mail de confirmación.
    const confirmado = params.get("email");
    if (confirmado === "confirmado") toast("Tu email quedó confirmado", "success");
    if (confirmado === "vencido") toast("El link venció o ya se usó. Pedí uno nuevo desde tu perfil.", "error");
  }, []);

  useEffect(() => {
    if (hydrated && synced && session) router.replace(homeFor(session));
  }, [hydrated, synced, session, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { identifier: "", password: "" } });

  const changeRole = (next: LoginRole) => {
    setRole(next);
    setServerError(null);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Sin almacenamiento solo se pierde recordar la solapa.
    }
  };

  const onSubmit = async ({ identifier, password }: Values) => {
    setServerError(null);
    const result = await login(role, identifier, password);
    if (!result.ok) return setServerError(result.error);
    const current = useAppStore.getState().session;
    const name = current?.name.split(" ")[0];
    toast(`Hola${name ? `, ${name}` : ""}`, "success");
    if (current) router.replace(homeFor(current));
  };

  // Con sesión abierta se redirige: no tiene sentido mostrar el formulario un instante.
  if (hydrated && synced && session) return <ScreenLoader />;

  const isClient = role === "cliente";

  return (
    <div className="flex min-h-dvh w-full justify-center lg:items-center lg:p-8">
      <div className="flex h-dvh w-full max-w-[480px] flex-col bg-surface px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),16px)] shadow-md lg:h-auto lg:max-w-[520px] lg:rounded-3xl lg:px-10 lg:py-10">
        <main className="no-scrollbar flex flex-1 flex-col justify-center overflow-y-auto py-4">
          <m.div variants={fadeUp} initial="hidden" animate="show" className="mb-8 flex flex-col items-center text-center">
            <LogoSeal className="h-20 w-20 drop-shadow-md" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Ingresá a tu cuenta</h1>
            <p className="text-[15px] text-secondary">
              {isClient && shop ? `Reservá tu turno en ${shop.name}` : isClient ? "Reservá tu turno en segundos" : "Tu agenda, tu equipo y tus cobros"}
            </p>
          </m.div>

          <Segmented
            label="Tipo de cuenta"
            value={role}
            onChange={changeRole}
            options={[
              { value: "cliente", label: "Soy cliente" },
              { value: "staff", label: "Soy barbero" },
            ]}
            className="mb-5"
          />

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Field label={isClient ? "Email" : "Celular o email"} htmlFor="identifier" error={errors.identifier?.message}>
              <input
                id="identifier"
                className="field py-3"
                inputMode={isClient ? "email" : "text"}
                autoComplete="username"
                placeholder={isClient ? "tu@email.com" : "Celular o email"}
                {...register("identifier")}
              />
            </Field>
            <Field label="Contraseña" htmlFor="password" error={errors.password?.message}>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="field py-3 pr-12"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </Field>

            <AnimatePresence>
              {serverError && (
                <m.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-xl bg-error-container px-3 py-2 text-sm text-error"
                  role="alert"
                >
                  {serverError}
                </m.p>
              )}
            </AnimatePresence>

            <button type="submit" disabled={isSubmitting} className="tap btn-primary mt-1 py-3.5 text-[15px]">
              {isSubmitting ? "Ingresando…" : "Ingresar"} {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          <Link
            href={`/auth/recuperar?tipo=${isClient ? "cliente" : "barbero"}`}
            className="mt-3 inline-flex min-h-10 items-center self-center text-sm font-medium text-secondary"
          >
            Olvidé mi contraseña
          </Link>
        </main>

        <footer className="flex flex-col items-center gap-1 text-center text-sm">
          {isClient ? (
            <p className="text-secondary">
              ¿No tenés cuenta?{" "}
              <Link href="/auth/registro" transitionTypes={[...NAV.forward]} className="text-link">
                Registrate
              </Link>
            </p>
          ) : (
            <p className="text-secondary">
              ¿No creaste tu barbería?{" "}
              <Link href="/auth/nueva-barberia" transitionTypes={[...NAV.forward]} className="text-link">
                Creala
              </Link>
            </p>
          )}
          <Link href="/politicas" className="inline-flex min-h-10 items-center text-xs text-muted underline-offset-2 hover:underline">
            Políticas de seña y cancelación
          </Link>
        </footer>
      </div>
    </div>
  );
}
