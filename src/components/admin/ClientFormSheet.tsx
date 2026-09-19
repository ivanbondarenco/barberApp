"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { uid } from "@/lib/format";
import type { ClientProfile } from "@/lib/types";
import { deleteClient, saveClient } from "@/store/actions";

const schema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre"),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const d = v.replace(/\D/g, "");
      return d.length >= 10 && d.length <= 13;
    }, "Celular inválido"),
  email: z.union([z.literal(""), z.email("Email inválido")]),
  preferences: z.string().max(160),
  internalNotes: z.string().max(240),
});
type Values = z.infer<typeof schema>;

interface ClientFormSheetProps {
  open: boolean;
  client?: ClientProfile;
  onClose: () => void;
  onDeleted?: () => void;
}

export function ClientFormSheet({ open, client, onClose, onDeleted }: ClientFormSheetProps) {
  const isNew = !client;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      name: client?.name ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      preferences: client?.preferences ?? "",
      internalNotes: client?.internalNotes ?? "",
    });
  }, [open, client, reset]);

  const onSubmit = async (v: Values) => {
    const next: ClientProfile = {
      ...(client ?? { notifications: { reminder24h: true, whatsapp: true, promos: false }, credit: 0, createdAt: new Date().toISOString() }),
      id: client?.id ?? uid("c"),
      name: v.name,
      phone: v.phone,
      email: v.email || undefined,
      preferences: v.preferences || undefined,
      internalNotes: v.internalNotes || undefined,
    };
    const result = await saveClient(next, isNew);
    if (result.ok) onClose();
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={isNew ? "Nuevo cliente" : "Editar cliente"}
        footer={
          <button type="submit" form="client-form" disabled={isSubmitting} className="tap btn-primary">
            {isSubmitting ? "Guardando…" : isNew ? "Crear cliente" : "Guardar cambios"}
          </button>
        }
      >
        <form id="client-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
          <Field label="Nombre y apellido" htmlFor="cl-name" error={errors.name?.message}>
            <input id="cl-name" className="field" {...register("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Celular" htmlFor="cl-phone" error={errors.phone?.message}>
              <input id="cl-phone" inputMode="tel" className="field" {...register("phone")} />
            </Field>
            <Field label="Email" htmlFor="cl-email" error={errors.email?.message}>
              <input id="cl-email" inputMode="email" className="field" placeholder="Opcional" {...register("email")} />
            </Field>
          </div>
          <Field label="Preferencias de corte" htmlFor="cl-pref">
            <textarea id="cl-pref" rows={2} className="field resize-none" placeholder="Visible también para el cliente" {...register("preferences")} />
          </Field>
          <Field label="Nota interna" htmlFor="cl-notes" hint="Solo la ve el staff">
            <textarea id="cl-notes" rows={2} className="field resize-none" {...register("internalNotes")} />
          </Field>
          {!isNew && (
            <button type="button" onClick={() => setConfirmDelete(true)} className="tap btn-destructive mt-1">
              <Trash2 size={16} /> Eliminar cliente
            </button>
          )}
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        destructive
        title={`¿Eliminar a ${client?.name}?`}
        description={
          client?.hasAccount
            ? "También se elimina su cuenta y no podrá ingresar a la app. El historial de turnos se conserva."
            : "Se elimina la ficha. El historial de turnos se conserva."
        }
        confirmLabel="Eliminar cliente"
        onConfirm={async () => {
          if (!client) return;
          const result = await deleteClient(client.id);
          if (result.ok) {
            onClose();
            onDeleted?.();
          }
        }}
      />
    </>
  );
}
