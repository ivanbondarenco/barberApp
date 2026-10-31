"use client";

import { useState } from "react";
import { ShopSignupForm } from "@/components/auth/ShopSignupForm";
import { PublicShell } from "@/components/layout/PublicShell";

/** Alta de una barbería nueva, como página (link directo). La landing la abre en un modal. */
export default function NuevaBarberiaPage() {
  const [busy, setBusy] = useState(false);

  return (
    <PublicShell
      title="Registrar mi barbería"
      fallbackHref="/"
      footer={
        <button type="submit" form="shop-form" disabled={busy} className="tap btn-primary">
          {busy ? "Creando…" : "Crear barbería"}
        </button>
      }
    >
      <div className="px-5 pb-6 pt-2">
        <ShopSignupForm formId="shop-form" onSubmittingChange={setBusy} />
      </div>
    </PublicShell>
  );
}
