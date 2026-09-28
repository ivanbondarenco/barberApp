"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PublicShell } from "@/components/layout/PublicShell";
import { homeFor } from "@/components/layout/RoleGuard";
import { Field } from "@/components/ui/Field";
import { PASSWORD_MIN, passwordSchema } from "@/lib/password";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const schema = z
  .object({
    name: z.string().trim().min(3, "Ingresá nombre y apellido").refine((v) => v.includes(" "), "Incluí tu apellido"),
    email: z.email("Email inválido"),
    phone: z
      .string()
      .trim()
      .refine((v) => {
        const d = v.replace(/\D/g, "");
        return d.length >= 10 && d.length <= 13;
      }, "Celular inválido"),
    password: passwordSchema,
    passwordConfirm: z.string(),
    accept: z.boolean().refine((v) => v, "Aceptá las políticas para continuar"),
  })
  .refine((v) => v.password === v.passwordConfirm, { message: "No coinciden", path: ["passwordConfirm"] });
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", password: "", passwordConfirm: "", accept: false },
  });

  const onSubmit = async (v: Values) => {
    setError(null);
    const result = await registerAccount({ name: v.name, email: v.email, phone: v.phone, password: v.password });
    if (!result.ok) return setError(result.error);
    toast(`¡Bienvenido, ${v.name.split(" ")[0]}!`, "success");
    const session = useAppStore.getState().session;
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
          {shop
            ? `Con tu cuenta reservás en ${shop.name} y en cualquier otra barbería de la app.`
            : "Con una sola cuenta reservás en todas las barberías donde te atendés."}
        </p>
        <Field label="Nombre y apellido" htmlFor="r-name" error={errors.name?.message}>
          <input id="r-name" className="field py-3" autoComplete="name" {...register("name")} />
        </Field>
        <Field label="Email" htmlFor="r-email" error={errors.email?.message} hint="Es con lo que vas a ingresar">
          <input id="r-email" className="field py-3" inputMode="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Celular" htmlFor="r-phone" error={errors.phone?.message} hint="La barbería lo usa para confirmarte los turnos">
          <input id="r-phone" className="field py-3" inputMode="tel" autoComplete="tel" placeholder="+54 9 11 …" {...register("phone")} />
        </Field>
        <Field label="Contraseña" htmlFor="r-password" error={errors.password?.message} hint={`Al menos ${PASSWORD_MIN} caracteres`}>
          <input id="r-password" type="password" autoComplete="new-password" className="field py-3" {...register("password")} />
        </Field>
        <Field label="Repetir contraseña" htmlFor="r-password2" error={errors.passwordConfirm?.message}>
          <input id="r-password2" type="password" autoComplete="new-password" className="field py-3" {...register("passwordConfirm")} />
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-secondary">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" {...register("accept")} />
          <span>
            Acepto las{" "}
            <Link href="/politicas" className="font-semibold text-primary">
              políticas de seña y cancelación
            </Link>
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
