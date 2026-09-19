"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col items-center justify-center gap-4 bg-surface px-6 text-center shadow-md lg:max-w-none lg:shadow-none">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container text-error">
        <TriangleAlert size={26} />
      </span>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Algo salió mal</h1>
        <p className="mt-1 text-sm text-secondary">No pudimos cargar esta pantalla. Tus turnos están a salvo.</p>
      </div>
      <div className="grid w-full max-w-72 grid-cols-2 gap-2">
        <button type="button" onClick={reset} className="tap btn-primary">
          <RefreshCw size={16} /> Reintentar
        </button>
        <Link href="/" className="tap btn-secondary">
          Inicio
        </Link>
      </div>
    </div>
  );
}
