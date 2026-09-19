"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { longDate } from "@/lib/dates";
import { money, paymentMethodLabel, phoneKey } from "@/lib/format";
import { splitDeposit } from "@/lib/pricing";
import type { Appointment, PaymentMethod } from "@/lib/types";
import { bookAppointment, updateAppointment } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

interface AppointmentFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** Si viene, se edita ese turno; si no, se crea uno manual. */
  appointment?: Appointment;
  prefill?: { clientName: string; clientPhone: string };
  initialDate?: string;
  onCreated?: (id: string) => void;
}

const METHODS: PaymentMethod[] = ["efectivo", "mercadopago", "transferencia"];

/** Alta y modificación de turnos desde el local. */
export function AppointmentFormSheet({ open, onClose, appointment, prefill, initialDate, onCreated }: AppointmentFormSheetProps) {
  const services = useAppStore((s) => s.services);
  const barbers = useAppStore((s) => s.barbers);
  const clients = useAppStore((s) => s.clients);
  const editing = !!appointment;

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [depositPaid, setDepositPaid] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** En edición, el horario solo cambia si se pide (un turno en curso puede tener horario ya pasado). */
  const [changeSchedule, setChangeSchedule] = useState(true);

  const activeServices = services.filter((s) => s.active || s.id === appointment?.serviceId);
  const activeBarbers = barbers.filter((b) => b.active || b.id === appointment?.barberId);

  useEffect(() => {
    if (!open) return;
    setClientName(appointment?.clientName ?? prefill?.clientName ?? "");
    setClientPhone(appointment?.clientPhone ?? prefill?.clientPhone ?? "");
    setServiceId(appointment?.serviceId ?? activeServices[0]?.id ?? "");
    setBarberId(appointment?.barberId ?? activeBarbers[0]?.id ?? "");
    setDate(appointment?.date ?? initialDate ?? null);
    setTime(appointment?.time ?? null);
    setNotes(appointment?.notes ?? "");
    setDepositPaid(false);
    setMethod("efectivo");
    setError(null);
    setChangeSchedule(!appointment);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const service = services.find((s) => s.id === serviceId);
  const suggestions = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (editing || q.length < 2) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(q) && c.phone !== clientPhone).slice(0, 3);
  }, [clients, clientName, clientPhone, editing]);

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
    setSaving(true);
    if (editing) {
      const result = await updateAppointment(appointment.id, { serviceId, barberId, date, time, notes });
      setSaving(false);
      if (result.ok) onClose();
      return;
    }
    const result = await bookAppointment({
      clientName,
      clientPhone,
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
    toast(`Turno agendado · ${clientName.split(" ")[0]} ${time} hs`, "success");
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
        <button type="button" onClick={submit} disabled={saving} className="tap btn-primary">
          {saving ? "Guardando…" : editing ? "Guardar cambios" : time ? `Agendar ${time} hs` : "Agendar turno"}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {!editing && (
          <div className="flex flex-col gap-3">
            <Field label="Cliente" htmlFor="ap-name">
              <input id="ap-name" className="field" placeholder="Nombre y apellido" value={clientName} onChange={(e) => setClientName(e.target.value)} autoComplete="off" />
            </Field>
            {suggestions.length > 0 && (
              <div className="-mt-1 flex flex-wrap gap-1.5">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClientName(c.name);
                      setClientPhone(c.phone);
                    }}
                    className="chip bg-primary-fixed py-1 text-primary"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            <Field label="Celular" htmlFor="ap-phone" hint={existingClient ? `Cliente existente: ${existingClient.name}` : "Si no existe, se crea la ficha"}>
              <input id="ap-phone" className="field" inputMode="tel" placeholder="+54 9 11 …" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Servicio" htmlFor="ap-service">
            <select id="ap-service" className="field px-3" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {activeServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
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
        </div>

        {editing && !changeSchedule ? (
          <div className="row rounded-2xl bg-surface-low">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-secondary">Día y hora</span>
              <span className="block text-[15px] font-semibold">
                <span className="capitalize">{longDate(appointment.date)}</span> · {appointment.time} hs
              </span>
            </span>
            <button type="button" onClick={() => setChangeSchedule(true)} className="min-h-10 px-2 text-sm font-semibold text-primary">
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
                <p className="text-xs text-secondary">50% · {money(splitDeposit(service.price).deposit)}</p>
              </div>
              <Switch checked={depositPaid} onChange={setDepositPaid} label="Seña recibida" />
            </div>
            {depositPaid && (
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {METHODS.map((mth) => (
                  <button
                    key={mth}
                    type="button"
                    onClick={() => setMethod(mth)}
                    className={cn(
                      "rounded-xl py-2 text-xs font-semibold transition-colors",
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
