import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { PRIVACY } from "@/components/legal/privacy";

export const metadata: Metadata = { title: "Política de privacidad · BarberApp" };

export default function PrivacidadPage() {
  return <LegalDoc {...PRIVACY} />;
}
