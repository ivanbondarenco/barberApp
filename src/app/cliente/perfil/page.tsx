"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, CircleHelp, FileText, History, KeyRound, LogOut, type LucideIcon, MailCheck, Scissors, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { NAV, Page } from "@/components/motion/Page";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Section } from "@/components/ui/States";
import { Switch } from "@/components/ui/Switch";
import { initials, money } from "@/lib/format";
import type { ClientProfile } from "@/lib/types";
import { saveClient } from "@/store/actions";
import { useAppStore, useCurrentClient } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

export default function PerfilPage() {
  const router = useRouter();
  const client = useCurrentClient();
  const visits = useAppStore((s) => s.appointments.filter((a) => a.clientId === client?.id && a.status === "completado").length);
  const logout = useAppStore((s) => s.logout);
  const emailVerified = useAppStore((s) => s.session?.emailVerified !== false);
  const resendVerification = useAppStore((s) => s.resendVerification);
  const [sending, setSending] = useState(false);
  const [sheet, setSheet] = useState<"datos" | "password" | null>(null);

  if (!client) return null;

  const toggle = (key: keyof ClientProfile["notifications"], value: boolean) =>
    void saveClient({ ...client, notifications: { ...client.notifications, [key]: value } }, false);

  return (
    <Page className="gap-6 px-5 pb-6 pt-2">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-on-primary">{initials(client.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold tracking-tight">{client.name}</p>
          <p className="text-sm text-secondary">{client.phone}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
          <p className="text-[13px] text-secondary">Visitas</p>
          <p className="text-2xl font-bold tabular-nums">{visits}</p>
        </div>
        <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
          <p className="text-[13px] text-secondary">Crédito a favor</p>
          <p className="text-2xl font-bold tabular-nums text-primary">{money(client.credit)}</p>
        </div>
      </div>

      <Section title="Cuenta">
        <div className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
          <MenuRow icon={UserRound} label="Mis datos" onClick={() => setSheet("datos")} />
          <MenuRow icon={Scissors} label="Preferencias de corte" detail={client.preferences ?? "Sin definir"} onClick={() => setSheet("datos")} />
          <MenuRow icon={History} label="Historial" href="/cliente/historial" />
          <MenuRow icon={Store} label="Mis barberías" href="/cliente/barberias" />
          <MenuRow icon={KeyRound} label="Cambiar contraseña" onClick={() => setSheet("password")} />
          {!emailVerified && (
            <MenuRow
              icon={MailCheck}
              label={sending ? "Enviando…" : "Confirmar mi email"}
              detail="Te mandamos un link para confirmarlo"
              onClick={async () => {
                if (sending) return;
                setSending(true);
                const result = await resendVerification();
                setSending(false);
                toast(result.ok ? "Te mandamos el link a tu email" : result.error, result.ok ? "success" : "error");
              }}
            />
          )}
        </div>
      </Section>

      <Section title="Avisos">
        <div className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
          {(
            [
              { key: "reminder24h", label: "Recordatorio 24 h antes" },
              { key: "whatsapp", label: "Confirmaciones por WhatsApp" },
            ] as const
          ).map((n) => (
            <label key={n.key} className="row cursor-pointer">
              <span className="flex-1 text-[15px]">{n.label}</span>
              <Switch checked={client.notifications[n.key]} onChange={(v) => toggle(n.key, v)} label={n.label} />
            </label>
          ))}
        </div>
      </Section>

      <div className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
        <MenuRow icon={FileText} label="Políticas de seña" href="/politicas" />
        <MenuRow icon={CircleHelp} label="Ayuda" href="/ayuda" />
      </div>

      <button
        type="button"
        onClick={async () => {
          await logout();
          router.replace("/auth/login");
        }}
        className="tap btn-destructive"
      >
        <LogOut size={17} /> Cerrar sesión
      </button>

      <ProfileSheet open={sheet === "datos"} client={client} onClose={() => setSheet(null)} />
      <PasswordSheet open={sheet === "password"} onClose={() => setSheet(null)} />
    </Page>
  );
}

function MenuRow({ icon: Icon, label, detail, href, onClick }: { icon: LucideIcon; label: string; detail?: string; href?: string; onClick?: () => void }) {
  const content = (
    <>
      <Icon size={19} className="text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {detail && <span className="block truncate text-[13px] text-secondary">{detail}</span>}
      </span>
      <ChevronRight size={18} className="text-secondary" aria-hidden />
    </>
  );
  return href ? (
    <Link href={href} transitionTypes={[...NAV.forward]} className="row hover:bg-surface-low">
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className="row hover:bg-surface-low">
      {content}
    </button>
  );
}

const profileSchema = z.object({
  name: z.string().trim().min(3, "Ingresá nombre y apellido"),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const d = v.replace(/\D/g, "");
      return d.length >= 10 && d.length <= 13;
    }, "Celular inválido"),
  email: z.union([z.literal(""), z.email("Email inválido")]),
  preferences: z.string().max(160),
});
type ProfileValues = z.infer<typeof profileSchema>;

function ProfileSheet({ open, client, onClose }: { open: boolean; client: ClientProfile; onClose: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (open) reset({ name: client.name, phone: client.phone, email: client.email ?? "", preferences: client.preferences ?? "" });
  }, [open, client, reset]);

  const onSubmit = async (v: ProfileValues) => {
    const result = await saveClient({ ...client, ...v, email: v.email || undefined, preferences: v.preferences || undefined }, false);
    if (result.ok) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Mis datos"
      footer={
        <button type="submit" form="profile-form" disabled={isSubmitting} className="tap btn-primary">
          Guardar
        </button>
      }
    >
      <form id="profile-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        <Field label="Nombre y apellido" htmlFor="pf-name" error={errors.name?.message}>
          <input id="pf-name" className="field" autoComplete="name" {...register("name")} />
        </Field>
        <Field label="Celular" htmlFor="pf-phone" error={errors.phone?.message}>
          <input id="pf-phone" className="field" inputMode="tel" autoComplete="tel" {...register("phone")} />
        </Field>
        <Field label="Email" htmlFor="pf-email" error={errors.email?.message}>
          <input id="pf-email" className="field" inputMode="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Preferencias de corte" htmlFor="pf-pref" hint="Tu barbero la ve en cada turno">
          <textarea id="pf-pref" rows={3} className="field resize-none" {...register("preferences")} />
        </Field>
      </form>
    </Sheet>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Cambiar contraseña">
      <ChangePasswordForm onDone={onClose} recoverHref="/auth/recuperar?tipo=cliente" />
    </Sheet>
  );
}
