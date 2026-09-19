"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { initials, uid } from "@/lib/format";
import type { Barber } from "@/lib/types";
import { deleteBarber, saveBarber } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

const schema = z.object({
  name: z.string().trim().min(3, "Ingresá el nombre"),
  title: z.string().trim().min(3, "Ej: Barber Master"),
  chair: z.string().regex(/^\d{1,2}$/, "Número de sillón"),
  phone: z.string().trim(),
  active: z.boolean(),
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
    });
  }, [open, barber]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useWatch({ control, name: "active" });

  const onSubmit = async (v: Values) => {
    const result = await saveBarber(
      {
        id: barber?.id ?? uid("b"),
        name: v.name,
        title: v.title,
        chair: Number(v.chair),
        phone: v.phone || undefined,
        initials: initials(v.name),
        rating: barber?.rating ?? 5,
        reviews: barber?.reviews ?? 0,
        active: v.active,
      },
      isNew,
    );
    if (result.ok) onClose();
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
