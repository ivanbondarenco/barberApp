import type { ReactNode } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { CONTACT_EMAIL } from "@/lib/plan";

export interface LegalSection {
  title: string;
  body: ReactNode;
}

export interface LegalDocContent {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}

/**
 * Términos y privacidad de BarberApp como servicio, para las barberías que lo contratan y sus
 * clientes. Las reglas de seña de cada local son otra cosa: viven en /politicas.
 *
 * El mismo texto se muestra como página (link directo) y en un modal (`LegalLink`).
 */
export function LegalDoc(doc: LegalDocContent) {
  return (
    <PublicShell title={doc.title} fallbackHref="/">
      <div className="px-5 pb-10 pt-2">
        <LegalBody {...doc} />
      </div>
    </PublicShell>
  );
}

export function LegalBody({ updated, intro, sections }: LegalDocContent) {
  return (
    <article className="flex flex-col gap-5 text-[14px] leading-relaxed text-secondary">
      <p className="text-xs text-muted">Última actualización: {updated}</p>
      <div className="text-[15px] text-ink">{intro}</div>
      {sections.map((section, i) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-[16px] font-bold text-ink">
            {i + 1}. {section.title}
          </h2>
          {section.body}
        </section>
      ))}
      <p className="rounded-2xl bg-surface-low p-4">
        ¿Dudas? Escribinos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </article>
  );
}
