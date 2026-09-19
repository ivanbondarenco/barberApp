import { WifiOff } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col items-center justify-center gap-4 bg-surface px-6 text-center lg:max-w-none">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
        <WifiOff size={26} />
      </span>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Estás sin conexión</h1>
        <p className="mt-1 text-sm text-secondary">
          Tus turnos guardados siguen disponibles. Reconectate para reservar o cobrar.
        </p>
      </div>
      <Link href="/" className="tap btn-primary max-w-60">
        Reintentar
      </Link>
    </div>
  );
}
