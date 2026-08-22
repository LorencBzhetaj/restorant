export const dynamic = "force-dynamic";

import { getRestaurant, getOpeningHours, getClosures } from "@/server/data";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, openingHours, closures] = await Promise.all([
    getRestaurant(),
    getOpeningHours(),
    getClosures(),
  ]);

  return (
    <SettingsForm
      settings={settings}
      openingHours={openingHours.map((h) => ({ id: h.id, dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime }))}
      closures={closures.map((c) => ({ id: c.id, startDate: c.startDate.toISOString(), endDate: c.endDate.toISOString(), reason: c.reason }))}
    />
  );
}
