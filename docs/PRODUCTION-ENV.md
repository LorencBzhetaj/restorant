# Vercel Production environment variables

Add these in Vercel → Project → **Settings → Environment Variables** (scope:
**Production**). Never commit them; never paste secrets into chat.

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon **DIRECT** URL | Same as your local `.env` (non-pooler; advisory locks need DIRECT) |
| `DIRECT_URL` | Neon **DIRECT** URL | Same value |
| `AUTH_SECRET` | *generate* | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_PASSWORD` | *your strong password* | The dashboard login. NOT `demo`. |
| `TZ` | `Europe/Tirane` | |
| `NEXT_PUBLIC_APP_URL` | `https://booking.gjecaj.al` | Booking app origin (email logo + cancel links) |
| `SMTP_HOST` | `smtp.gmail.com` | (if using Gmail) |
| `SMTP_PORT` | `465` | 465 = SSL |
| `SMTP_USER` | your Gmail address | |
| `SMTP_PASS` | your Gmail **app password** | The 16-char app password (not your login password) |
| `EMAIL_FROM` | `Gjeçaj Alpine Restaurant <your@gmail.com>` | Sender shown to guests |
| `CRON_SECRET` | *generate* | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — Vercel Cron sends it as the Bearer token |
| `ALLOWED_ORIGINS` | `https://gjecaj.al,https://www.gjecaj.al` | Comma-separated exact origins allowed to call the API/embed (your WordPress site) |
| `BLOB_READ_WRITE_TOKEN` | *auto* | Added automatically when you connect a Vercel Blob store (see VERCEL-BLOB-SETUP.md). Optional for launch — the bundled logo works without it; needed only to upload/replace the logo from the dashboard. |

## Generate the two secrets locally (don't type them in chat)
```bash
node -e "console.log('AUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```
Copy each value into Vercel.

## Notes
- `DATABASE_URL`/`DIRECT_URL`: reuse exactly what your local `.env` already has (Neon DIRECT).
- `ALLOWED_ORIGINS` must match the browser Origin exactly (scheme + host, no trailing slash). Add both apex and `www` if your WordPress uses both.
- After changing env vars in Vercel, redeploy for them to take effect.
