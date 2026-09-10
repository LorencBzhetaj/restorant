import { vi, describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";

let admin = true;
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/require-admin", () => ({ isAdmin: async () => admin }));

// Partially mock storage: keep the real isManagedLogoUrl / generateLogoPathname,
// stub the side-effecting putLogo / deleteManagedLogo.
const store = { putLogo: vi.fn(), deleteManagedLogo: vi.fn() };
vi.mock("@/lib/logo-storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/logo-storage")>();
  return {
    ...actual,
    putLogo: (...a: unknown[]) => store.putLogo(...a),
    deleteManagedLogo: (...a: unknown[]) => store.deleteManagedLogo(...a),
  };
});

import { prisma } from "@/lib/prisma";
import { processLogo } from "@/lib/logo-validation";
import { generateLogoPathname, isManagedLogoUrl } from "@/lib/logo-storage";
import { uploadLogo, removeLogo } from "@/server/branding-actions";

const MANAGED_NEW = "https://abc123.public.blob.vercel-storage.com/branding/villa-gjecaj/logo-new.png";

const pngBuf = (w = 64, h = 64) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 180, g: 90, b: 56, alpha: 1 } } }).png().toBuffer();
const jpegBuf = () => sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer();
const webpBuf = () => sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } }).webp().toBuffer();
const gifBuf = () => sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } }).gif().toBuffer();

function fileOf(buf: Buffer, name: string, type: string) {
  return new File([new Uint8Array(buf)], name, { type });
}
function fd(file: File) {
  const f = new FormData();
  f.append("file", file);
  return f;
}

async function setLogo(url: string | null) {
  await prisma.restaurantSetting.deleteMany();
  await prisma.restaurantSetting.create({ data: { name: "Villa Gjecaj", currency: "EUR", logoUrl: url } });
}

beforeEach(async () => {
  admin = true;
  store.putLogo.mockReset();
  store.deleteManagedLogo.mockReset();
  store.putLogo.mockResolvedValue({ url: MANAGED_NEW, pathname: "branding/villa-gjecaj/logo-new.png" });
  await setLogo(null);
});

describe("processLogo (server-side validation + normalization)", () => {
  it("accepts a valid PNG and outputs PNG", async () => {
    const r = await processLogo(await pngBuf(), "image/png");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.contentType).toBe("image/png");
  });
  it("accepts a valid JPEG", async () => {
    expect((await processLogo(await jpegBuf(), "image/jpeg")).ok).toBe(true);
  });
  it("accepts a valid WebP", async () => {
    expect((await processLogo(await webpBuf(), "image/webp")).ok).toBe(true);
  });
  it("rejects an oversized file", async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1, 0xff);
    const r = await processLogo(big, "image/png");
    expect(r.ok).toBe(false);
  });
  it("rejects an empty file", async () => {
    expect((await processLogo(Buffer.alloc(0), "image/png")).ok).toBe(false);
  });
  it("rejects a fake extension / spoofed MIME (text bytes claiming png)", async () => {
    const r = await processLogo(Buffer.from("this is definitely not an image"), "image/png");
    expect(r.ok).toBe(false);
  });
  it("rejects a corrupt image (valid magic bytes, garbage body)", async () => {
    const corrupt = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("garbage".repeat(20))]);
    expect((await processLogo(corrupt)).ok).toBe(false);
  });
  it("rejects an unexpected format (GIF)", async () => {
    const r = await processLogo(await gifBuf(), "image/gif");
    expect(r.ok).toBe(false);
  });
});

describe("generateLogoPathname (server-generated, immutable)", () => {
  it("generates a namespaced unique .png pathname, never the client filename", () => {
    const a = generateLogoPathname("png");
    const b = generateLogoPathname("png");
    expect(a).toMatch(/^branding\/villa-gjecaj\/logo-\d+-[0-9a-f-]{36}\.png$/);
    expect(a).not.toBe(b); // immutable/unique
  });
});

describe("uploadLogo action", () => {
  it("rejects an unauthenticated upload", async () => {
    admin = false;
    const r = await uploadLogo(fd(fileOf(await pngBuf(), "x.png", "image/png")));
    expect(r.ok).toBe(false);
    expect(store.putLogo).not.toHaveBeenCalled();
  });

  it("stores a valid upload and updates logoUrl; storage receives the processed buffer, not the client filename", async () => {
    const r = await uploadLogo(fd(fileOf(await pngBuf(), "my-holiday-photo.PNG", "image/png")));
    expect(r.ok).toBe(true);
    const [buf, ext, ct] = store.putLogo.mock.calls[0];
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(ext).toBe("png");
    expect(ct).toBe("image/png");
    const s = await prisma.restaurantSetting.findFirst();
    expect(s?.logoUrl).toBe(MANAGED_NEW);
  });

  it("on replacement, deletes the old managed blob only after the DB update succeeds", async () => {
    await setLogo("https://old111.public.blob.vercel-storage.com/branding/villa-gjecaj/logo-old.png");
    const r = await uploadLogo(fd(fileOf(await pngBuf(), "x.png", "image/png")));
    expect(r.ok).toBe(true);
    expect((await prisma.restaurantSetting.findFirst())?.logoUrl).toBe(MANAGED_NEW);
    expect(store.deleteManagedLogo).toHaveBeenCalledWith("https://old111.public.blob.vercel-storage.com/branding/villa-gjecaj/logo-old.png");
  });

  it("never deletes an arbitrary external old URL", async () => {
    await setLogo("https://images.unsplash.com/some-external-logo.png");
    const r = await uploadLogo(fd(fileOf(await pngBuf(), "x.png", "image/png")));
    expect(r.ok).toBe(true);
    expect(store.deleteManagedLogo).not.toHaveBeenCalled();
  });

  it("cleans up the new orphan blob when the DB update fails", async () => {
    await setLogo(null); // a row exists, so the action takes the update path
    const orig = prisma.restaurantSetting.update;
    // @ts-expect-error temporary override to simulate a DB failure
    prisma.restaurantSetting.update = () => Promise.reject(new Error("db down"));
    try {
      const r = await uploadLogo(fd(fileOf(await pngBuf(), "x.png", "image/png")));
      expect(r.ok).toBe(false);
      expect(store.deleteManagedLogo).toHaveBeenCalledWith(MANAGED_NEW); // orphan removed
    } finally {
      prisma.restaurantSetting.update = orig;
    }
  });

  it("leaves the current logo unchanged when the upload fails", async () => {
    await setLogo("https://keep.public.blob.vercel-storage.com/branding/villa-gjecaj/logo-keep.png");
    store.putLogo.mockRejectedValueOnce(new Error("blob down"));
    const r = await uploadLogo(fd(fileOf(await pngBuf(), "x.png", "image/png")));
    expect(r.ok).toBe(false);
    expect((await prisma.restaurantSetting.findFirst())?.logoUrl).toBe("https://keep.public.blob.vercel-storage.com/branding/villa-gjecaj/logo-keep.png");
  });

  it("rejects a spoofed upload (text posing as image/png)", async () => {
    const r = await uploadLogo(fd(fileOf(Buffer.from("nope"), "evil.png", "image/png")));
    expect(r.ok).toBe(false);
    expect(store.putLogo).not.toHaveBeenCalled();
  });
});

describe("removeLogo action", () => {
  it("restores the fallback and deletes the old managed blob", async () => {
    await setLogo("https://rm.public.blob.vercel-storage.com/branding/villa-gjecaj/logo.png");
    const r = await removeLogo();
    expect(r.ok).toBe(true);
    expect((await prisma.restaurantSetting.findFirst())?.logoUrl).toBeNull();
    expect(store.deleteManagedLogo).toHaveBeenCalled();
  });

  it("nulls logoUrl but never deletes an external URL on remove", async () => {
    await setLogo("https://external.example.com/logo.png");
    const r = await removeLogo();
    expect(r.ok).toBe(true);
    expect((await prisma.restaurantSetting.findFirst())?.logoUrl).toBeNull();
    expect(store.deleteManagedLogo).not.toHaveBeenCalled();
  });

  it("requires an authenticated admin", async () => {
    admin = false;
    expect((await removeLogo()).ok).toBe(false);
  });
});

describe("isManagedLogoUrl", () => {
  it("recognizes our blob host and dev-local prefix, rejects external", () => {
    expect(isManagedLogoUrl("https://x.public.blob.vercel-storage.com/a.png")).toBe(true);
    expect(isManagedLogoUrl("/branding/local/logo-1.png")).toBe(true);
    expect(isManagedLogoUrl("https://images.unsplash.com/a.png")).toBe(false);
    expect(isManagedLogoUrl(null)).toBe(false);
  });
});
