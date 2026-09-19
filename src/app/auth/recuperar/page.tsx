"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useState } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { SuccessCheck } from "@/components/motion/SuccessCheck";
import { Field } from "@/components/ui/Field";
import { stepSlide } from "@/lib/motion";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

type Step = 0 | 1 | 2 | 3;

export default function RecuperarPage() {
  const recover = useAppStore((s) => s.recover);
  const [step, setStep] = useState<Step>(0);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    setError(null);
    setBusy(true);
    const result =
      step === 0
        ? await recover({ identifier })
        : step === 1
          ? await recover({ identifier, code })
          : await recover({ identifier, code, pin });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (step === 0) toast("Código enviado", "info");
    setStep((s) => (s + 1) as Step);
  };

  const labels = ["Enviar código", "Verificar", "Guardar PIN"];

  return (
    <PublicShell
      title="Recuperar PIN"
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
                <p className="text-[15px] text-secondary">Te enviamos un código para crear un PIN nuevo.</p>
                <Field label="Celular o email de tu cuenta" htmlFor="rec-id" error={error ?? undefined}>
                  <input id="rec-id" className="field py-3" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="+54 9 11 …" />
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <p className="text-[15px] text-secondary">Ingresá el código que enviamos a {identifier}.</p>
                <input aria-label="Código" className="field py-4 text-center text-3xl tracking-[0.5em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                {error && <p className="field-error mt-0 text-center">{error}</p>}
              </>
            )}
            {step === 2 && (
              <>
                <p className="text-[15px] text-secondary">Elegí un PIN de 4 dígitos que no sea obvio.</p>
                <Field label="Nuevo PIN" htmlFor="rec-pin" error={error ?? undefined}>
                  <input id="rec-pin" type="password" inputMode="numeric" maxLength={4} className="field py-3 text-center text-2xl tracking-[0.5em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
                </Field>
              </>
            )}
            {step === 3 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <SuccessCheck />
                <p className="page-title">PIN actualizado</p>
                <p className="text-[15px] text-secondary">Ya podés ingresar con tu PIN nuevo.</p>
              </div>
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </PublicShell>
  );
}
