import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { getRestaurant, getActiveTables } from "@/server/data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, tables] = await Promise.all([getRestaurant(), getActiveTables()]);

  const tableOptions = tables.map((t) => ({ id: t.id, name: t.name, seats: t.seats, section: t.section }));

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <AdminSidebar shopName={settings.name} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <AdminTopbar restaurantName={settings.name} tables={tableOptions} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
