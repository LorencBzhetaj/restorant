"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/require-admin";
import { rateLimit } from "@/lib/rate-limit";
import { processLogo } from "@/lib/logo-validation";
import { putLogo, deleteManagedLogo, isManagedLogoUrl } from "@/lib/logo-storage";

export type LogoResult = { ok: true; url: string | null } | { ok: false; error: string };

function revalidateBranding() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

/**
 * Authenticated server-side logo upload. The browser only submits the file; this
 * action validates it, stores it, and updates RestaurantSetting.logoUrl in a safe
 * order (validate → upload new → update DB → then best-effort delete the old
 * managed blob; on DB failure delete the new orphan).
 */
export async function uploadLogo(formData: FormData): Promise<LogoResult> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };

  const rl = rateLimit("logo-upload", 10, 60_000);
  if (!rl.ok) return { ok: false, error: `Too many uploads — try again in ${rl.retryAfter}s.` };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file was provided." };

  // 1. Validate + normalize (never logs file contents).
  const bytes = Buffer.from(await file.arrayBuffer());
  const processed = await processLogo(bytes, file.type || undefined);
  if (!processed.ok) return { ok: false, error: processed.error };

  // 2. Upload the new blob under a server-generated pathname.
  let uploaded: { url: string; pathname: string };
  try {
    uploaded = await putLogo(processed.data.buffer, processed.data.ext, processed.data.contentType);
  } catch {
    return { ok: false, error: "Could not store the image. Check the storage configuration." };
  }

  const existing = await prisma.restaurantSetting.findFirst();
  const oldUrl = existing?.logoUrl ?? null;

  // 3-4. Update the DB and confirm it succeeded.
  try {
    if (existing) {
      await prisma.restaurantSetting.update({ where: { id: existing.id }, data: { logoUrl: uploaded.url } });
    } else {
      await prisma.restaurantSetting.create({ data: { name: "Gjeçaj Alpine Restaurant Cuisine", logoUrl: uploaded.url } });
    }
  } catch {
    // 7. DB failed → remove the just-uploaded orphan, keep the current logo.
    try {
      await deleteManagedLogo(uploaded.url);
    } catch {
      console.warn("[logo] failed to clean up orphan blob after a DB error");
    }
    return { ok: false, error: "Could not save the logo. No changes were made." };
  }

  // 5-6. Delete the previous blob ONLY if we manage it, best-effort.
  if (oldUrl && oldUrl !== uploaded.url && isManagedLogoUrl(oldUrl)) {
    try {
      await deleteManagedLogo(oldUrl);
    } catch {
      console.warn("[logo] previous blob cleanup failed — new logo is active");
    }
  }

  revalidateBranding();
  return { ok: true, url: uploaded.url };
}

/** Remove the logo: null out logoUrl (fallback to initials) and delete the old managed blob. */
export async function removeLogo(): Promise<LogoResult> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };

  const existing = await prisma.restaurantSetting.findFirst();
  const oldUrl = existing?.logoUrl ?? null;

  if (existing) await prisma.restaurantSetting.update({ where: { id: existing.id }, data: { logoUrl: null } });

  if (oldUrl && isManagedLogoUrl(oldUrl)) {
    try {
      await deleteManagedLogo(oldUrl);
    } catch {
      console.warn("[logo] blob cleanup on remove failed");
    }
  }

  revalidateBranding();
  return { ok: true, url: null };
}
