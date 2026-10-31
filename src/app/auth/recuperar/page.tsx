"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { SuccessCheck } from "@/components/motion/SuccessCheck";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { stepSlide } from "@/lib/motion";
import { PASSWORD_MIN, passwordSchema } from "@/lib/password";
import { useAppStore, type LoginRole } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

type Step = 0 | 1 | 2 | 3;

export default function RecuperarPage() {
  const recover = useAppStore((s) => s.recover);
  const [role, setRole] = useState<LoginRole>("cliente");
  const [step, setStep] = useState<Step>(0);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // La solapa del ingreso desde la que se llegó (?tipo=barbero).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tipo") === "barbero") setRole("staff");
  }, []);

  const next = async () => {
    setError(null);
    if (step === 2) {
      const valid = passwordSchema.safeParse(password);
      if (!valid.success) return setError(valid.error.issues[0].message);
    }
    setBusy(true);
    const result =
      step === 0
        ? await recover({ role, identifier })
        : step === 1
          ? await recover({ role, identifier, code })
          : await recover({ role, identifier, code, password });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (step === 0) toast("Te enviamos un código", "info");
    setStep((s) => (s + 1) as Step);
  };

  const labels = ["Enviar código", "Verificar", "Guardar contraseña"];
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
          <button type="button" onClick={next} disabled={busy} className="tap btn-primary">
            {busy ? "…" : labels[step]}
          </button>
        )
      }
    >
      <div className="px-5 pb-6 pt-2">
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
                    inputMode={isClient ? "email" : "text"}
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <p className="text-[15px] text-secondary">Ingresá el código de 6 dígitos que te enviamos.</p>
                <input
                  aria-label="Código"
                  className="field py-4 text-center text-3xl tracking-[0.5em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                {error && <p className="field-error mt-0 text-center">{error}</p>}
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
      </div>
    </PublicShell>
  );
}
