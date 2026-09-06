export const dynamic = "force-dynamic";

import { getCustomers } from "@/server/data";
import { CustomerTable } from "@/components/admin/customer-table";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const customers = await getCustomers();
  return <CustomerTable customers={customers} />;
}
