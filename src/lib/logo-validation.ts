import sharp, { type Metadata } from "sharp";

/**
 * Server-side logo validation + normalization. NEVER trusts the browser MIME or
 * the filename — it sniffs the magic bytes and fully decodes the image with
 * sharp. Rejects oversized, empty, corrupt, animated or unexpected images, then
 * normalizes: applies EXIF orientation, strips metadata, constrains dimensions,
 * preserves transparency, and re-encodes to an optimized PNG.
 */

export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;

const MIN_DIM = 8;
const MAX_DIM = 4000; // reject unreasonable source dimensions
const OUTPUT_MAX = 512; // constrain output for dashboard + email use

export interface ProcessedLogo {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

export type ProcessResult = { ok: true; data: ProcessedLogo } | { ok: false; error: string };

/** Detect the real container from the leading bytes (defense before decoding). */
function sniff(buf: Buffer): "png" | "jpeg" | "webp" | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function processLogo(bytes: Buffer, browserMime?: string): Promise<ProcessResult> {
  if (!bytes || bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, error: "Image is larger than 2 MB." };
  if (browserMime && !ALLOWED_MIME.includes(browserMime as (typeof ALLOWED_MIME)[number])) {
    return { ok: false, error: "Only PNG, JPEG or WebP images are allowed." };
  }

  const sniffed = sniff(bytes);
  if (!sniffed) return { ok: false, error: "File is not a valid PNG, JPEG or WebP image." };

  let meta: Metadata;
  try {
    meta = await sharp(bytes, { animated: true }).metadata();
  } catch {
    return { ok: false, error: "The image could not be decoded — it may be corrupt." };
  }

  if (!meta.format || !["png", "jpeg", "webp"].includes(meta.format)) {
    return { ok: false, error: "Unsupported image format." };
  }
  if ((meta.pages ?? 1) > 1) return { ok: false, error: "Animated images are not supported." };

  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < MIN_DIM || h < MIN_DIM) return { ok: false, error: "The image is too small." };
  if (w > MAX_DIM || h > MAX_DIM) return { ok: false, error: "The image dimensions are too large." };

  try {
    // rotate() with no args applies the EXIF orientation and drops the tag;
    // sharp strips other metadata by default. Output PNG preserves transparency.
    const buffer = await sharp(bytes)
      .rotate()
      .resize({ width: OUTPUT_MAX, height: OUTPUT_MAX, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { ok: true, data: { buffer, contentType: "image/png", ext: "png" } };
  } catch {
    return { ok: false, error: "The image could not be processed." };
  }
}
