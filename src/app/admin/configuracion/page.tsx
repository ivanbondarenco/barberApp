"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Plus, X } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { BookingRulesPanel } from "@/components/admin/BookingRulesPanel";
import { DepositRulesPanel } from "@/components/admin/DepositRulesPanel";
import { IntegrationGuideButton } from "@/components/admin/IntegrationGuide";
import { ShopLinkCard } from "@/components/admin/ShopLinkCard";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { SetupChecklist } from "@/components/layout/SetupChecklist";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Page } from "@/components/motion/Page";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { minutesToTime, timeToMinutes } from "@/lib/dates";
import { setupTasks } from "@/lib/notifications";
import { dayRanges, MAX_RANGES_PER_DAY, normalizeRanges } from "@/lib/schedule";
import type { DayHours, TimeRange } from "@/lib/types";
import { ease } from "@/lib/motion";
import { disconnectMercadopago, saveWhatsappCredentials, updateBusinessInfo, updateHours } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";
import { toast, undoToast } from "@/store/useToast";

type Tab = "negocio" | "horarios" | "reservas" | "senas" | "integraciones" | "cuenta";
const TABS: Tab[] = ["negocio", "horarios", "reservas", "senas", "integraciones", "cuenta"];

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
/** De 06:00 a 23:30, cada media hora. */
const TIMES = Array.from({ length: 36 }, (_, i) => minutesToTime(6 * 60 + i * 30));

const infoSchema = z.object({
  name: z.string().trim().min(3, "Ingresá el nombre de la barbería"),
  address: z.string().trim().min(3, "Ingresá la dirección del local"),
  // Opcional: donde se muestra, se omite si está vacío.
  neighborhood: z.string().trim(),
  whatsapp: z.string().trim().refine((v) => v.replace(/\D/g, "").length >= 10, "Ingresá un celular válido, con característica"),
  email: z.email("Ingresá un email válido"),
  instagram: z.string().trim(),
  // Los datos de transferencia son opcionales; si se cargan, tienen que estar bien.
  transferAlias: z
    .string()
    .trim()
    .refine((v) => !v || (v.length >= 6 && v.length <= 20), "Ingresá un alias de 6 a 20 caracteres"),
  transferCbu: z
    .string()
    .trim()
    .refine((v) => !v || /^\d{22}$/.test(v), "Ingresá los 22 dígitos del CBU o CVU"),
});
type InfoValues = z.infer<typeof infoSchema>;

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>("negocio");
  /** Hay cambios sin guardar en los datos del negocio: se avisa antes de perderlos. */
  const [dirty, setDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Los avisos de configuración pendiente traen ?tab=integraciones: se abre directo ahí.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (TABS.includes(wanted as Tab)) setTab(wanted as Tab);
  }, []);

  // En teléfonos angostos las solapas no entran: la elegida se trae a la vista.
  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [tab]);

  // Cerrar o recargar la pestaña con cambios sin guardar pide confirmación al navegador.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const changeTab = (next: Tab) => {
    if (next === tab) return;
    if (dirty) return setPendingTab(next);
    setTab(next);
  };

  const isOwner = useAppStore((s) => s.session?.role === "admin");
  const integrations = useAppStore((s) => s.integrations);
  const services = useAppStore((s) => s.services);
  const synced = useAppStore((s) => s.synced);
  // El aviso de la agenda se puede ocultar; acá queda siempre a mano mientras falte algo.
  const setup = useMemo(
    () => (synced && isOwner ? setupTasks({ integrations, services }, "admin") : []),
    [synced, isOwner, integrations, services],
  );
  const shopName = useAppStore((s) => s.session?.shop?.name);

  return (
    <Page className="gap-4 px-5 pb-6 pt-1">
      <SetupChecklist tasks={setup} shopName={shopName} variant="banner" />
      <div ref={tabsRef} className="no-scrollbar -mx-5 overflow-x-auto px-5">
        <Segmented
          label="Sección"
          value={tab}
          onChange={changeTab}
          className="min-w-max"
          options={[
            { value: "negocio", label: "Negocio" },
            { value: "horarios", label: "Horarios" },
            { value: "reservas", label: "Reservas" },
            { value: "senas", label: "Señas" },
            { value: "integraciones", label: "Conexiones" },
            { value: "cuenta", label: "Cuenta" },
          ]}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: ease.enter } }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="flex flex-col gap-4">
          {tab === "negocio" && (
            <>
              <ShopLinkCard />
              <BusinessForm onDirtyChange={setDirty} />
            </>
          )}
          {tab === "horarios" && <HoursEditor />}
          {tab === "reservas" && <BookingRulesPanel />}
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

      <ConfirmDialog
        open={!!pendingTab}
        onClose={() => setPendingTab(null)}
        destructive
        title="¿Descartar los cambios?"
        description="Hay cambios en los datos del negocio que todavía no guardaste."
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        onConfirm={() => {
          setDirty(false);
          if (pendingTab) setTab(pendingTab);
        }}
      />
    </Page>
  );
}

function BusinessForm({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const info = useAppStore((s) => s.businessInfo);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<InfoValues>({ resolver: zodResolver(infoSchema), defaultValues: info });
  const alias = useWatch({ control, name: "transferAlias" });

  useEffect(() => {
    if (!isDirty) reset(info);
  }, [info]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  // Al salir de la solapa (descartando), deja de haber cambios pendientes.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        const result = await updateBusinessInfo(v);
        if (result.ok) reset(v);
      })}
      noValidate
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3 rounded-2xl bg-surface-lowest p-4 shadow-xs">
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
        <Field label="Barrio / ciudad" htmlFor="bi-neigh" error={errors.neighborhood?.message} hint="Opcional">
          <input id="bi-neigh" className="field" {...register("neighborhood")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="WhatsApp" htmlFor="bi-wa" error={errors.whatsapp?.message}>
            <input id="bi-wa" inputMode="tel" className="field" {...register("whatsapp")} />
          </Field>
          <Field label="Instagram" htmlFor="bi-ig">
            <input id="bi-ig" className="field" placeholder="Opcional" {...register("instagram")} />
          </Field>
        </div>
        <Field label="Email" htmlFor="bi-email" error={errors.email?.message}>
          <input id="bi-email" inputMode="email" className="field" {...register("email")} />
        </Field>
        <div className="grid grid-cols-[2fr_3fr] gap-3">
          <Field label="Alias" htmlFor="bi-alias" error={errors.transferAlias?.message}>
            <input id="bi-alias" className="field" placeholder="Opcional" autoCapitalize="none" {...register("transferAlias")} />
          </Field>
          <Field label="CBU / CVU" htmlFor="bi-cbu" error={errors.transferCbu?.message}>
            <input id="bi-cbu" inputMode="numeric" maxLength={22} className="field font-mono text-sm" placeholder="Opcional" {...register("transferCbu")} />
          </Field>
        </div>
        {!alias?.trim() && (
          <p className="text-xs text-secondary">Sin alias no ofrecemos transferencia para pagar la seña.</p>
        )}
      </div>

      {/* Barra fija mientras haya cambios: queda sobre la barra de navegación, sin tener que bajar a buscarla. */}
      <AnimatePresence>
        {isDirty && (
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="sticky bottom-0 z-10 -mx-5 flex gap-2 border-t border-surface-high bg-surface-lowest/95 px-5 py-3 backdrop-blur-xl"
          >
            <button type="button" onClick={() => reset(info)} disabled={isSubmitting} className="tap btn-secondary w-auto shrink-0 px-4">
              Descartar
            </button>
            <button type="submit" disabled={isSubmitting} className="tap btn-primary flex-1">
              {isSubmitting ? "Guardando…" : "Guardar cambios"}
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function HoursEditor() {
  const hours = useAppStore((s) => s.businessHours);
  /** Cada cambio se guarda solo: se muestra un "Guardado" discreto para que se note. */
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const save = async (i: number, patch: Partial<DayHours>) => {
    clearTimeout(savedTimer.current);
    setStatus("saving");
    const result = await updateHours(i, patch);
    setStatus(result.ok ? "saved" : "idle");
    if (result.ok) savedTimer.current = setTimeout(() => setStatus("idle"), 2500);
    return result;
  };

  const saveRanges = (i: number, ranges: TimeRange[]) => {
    const result = normalizeRanges(ranges);
    if (typeof result === "string") return toast(result, "error");
    void save(i, { ranges: result });
  };

  const setRange = (i: number, idx: number, patch: Partial<TimeRange>) =>
    saveRanges(i, dayRanges(hours[i]).map((r, k) => (k === idx ? { ...r, ...patch } : r)));

  /** Suma una franja una hora después del cierre actual (ej. 09–13 → agrega 14–18). */
  const addRange = (i: number) => {
    const ranges = dayRanges(hours[i]);
    const from = timeToMinutes(ranges[ranges.length - 1].close) + 60;
    const last = timeToMinutes(TIMES[TIMES.length - 1]);
    if (from + 30 > last) return toast("No queda lugar después del último horario. Ajustá el cierre primero.", "error");
    saveRanges(i, [...ranges, { open: minutesToTime(from), close: minutesToTime(Math.min(from + 4 * 60, last)) }]);
  };

  const removeRange = (i: number, idx: number) => saveRanges(i, dayRanges(hours[i]).filter((_, k) => k !== idx));

  /** Día modelo para copiar: el lunes, o el primer día abierto de la semana. */
  const source = ORDER.find((i) => !hours[i]?.closed);

  /** Copia el horario del día modelo a los demás días abiertos, con "Deshacer". */
  const copyToAll = async () => {
    if (source === undefined) return;
    const ranges = dayRanges(hours[source]);
    const targets = ORDER.filter((i) => i !== source && !hours[i].closed);
    const before = targets.map((i) => ({ i, ranges: dayRanges(hours[i]) }));
    for (const i of targets) {
      const result = await save(i, { ranges });
      if (!result.ok) return;
    }
    undoToast(`Horario del ${DAYS[source].toLowerCase()} copiado a ${targets.length} días`, () => {
      void (async () => {
        for (const b of before) await save(b.i, { ranges: b.ranges });
      })();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3 px-1">
        <p className="text-[13px] text-secondary">
          Cada día puede tener varios horarios. Por ejemplo, de 09:00 a 13:00 y de 16:00 a 20:00 para cortar al mediodía.
          Los cambios se guardan solos.
        </p>
        <span aria-live="polite" className="flex min-h-5 shrink-0 items-center gap-1 text-xs font-semibold text-mint-ink">
          {status === "saving" && <span className="text-secondary">Guardando…</span>}
          {status === "saved" && (
            <>
              <Check size={14} aria-hidden /> Guardado
            </>
          )}
        </span>
      </div>
      {source !== undefined && (
        <button
          type="button"
          onClick={() => void copyToAll()}
          className="tap flex min-h-11 items-center gap-1.5 self-start rounded-full bg-surface-low px-4 text-[13px] font-semibold text-ink hover:bg-surface-high"
        >
          <Copy size={14} aria-hidden /> Copiar el {DAYS[source].toLowerCase()} a todos los días
        </button>
      )}
      <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
        {ORDER.map((i) => {
          const day = hours[i];
          const ranges = dayRanges(day);
          return (
            <li key={i} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[15px] font-medium">{DAYS[i]}</span>
                <Switch checked={!day.closed} onChange={(open) => void save(i, { closed: !open })} label={`${DAYS[i]} abierto`} />
              </div>
              {day.closed ? (
                <p className="text-[13px] text-secondary">Cerrado</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ranges.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <select aria-label={`Apertura ${DAYS[i]} franja ${idx + 1}`} value={r.open} onChange={(e) => setRange(i, idx, { open: e.target.value })} className="field flex-1 px-2 py-2 text-center text-sm">
                        {TIMES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      <span className="text-[13px] text-secondary">a</span>
                      <select aria-label={`Cierre ${DAYS[i]} franja ${idx + 1}`} value={r.close} onChange={(e) => setRange(i, idx, { close: e.target.value })} className="field flex-1 px-2 py-2 text-center text-sm">
                        {TIMES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      {ranges.length > 1 ? (
                        <button type="button" onClick={() => removeRange(i, idx)} className="tap grid size-11 shrink-0 place-items-center rounded-full text-secondary hover:bg-surface-low" aria-label={`Quitar franja ${idx + 1} de ${DAYS[i]}`}>
                          <X size={16} />
                        </button>
                      ) : (
                        <span className="size-11 shrink-0" />
                      )}
                    </div>
                  ))}
                  {ranges.length < MAX_RANGES_PER_DAY && (
                    <button type="button" onClick={() => addRange(i)} className="tap flex min-h-11 items-center gap-1 self-start text-[13px] font-semibold text-primary">
                      <Plus size={14} /> Agregar horario
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const OAUTH_MESSAGES: Record<string, { text: string; tone: "success" | "error" }> = {
  conectado: { text: "Mercado Pago conectado", tone: "success" },
  cancelado: { text: "Cancelaste la conexión con Mercado Pago", tone: "error" },
  error: { text: "No se pudo conectar Mercado Pago. Probá de nuevo.", tone: "error" },
  "no-disponible": { text: "El cobro con Mercado Pago todavía no está habilitado", tone: "error" },
};

/**
 * Conexión con Mercado Pago del local.
 *
 * El dueño toca "Conectar", autoriza a BarberApp en Mercado Pago con la cuenta de la barbería y
 * vuelve acá. No copia ninguna credencial: el token lo recibe el servidor y nunca llega al
 * navegador. Las señas se cobran a nombre de esa cuenta.
 */
function PaymentsPanel() {
  const ready = useAppStore((s) => s.integrations.mercadopagoReady);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = async () => {
    const res = await fetch("/api/settings/payments", { credentials: "same-origin", cache: "no-store" });
    if (res.ok) setStatus((await res.json()) as PaymentStatus);
  };

  useEffect(() => {
    void load().catch(() => undefined);
    // Vuelta del OAuth (?mp=conectado|cancelado|error): se avisa y se limpia la URL.
    const params = new URLSearchParams(window.location.search);
    const outcome = OAUTH_MESSAGES[params.get("mp") ?? ""];
    if (!outcome) return;
    toast(outcome.text, outcome.tone);
    params.delete("mp");
    const rest = params.toString();
    window.history.replaceState(null, "", rest ? `${window.location.pathname}?${rest}` : window.location.pathname);
    // La conexión cambió en el servidor: se trae el estado nuevo (mercadopagoReady).
    void useAppStore.getState().refresh(true);
  }, []);

  const connected = status ? status.connected : ready;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-caps text-secondary">Mercado Pago</h2>
      <div className={cn("rounded-2xl p-4", connected ? "bg-mint" : "bg-surface-lowest shadow-xs")}>
        <p className={cn("text-[15px] font-semibold", connected && "text-mint-ink")}>
          {connected ? "Cobro online activo" : "Cobro online sin conectar"}
        </p>
        <p className={cn("mt-1 text-[13px]", connected ? "text-mint-ink" : "text-secondary")}>
          {connected
            ? "Los clientes pagan la seña en Mercado Pago y la plata entra directo a tu cuenta."
            : "Conectá la cuenta de Mercado Pago de la barbería para cobrar las señas online. Mientras tanto, la app ofrece solo transferencia y efectivo."}
        </p>
        {connected && status?.linkedAt && (
          <p className="mt-2 text-[13px] text-mint-ink">Conectado el {new Date(status.linkedAt).toLocaleDateString("es-AR")}</p>
        )}
        {connected && status && !status.canReceiveWebhooks && (
          <p className="mt-2 text-[13px] font-semibold text-error">
            Falta configurar las notificaciones de pago en el servidor: las señas no se van a acreditar solas.
          </p>
        )}
      </div>

      {connected ? (
        <button type="button" onClick={() => setConfirming(true)} className="tap btn-destructive">
          Desconectar Mercado Pago
        </button>
      ) : status && !status.available ? (
        <p className="text-[13px] text-secondary">El cobro con Mercado Pago todavía no está habilitado en esta instalación.</p>
      ) : (
        <>
          {/* Navegación completa: el OAuth sale a Mercado Pago y vuelve a esta pantalla. */}
          <a href="/api/payments/oauth/start" className="tap btn-primary text-center">
            Conectar con Mercado Pago
          </a>
          <p className="text-[13px] text-secondary">
            Te lleva a Mercado Pago para que inicies sesión con la cuenta de la barbería y autorices a BarberApp a crear los
            cobros de las señas. No hace falta copiar ninguna clave.
          </p>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Desconectar Mercado Pago?"
        description="Tus clientes ya no van a poder pagar la seña online. Las señas que ya se cobraron no cambian."
        confirmLabel="Desconectar"
        destructive
        onConfirm={async () => {
          const result = await disconnectMercadopago();
          setConfirming(false);
          if (result.ok) await load().catch(() => undefined);
        }}
      />
    </div>
  );
}

interface PaymentStatus {
  connected: boolean;
  available: boolean;
  canReceiveWebhooks: boolean;
  linkedAt?: string;
  expiresAt?: string;
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
        <h2 className="text-caps text-secondary">WhatsApp · avanzado (opcional)</h2>
        <IntegrationGuideButton guide="whatsapp" />
      </div>
      {/* Es configuración de desarrollador (WhatsApp Cloud API de Meta): se presenta como opcional, no como falta. */}
      <div className={cn("rounded-2xl p-4", ready ? "bg-mint" : "bg-surface-low")}>
        <p className={cn("text-[15px] font-semibold", ready && "text-mint-ink")}>
          {ready ? "WhatsApp conectado" : "WhatsApp sin configurar"}
        </p>
        <p className={cn("mt-1 text-[13px]", ready ? "text-mint-ink" : "text-secondary")}>
          {ready
            ? "Los códigos de verificación salen desde tu número."
            : "Opcional. Con una cuenta de WhatsApp Cloud API de Meta, los códigos para recuperar la contraseña salen desde tu número. Si no la tenés, escribinos y te ayudamos."}
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
