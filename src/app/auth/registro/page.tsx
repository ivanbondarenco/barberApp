"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PublicShell } from "@/components/layout/PublicShell";
import { homeFor } from "@/components/layout/RoleGuard";
import { Field } from "@/components/ui/Field";
import { readGuestContact } from "@/lib/guest-contact";
import { PASSWORD_MIN, passwordSchema } from "@/lib/password";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

// Alcanza con un nombre: el que dejó al reservar sin cuenta puede ser uno solo ("Lucas").
const schema = z.object({
  name: z.string().trim().min(2, "Ingresá nombre y apellido"),
  email: z.email("Email inválido"),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const d = v.replace(/\D/g, "");
      return d.length >= 10 && d.length <= 13;
    }, "Celular inválido"),
  password: passwordSchema,
  accept: z.boolean().refine((v) => v, "Aceptá las políticas para continuar"),
});
type Values = z.infer<typeof schema>;

/**
 * Alta de un cliente. Una sola cuenta para todas las barberías: si llegó por el link de un
 * local queda sumado a ese; si no, al terminar elige dónde se atiende.
 */
export default function RegistroPage() {
  const router = useRouter();
  const registerAccount = useAppStore((s) => s.register);
  const shop = useAppStore((s) => s.shop);
  const [error, setError] = useState<string | null>(null);
  // En lugar de pedirla dos veces: se puede mirar lo que se escribió.
  const [showPassword, setShowPassword] = useState(false);
  /** Llega desde la pantalla final de una reserva sin cuenta: ese turno queda en la cuenta nueva. */
  const [fromBooking, setFromBooking] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", password: "", accept: false },
  });

  // Si ya reservó sin cuenta en este teléfono, nombre y celular ya los dejó: no se los pide de nuevo.
  useEffect(() => {
    setFromBooking(new URLSearchParams(window.location.search).get("desde") === "reserva");
    const guest = readGuestContact();
    if (guest.name) setValue("name", guest.name);
    if (guest.phone) setValue("phone", guest.phone);
  }, [setValue]);

  const onSubmit = async (v: Values) => {
    setError(null);
    const result = await registerAccount({ name: v.name, email: v.email, phone: v.phone, password: v.password });
    if (!result.ok) return setError(result.error);
    toast(`¡Bienvenido, ${v.name.split(" ")[0]}!`, "success");
    const session = useAppStore.getState().session;
    // Viene de reservar: el turno ya está en su cuenta (se vinculó por el celular), que lo vea.
    if (fromBooking && session?.shop) return router.replace("/cliente/mis-turnos");
    router.replace(session ? homeFor(session) : "/");
  };

  return (
    <PublicShell
      title="Crear cuenta"
      fallbackHref="/"
      footer={
        <button type="submit" form="register-form" disabled={isSubmitting} className="tap btn-primary">
          {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      }
    >
      <form id="register-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 px-5 pb-6 pt-2">
        <p className="text-[15px] text-secondary">
          {fromBooking
            ? "Tu turno queda guardado en tu cuenta, junto con tu historial. Usá el mismo celular con el que reservaste."
            : shop
              ? `Con tu cuenta reservás en ${shop.name} y en cualquier otra barbería de la app.`
              : "Con una sola cuenta reservás en todas las barberías donde te atendés."}
        </p>
        <Field label="Nombre y apellido" htmlFor="r-name" error={errors.name?.message}>
          <input id="r-name" className="field py-3" autoComplete="name" autoCapitalize="words" maxLength={60} {...register("name")} />
        </Field>
        <Field label="Email" htmlFor="r-email" error={errors.email?.message} hint="Es con lo que vas a ingresar">
          <input
            id="r-email"
            className="field py-3"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={120}
            {...register("email")}
          />
        </Field>
        <Field label="Celular" htmlFor="r-phone" error={errors.phone?.message} hint="El local lo usa si necesita avisarte algo de tu turno">
          <input id="r-phone" className="field py-3" type="tel" inputMode="tel" autoComplete="tel" placeholder="+54 9 11 …" {...register("phone")} />
        </Field>
        <Field label="Contraseña" htmlFor="r-password" error={errors.password?.message} hint={`Al menos ${PASSWORD_MIN} caracteres`}>
          <div className="relative">
            <input
              id="r-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="field py-3 pr-12"
              maxLength={100}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted"
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-secondary">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" {...register("accept")} />
          <span>
            Acepto las{" "}
            {/* En otra pestaña: volver no tiene que borrar lo que ya completó. */}
            <a href="/politicas" target="_blank" rel="noreferrer" className="font-semibold text-primary">
              políticas de seña y cancelación
            </a>
          </span>
        </label>
        {errors.accept && <p className="field-error -mt-2">{errors.accept.message}</p>}
        {error && (
          <p role="alert" className="rounded-2xl bg-error-container px-4 py-3 text-[13px] text-error">
            {error}
          </p>
        )}
      </form>
    </PublicShell>
  );
}
