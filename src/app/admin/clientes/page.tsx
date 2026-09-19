"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { BadgeCheck, Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientFormSheet } from "@/components/admin/ClientFormSheet";
import { NAV, Page } from "@/components/motion/Page";
import { Fab } from "@/components/ui/Fab";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/States";
import { buildClients } from "@/lib/clients";
import { dayNumber, dayShort } from "@/lib/dates";
import { initials, onlyDigits } from "@/lib/format";
import { listItem } from "@/lib/motion";
import { useAppStore } from "@/store/useAppStore";

type Filter = "todos" | "proximos" | "frecuentes";

export default function ClientesPage() {
  const clients = useAppStore((s) => s.clients);
  const appointments = useAppStore((s) => s.appointments);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [createOpen, setCreateOpen] = useState(false);

  const all = useMemo(() => buildClients(clients, appointments), [clients, appointments]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = onlyDigits(q);
    return all.filter(({ profile, nextAppointment, visits }) => {
      const match = !q || profile.name.toLowerCase().includes(q) || (digits.length >= 3 && onlyDigits(profile.phone).includes(digits));
      if (!match) return false;
      if (filter === "proximos") return !!nextAppointment;
      if (filter === "frecuentes") return visits >= 2;
      return true;
    });
  }, [all, query, filter]);

  return (
    <Page className="gap-3 px-5 pb-28 pt-1">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" aria-label="Buscar cliente" placeholder="Buscar por nombre o celular" value={query} onChange={(e) => setQuery(e.target.value)} className="field bg-surface-lowest pl-10" />
      </div>
      <Segmented
        label="Filtro"
        size="sm"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "todos", label: "Todos", count: all.length },
          { value: "proximos", label: "Con turno" },
          { value: "frecuentes", label: "Frecuentes" },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState icon={Users} title={query ? "Sin resultados" : "Sin clientes"} text={query ? "Probá con otro nombre o número." : "Creá una ficha con el botón +."} />
      ) : (
        <ul className="mt-1 divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-lowest shadow-xs">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map(({ profile, visits, nextAppointment }, i) => (
              <m.li key={profile.id} layout custom={i} variants={listItem} initial="hidden" animate="show" exit="exit">
                <Link href={`/admin/clientes/${profile.id}`} transitionTypes={[...NAV.forward]} className="row">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary">{initials(profile.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-[15px] font-medium">
                      <span className="truncate">{profile.name}</span>
                      {profile.hasAccount && <BadgeCheck size={14} className="shrink-0 text-primary" aria-label="Tiene cuenta" />}
                    </span>
                    <span className="block text-[13px] text-secondary">
                      {visits} {visits === 1 ? "visita" : "visitas"}
                    </span>
                  </span>
                  {nextAppointment && (
                    <span className="chip bg-primary-fixed text-primary">
                      {dayShort(nextAppointment.date)} {dayNumber(nextAppointment.date)}
                    </span>
                  )}
                </Link>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Fab label="Cliente" onClick={() => setCreateOpen(true)} />
      <ClientFormSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </Page>
  );
}
