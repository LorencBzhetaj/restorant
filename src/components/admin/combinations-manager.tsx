"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, Pencil, Link2, Home, Trees, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { addCombination, updateCombination, toggleCombination, deleteCombination } from "@/server/actions";

interface AreaOpt { id: string; name: string; kind: string }
interface TableOpt { id: string; name: string; seats: number; areaId: string | null }
interface Member { tableId: string; tableName: string; seats: number }
interface Combination {
  id: string; name: string; areaId: string; areaName: string; areaKind: string;
  maxSeats: number; minSeats: number | null; priority: number; isActive: boolean; members: Member[];
}

export function CombinationsManager({
  areas, tables, combinations,
}: { areas: AreaOpt[]; tables: TableOpt[]; combinations: Combination[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [maxSeats, setMaxSeats] = useState(4);
  const [minSeats, setMinSeats] = useState<string>("");
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Only tables in the chosen area can be members (no Indoor/Outdoor crossing).
  const areaTables = useMemo(() => tables.filter((t) => t.areaId === areaId), [tables, areaId]);
  const selectedSeats = useMemo(
    () => memberIds.reduce((s, id) => s + (tables.find((t) => t.id === id)?.seats ?? 0), 0),
    [memberIds, tables],
  );

  function openNew() {
    setEditId(null);
    setAreaId(areas[0]?.id ?? "");
    setName("");
    setMemberIds([]);
    setMaxSeats(4);
    setMinSeats("");
    setPriority(0);
    setIsActive(true);
    setOpen(true);
  }
  function openEdit(c: Combination) {
    setEditId(c.id);
    setAreaId(c.areaId);
    setName(c.name);
    setMemberIds(c.members.map((m) => m.tableId));
    setMaxSeats(c.maxSeats);
    setMinSeats(c.minSeats != null ? String(c.minSeats) : "");
    setPriority(c.priority);
    setIsActive(c.isActive);
    setOpen(true);
  }
  function toggleMember(id: string) {
    setMemberIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function onAreaChange(next: string) {
    setAreaId(next);
    setMemberIds([]); // members must belong to the new area
  }

  function save() {
    if (memberIds.length < 2) return toast.error("Select at least two tables");
    const payload = {
      name, areaId, maxSeats, priority, isActive, tableIds: memberIds,
      minSeats: minSeats.trim() === "" ? 0 : Number(minSeats),
    };
    startTransition(async () => {
      const res = editId ? await updateCombination(editId, payload) : await addCombination(payload);
      if (res.ok) { toast.success(editId ? "Combination updated" : "Combination added"); setOpen(false); router.refresh(); }
      else toast.error(res.error);
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteCombination(id);
      if (res.ok) { toast.success("Combination deleted"); router.refresh(); } else toast.error(res.error);
    });
  }
  function toggle(id: string, next: boolean) {
    startTransition(async () => {
      const res = await toggleCombination(id, next);
      if (res.ok) { toast.success(next ? "Combination activated" : "Combination deactivated"); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-sm p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Table combinations</h2>
          <p className="text-sm text-muted-foreground">Predefined groups of tables pushed together for larger parties. Members must share one area.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="size-4" /> New combination</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>{editId ? "Edit combination" : "New combination"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Indoor 8-top (T1+T2)" />
              </div>
              <div className="space-y-1.5">
                <Label>Area</Label>
                <Select value={areaId} onValueChange={onAreaChange}>
                  <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.kind})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Member tables <span className="text-muted-foreground">({memberIds.length} selected · {selectedSeats} seats)</span></Label>
                {areaTables.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No tables in this area yet.</p>
                ) : (
                  <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-border p-2">
                    {areaTables.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleMember(t.id)}
                        className={cn(
                          "flex items-center justify-between rounded-md border px-2 py-1.5 text-sm transition-colors",
                          memberIds.includes(t.id) ? "border-brand bg-brand/10 font-medium" : "border-border hover:border-brand/50",
                        )}
                      >
                        <span>{t.name}</span><span className="text-xs text-muted-foreground">{t.seats}p</span>
                      </button>
                    ))}
                  </div>
                )}
                {memberIds.length === 1 && (
                  <p className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="size-3" /> A combination needs at least two tables.</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Max seats</Label><Input type="number" min={2} value={maxSeats} onChange={(e) => setMaxSeats(Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label>Min seats</Label><Input type="number" min={0} value={minSeats} onChange={(e) => setMinSeats(e.target.value)} placeholder="—" /></div>
                <div className="space-y-1.5"><Label>Priority</Label><Input type="number" min={0} value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label className="cursor-default">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {editId ? "Save" : "Add combination"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {combinations.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">No combinations defined yet.</p>
        )}
        {combinations.map((c) => {
          const Icon = c.areaKind === "outdoor" ? Trees : Home;
          return (
            <div key={c.id} className={cn("rounded-lg border p-4", c.isActive ? "border-border" : "border-border bg-muted/30 opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Link2 className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-medium">
                      {c.name}
                      <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold", c.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                        {c.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="size-3.5" /> {c.areaName} · {c.members.map((m) => m.tableName).join(" + ")} · up to {c.maxSeats}{c.minSeats ? ` (min ${c.minSeats})` : ""} · priority {c.priority}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch checked={c.isActive} onCheckedChange={(v) => toggle(c.id, v)} disabled={pending} />
                  <Button size="icon-sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
