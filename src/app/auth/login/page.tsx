"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowRight, Eye, EyeOff, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LogoSeal } from "@/components/layout/Logo";
import { homeFor } from "@/components/layout/RoleGuard";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { fadeUp } from "@/lib/motion";
import type { Role } from "@/lib/types";
import { useAppStore, useHydrated } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const schema = z.object({
  identifier: z.string().trim().min(3, "Ingresá tu celular o email"),
  pin: z.string().regex(/^\d{4}$/, "El PIN tiene 4 dígitos"),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAppStore((s) => s.session);
  const shop = useAppStore((s) => s.shop);
  const shops = useAppStore((s) => s.shops);
  const synced = useAppStore((s) => s.synced);
  const login = useAppStore((s) => s.login);
  const [role, setRole] = useState<Role>("cliente");
  const [showPin, setShowPin] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    void useAppStore.getState().refresh(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !synced) return;
    if (session) router.replace(homeFor(session.role));
    else if (!shop) router.replace("/");
  }, [hydrated, synced, session, shop, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { identifier: "", pin: "" } });

  const onSubmit = async ({ identifier, pin }: Values) => {
    setServerError(null);
    const result = await login(role, identifier, pin);
    if (!result.ok) return setServerError(result.error);
    const name = useAppStore.getState().session?.name.split(" ")[0];
    toast(`Hola${name ? `, ${name}` : ""}`, "success");
    router.replace(homeFor(role));
  };

  return (
    <div className="flex min-h-dvh w-full justify-center lg:items-center lg:p-8">
      <div className="flex h-dvh w-full max-w-[480px] flex-col bg-surface px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),16px)] shadow-md lg:h-auto lg:max-w-[520px] lg:rounded-3xl lg:px-10 lg:py-10">
        <main className="no-scrollbar flex flex-1 flex-col justify-center overflow-y-auto py-4">
          <m.div variants={fadeUp} initial="hidden" animate="show" className="mb-8 flex flex-col items-center text-center">
            <LogoSeal className="h-20 w-20 drop-shadow-md" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight">{shop?.name ?? "Barbería"}</h1>
            <p className="text-[15px] text-secondary">Reservá tu turno en segundos</p>
            {shops.length > 1 && (
              <Link href="/" className="text-link mt-1 text-[13px]">
                Cambiar de barbería
              </Link>
            )}
          </m.div>

          <Segmented
            label="Tipo de cuenta"
            value={role}
            onChange={(r) => {
              setRole(r);
              setServerError(null);
            }}
            options={[
              { value: "cliente", label: "Soy cliente" },
              { value: "admin", label: "Soy barbero" },
            ]}
            className="mb-5"
          />

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Field label={role === "admin" ? "Email" : "Celular o email"} htmlFor="identifier" error={errors.identifier?.message}>
              <input
                id="identifier"
                className="field py-3"
                inputMode={role === "admin" ? "email" : "tel"}
                autoComplete="username"
                placeholder={role === "admin" ? "admin@dsstudio.com.ar" : "+54 9 11 …"}
                {...register("identifier")}
              />
            </Field>
            <Field label="PIN" htmlFor="pin" error={errors.pin?.message}>
              <div className="relative">
                <input
                  id="pin"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={4}
                  placeholder="••••"
                  className="field py-3 pr-12 tracking-[0.35em]"
                  {...register("pin")}
                />
                <button type="button" onClick={() => setShowPin((v) => !v)} aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted">
                  {showPin ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </Field>

            <AnimatePresence>
              {serverError && (
                <m.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-xl bg-error-container px-3 py-2 text-sm text-error" role="alert">
                  {serverError}
                </m.p>
              )}
            </AnimatePresence>

            <button type="submit" disabled={isSubmitting} className="tap btn-primary mt-1 py-3.5 text-[15px]">
              {isSubmitting ? "Ingresando…" : "Ingresar"} {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <Link href="/auth/recuperar" className="inline-flex min-h-10 items-center font-medium text-secondary">
              Olvidé mi PIN
            </Link>
            {role === "cliente" && (
              <button type="button" onClick={() => setOtpOpen(true)} className="text-link">
                <MessageSquareText size={16} /> Entrar con código
              </button>
            )}
          </div>
        </main>

        <footer className="flex flex-col items-center gap-1 text-center text-sm">
          {role === "cliente" && (
            <p className="text-secondary">
              ¿Primera vez?{" "}
              <Link href="/auth/registro" className="text-link">
                Crear cuenta
              </Link>
            </p>
          )}
          <Link href="/politicas" className="inline-flex min-h-10 items-center text-xs text-muted underline-offset-2 hover:underline">
            Políticas de seña y cancelación
          </Link>
        </footer>

        <OtpSheet open={otpOpen} onClose={() => setOtpOpen(false)} onDone={() => router.replace("/cliente/reservar")} />
      </div>
    </div>
  );
}

function OtpSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const otp = useAppStore((s) => s.otp);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSent(false);
      setCode("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await otp(phone, sent ? code : undefined);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (!sent) {
      setSent(true);
      toast("Te enviamos un código por WhatsApp", "info");
      return;
    }
    onClose();
    onDone();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Entrar con código"
      subtitle="Te lo mandamos por WhatsApp"
      footer={
        <button type="button" onClick={submit} disabled={busy} className="tap btn-primary">
          {busy ? "…" : sent ? "Verificar" : "Enviar código"}
        </button>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {!sent ? (
          <m.div key="phone" variants={fadeUp} initial="hidden" animate="show" exit="exit">
            <Field label="Celular" htmlFor="otp-phone" error={error ?? undefined}>
              <input id="otp-phone" className="field py-3" inputMode="tel" autoComplete="tel" placeholder="+54 9 11 …" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </m.div>
        ) : (
          <m.div key="code" variants={fadeUp} initial="hidden" animate="show" exit="exit">
            <Field label={`Código enviado a ${phone}`} htmlFor="otp-code" error={error ?? undefined}>
              <input id="otp-code" className="field py-3 text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </Field>
          </m.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
