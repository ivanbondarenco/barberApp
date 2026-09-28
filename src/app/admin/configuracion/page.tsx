"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DepositRulesPanel } from "@/components/admin/DepositRulesPanel";
import { IntegrationGuideButton } from "@/components/admin/IntegrationGuide";
import { ShopLinkCard } from "@/components/admin/ShopLinkCard";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { Page } from "@/components/motion/Page";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { minutesToTime } from "@/lib/dates";
import { ease } from "@/lib/motion";
import { savePaymentCredentials, saveWhatsappCredentials, updateBusinessInfo, updateHours } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

type Tab = "negocio" | "horarios" | "senas" | "integraciones" | "cuenta";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TIMES = Array.from({ length: 31 }, (_, i) => minutesToTime(7 * 60 + i * 30));

const infoSchema = z.object({
  name: z.string().trim().min(3, "Ingresá el nombre de la barbería"),
  address: z.string().trim().min(3, "Requerido"),
  neighborhood: z.string().trim().min(3, "Requerido"),
  whatsapp: z.string().trim().refine((v) => v.replace(/\D/g, "").length >= 10, "Celular inválido"),
  email: z.email("Email inválido"),
  instagram: z.string().trim(),
  transferAlias: z.string().trim().min(6, "Entre 6 y 20 caracteres").max(20),
  transferCbu: z.string().regex(/^\d{22}$/, "22 dígitos"),
});
type InfoValues = z.infer<typeof infoSchema>;

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>("negocio");
  return (
    <Page className="gap-4 px-5 pb-6 pt-1">
      <Segmented
        label="Sección"
        value={tab}
        onChange={setTab}
        options={[
          { value: "negocio", label: "Negocio" },
          { value: "horarios", label: "Horarios" },
          { value: "senas", label: "Señas" },
          { value: "integraciones", label: "Conexiones" },
          { value: "cuenta", label: "Cuenta" },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: ease.enter } }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="flex flex-col gap-4">
          {tab === "negocio" && (
            <>
              <ShopLinkCard />
              <BusinessForm />
            </>
          )}
          {tab === "horarios" && <HoursEditor />}
          {tab === "senas" && <DepositRulesPanel />}
          {tab === "integraciones" && (
            <>
              <PaymentsPanel />
              <hr className="border-surface-high" />
              <WhatsappPanel />
            </>
          )}
          {tab === "cuenta" && <AccountPanel />}
        </m.div>
      </AnimatePresence>
    </Page>
  );
}

function BusinessForm() {
  const info = useAppStore((s) => s.businessInfo);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<InfoValues>({ resolver: zodResolver(infoSchema), defaultValues: info });

  useEffect(() => {
    if (!isDirty) reset(info);
  }, [info]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        const result = await updateBusinessInfo(v);
        if (result.ok) reset(v);
      })}
      noValidate
      className="flex flex-col gap-3 rounded-2xl bg-surface-lowest p-4 shadow-xs"
    >
      <Field
        label="Nombre de la barbería"
        htmlFor="bi-name"
        error={errors.name?.message}
        hint="Así te ven tus clientes. El link del local no cambia."
      >
        <input id="bi-name" className="field" autoComplete="organization" {...register("name")} />
      </Field>
      <Field label="Dirección" htmlFor="bi-address" error={errors.address?.message}>
        <input id="bi-address" className="field" {...register("address")} />
      </Field>
      <Field label="Barrio / ciudad" htmlFor="bi-neigh" error={errors.neighborhood?.message}>
        <input id="bi-neigh" className="field" {...register("neighborhood")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="WhatsApp" htmlFor="bi-wa" error={errors.whatsapp?.message}>
          <input id="bi-wa" inputMode="tel" className="field" {...register("whatsapp")} />
        </Field>
        <Field label="Instagram" htmlFor="bi-ig">
          <input id="bi-ig" className="field" {...register("instagram")} />
        </Field>
      </div>
      <Field label="Email" htmlFor="bi-email" error={errors.email?.message}>
        <input id="bi-email" inputMode="email" className="field" {...register("email")} />
      </Field>
      <div className="grid grid-cols-[2fr_3fr] gap-3">
        <Field label="Alias" htmlFor="bi-alias" error={errors.transferAlias?.message}>
          <input id="bi-alias" className="field" {...register("transferAlias")} />
        </Field>
        <Field label="CBU / CVU" htmlFor="bi-cbu" error={errors.transferCbu?.message}>
          <input id="bi-cbu" inputMode="numeric" maxLength={22} className="field font-mono text-sm" {...register("transferCbu")} />
        </Field>
      </div>
      <AnimatePresence>
        {isDirty && (
          <m.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} type="submit" disabled={isSubmitting} className="tap btn-primary">
            Guardar cambios
          </m.button>
        )}
      </AnimatePresence>
    </form>
  );
}

function HoursEditor() {
  const hours = useAppStore((s) => s.businessHours);
  return (
    <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
      {ORDER.map((i) => {
        const day = hours[i];
        return (
          <li key={i} className="flex items-center gap-2 px-4 py-2.5">
            <span className="w-20 shrink-0 text-[15px] font-medium">{DAYS[i]}</span>
            <div className={cn("grid flex-1 grid-cols-2 gap-1.5 transition-opacity", day.closed && "pointer-events-none opacity-30")}>
              <select aria-label={`Apertura ${DAYS[i]}`} value={day.open} onChange={(e) => void updateHours(i, { open: e.target.value })} className="field px-2 py-2 text-center text-sm">
                {TIMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select aria-label={`Cierre ${DAYS[i]}`} value={day.close} onChange={(e) => void updateHours(i, { close: e.target.value })} className="field px-2 py-2 text-center text-sm">
                {TIMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <Switch checked={!day.closed} onChange={(open) => void updateHours(i, { closed: !open })} label={`${DAYS[i]} abierto`} />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Credenciales de Mercado Pago del local.
 *
 * Nunca se muestran completas: el servidor devuelve solo los últimos 4 caracteres para
 * reconocerlas. Un campo vacío deja la credencial como está; para borrarla se usa el botón.
 */
function PaymentsPanel() {
  const ready = useAppStore((s) => s.integrations.mercadopagoReady);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [values, setValues] = useState({ accessToken: "", publicKey: "", webhookSecret: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/settings/payments", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PaymentStatus | null) => d && setStatus(d))
      .catch(() => undefined);
  }, []);

  const save = async () => {
    // Solo se mandan los campos que el dueño realmente escribió.
    const patch = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim())) as Record<string, string>;
    if (!Object.keys(patch).length) return;
    setSaving(true);
    const result = await savePaymentCredentials(patch);
    setSaving(false);
    if (!result.ok) return;
    setValues({ accessToken: "", publicKey: "", webhookSecret: "" });
    const refreshed = await fetch("/api/settings/payments", { credentials: "same-origin", cache: "no-store" });
    if (refreshed.ok) setStatus((await refreshed.json()) as PaymentStatus);
  };

  const fields = [
    { key: "accessToken" as const, label: "Access token de Mercado Pago", hint: "Credencial de producción", stored: status?.accessToken },
    { key: "publicKey" as const, label: "Public key", hint: "Opcional", stored: status?.publicKey },
    {
      key: "webhookSecret" as const,
      label: "Clave secreta del webhook",
      hint: "La genera Mercado Pago al configurar la notificación",
      stored: status?.webhookSecret,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-caps text-secondary">Mercado Pago</h2>
        <IntegrationGuideButton guide="mercadopago" />
      </div>
      <div className={cn("rounded-2xl p-4", ready ? "bg-mint" : "bg-surface-lowest shadow-xs")}>
        <p className={cn("text-[15px] font-semibold", ready && "text-mint-ink")}>
          {ready ? "Cobro online activo" : "Cobro online sin configurar"}
        </p>
        <p className={cn("mt-1 text-[13px]", ready ? "text-mint-ink" : "text-secondary")}>
          {ready
            ? "Los clientes pueden pagar la seña con Mercado Pago."
            : "Sin credenciales, la app ofrece solo transferencia y efectivo."}
        </p>
        {ready && status && !status.canReceiveWebhooks && (
          <p className="mt-2 text-[13px] font-semibold text-error">
            Falta la clave secreta del webhook: sin ella no se pueden acreditar los pagos automáticamente.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={`mp-${f.key}`}>
            <input
              id={`mp-${f.key}`}
              type="password"
              autoComplete="off"
              className="field font-mono"
              placeholder={f.stored || f.hint}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </Field>
        ))}
      </div>

      <p className="text-[13px] text-secondary">
        En Mercado Pago configurá la notificación de pagos apuntando a <span className="font-mono">/api/payments/webhook</span> de
        este sitio.
      </p>

      <button type="button" disabled={saving} onClick={() => void save()} className="tap btn-primary">
        {saving ? "Guardando…" : "Guardar Mercado Pago"}
      </button>
    </div>
  );
}

interface PaymentStatus {
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
  ready: boolean;
  canReceiveWebhooks: boolean;
}

/** Cambio de la contraseña de la cuenta del staff. */
function AccountPanel() {
  const session = useAppStore((s) => s.session);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
        <p className="text-[13px] text-secondary">Sesión iniciada como</p>
        <p className="text-[15px] font-semibold">{session?.name}</p>
        <p className="text-[13px] text-secondary">{session?.identifier}</p>
      </div>
      <ChangePasswordForm recoverHref="/auth/recuperar?tipo=barbero" />
    </div>
  );
}

interface WhatsappStatus {
  accessToken: string;
  phoneNumberId: string;
  template: string;
  language: string;
  ready: boolean;
}

/**
 * Credenciales de WhatsApp Cloud API del local. Con esto la app manda el código para
 * recuperar la contraseña.
 */
function WhatsappPanel() {
  const ready = useAppStore((s) => s.integrations.whatsappReady);
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [values, setValues] = useState({ accessToken: "", phoneNumberId: "", template: "", language: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch("/api/settings/whatsapp", { credentials: "same-origin", cache: "no-store" });
    if (res.ok) setStatus((await res.json()) as WhatsappStatus);
  };

  useEffect(() => {
    void load().catch(() => undefined);
  }, []);

  const save = async () => {
    // Solo se manda lo que el dueño escribió: lo vacío deja la credencial como está.
    const patch = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim())) as Record<string, string>;
    if (!Object.keys(patch).length) return;
    setSaving(true);
    const result = await saveWhatsappCredentials(patch);
    setSaving(false);
    if (!result.ok) return;
    setValues({ accessToken: "", phoneNumberId: "", template: "", language: "" });
    await load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-caps text-secondary">WhatsApp</h2>
        <IntegrationGuideButton guide="whatsapp" />
      </div>
      <div className={cn("rounded-2xl p-4", ready ? "bg-mint" : "bg-surface-lowest shadow-xs")}>
        <p className={cn("text-[15px] font-semibold", ready && "text-mint-ink")}>
          {ready ? "WhatsApp conectado" : "WhatsApp sin configurar"}
        </p>
        <p className={cn("mt-1 text-[13px]", ready ? "text-mint-ink" : "text-secondary")}>
          {ready
            ? "Los códigos de verificación salen desde tu número."
            : "Sin esto, tus clientes y tu equipo no pueden recuperar su contraseña por su cuenta."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Field label="Access token de WhatsApp" htmlFor="wa-token">
          <input
            id="wa-token"
            type="password"
            autoComplete="off"
            className="field font-mono"
            placeholder={status?.accessToken || "Token permanente de tu app de Meta"}
            value={values.accessToken}
            onChange={(e) => setValues((v) => ({ ...v, accessToken: e.target.value }))}
          />
        </Field>
        <Field label="Phone number ID" htmlFor="wa-phone">
          <input
            id="wa-phone"
            inputMode="numeric"
            autoComplete="off"
            className="field font-mono"
            placeholder={status?.phoneNumberId || "Id del número en WhatsApp Cloud API"}
            value={values.phoneNumberId}
            onChange={(e) => setValues((v) => ({ ...v, phoneNumberId: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plantilla" htmlFor="wa-template">
            <input
              id="wa-template"
              autoComplete="off"
              className="field"
              placeholder={status?.template ?? ""}
              value={values.template}
              onChange={(e) => setValues((v) => ({ ...v, template: e.target.value }))}
            />
          </Field>
          <Field label="Idioma" htmlFor="wa-language">
            <input
              id="wa-language"
              autoComplete="off"
              className="field"
              placeholder={status?.language ?? ""}
              value={values.language}
              onChange={(e) => setValues((v) => ({ ...v, language: e.target.value }))}
            />
          </Field>
        </div>
      </div>

      <p className="text-[13px] text-secondary">
        La plantilla tiene que estar aprobada por Meta como plantilla de autenticación, con el código como único
        parámetro. Meta no permite mandar texto libre para esto.
      </p>

      <button type="button" disabled={saving} onClick={() => void save()} className="tap btn-primary">
        {saving ? "Guardando…" : "Guardar WhatsApp"}
      </button>
    </div>
  );
}
