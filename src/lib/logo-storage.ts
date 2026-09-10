import { put, del } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Logo blob storage. In production (or whenever BLOB_READ_WRITE_TOKEN is set)
 * uploads go to a PUBLIC Vercel Blob store via an authenticated SERVER call — the
 * write token never reaches the browser. With no token (local dev only) it falls
 * back to writing under public/branding/local so the feature is testable locally;
 * this fallback is refused in production.
 *
 * Pathnames are generated on the server and are unique + immutable, so browser
 * and email caches never serve a stale logo. Deletion only ever touches URLs we
 * manage (our Blob host or the dev-local prefix) — never an arbitrary external
 * URL.
 */

const BLOB_HOST_RE = /\.public\.blob\.vercel-storage\.com$/i;
const DEV_PREFIX = "/branding/local/";

export function isManagedLogoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith(DEV_PREFIX)) return true;
  try {
    return BLOB_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Server-generated, unique, immutable pathname — never the client filename. */
export function generateLogoPathname(ext: string): string {
  return `branding/villa-gjecaj/logo-${Date.now()}-${randomUUID()}.${ext}`;
}

export async function putLogo(buffer: Buffer, ext: string, contentType: string): Promise<{ url: string; pathname: string }> {
  const pathname = generateLogoPathname(ext);
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (token) {
    const res = await put(pathname, buffer, { access: "public", contentType, token, addRandomSuffix: false });
    return { url: res.url, pathname };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Blob storage is not configured (BLOB_READ_WRITE_TOKEN missing).");
  }

  // Dev-only local fallback so the upload flow is testable without a Blob store.
  const filename = path.basename(pathname);
  const abs = path.join(process.cwd(), "public", "branding", "local", filename);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  return { url: `${DEV_PREFIX}${filename}`, pathname: `${DEV_PREFIX}${filename}` };
}

export async function deleteManagedLogo(url: string): Promise<void> {
  if (!isManagedLogoUrl(url)) return; // never delete external / arbitrary URLs

  if (url.startsWith(DEV_PREFIX)) {
    const abs = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    try {
      await unlink(abs);
    } catch {
      /* already gone */
    }
    return;
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) await del(url, { token });
}
