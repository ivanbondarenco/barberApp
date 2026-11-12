import { Scissors } from "lucide-react";
import { HomeLink } from "@/components/landing/RecoveryLinks";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col items-center justify-center gap-4 bg-surface px-6 text-center shadow-md lg:max-w-none lg:shadow-none">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
        <Scissors size={26} />
      </span>
      <div>
        <p className="section-title">Error 404</p>
        <h1 className="text-xl font-bold tracking-tight">Esta página no existe</h1>
        <p className="mt-1 text-sm text-secondary">El enlace puede estar vencido o el turno fue eliminado.</p>
      </div>
      <HomeLink className="tap btn-primary max-w-60">Volver al inicio</HomeLink>
    </div>
  );
}
