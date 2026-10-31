"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LegalLink } from "@/components/legal/LegalLink";
import { NAV } from "@/components/motion/Page";
import { Field } from "@/components/ui/Field";
import { PASSWORD_MIN, passwordSchema } from "@/lib/password";
import { AR_PHONE_ERROR, AR_PREFIX, isArPhone, toArPhone } from "@/lib/phone";
import {
  addressSchema,
  emailSchema,
  personNameSchema,
  sanitizePersonName,
  sanitizePhone,
  shopNameSchema,
} from "@/lib/validation";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const schema = z
  .object({
    name: shopNameSchema,
    address: addressSchema,
    whatsapp: z.string().trim().refine(isArPhone, AR_PHONE_ERROR),
    ownerName: personNameSchema,
    identifier: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string().min(1, "Repetí la contraseña"),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirm"],
  });
type Values = z.infer<typeof schema>;

/**
 * Alta de una barbería nueva. Al terminar queda la sesión abierta como dueño.
 *
 * Se usa en la página /auth/nueva-barberia y en el modal que abren la landing y el ingreso. El
 * botón de enviar lo pone quien lo muestra (en el pie de su hoja), apuntando a `formId`.
 */
export function ShopSignupForm({ formId, onSubmittingChange }: { formId: string; onSubmittingChange?: (busy: boolean) => void }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // Valida al salir de cada campo (y en cada tecla una vez marcado) para que los avisos
    // aparezcan antes de tocar "Crear barbería".
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { name: "", address: "", whatsapp: "", ownerName: "", identifier: "", password: "", passwordConfirm: "" },
  });

  useEffect(() => onSubmittingChange?.(isSubmitting), [isSubmitting, onSubmittingChange]);

  const password = watch("password");
  const passwordConfirm = watch("passwordConfirm");
  const longEnough = password.length >= PASSWORD_MIN;
  const matches = password.length > 0 && password === passwordConfirm;

  // Lo que no va en el campo directamente no se escribe: letras en el teléfono, números en el nombre.
  const filtered = (field: "whatsapp" | "ownerName", clean: (v: string) => string) =>
    register(field, {
      onChange: (e: { target: { value: string } }) => {
        const value = clean(e.target.value);
        if (value !== e.target.value) setValue(field, value, { shouldValidate: !!errors[field] });
      },
    });

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      const res = await fetch("/api/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          address: values.address,
          whatsapp: toArPhone(values.whatsapp),
          ownerName: values.ownerName,
          identifier: values.identifier,
          password: values.password,
        }),
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setServerError(data.error ?? "No pudimos crear la barbería");
      await useAppStore.getState().refresh(true);
      toast("¡Barbería creada! Cargá tus servicios y horarios.", "success");
      router.replace("/admin/agenda", { transitionTypes: [...NAV.forward] });
    } catch {
      setServerError("Sin conexión. Revisá tu internet.");
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <p className="text-[15px] text-secondary">
        Creamos tu local con un catálogo básico y tu cuenta de dueño. Después cargás servicios, horarios y equipo.
      </p>

      <Field label="Nombre de la barbería" htmlFor={`${formId}-name`} error={errors.name?.message}>
        <input id={`${formId}-name`} className="field py-3" autoComplete="organization" maxLength={60} {...register("name")} />
      </Field>
      <Field label="Dirección" htmlFor={`${formId}-address`} error={errors.address?.message} hint="La ven tus clientes al reservar">
        <input id={`${formId}-address`} className="field py-3" autoComplete="street-address" maxLength={120} placeholder="Av. Corrientes 1234" {...register("address")} />
      </Field>
      <Field
        label="Tu número de teléfono"
        htmlFor={`${formId}-wa`}
        error={errors.whatsapp?.message}
        hint="Código de área y número, sin 0 ni 15"
      >
        <div className="field flex items-center gap-2 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <span aria-hidden className="shrink-0 text-secondary">
            {AR_PREFIX}
          </span>
          <input
            id={`${formId}-wa`}
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted sm:text-sm"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="11 3096-9716"
            maxLength={20}
            {...filtered("whatsapp", sanitizePhone)}
          />
        </div>
      </Field>
      <Field label="Tu nombre" htmlFor={`${formId}-owner`} error={errors.ownerName?.message}>
        <input id={`${formId}-owner`} className="field py-3" autoComplete="name" maxLength={60} {...filtered("ownerName", sanitizePersonName)} />
      </Field>
      <Field label="Tu email" htmlFor={`${formId}-id`} error={errors.identifier?.message} hint="Es con lo que vas a ingresar">
        <input id={`${formId}-id`} className="field py-3" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={120} {...register("identifier")} />
      </Field>
      <Field label="Contraseña" htmlFor={`${formId}-password`} error={errors.password?.message}>
        <input id={`${formId}-password`} type="password" autoComplete="new-password" className="field py-3" maxLength={100} {...register("password")} />
      </Field>
      <Field label="Repetir contraseña" htmlFor={`${formId}-password2`} error={errors.passwordConfirm?.message}>
        <input id={`${formId}-password2`} type="password" autoComplete="new-password" className="field py-3" maxLength={100} {...register("passwordConfirm")} />
      </Field>

      <ul aria-live="polite" className="flex flex-col gap-1 text-xs">
        <Check ok={longEnough}>Al menos {PASSWORD_MIN} caracteres</Check>
        <Check ok={matches}>Las dos contraseñas coinciden</Check>
      </ul>

      <p className="text-xs leading-relaxed text-secondary">
        Al crear tu barbería aceptás los{" "}
        <LegalLink doc="terminos" className="font-semibold text-primary">
          términos y condiciones
        </LegalLink>{" "}
        y la{" "}
        <LegalLink doc="privacidad" className="font-semibold text-primary">
          política de privacidad
        </LegalLink>
        .
      </p>

      {serverError && (
        <p role="alert" className="rounded-2xl bg-error-container px-4 py-3 text-[13px] text-error">
          {serverError}
        </p>
      )}
    </form>
  );
}

/** Requisito de la contraseña, en verde cuando ya está cumplido. */
function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={ok ? "flex items-center gap-1.5 font-medium text-mint-ink" : "flex items-center gap-1.5 text-muted"}>
      <span aria-hidden>{ok ? "✓" : "○"}</span>
      {children}
    </li>
  );
}
