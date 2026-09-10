# Vercel Blob setup — logo uploads

The admin logo upload stores images in a **public** Vercel Blob store. Uploads are
performed **server-side** (a Server Action) using a write token that never
reaches the browser. Do this only when you are ready — **do not create/connect the
production Blob store without explicit authorization.**

## 1. Create a public Blob store
1. Vercel Dashboard → your account/team → **Storage** → **Create** → **Blob**.
2. Name it (e.g. `villa-gjecaj-blob`). Access: **Public** (logos are public images).

## 2. Connect it to the booking project
1. Open the Blob store → **Projects** → **Connect Project** → select the booking app.
2. Vercel injects **`BLOB_READ_WRITE_TOKEN`** into the project's environment
   (Production/Preview/Development as you choose). This is the server-side write
   token — treat it as a secret.

## 3. OIDC credentials (where supported)
On projects with Vercel OIDC enabled, `@vercel/blob` can use the request-scoped
OIDC token automatically in the Vercel runtime, so a long-lived
`BLOB_READ_WRITE_TOKEN` is not strictly required in that environment. If OIDC is
available, prefer it and keep the static token only for local development. Our
code passes `token: process.env.BLOB_READ_WRITE_TOKEN` when present and otherwise
relies on the platform default — no code change needed to adopt OIDC.

## 4. Local development
- Easiest: `vercel env pull .env.local` to fetch `BLOB_READ_WRITE_TOKEN` locally
  (`.env*` is gitignored — never commit it).
- Or leave the token unset: with **no** `BLOB_READ_WRITE_TOKEN` in a non-production
  environment, the app falls back to writing the processed image under
  `public/branding/local/` (gitignored) so you can test upload/replace/remove
  end-to-end without a Blob store. This fallback is **refused in production**.

## 5. Never commit a token
- `BLOB_READ_WRITE_TOKEN` lives only in Vercel env / `.env.local`.
- It is never printed, logged, or embedded in client code. The browser only
  submits the file to the Server Action; the token stays on the server.

## 6. Verify upload + public delivery
1. **Preview:** open a preview deployment → Dashboard → Settings → Branding →
   upload a logo. Confirm the returned URL is on
   `*.public.blob.vercel-storage.com` and loads publicly.
2. Confirm the logo appears in the dashboard header and in a test email.
3. Replace the logo → the URL changes (unique immutable pathname), the old blob
   is deleted, and caches are not serving the old image.
4. Remove the logo → dashboard/email fall back to the name initial; the blob is
   deleted.
5. Repeat the upload check in **Production** once authorized.

## Notes
- Pathnames are server-generated and unique: `branding/villa-gjecaj/logo-<ts>-<uuid>.png`.
- The old blob is deleted only after the DB update succeeds, and only when the URL
  belongs to our managed store — an externally hosted URL is never deleted.
- Images are validated and normalized server-side (PNG/JPEG/WebP ≤ 2 MB, decoded,
  de-animated, oriented, stripped of metadata, constrained, re-encoded to PNG).
