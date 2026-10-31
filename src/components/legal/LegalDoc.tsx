import type { ReactNode } from "react";
import { PublicShell } from "@/components/layout/PublicShell";

export const CONTACT_EMAIL = "argentinabarberapp@gmail.com";

export interface LegalSection {
  title: string;
  body: ReactNode;
}

/**
 * Términos y privacidad de BarberApp como servicio, para las barberías que lo contratan y sus
 * clientes. Las reglas de seña de cada local son otra cosa: viven en /politicas.
 */
export function LegalDoc({ title, updated, intro, sections }: { title: string; updated: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <PublicShell title={title} fallbackHref="/">
      <article className="flex flex-col gap-5 px-5 pb-10 pt-2 text-[14px] leading-relaxed text-secondary">
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
    </PublicShell>
  );
}
