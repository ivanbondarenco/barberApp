"use client";

import { Search, Smartphone, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { longDate } from "@/lib/dates";
import { initials, money, onlyDigits, paymentMethodLabel, phoneKey } from "@/lib/format";
import { depositPercent, serviceDepositRate, splitDeposit } from "@/lib/pricing";
import type { Appointment, ClientProfile, PaymentMethod } from "@/lib/types";
import { bookAppointment, updateAppointment } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

interface AppointmentFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** Si viene, se edita ese turno; si no, se crea uno manual. */
  appointment?: Appointment;
  /** Cliente ya elegido (por ejemplo, desde su ficha). */
  prefill?: { clientId?: string; clientName: string; clientPhone: string };
  initialDate?: string;
  onCreated?: (id: string) => void;
}

const METHODS: PaymentMethod[] = ["efectivo", "mercadopago", "transferencia"];

/**
 * De dónde sale el cliente del turno: una ficha que ya existe (tenga o no la app), o uno nuevo
 * que se carga con el nombre (y el celular, si lo dicta).
 */
type ClientMode = "ficha" | "sin_app";

/** Cuántas fichas se listan de una: con el buscador alcanza para llegar al resto. */
const MAX_RESULTS = 25;

/** Alta y modificación de turnos desde el local. */
export function AppointmentFormSheet({ open, onClose, appointment, prefill, initialDate, onCreated }: AppointmentFormSheetProps) {
  const services = useAppStore((s) => s.services);
  const barbers = useAppStore((s) => s.barbers);
  const clients = useAppStore((s) => s.clients);
  const session = useAppStore((s) => s.session);
  /** El barbero agenda solo en su sillón: el servidor rechaza otro, así que ni se ofrece. */
  const ownBarberId = session?.role === "barbero" ? session.barberId : undefined;
  const editing = !!appointment;

  const [clientMode, setClientMode] = useState<ClientMode>("ficha");
  const [clientId, setClientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [depositPaid, setDepositPaid] = useState(false);
  const depositRate = useAppStore((s) => s.depositSettings.rate);
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** En edición, el horario solo cambia si se pide (un turno en curso puede tener horario ya pasado). */
  const [changeSchedule, setChangeSchedule] = useState(true);

  const activeServices = services.filter((s) => s.active || s.id === appointment?.serviceId);
  const activeBarbers = barbers.filter((b) => b.active || b.id === appointment?.barberId);

  useEffect(() => {
    if (!open) return;
    // Un nombre que llega de afuera sin ficha (un turno viejo) se sigue cargando a mano.
    const preselected = prefill?.clientId ?? clients.find((c) => phoneKey(c.phone) === phoneKey(prefill?.clientPhone ?? ""))?.id ?? null;
    setClientMode(prefill && !preselected ? "sin_app" : "ficha");
    setClientId(preselected);
    setSearch("");
    setClientName(appointment?.clientName ?? prefill?.clientName ?? "");
    setClientPhone(appointment?.clientPhone ?? prefill?.clientPhone ?? "");
    setServiceId(appointment?.serviceId ?? activeServices[0]?.id ?? "");
    setBarberId(appointment?.barberId ?? ownBarberId ?? activeBarbers[0]?.id ?? "");
    setDate(appointment?.date ?? initialDate ?? null);
    setTime(appointment?.time ?? null);
    setNotes(appointment?.notes ?? "");
    setDepositPaid(false);
    setMethod("efectivo");
    setError(null);
    setChangeSchedule(!appointment);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const service = services.find((s) => s.id === serviceId);
  const selected = clients.find((c) => c.id === clientId);

  /** Fichas que coinciden con lo que se escribió, por nombre o por teléfono. */
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = onlyDigits(search);
    const matches = clients.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || (digits.length >= 3 && onlyDigits(c.phone).includes(digits)),
    );
    return matches.sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, search]);

  const onDate = useCallback((d: string) => setDate(d), []);
  const onTime = useCallback((t: string | null) => setTime(t), []);

  const submit = async () => {
    setError(null);
    if (editing && !changeSchedule) {
      setSaving(true);
      const result = await updateAppointment(appointment.id, { serviceId, notes });
      setSaving(false);
      if (result.ok) onClose();
      return;
    }
    if (!service || !date || !time) return setError("Elegí servicio, día y horario");
    if (editing) {
      setSaving(true);
      const result = await updateAppointment(appointment.id, { serviceId, barberId, date, time, notes });
      setSaving(false);
      if (result.ok) onClose();
      return;
    }
    // Con ficha van el id y sus datos; sin app va solo el nombre (y el celular si lo dictó).
    let who: { clientId?: string; clientName: string; clientPhone: string };
    if (clientMode === "ficha") {
      if (!selected) return setError("Elegí un cliente de la lista o cargalo como cliente nuevo");
      who = { clientId: selected.id, clientName: selected.name, clientPhone: selected.phone };
    } else {
      who = { clientName, clientPhone };
    }
    const name = who.clientName;
    setSaving(true);
    const result = await bookAppointment({
      ...who,
      serviceId,
      barberId,
      date,
      time,
      notes,
      depositMethod: method,
      depositPaid,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    toast(`Turno agendado · ${name.split(" ")[0]} ${time} hs`, "success");
    onCreated?.(result.id);
    onClose();
  };

  const existingClient = clients.find((c) => phoneKey(c.phone) === phoneKey(clientPhone));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Editar turno" : "Nuevo turno"}
      subtitle={editing ? appointment.clientName : "Carga manual desde el local"}
      footer={
        <button type="button" onClick={submit} disabled={saving || !activeServices.length} className="tap btn-primary">
          {saving ? "Guardando…" : editing ? "Guardar cambios" : time ? `Agendar ${time} hs` : "Agendar turno"}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {!editing && (
          <div className="flex flex-col gap-3">
            <Segmented
              label="Tipo de cliente"
              value={clientMode}
              onChange={(v) => {
                setClientMode(v);
                setError(null);
              }}
              size="sm"
              options={[
                { value: "ficha", label: "Buscar cliente" },
                { value: "sin_app", label: "Cliente nuevo" },
              ]}
            />

            {clientMode === "ficha" ? (
              selected ? (
                <div className="row rounded-2xl bg-surface-low">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary">
                    {initials(selected.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{selected.name}</span>
                    <span className="block text-[13px] text-secondary">{selected.phone}</span>
                  </span>
                  <button type="button" onClick={() => setClientId(null)} className="min-h-11 px-2 text-sm font-semibold text-primary">
                    Cambiar
                  </button>
                </div>
              ) : (
                <ClientSearch
                  value={search}
                  onChange={setSearch}
                  results={results}
                  onPick={(c) => {
                    setClientId(c.id);
                    setError(null);
                  }}
                  onCreate={(text) => {
                    // Lo que se buscó pasa al alta: si eran números, es el celular; si no, el nombre.
                    const isPhone = onlyDigits(text).length >= 6 && !/[a-záéíóúñ]/i.test(text);
                    setClientMode("sin_app");
                    setClientName(isPhone ? "" : text.trim());
                    setClientPhone(isPhone ? text.trim() : "");
                    setError(null);
                  }}
                />
              )
            ) : (
              <>
                <Field label="Cliente" htmlFor="ap-name">
                  <input
                    id="ap-name"
                    className="field"
                    placeholder="Nombre y apellido"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Celular (opcional)"
                  htmlFor="ap-phone"
                  hint={
                    existingClient
                      ? `Cliente existente: ${existingClient.name}`
                      : clientPhone.trim()
                        ? "Se crea la ficha del cliente"
                        : "Sin celular queda solo en la agenda: no recibe recordatorios"
                  }
                >
                  <input
                    id="ap-phone"
                    className="field"
                    inputMode="tel"
                    placeholder="+54 9 11 …"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>
        )}

        {activeServices.length === 0 && (
          <p className="rounded-2xl bg-error-container/50 px-4 py-3 text-[13px] text-ink">
            Todavía no cargaste servicios. Creálos en{" "}
            <Link href="/admin/servicios?nuevo=servicio" onClick={onClose} className="font-semibold text-primary underline underline-offset-2">
              Catálogo › Servicios
            </Link>
            , con tu precio y tu duración, y después podés agendar.
          </p>
        )}

        <div className={cn("grid gap-3", ownBarberId ? "grid-cols-1" : "grid-cols-2")}>
          <Field label="Servicio" htmlFor="ap-service">
            <select id="ap-service" className="field px-3" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {activeServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {!ownBarberId && (
          <Field label="Barbero" htmlFor="ap-barber">
            <select
              id="ap-barber"
              className="field px-3"
              value={barberId}
              onChange={(e) => {
                setBarberId(e.target.value);
                if (editing) setChangeSchedule(true);
              }}
            >
              {activeBarbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          )}
        </div>

        {editing && !changeSchedule ? (
          <div className="row rounded-2xl bg-surface-low">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-secondary">Día y hora</span>
              <span className="block text-[15px] font-semibold">
                <span className="capitalize">{longDate(appointment.date)}</span> · {appointment.time} hs
              </span>
            </span>
            <button type="button" onClick={() => setChangeSchedule(true)} className="min-h-11 px-2 text-sm font-semibold text-primary">
              Cambiar
            </button>
          </div>
        ) : service && barberId && (
          <SlotPicker
            barberId={barberId}
            durationMin={service.durationMin}
            date={date}
            time={time}
            onDateChange={onDate}
            onTimeChange={onTime}
            excludeAppointmentId={appointment?.id}
          />
        )}

        <Field label="Nota técnica (opcional)" htmlFor="ap-notes">
          <input id="ap-notes" className="field" maxLength={160} placeholder="Ej: sensibilidad en nuca" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {!editing && service && (
          <div className="rounded-2xl bg-surface-low p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Seña ya recibida</p>
                <p className="text-xs text-secondary">
                  {depositPercent(serviceDepositRate(service, depositRate))} · {money(splitDeposit(service.price, serviceDepositRate(service, depositRate)).deposit)}
                </p>
              </div>
              <Switch checked={depositPaid} onChange={setDepositPaid} label="Seña recibida" />
            </div>
            {depositPaid && (
              <div className="mt-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Medio de pago de la seña">
                {METHODS.map((mth) => (
                  <button
                    key={mth}
                    type="button"
                    role="radio"
                    aria-checked={method === mth}
                    onClick={() => setMethod(mth)}
                    className={cn(
                      "tap min-h-11 rounded-xl px-1 text-xs font-semibold transition-colors",
                      method === mth ? "bg-primary text-on-primary" : "bg-surface-lowest text-secondary",
                    )}
                  >
                    {paymentMethodLabel[mth]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="field-error mt-0 rounded-xl bg-error-container/50 px-3 py-2">{error}</p>}
      </div>
    </Sheet>
  );
}

/** Buscador de fichas: el desplegable con el que el local elige a quién le agenda. */
function ClientSearch({
  value,
  onChange,
  results,
  onPick,
  onCreate,
}: {
  value: string;
  onChange: (value: string) => void;
  results: ClientProfile[];
  onPick: (client: ClientProfile) => void;
  /** Sin coincidencias: pasa lo escrito al alta de un cliente nuevo. */
  onCreate: (text: string) => void;
}) {
  const visible = results.slice(0, MAX_RESULTS);
  return (
    <div className="flex flex-col gap-2">
      <Field label="Buscar cliente" htmlFor="ap-client-search">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" aria-hidden />
          <input
            id="ap-client-search"
            className="field pl-9"
            placeholder="Nombre o celular"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
          />
        </div>
      </Field>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-low px-4 py-4 text-center">
          <p className="text-[13px] text-secondary">No encontramos esa ficha.</p>
          <button type="button" onClick={() => onCreate(value)} className="tap btn-secondary min-h-11 max-w-full px-4 text-[14px]">
            <UserPlus size={16} aria-hidden />
            <span className="truncate">{value.trim() ? `Crear “${value.trim()}” como cliente nuevo` : "Cargar cliente nuevo"}</span>
          </button>
        </div>
      ) : (
        <ul className="max-h-56 divide-y divide-surface-high overflow-y-auto overscroll-contain rounded-2xl bg-surface-low">
          {visible.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(c)} className="tap row w-full text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary">
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{c.name}</span>
                  <span className="block text-[13px] text-secondary">{c.phone}</span>
                </span>
                {c.hasAccount ? (
                  <span className="chip shrink-0 gap-1 bg-mint py-1 text-[11px] text-mint-ink">
                    <Smartphone size={12} aria-hidden /> Con app
                  </span>
                ) : (
                  <UserRound size={16} className="shrink-0 text-secondary" aria-label="Sin cuenta en la app" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.length > visible.length && (
        <p className="px-1 text-xs text-muted">
          {results.length - visible.length} fichas más. Escribí el nombre o el celular para encontrarla.
        </p>
      )}
    </div>
  );
}
