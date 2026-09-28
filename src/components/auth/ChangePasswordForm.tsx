"use client";

import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { PASSWORD_MIN, passwordSchema } from "@/lib/password";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

/** Cambio de contraseña con la sesión abierta. Lo usan el perfil del cliente y el del staff. */
export function ChangePasswordForm({ onDone, recoverHref }: { onDone?: () => void; recoverHref: string }) {
  const changePassword = useAppStore((s) => s.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!current) return setError("Ingresá tu contraseña actual");
    const valid = passwordSchema.safeParse(next);
    if (!valid.success) return setError(valid.error.issues[0].message);
    setSaving(true);
    const result = await changePassword(current, next);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setCurrent("");
    setNext("");
    toast("Contraseña actualizada", "success");
    onDone?.();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="Contraseña actual" htmlFor="pw-current">
        <input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          className="field"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>
      <Field label="Contraseña nueva" htmlFor="pw-next" hint={`Al menos ${PASSWORD_MIN} caracteres`} error={error ?? undefined}>
        <input
          id="pw-next"
          type="password"
          autoComplete="new-password"
          className="field"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </Field>
      <button type="submit" disabled={saving} className="tap btn-primary mt-1">
        {saving ? "Guardando…" : "Cambiar contraseña"}
      </button>
      <Link href={recoverHref} className="self-center text-sm font-semibold text-primary">
        No recuerdo mi contraseña
      </Link>
    </form>
  );
}
