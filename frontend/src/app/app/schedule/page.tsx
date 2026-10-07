import type { Metadata } from "next";

import { VehicleSchedule } from "@/components/vehicle-schedule";

export const metadata: Metadata = {
  title: "Daily schedule | KakiMETch",
  description: "Human-reviewed vehicle allocation for Loving Heart MET trips.",
};

export default function SchedulePage() {
  return <VehicleSchedule />;
}
