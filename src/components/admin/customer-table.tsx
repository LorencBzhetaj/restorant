"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";

interface Row {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  total: number;
  completed: number;
  covers: number;
  lastVisit: Date | string | null;
}

export function CustomerTable({ customers }: { customers: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const filtered = customers.filter((c) => `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">All guests</h2>
          <p className="text-sm text-muted-foreground">{customers.length} guests</p>
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone…" className="pl-9" />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guest</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-center">Visits</TableHead>
            <TableHead className="text-center">Completed</TableHead>
            <TableHead className="text-center">Guests</TableHead>
            <TableHead>Last visit</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((c) => (
            <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/customers/${c.id}`)}>
              <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
              <TableCell className="text-muted-foreground">{c.phone}</TableCell>
              <TableCell className="text-center">{c.total}</TableCell>
              <TableCell className="text-center">{c.completed}</TableCell>
              <TableCell className="text-center">{c.covers}</TableCell>
              <TableCell className="text-muted-foreground">{c.lastVisit ? formatDate(c.lastVisit) : "—"}</TableCell>
              <TableCell className="text-right"><ChevronRight className="size-4 text-muted-foreground" /></TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No guests match “{q}”.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
