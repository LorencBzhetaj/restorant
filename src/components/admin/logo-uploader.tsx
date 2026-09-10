"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Trash2, ImageUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { uploadLogo, removeLogo } from "@/server/branding-actions";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;

export function LogoUploader({ currentUrl, name }: { currentUrl: string | null; name: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null); // object URL of the picked file
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "G";

  function pick() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    // Client-side pre-checks (UX only; the server re-validates authoritatively).
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is larger than 2 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setPickedName(file.name);
  }

  function clearPick() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPickedName(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function save() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await uploadLogo(fd);
      if (res.ok) {
        toast.success("Logo updated");
        clearPick();
        router.refresh();
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeLogo();
      if (res.ok) {
        toast.success("Logo removed — showing the name initial");
        clearPick();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const shownUrl = preview ?? currentUrl;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/40">
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownUrl} alt={`${name} logo`} className="size-full object-contain" />
          ) : (
            <span className="font-heading text-2xl font-semibold text-brand">{initial}</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{preview ? "New logo — preview" : currentUrl ? "Current logo" : "No logo set"}</p>
          <p className="text-xs text-muted-foreground">
            {pickedName ? pickedName : "PNG, JPEG or WebP up to 2 MB. A square image around 512×512 with a transparent background works best. The name initial is shown as a fallback."}
          </p>
        </div>
      </div>

      <input ref={inputRef} type="file" accept={ACCEPT} onChange={onFile} className="hidden" />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!preview ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={pick} disabled={pending}>
              {currentUrl ? <ImageUp className="size-4" /> : <Upload className="size-4" />} {currentUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {currentUrl && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={pending}><Trash2 className="size-4" /> Remove</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove the logo?</AlertDialogTitle>
                    <AlertDialogDescription>The dashboard and emails will show the restaurant name initial instead. You can upload a new logo anytime.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={remove}>Remove logo</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        ) : (
          <>
            <Button type="button" size="sm" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Save logo
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearPick} disabled={pending}><X className="size-4" /> Cancel</Button>
          </>
        )}
      </div>
    </div>
  );
}
