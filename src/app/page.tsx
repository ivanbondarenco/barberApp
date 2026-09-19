"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor, ScreenLoader } from "@/components/layout/RoleGuard";
import { useAppStore, useHydrated } from "@/store/useAppStore";

export default function Home() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useAppStore((s) => s.session);
  const synced = useAppStore((s) => s.synced);

  useEffect(() => {
    void useAppStore.getState().refresh(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !synced) return;
    router.replace(session ? homeFor(session.role) : "/auth/login");
  }, [hydrated, synced, session, router]);

  return <ScreenLoader />;
}
