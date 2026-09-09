"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Save, RotateCw, Undo2, ArrowLeft, AlertTriangle, Link2, Square, Circle, RectangleHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FLOOR_COLS, FLOOR_ROWS } from "@/lib/constants";
import { saveFloorLayout } from "@/server/actions";

interface EditorTable {
  id: string; name: string; seats: number; areaId: string | null; areaName: string | null; areaKind: string | null;
  shape: string; x: number; y: number; w: number; h: number; rotation: number; isActive: boolean;
}
interface AreaOpt { id: string; name: string; kind: string }
interface ComboOpt { id: string; name: string; areaId: string; memberTableIds: string[] }
interface Layout { x: number; y: number; w: number; h: number; shape: string; rotation: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function FloorEditor({
  tables, areas, combinations,
}: { tables: EditorTable[]; areas: AreaOpt[]; combinations: ComboOpt[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offX: number; offY: number } | null>(null);

  const initial = useMemo<Record<string, Layout>>(
    () => Object.fromEntries(tables.map((t) => [t.id, { x: t.x, y: t.y, w: t.w, h: t.h, shape: t.shape, rotation: t.rotation }])),
    [tables],
  );
  const [layout, setLayout] = useState<Record<string, Layout>>(initial);
  const [baseline, setBaseline] = useState<Record<string, Layout>>(initial);
  const [activeArea, setActiveArea] = useState(areas[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dirty = useMemo(() => JSON.stringify(layout) !== JSON.stringify(baseline), [layout, baseline]);
  const areaTables = tables.filter((t) => t.areaId === activeArea);
  const areaCombos = combinations.filter((c) => c.areaId === activeArea);

  // Which combinations a table belongs to (for the visual link indicator).
  const combosByTable = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of combinations) for (const id of c.memberTableIds) (m[id] ??= []).push(c.name);
    return m;
  }, [combinations]);

  // Overlap warnings (visual only — never affects availability).
  const overlaps = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < areaTables.length; i++) {
      for (let j = i + 1; j < areaTables.length; j++) {
        const a = layout[areaTables[i].id], b = layout[areaTables[j].id];
        if (!a || !b) continue;
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
          out.push(`${areaTables[i].name} overlaps ${areaTables[j].name}`);
        }
      }
    }
    return out;
  }, [areaTables, layout]);

  function updateSel(patch: Partial<Layout>) {
    if (!selectedId) return;
    setLayout((cur) => {
      const t = { ...cur[selectedId], ...patch };
      t.w = clamp(t.w, 1, FLOOR_COLS);
      t.h = clamp(t.h, 1, FLOOR_ROWS);
      t.x = clamp(t.x, 0, FLOOR_COLS - t.w);
      t.y = clamp(t.y, 0, FLOOR_ROWS - t.h);
      return { ...cur, [selectedId]: t };
    });
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cellW = rect.width / FLOOR_COLS, cellH = rect.height / FLOOR_ROWS;
    const t = layout[id];
    const pointerCellX = (e.clientX - rect.left) / cellW;
    const pointerCellY = (e.clientY - rect.top) / cellH;
    dragRef.current = { id, offX: pointerCellX - t.x, offY: pointerCellY - t.y };
    setSelectedId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const cellW = rect.width / FLOOR_COLS, cellH = rect.height / FLOOR_ROWS;
    const t = layout[d.id];
    const rawX = (e.clientX - rect.left) / cellW - d.offX;
    const rawY = (e.clientY - rect.top) / cellH - d.offY;
    const nx = clamp(Math.round(rawX), 0, FLOOR_COLS - t.w); // snap to grid + keep on canvas
    const ny = clamp(Math.round(rawY), 0, FLOOR_ROWS - t.h);
    if (nx !== t.x || ny !== t.y) setLayout((cur) => ({ ...cur, [d.id]: { ...cur[d.id], x: nx, y: ny } }));
  }
  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current) (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  }

  function reset() { setLayout(baseline); setSelectedId(null); }

  function save() {
    setPending(true);
    const payload = { tables: tables.map((t) => ({ id: t.id, ...layout[t.id] })) };
    saveFloorLayout(payload)
      .then((res) => {
        if (res.ok) { setBaseline(layout); toast.success("Floor layout saved"); router.refresh(); }
        else toast.error(res.error);
      })
      .catch(() => toast.error("Could not save the layout"))
      .finally(() => setPending(false));
  }

  const sel = selectedId ? layout[selectedId] : null;
  const selTable = tables.find((t) => t.id === selectedId) ?? null;
  const selCombos = selectedId ? combosByTable[selectedId] ?? [] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/dashboard/floor"><ArrowLeft className="size-4" /> Floor plan</Link></Button>
          <h1 className="ml-1 font-heading text-lg font-semibold">Edit layout</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reset} disabled={!dirty || pending}><Undo2 className="size-4" /> Reset</Button>
          <Button size="sm" onClick={save} disabled={!dirty || pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save layout</Button>
        </div>
      </div>

      {/* Area tabs — Indoor and Outdoor have separate floor plans */}
      <div className="flex gap-2">
        {areas.map((a) => (
          <button
            key={a.id}
            onClick={() => { setActiveArea(a.id); setSelectedId(null); }}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              a.id === activeArea ? "border-brand bg-brand/15 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}
          >
            {a.name}
          </button>
        ))}
      </div>

      {overlaps.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Overlapping tables (visual only — booking availability is unaffected):</p>
            <p>{overlaps.join(" · ")}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Canvas */}
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div
            ref={canvasRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative w-full touch-none select-none rounded-xl border border-border bg-[repeating-linear-gradient(45deg,transparent,transparent_12px,color-mix(in_oklab,var(--muted)_60%,transparent)_12px,color-mix(in_oklab,var(--muted)_60%,transparent)_13px)]"
            style={{ aspectRatio: `${FLOOR_COLS} / ${FLOOR_ROWS}` }}
          >
            {areaTables.map((t) => {
              const l = layout[t.id];
              const isSel = t.id === selectedId;
              const isMember = (combosByTable[t.id]?.length ?? 0) > 0;
              const isRound = l.shape === "round";
              return (
                <button
                  key={t.id}
                  type="button"
                  onPointerDown={(e) => onPointerDown(e, t.id)}
                  className={cn(
                    "absolute flex touch-none flex-col items-center justify-center border-2 p-0.5 text-center",
                    isRound ? "rounded-full" : "rounded-lg",
                    t.isActive ? "border-brand/60 bg-brand/10 text-foreground" : "border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground/60",
                    isSel ? "z-10 cursor-grabbing ring-2 ring-brand ring-offset-1 ring-offset-background" : "cursor-grab hover:shadow-md",
                  )}
                  style={{
                    left: `${(l.x / FLOOR_COLS) * 100}%`, top: `${(l.y / FLOOR_ROWS) * 100}%`,
                    width: `${(l.w / FLOOR_COLS) * 100}%`, height: `${(l.h / FLOOR_ROWS) * 100}%`,
                    transform: `rotate(${l.rotation}deg)`,
                  }}
                >
                  {isMember && <Link2 className="absolute right-0.5 top-0.5 size-3 text-brand" />}
                  <span className="text-[10px] font-semibold leading-none sm:text-xs">{t.name}</span>
                  <span className="mt-0.5 text-[9px] leading-none opacity-80">{t.seats}p</span>
                </button>
              );
            })}
            {areaTables.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No tables in this area yet.</p>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Drag a table to move it. It snaps to the grid and stays inside the plan.</p>
        </div>

        {/* Selected-table controls */}
        <div className="rounded-xl border border-border bg-card p-4">
          {!sel || !selTable ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Select a table to edit its size, shape and rotation.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{selTable.name} <span className="text-sm font-normal text-muted-foreground">· {selTable.seats}p</span></h3>
                {!selTable.isActive && <p className="text-xs text-muted-foreground">Inactive table (shown dashed)</p>}
                {selCombos.length > 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-brand"><Link2 className="size-3" /> In: {selCombos.join(", ")}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Stepper label="Width" value={sel.w} min={1} max={FLOOR_COLS} onChange={(w) => updateSel({ w })} />
                <Stepper label="Height" value={sel.h} min={1} max={FLOOR_ROWS} onChange={(h) => updateSel({ h })} />
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Shape</p>
                <div className="grid grid-cols-3 gap-2">
                  {([["square", Square], ["round", Circle], ["rect", RectangleHorizontal]] as const).map(([shape, Icon]) => (
                    <button key={shape} onClick={() => updateSel({ shape })}
                      className={cn("flex flex-col items-center gap-1 rounded-lg border py-2 text-xs capitalize transition-colors",
                        sel.shape === shape ? "border-brand bg-brand/10 font-medium" : "border-border hover:border-brand/50 text-muted-foreground")}>
                      <Icon className="size-4" /> {shape}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Rotation <span className="text-muted-foreground">({sel.rotation}°)</span></p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => updateSel({ rotation: (sel.rotation + 90) % 360 })}>
                  <RotateCw className="size-4" /> Rotate 90°
                </Button>
              </div>
            </div>
          )}

          {areaCombos.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium"><Link2 className="size-4 text-brand" /> Combinations here</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {areaCombos.map((c) => <li key={c.id}>{c.name} <span className="opacity-70">({c.memberTableIds.length} tables)</span></li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</Button>
        <span className="w-8 text-center font-mono text-sm">{value}</span>
        <Button variant="outline" size="icon-sm" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</Button>
      </div>
    </div>
  );
}
