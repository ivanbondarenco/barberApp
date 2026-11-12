"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { SuccessCheck } from "@/components/motion/SuccessCheck";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { onlyDigits } from "@/lib/format";
import { stepSlide } from "@/lib/motion";
import { PASSWORD_MIN, passwordSchema } from "@/lib/password";
import { useAppStore, type LoginRole } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

type Step = 0 | 1 | 2 | 3;

/** Segundos de espera antes de poder pedir otro código. */
const RESEND_COOLDOWN = 30;

/** "ju•••@gmail.com": alcanza para reconocer la casilla sin mostrarla entera. */
function maskEmail(email: string): string {
  const [user, domain] = email.trim().split("@");
  if (!domain) return email;
  return `${user.slice(0, 2)}•••@${domain}`;
}

/** A dónde salió el código, contado sin mostrar el dato completo. */
function destinationText(identifier: string, via: "email" | "whatsapp" | null): string {
  const value = identifier.trim();
  if (via === "email" || (!via && value.includes("@"))) return `Te lo mandamos por email a ${maskEmail(value)}.`;
  const digits = onlyDigits(value);
  // El WhatsApp va siempre al celular de la cuenta; si entró con email, no sabemos cuál mostrar.
  return !value.includes("@") && digits.length >= 4
    ? `Te lo mandamos por WhatsApp al celular terminado en ${digits.slice(-4)}.`
    : "Te lo mandamos por WhatsApp al celular de tu cuenta.";
}

export default function RecuperarPage() {
  const recover = useAppStore((s) => s.recover);
  const [role, setRole] = useState<LoginRole>("cliente");
  const [step, setStep] = useState<Step>(0);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [via, setVia] = useState<"email" | "whatsapp" | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // La solapa del ingreso desde la que se llegó (?tipo=barbero).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tipo") === "barbero") setRole("staff");
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  /** Pide el código. Se llama directo (y no por el store) para saber por dónde salió. */
  const sendCode = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, identifier }),
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; via?: "email" | "whatsapp" };
      if (!res.ok || data.error) {
        setError(data.error ?? "No pudimos enviar el código. Probá de nuevo.");
        return false;
      }
      setVia(data.via ?? null);
      setCooldown(RESEND_COOLDOWN);
      return true;
    } catch {
      setError("Sin conexión. Revisá tu internet.");
      return false;
    }
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || step === 3) return;
    setError(null);
    if (step === 2) {
      const valid = passwordSchema.safeParse(password);
      if (!valid.success) return setError(valid.error.issues[0].message);
    }
    setBusy(true);
    if (step === 0) {
      const ok = await sendCode();
      setBusy(false);
      if (!ok) return;
      toast("Te enviamos un código", "info");
      setStep(1);
      return;
    }
    const result = step === 1 ? await recover({ role, identifier, code }) : await recover({ role, identifier, code, password });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setStep((s) => (s + 1) as Step);
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setError(null);
    setBusy(true);
    const ok = await sendCode();
    setBusy(false);
    if (ok) {
      setCode("");
      toast("Te mandamos un código nuevo", "info");
    }
  };

  const changeIdentifier = () => {
    setError(null);
    setCode("");
    setStep(0);
  };

  const labels = ["Enviar código", "Verificar", "Guardar contraseña"];
  const busyLabels = ["Enviando…", "Verificando…", "Guardando…"];
  const isClient = role === "cliente";

  return (
    <PublicShell
      title="Recuperar contraseña"
      footer={
        step === 3 ? (
          <Link href="/auth/login" className="tap btn-primary">
            Ir a ingresar
          </Link>
        ) : (
          <button type="submit" form="recover-form" disabled={busy} className="tap btn-primary">
            {busy ? busyLabels[step] : labels[step]}
          </button>
        )
      }
    >
      {/* Un form por pantalla: Enter en el teclado avanza igual que el botón. */}
      <form id="recover-form" onSubmit={submit} noValidate className="px-5 pb-6 pt-2">
        <AnimatePresence mode="wait" custom={1} initial={false}>
          <m.div key={step} custom={1} variants={stepSlide} initial="enter" animate="center" exit="exit" className="flex flex-col gap-4">
            {step === 0 && (
              <>
                <Segmented
                  label="Tipo de cuenta"
                  value={role}
                  onChange={(r) => {
                    setRole(r);
                    setError(null);
                  }}
                  options={[
                    { value: "cliente", label: "Soy cliente" },
                    { value: "staff", label: "Soy barbero" },
                  ]}
                />
                <p className="text-[15px] text-secondary">
                  Te mandamos un código de 6 dígitos al email de tu cuenta (o a su WhatsApp) para que elijas una
                  contraseña nueva.
                </p>
                <Field label={isClient ? "Email de tu cuenta" : "Celular o email de tu cuenta"} htmlFor="rec-id" error={error ?? undefined}>
                  <input
                    id="rec-id"
                    className="field py-3"
                    type={isClient ? "email" : "text"}
                    inputMode={isClient ? "email" : "text"}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <p className="text-[15px] text-secondary">
                  Ingresá el código de 6 dígitos que te enviamos. {destinationText(identifier, via)}
                </p>
                <input
                  aria-label="Código"
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? "rec-code-error" : undefined}
                  className="field py-4 text-center text-3xl tracking-[0.5em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                {error && (
                  <p id="rec-code-error" className="field-error mt-0 text-center">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-x-4">
                  <button type="button" onClick={() => void resend()} disabled={cooldown > 0 || busy} className="text-link text-sm disabled:text-muted">
                    {cooldown > 0 ? `Reenviar código en ${cooldown} s` : "Reenviar código"}
                  </button>
                  <button type="button" onClick={changeIdentifier} className="text-link text-sm">
                    Cambiar {isClient ? "email" : "dato"}
                  </button>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <p className="text-[15px] text-secondary">Elegí una contraseña nueva de al menos {PASSWORD_MIN} caracteres.</p>
                <Field label="Nueva contraseña" htmlFor="rec-password" error={error ?? undefined}>
                  <input
                    id="rec-password"
                    type="password"
                    autoComplete="new-password"
                    className="field py-3"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              </>
            )}
            {step === 3 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <SuccessCheck />
                <p className="page-title">Contraseña actualizada</p>
                <p className="text-[15px] text-secondary">Ya podés ingresar con tu contraseña nueva.</p>
              </div>
            )}
          </m.div>
        </AnimatePresence>
      </form>
    </PublicShell>
  );
}
