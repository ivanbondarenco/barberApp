"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { initials, uid } from "@/lib/format";
import { PASSWORD_MIN } from "@/lib/password";
import type { Barber } from "@/lib/types";
import { deleteBarber, saveBarber, saveStaffAccount } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const schema = z.object({
  name: z.string().trim().min(3, "Ingresá el nombre"),
  title: z.string().trim().min(3, "Ej: Barber Master"),
  chair: z.string().regex(/^\d{1,2}$/, "Número de sillón"),
  phone: z.string().trim(),
  active: z.boolean(),
  /** Usuario con el que entra a la app. Vacío = sin acceso. */
  accountIdentifier: z.string().trim(),
  /** Obligatorio solo al darle acceso por primera vez. */
  accountPassword: z.string().trim(),
});
type Values = z.infer<typeof schema>;

export function BarberFormSheet({ open, barber, onClose }: { open: boolean; barber?: Barber; onClose: () => void }) {
  const barbers = useAppStore((s) => s.barbers);
  const isNew = !barber;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      name: barber?.name ?? "",
      title: barber?.title ?? "Barber",
      chair: String(barber?.chair ?? Math.max(0, ...barbers.map((b) => b.chair)) + 1),
      phone: barber?.phone ?? "",
      active: barber?.active ?? true,
      accountIdentifier: barber?.accountIdentifier ?? "",
      accountPassword: "",
    });
  }, [open, barber]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useWatch({ control, name: "active" });

  const onSubmit = async (v: Values) => {
    const id = barber?.id ?? uid("b");
    const result = await saveBarber(
      {
        id,
        name: v.name,
        title: v.title,
        chair: Number(v.chair),
        phone: v.phone || undefined,
        initials: initials(v.name),
        active: v.active,
      },
      isNew,
    );
    if (!result.ok) return;

    // El acceso vive aparte del sillón: se guarda solo si cambió algo.
    const identifierChanged = v.accountIdentifier !== (barber?.accountIdentifier ?? "");
    if (identifierChanged || v.accountPassword) {
      if (v.accountIdentifier && !barber?.hasAccount && !v.accountPassword) {
        return toast("Elegí una contraseña inicial para su acceso", "error");
      }
      if (v.accountPassword && v.accountPassword.length < PASSWORD_MIN) {
        return toast(`La contraseña tiene al menos ${PASSWORD_MIN} caracteres`, "error");
      }
      const account = await saveStaffAccount({
        barberId: id,
        identifier: v.accountIdentifier,
        password: v.accountPassword || undefined,
      });
      if (!account.ok) return;
    }
    onClose();
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={isNew ? "Nuevo barbero" : "Editar barbero"}
        footer={
          <button type="submit" form="barber-form" disabled={isSubmitting} className="tap btn-primary">
            {isSubmitting ? "Guardando…" : isNew ? "Agregar al equipo" : "Guardar cambios"}
          </button>
        }
      >
        <form id="barber-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
          <Field label="Nombre" htmlFor="bf-name" error={errors.name?.message}>
            <input id="bf-name" className="field" {...register("name")} />
          </Field>
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <Field label="Especialidad" htmlFor="bf-title" error={errors.title?.message}>
              <input id="bf-title" className="field" {...register("title")} />
            </Field>
            <Field label="Sillón" htmlFor="bf-chair" error={errors.chair?.message}>
              <input id="bf-chair" inputMode="numeric" className="field" {...register("chair")} />
            </Field>
          </div>
          <Field label="Celular" htmlFor="bf-phone">
            <input id="bf-phone" inputMode="tel" className="field" placeholder="Opcional" {...register("phone")} />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-low px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Recibe reservas</span>
              <span className="text-xs text-secondary">Desactivalo en vacaciones o francos largos</span>
            </span>
            <Switch checked={!!active} onChange={(v) => setValue("active", v)} label="Recibe reservas" />
          </label>
          <fieldset className="mt-1 flex flex-col gap-3 rounded-2xl bg-surface-low p-3">
            <legend className="sr-only">Acceso a la app</legend>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <KeyRound size={15} className="text-primary" aria-hidden /> Acceso a la app
            </p>
            <p className="-mt-1 text-xs text-secondary">
              Con cuenta propia ve y cobra solo su agenda. El catálogo, el equipo y la configuración quedan para vos.
            </p>
            <Field label="Email o celular" htmlFor="bf-account" error={errors.accountIdentifier?.message}>
              <input
                id="bf-account"
                className="field bg-surface-lowest"
                autoComplete="off"
                placeholder="Dejalo vacío para quitarle el acceso"
                {...register("accountIdentifier")}
              />
            </Field>
            <Field
              label={barber?.hasAccount ? "Contraseña nueva (opcional)" : "Contraseña inicial"}
              htmlFor="bf-password"
              hint={`Al menos ${PASSWORD_MIN} caracteres`}
              error={errors.accountPassword?.message}
            >
              <input
                id="bf-password"
                type="password"
                autoComplete="new-password"
                className="field bg-surface-lowest"
                {...register("accountPassword")}
              />
            </Field>
            {barber?.hasAccount && (
              <p className="text-xs text-secondary">Al cambiarle la contraseña se cierran sus sesiones abiertas.</p>
            )}
          </fieldset>

          {!isNew && (
            <button type="button" onClick={() => setConfirmDelete(true)} className="tap btn-destructive mt-1">
              <Trash2 size={16} /> Eliminar del equipo
            </button>
          )}
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        destructive
        title={`¿Eliminar a ${barber?.name}?`}
        description="Se borran sus bloqueos de agenda. Si tiene turnos próximos, primero reasignalos."
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (!barber) return;
          const result = await deleteBarber(barber.id);
          if (result.ok) onClose();
        }}
      />
    </>
  );
}
