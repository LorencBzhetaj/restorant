export const dynamic = "force-dynamic";

import { getRestaurant, getOpeningHours, getClosures, getSlotLimits } from "@/server/data";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, openingHours, closures, slotLimits] = await Promise.all([
    getRestaurant(),
    getOpeningHours(),
    getClosures(),
    getSlotLimits(),
  ]);

  return (
    <SettingsForm
      settings={settings}
      openingHours={openingHours.map((h) => ({ id: h.id, dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime }))}
      closures={closures.map((c) => ({ id: c.id, startDate: c.startDate.toISOString(), endDate: c.endDate.toISOString(), reason: c.reason }))}
      slotLimits={slotLimits.map((l) => ({ id: l.id, dayOfWeek: l.dayOfWeek, time: l.time, areaKind: l.areaKind, maxReservations: l.maxReservations, maxCovers: l.maxCovers }))}
    />
  );
}
