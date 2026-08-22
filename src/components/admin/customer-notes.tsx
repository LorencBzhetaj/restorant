"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomerNotes } from "@/server/actions";

export function CustomerNotes({ id, notes }: { id: string; notes: string }) {
  const router = useRouter();
  const [value, setValue] = useState(notes);
  const [pending, startTransition] = useTransition();
  const dirty = value !== notes;

  function save() {
    startTransition(async () => {
      const res = await updateCustomerNotes(id, value);
      if (res.ok) { toast.success("Notes saved"); router.refresh(); } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Add a note about this guest…" rows={4} />
      <Button size="sm" onClick={save} disabled={pending || !dirty}>{pending && <Loader2 className="size-4 animate-spin" />} Save notes</Button>
    </div>
  );
}
