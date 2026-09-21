"use client";

import { Check, Copy, QrCode, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { whatsappLink } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/store/useToast";

/**
 * El link público del local. Sin esto la barbería es invisible: es la única forma que tienen
 * sus clientes de llegar a reservar, así que va arriba de todo y se copia de un toque.
 */
export function ShopLinkCard() {
  const shop = useAppStore((s) => s.shop);
  const info = useAppStore((s) => s.businessInfo);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  // El origen solo se conoce en el navegador.
  useEffect(() => setOrigin(window.location.origin), []);

  if (!shop) return null;
  const url = `${origin}/b/${shop.slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copiado", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(url);
    }
  };

  const share = async () => {
    const text = `Reservá tu turno en ${info.name}: ${url}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: info.name, text, url });
        return;
      } catch {
        // El usuario canceló el diálogo del sistema: no es un error.
        return;
      }
    }
    window.open(whatsappLink("", text), "_blank", "noreferrer");
  };

  return (
    <div className="rounded-2xl bg-surface-lowest p-4 shadow-xs">
      <p className="flex items-center gap-1.5 text-[15px] font-medium">
        <QrCode size={16} className="text-primary" aria-hidden /> Tu link para compartir
      </p>
      <p className="mt-1 text-[13px] text-secondary">
        Mandáselo a tus clientes o poné el link en tu Instagram. Con eso reservan sin llamarte.
      </p>
      <p className="mt-3 truncate rounded-xl bg-surface-low px-3 py-2.5 font-mono text-[13px]" title={url}>
        {url || "…"}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void copy()} className="tap btn-secondary">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copiado" : "Copiar"}
        </button>
        <button type="button" onClick={() => void share()} className="tap btn-primary">
          <Share2 size={16} /> Compartir
        </button>
      </div>
    </div>
  );
}
