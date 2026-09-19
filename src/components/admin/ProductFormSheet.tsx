"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ProductVisual } from "@/components/marketplace/ProductVisual";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { uid } from "@/lib/format";
import type { Product, ProductShape } from "@/lib/types";
import { deleteProduct, saveProduct } from "@/store/actions";

const schema = z.object({
  name: z.string().trim().min(3, "Mínimo 3 caracteres").max(40),
  subtitle: z.string().trim().max(50),
  price: z.string().regex(/^\d+$/, "Solo números").refine((v) => Number(v) >= 100, "Mínimo $100"),
  size: z.string().trim().min(1, "Ej: 100g"),
  stock: z.number().int().min(0),
  category: z.enum(["ceras", "barba", "afeitado", "cuidado"]),
  shape: z.enum(["jar", "dropper", "bottle", "tube"]),
  active: z.boolean(),
});
type Values = z.infer<typeof schema>;

const SHAPES: { value: ProductShape; label: string }[] = [
  { value: "jar", label: "Pote" },
  { value: "dropper", label: "Gotero" },
  { value: "bottle", label: "Frasco" },
  { value: "tube", label: "Pomo" },
];

export function ProductFormSheet({ open, product, onClose }: { open: boolean; product?: Product; onClose: () => void }) {
  const isNew = !product;
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
      name: product?.name ?? "",
      subtitle: product?.subtitle ?? "",
      price: product ? String(product.price) : "",
      size: product?.size ?? "",
      stock: product?.stock ?? 10,
      category: product?.category ?? "ceras",
      shape: product?.shape ?? "jar",
      active: product?.active ?? true,
    });
  }, [open, product, reset]);

  const [stock, shape, active] = useWatch({ control, name: ["stock", "shape", "active"] });

  const onSubmit = async (v: Values) => {
    const result = await saveProduct({ ...v, id: product?.id ?? uid("p"), price: Number(v.price) }, isNew);
    if (result.ok) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? "Nuevo producto" : "Editar producto"}
      footer={
        <button type="submit" form="product-form" disabled={isSubmitting} className="tap btn-primary">
          {isSubmitting ? "Guardando…" : isNew ? "Crear producto" : "Guardar cambios"}
        </button>
      }
    >
      <form id="product-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <ProductVisual shape={shape ?? "jar"} className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl" />
          <Field label="Nombre" htmlFor="pr-name" error={errors.name?.message} className="flex-1">
            <input id="pr-name" className="field" {...register("name")} />
          </Field>
        </div>
        <Field label="Descripción corta" htmlFor="pr-sub">
          <input id="pr-sub" className="field" placeholder="Opcional" {...register("subtitle")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio" htmlFor="pr-price" error={errors.price?.message}>
            <input id="pr-price" inputMode="numeric" className="field" {...register("price")} />
          </Field>
          <Field label="Tamaño" htmlFor="pr-size" error={errors.size?.message}>
            <input id="pr-size" className="field" placeholder="100g" {...register("size")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría" htmlFor="pr-cat">
            <select id="pr-cat" className="field" {...register("category")}>
              <option value="ceras">Ceras</option>
              <option value="barba">Barba</option>
              <option value="afeitado">Afeitado</option>
              <option value="cuidado">Cuidado</option>
            </select>
          </Field>
          <Field label="Envase" htmlFor="pr-shape">
            <select id="pr-shape" className="field" {...register("shape")}>
              {SHAPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="divide-y divide-surface-high rounded-2xl bg-surface-low">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">Stock</span>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Restar stock" onClick={() => setValue("stock", Math.max(0, (stock ?? 0) - 1))} className="tap flex h-10 w-10 items-center justify-center rounded-full bg-surface-lowest">
                <Minus size={16} />
              </button>
              <span className="w-8 text-center text-base font-bold tabular-nums">{stock ?? 0}</span>
              <button type="button" aria-label="Sumar stock" onClick={() => setValue("stock", (stock ?? 0) + 1)} className="tap flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-medium">Publicado en la tienda</span>
            <Switch checked={!!active} onChange={(v) => setValue("active", v)} label="Publicado" />
          </label>
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={() => {
              onClose();
              void deleteProduct(product);
            }}
            className="tap btn-destructive mt-1"
          >
            <Trash2 size={16} /> Eliminar producto
          </button>
        )}
      </form>
    </Sheet>
  );
}
