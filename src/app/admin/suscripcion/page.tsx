"use client";

import { CheckCircle2, CreditCard, MessageCircle, ReceiptText } from "lucide-react";
import * as m from "motion/react-m";
import { useEffect, useState } from "react";
import { refreshBillingStatus } from "@/components/billing/useBillingStatus";
import { Page } from "@/components/motion/Page";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { EmptyState, Section, SkeletonList } from "@/components/ui/States";
import {
  BILLING_METHOD_LABEL,
  BILLING_STATUS_LABEL,
  subscriptionActive,
  type BillingInfo,
  type BillingStatus,
} from "@/lib/billing";
import { cn } from "@/lib/cn";
import { money, whatsappLink } from "@/lib/format";
import { listItem } from "@/lib/motion";
import { SUPPORT_WHATSAPP, TRIAL_LABEL } from "@/lib/plan";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

const fullDate = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

const STATUS_TONE: Record<BillingStatus, string> = {
  trial: "bg-primary-fixed text-primary",
  active: "bg-mint text-mint-ink",
  past_due: "bg-amber-container text-amber-ink",
  suspended: "bg-error-container text-error",
};

/** Titular de la tarjeta de estado: lo que el dueño necesita saber en una línea. */
function headline(info: BillingInfo): string {
  const days = Math.max(0, info.daysLeft);
  switch (info.status) {
    case "trial":
      return days <= 1 ? "Tu prueba gratis termina hoy" : `Te quedan ${days} días de prueba`;
    case "active":
      return `Pagada hasta el ${fullDate(info.paidUntil ?? info.nextRenewal)}`;
    case "past_due":
      return `Vencida: se suspende el ${fullDate(info.suspendsAt)}`;
    case "suspended":
      return "Agenda suspendida";
  }
}

async function call(url: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/**
 * Suscripción del local a BarberApp: estado, precio y cómo pagar.
 * El precio lo calcula el servidor (2 cortes del local); acá solo se explica de dónde sale.
 */
export default function SuscripcionPage() {
  const shopName = useAppStore((s) => s.session?.shop?.name ?? "mi barbería");
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = async () => {
    const { ok, data } = await call("/api/billing");
    if (ok) {
      setInfo(data as unknown as BillingInfo);
      setError(null);
    } else setError(String(data.error ?? "No pudimos cargar la suscripción."));
  };

  useEffect(() => {
    void load().catch(() => setError("Sin conexión. Probá de nuevo."));
    // Vuelta de Mercado Pago: el débito se confirma por el webhook, unos segundos después.
    const params = new URLSearchParams(window.location.search);
    if (params.get("mp")) {
      toast("Listo. Apenas Mercado Pago lo confirme, se actualiza acá.", "success");
      params.delete("mp");
      const rest = params.toString();
      window.history.replaceState(null, "", rest ? `${window.location.pathname}?${rest}` : window.location.pathname);
      const timer = window.setTimeout(() => {
        void load().catch(() => undefined);
        void refreshBillingStatus();
      }, 5000);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const subscribe = async () => {
    if (!info) return;
    if (!info.ownerEmail && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError("Ingresá el email de tu cuenta de Mercado Pago");
      return;
    }
    setEmailError(undefined);
    setBusy(true);
    try {
      const { ok, data } = await call("/api/billing/subscribe", info.ownerEmail ? {} : { email: email.trim() });
      if (ok && typeof data.initPoint === "string") {
        // Navegación completa: se autoriza en Mercado Pago y vuelve a esta pantalla.
        window.location.href = data.initPoint;
        return;
      }
      toast(String(data.error ?? "No pudimos abrir Mercado Pago. Probá de nuevo."), "error");
    } catch {
      toast("Sin conexión. Probá de nuevo.", "error");
    }
    setBusy(false);
  };

  const cancel = async () => {
    const { ok, data } = await call("/api/billing/cancel", {});
    setConfirmCancel(false);
    if (ok) {
      setInfo(data as unknown as BillingInfo);
      toast("Cancelaste el débito automático.", "success");
      void refreshBillingStatus();
    } else toast(String(data.error ?? "No pudimos cancelar. Probá de nuevo."), "error");
  };

  if (error && !info) {
    return (
      <Page className="px-5 pb-6 pt-1">
        <EmptyState icon={CreditCard} title="Suscripción" text={error} />
      </Page>
    );
  }
  if (!info) return <SkeletonList rows={3} />;

  const subscribed = subscriptionActive(info.subscription);
  const pending = info.subscription?.status === "pending";
  const transferLink = whatsappLink(SUPPORT_WHATSAPP, `Hola, quiero pagar la suscripción de BarberApp de ${shopName} por transferencia.`);
  const flooredByMin = !info.reference || info.reference.price * 2 < info.minPrice;

  return (
    <Page className="gap-5 px-5 pb-6 pt-1">
      <section className="rounded-3xl bg-surface-lowest p-5 shadow-xs">
        <span className={cn("chip", STATUS_TONE[info.status])}>{BILLING_STATUS_LABEL[info.status]}</span>
        <p className="mt-2 text-[22px] font-bold leading-tight tracking-tight">{headline(info)}</p>
        <p className="mt-1 text-[13px] text-secondary">
          {info.exempt
            ? "Barbería de demostración: no se cobra."
            : info.status === "trial"
              ? `La prueba de ${TRIAL_LABEL} termina el ${fullDate(info.trialEndsAt)}. No hace falta tarjeta para probar.`
              : info.status === "suspended"
                ? "Tus clientes no pueden reservar y el equipo no puede cargar turnos. No se borró nada: apenas pagues, todo vuelve como estaba."
                : info.status === "past_due"
                  ? "Todavía podés usar todo normalmente. Si no se paga, la agenda se suspende."
                  : subscribed
                    ? `Se renueva sola el ${fullDate(info.nextRenewal)}.`
                    : "Cuando venza, renovala para seguir sin cortes."}
        </p>
      </section>

      <Section title="Precio">
        <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
          <p className="text-3xl font-bold tracking-tight tabular-nums">
            {money(info.price)}
            <span className="text-[15px] font-medium text-secondary"> / mes</span>
          </p>
          <p className="mt-1 text-[13px] text-secondary">
            {info.reference
              ? `El valor de 2 cortes de tu barbería (${info.reference.name}: ${money(info.reference.price)}).`
              : "El valor de 2 cortes de tu barbería. Todavía no cargaste servicios."}
            {flooredByMin && ` Con un mínimo de ${money(info.minPrice)}.`}
          </p>
        </div>
      </Section>

      {!info.exempt && (
        <Section title="Cómo pagar">
          <div className="flex flex-col gap-3">
            {subscribed ? (
              <div className="rounded-2xl bg-mint p-4">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-mint-ink">
                  <CheckCircle2 size={18} aria-hidden /> Débito automático activo
                </p>
                <p className="mt-1 text-[13px] text-mint-ink">
                  Mercado Pago te cobra {money(info.price)} todos los meses. Próximo cobro: {fullDate(info.nextRenewal)}.
                </p>
              </div>
            ) : info.mercadopagoAvailable ? (
              <>
                {pending && (
                  <p className="rounded-2xl bg-amber-container p-3 text-[13px] text-amber-ink">
                    Empezaste la suscripción pero falta autorizarla en Mercado Pago. Tocá el botón para terminarla.
                  </p>
                )}
                {!info.ownerEmail && (
                  <Field label="Email de tu cuenta de Mercado Pago" htmlFor="billing-email" error={emailError}>
                    <input
                      id="billing-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      className="field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vos@ejemplo.com"
                    />
                  </Field>
                )}
                <button type="button" onClick={subscribe} disabled={busy} className="tap btn-primary">
                  <CreditCard size={18} aria-hidden />
                  {busy ? "Abriendo Mercado Pago…" : "Suscribirme con Mercado Pago"}
                </button>
                <p className="text-[13px] text-secondary">
                  Autorizás una vez y se debita solo todos los meses.
                  {info.status === "trial" && " El primer cobro es cuando termina la prueba: no perdés días."}
                </p>
              </>
            ) : (
              <p className="rounded-2xl bg-surface-lowest p-4 text-[13px] text-secondary shadow-xs">
                El pago con Mercado Pago todavía no está habilitado. Pagá por transferencia y escribinos.
              </p>
            )}

            <a href={transferLink} target="_blank" rel="noopener noreferrer" className="tap row card">
              <MessageCircle size={19} className="text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Pagar por transferencia</span>
                <span className="block text-[13px] text-secondary">Escribinos por WhatsApp, te pasamos los datos y lo acreditamos.</span>
              </span>
            </a>

            {info.subscription && info.subscription.status !== "cancelled" && (
              <button type="button" onClick={() => setConfirmCancel(true)} className="tap btn-destructive">
                Cancelar débito automático
              </button>
            )}
          </div>
        </Section>
      )}

      <Section title="Pagos">
        {info.payments.length === 0 ? (
          <EmptyState icon={ReceiptText} title="Sin pagos todavía" text="Acá vas a ver cada cuota que se acredite." className="py-6" />
        ) : (
          <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
            {info.payments.map((p, i) => (
              <m.li key={p.id} custom={i} variants={listItem} initial="hidden" animate="show" className="row">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{fullDate(p.createdAt)}</span>
                  <span className="block text-[13px] text-secondary">
                    {BILLING_METHOD_LABEL[p.method]} · cubre hasta el {fullDate(p.paidUntil)}
                  </span>
                </span>
                <span className="text-[15px] font-semibold tabular-nums">{money(p.amount)}</span>
              </m.li>
            ))}
          </ul>
        )}
      </Section>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="¿Cancelar el débito automático?"
        description={
          info.paidUntil
            ? `No se te cobra más. Lo que ya pagaste sigue valiendo hasta el ${fullDate(info.paidUntil)}.`
            : "No se te cobra más. Para seguir usando la agenda después de la prueba, vas a tener que pagar de otra forma."
        }
        confirmLabel="Cancelar débito"
        cancelLabel="Volver"
        busyLabel="Cancelando…"
        destructive
        onConfirm={cancel}
      />
    </Page>
  );
}
