import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { TERMS } from "@/components/legal/terms";

export const metadata: Metadata = { title: "Términos y condiciones · BarberApp" };

export default function TerminosPage() {
  return <LegalDoc {...TERMS} />;
}
