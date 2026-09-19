"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PublicShell } from "@/components/layout/PublicShell";
import { Field } from "@/components/ui/Field";
import { stepSlide } from "@/lib/motion";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const schema = z
  .object({
    name: z.string().trim().min(3, "Ingresá nombre y apellido").refine((v) => v.includes(" "), "Incluí tu apellido"),
    phone: z
      .string()
      .trim()
      .refine((v) => {
        const d = v.replace(/\D/g, "");
        return d.length >= 10 && d.length <= 13;
      }, "Celular inválido"),
    email: z.union([z.literal(""), z.email("Email inválido")]),
    pin: z.string().regex(/^\d{4}$/, "4 dígitos"),
    pinConfirm: z.string(),
    accept: z.boolean().refine((v) => v, "Aceptá las políticas para continuar"),
  })
  .refine((v) => v.pin === v.pinConfirm, { message: "No coinciden", path: ["pinConfirm"] });
type Values = z.infer<typeof schema>;

export default function RegistroPage() {
  const router = useRouter();
  const registerAccount = useAppStore((s) => s.register);
  const [data, setData] = useState<Values | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", pin: "", pinConfirm: "", accept: false },
  });

  const verify = async () => {
    if (!data) return;
    setBusy(true);
    setError(null);
    const result = await registerAccount({ name: data.name, phone: data.phone, email: data.email, pin: data.pin, code });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    toast(`¡Bienvenido, ${data.name.split(" ")[0]}!`, "success");
    router.replace("/cliente/reservar");
  };

  return (
    <PublicShell
      title="Crear cuenta"
      footer={
        data ? (
          <button type="button" onClick={verify} disabled={busy || code.length < 6} className="tap btn-primary">
            {busy ? "Creando cuenta…" : "Verificar y crear cuenta"}
          </button>
        ) : (
          <button type="submit" form="register-form" className="tap btn-primary">
            Continuar
          </button>
        )
      }
    >
      <div className="px-5 pb-6 pt-2">
        <AnimatePresence mode="wait" initial={false} custom={data ? 1 : -1}>
          {!data ? (
            <m.form
              key="datos"
              custom={-1}
              variants={stepSlide}
              initial="enter"
              animate="center"
              exit="exit"
              id="register-form"
              onSubmit={handleSubmit((v) => {
                setData(v);
                toast("Te enviamos un código por WhatsApp", "info");
              })}
              noValidate
              className="flex flex-col gap-4"
            >
              <p className="text-[15px] text-secondary">Con tu cuenta reservás, pagás la seña y seguís tus turnos.</p>
              <Field label="Nombre y apellido" htmlFor="r-name" error={errors.name?.message}>
                <input id="r-name" className="field py-3" autoComplete="name" {...register("name")} />
              </Field>
              <Field label="Celular" htmlFor="r-phone" error={errors.phone?.message} hint="Lo usamos para confirmar tus turnos">
                <input id="r-phone" className="field py-3" inputMode="tel" autoComplete="tel" placeholder="+54 9 11 …" {...register("phone")} />
              </Field>
              <Field label="Email (opcional)" htmlFor="r-email" error={errors.email?.message}>
                <input id="r-email" className="field py-3" inputMode="email" autoComplete="email" {...register("email")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="PIN" htmlFor="r-pin" error={errors.pin?.message}>
                  <input id="r-pin" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" className="field py-3 tracking-[0.35em]" {...register("pin")} />
                </Field>
                <Field label="Repetir PIN" htmlFor="r-pin2" error={errors.pinConfirm?.message}>
                  <input id="r-pin2" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password" className="field py-3 tracking-[0.35em]" {...register("pinConfirm")} />
                </Field>
              </div>
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
            </m.form>
          ) : (
            <m.div key="codigo" custom={1} variants={stepSlide} initial="enter" animate="center" exit="exit" className="flex flex-col gap-4">
              <p className="text-[15px] text-secondary">
                Ingresá el código de 6 dígitos que enviamos a <strong className="text-ink">{data.phone}</strong>.
              </p>
              <input
                aria-label="Código"
                className="field py-4 text-center text-3xl tracking-[0.5em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
              />
              {error && <p className="field-error mt-0 text-center">{error}</p>}
              <div className="flex justify-between text-sm">
                <button type="button" onClick={() => setData(null)} className="font-medium text-secondary">
                  Corregir datos
                </button>
                <button type="button" onClick={() => toast("Código reenviado", "info")} className="font-semibold text-primary">
                  Reenviar
                </button>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </PublicShell>
  );
}
