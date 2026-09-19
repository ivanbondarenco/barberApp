"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DepositRulesPanel } from "@/components/admin/DepositRulesPanel";
import { Page } from "@/components/motion/Page";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { minutesToTime } from "@/lib/dates";
import { ease } from "@/lib/motion";
import { updateBusinessInfo, updateHours } from "@/store/actions";
import { useAppStore } from "@/store/useAppStore";

type Tab = "negocio" | "horarios" | "senas";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TIMES = Array.from({ length: 31 }, (_, i) => minutesToTime(7 * 60 + i * 30));

const infoSchema = z.object({
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
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: ease.enter } }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="flex flex-col gap-4">
          {tab === "negocio" && <BusinessForm />}
          {tab === "horarios" && <HoursEditor />}
          {tab === "senas" && <DepositRulesPanel />}
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
