import { Suspense } from "react";
import { BookingFlow } from "@/components/booking/BookingFlow";

export default function ReservarPage() {
  return (
    <Suspense>
      <BookingFlow />
    </Suspense>
  );
}
