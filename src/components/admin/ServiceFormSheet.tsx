"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { money, uid } from "@/lib/format";
import { splitDeposit } from "@/lib/pricing";
import type { Service } from "@/lib/types";
import { deleteService, saveService } from "@/store/actions";

const schema = z.object({
  name: z.string().trim().min(3, "Mínimo 3 caracteres").max(40),
  description: z.string().trim().max(90),
  price: z.string().regex(/^\d+$/, "Solo números").refine((v) => Number(v) >= 500, "Mínimo $500"),
  durationMin: z.string(),
  category: z.enum(["corte", "barba", "combo", "tratamiento"]),
  featured: z.boolean(),
  active: z.boolean(),
});
type Values = z.infer<typeof schema>;

const DURATIONS = ["15", "30", "45", "60", "75", "90", "120"];

export function ServiceFormSheet({ open, service, onClose }: { open: boolean; service?: Service; onClose: () => void }) {
  const isNew = !service;
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
      name: service?.name ?? "",
      description: service?.description ?? "",
      price: service ? String(service.price) : "",
      durationMin: String(service?.durationMin ?? 45),
      category: service?.category ?? "corte",
      featured: service?.featured ?? false,
      active: service?.active ?? true,
    });
  }, [open, service, reset]);

  const [price, featured, active] = useWatch({ control, name: ["price", "featured", "active"] });
  const split = splitDeposit(Number(price) || 0);

  const onSubmit = async (v: Values) => {
    const next: Service = {
      id: service?.id ?? uid("s"),
      name: v.name,
      description: v.description,
      price: Number(v.price),
      durationMin: Number(v.durationMin),
      category: v.category,
      featured: v.featured,
      tag: v.featured ? service?.tag ?? "Top" : undefined,
      active: v.active,
    };
    const result = await saveService(next, isNew);
    if (result.ok) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? "Nuevo servicio" : "Editar servicio"}
      footer={
        <button type="submit" form="service-form" disabled={isSubmitting} className="tap btn-primary">
          {isSubmitting ? "Guardando…" : isNew ? "Crear servicio" : "Guardar cambios"}
        </button>
      }
    >
      <form id="service-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        <Field label="Nombre" htmlFor="sv-name" error={errors.name?.message}>
          <input id="sv-name" className="field" {...register("name")} />
        </Field>
        <Field label="Descripción" htmlFor="sv-desc" error={errors.description?.message}>
          <input id="sv-desc" className="field" placeholder="Opcional" {...register("description")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio" htmlFor="sv-price" error={errors.price?.message} hint={split.deposit ? `Seña 50%: ${money(split.deposit)}` : undefined}>
            <input id="sv-price" inputMode="numeric" className="field" placeholder="11000" {...register("price")} />
          </Field>
          <Field label="Duración" htmlFor="sv-dur">
            <select id="sv-dur" className="field" {...register("durationMin")}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Categoría" htmlFor="sv-cat">
          <select id="sv-cat" className="field" {...register("category")}>
            <option value="corte">Corte</option>
            <option value="barba">Barba</option>
            <option value="combo">Combo</option>
            <option value="tratamiento">Tratamiento</option>
          </select>
        </Field>
        <div className="divide-y divide-surface-high rounded-2xl bg-surface-low">
          <label className="flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Visible para reservar</span>
              <span className="text-xs text-secondary">Aparece en el menú de clientes</span>
            </span>
            <Switch checked={!!active} onChange={(v) => setValue("active", v)} label="Visible para reservar" />
          </label>
          <label className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-medium">Destacar como “Top”</span>
            <Switch checked={!!featured} onChange={(v) => setValue("featured", v)} label="Destacar" />
          </label>
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={() => {
              onClose();
              void deleteService(service);
            }}
            className="tap btn-destructive mt-1"
          >
            <Trash2 size={16} /> Eliminar servicio
          </button>
        )}
      </form>
    </Sheet>
  );
}
