"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FloorMap, type FloorTable, type TableStatus } from "@/components/floor/floor-map";
import { upsertTable, toggleTableActive } from "@/server/actions";

interface TableRow {
  id: string;
  name: string;
  seats: number;
  section: string;
  shape: string;
  x: number; y: number; w: number; h: number;
  isActive: boolean;
  reservations: number;
}

const EMPTY = { name: "", seats: 2, section: "Main hall", shape: "square", x: 0, y: 0, w: 2, h: 2, isActive: true };

export function TablesManager({ tables }: { tables: TableRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const floorTables: FloorTable[] = tables.filter((t) => t.isActive).map((t) => ({ ...t }));
  const statuses: Record<string, TableStatus> = {};
  for (const t of floorTables) statuses[t.id] = "free";

  function openNew() { setEditId(null); setForm(EMPTY); setOpen(true); }
  function openEdit(t: TableRow) {
    setEditId(t.id);
    setForm({ name: t.name, seats: t.seats, section: t.section, shape: t.shape, x: t.x, y: t.y, w: t.w, h: t.h, isActive: t.isActive });
    setOpen(true);
  }

  function save() {
    if (!form.name.trim()) return toast.error("Name is required");
    startTransition(async () => {
      const res = await upsertTable(editId, form);
      if (res.ok) { toast.success(editId ? "Table updated" : "Table added"); setOpen(false); router.refresh(); }
      else toast.error(res.error);
    });
  }
  function toggle(t: TableRow, next: boolean) {
    startTransition(async () => {
      const res = await toggleTableActive(t.id, next);
      if (res.ok) router.refresh(); else toast.error(res.error);
    });
  }

  const totalSeats = tables.filter((t) => t.isActive).reduce((s, t) => s + t.seats, 0);

  return (
    <div className="space-y-6">
      {/* Floor preview */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Floor plan</h2>
            <p className="text-sm text-muted-foreground">{floorTables.length} active tables · {totalSeats} seats</p>
          </div>
          <Button size="sm" onClick={openNew}><Plus className="size-4" /> Add table</Button>
        </div>
        <FloorMap tables={floorTables} statuses={statuses} clickable="none" />
      </div>

      {/* Table list */}
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Bookings</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {t.seats}</span></TableCell>
                <TableCell className="text-muted-foreground">{t.section}</TableCell>
                <TableCell className="text-muted-foreground">{t.reservations}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={t.isActive} onCheckedChange={(v) => toggle(t, v)} disabled={pending} />
                    <span className="text-xs text-muted-foreground">{t.isActive ? "Active" : "Hidden"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)}><Pencil className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit table" : "Add table"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="T1" /></div>
              <div className="space-y-1.5"><Label>Seats</Label><Input type="number" min={1} value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Section</Label><Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Main hall" /></div>
              <div className="space-y-1.5">
                <Label>Shape</Label>
                <Select value={form.shape} onValueChange={(v) => setForm({ ...form, shape: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="round">Round</SelectItem>
                    <SelectItem value="rect">Rectangle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Position on floor (12 × 8 grid)</Label>
              <div className="grid grid-cols-4 gap-2">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <div key={k} className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase">{k}</span>
                    <Input type="number" min={k === "w" || k === "h" ? 1 : 0} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="cursor-default">Active (bookable)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {editId ? "Save changes" : "Add table"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
