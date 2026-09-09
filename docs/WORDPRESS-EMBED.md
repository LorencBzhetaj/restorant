# WordPress / Divi embed instructions

> ⚠️ **Not yet live-tested.** This documents the integration; it must be verified
> live once the booking app is deployed and WordPress access is available. Do not
> treat the checklist as passed until actually tested on the live site.

The booking flow is **not duplicated** in WordPress. WordPress only embeds an
iframe served by the booking app (`/reserve`), sized automatically via
`postMessage`. All reservation logic, availability, closures, caps, combinations
and emails stay in the app.

## Prerequisites

- Booking app deployed at its real origin, e.g. `https://booking.gjecaj.al`
  (this is `NEXT_PUBLIC_APP_URL`).
- `ALLOWED_ORIGINS` on the app includes the WordPress origin(s), e.g.
  `https://gjecaj.al,https://www.gjecaj.al`.
- `public/embed.js` is served by the app at `https://booking.gjecaj.al/embed.js`.

## Divi Code Module snippet (exact)

Add a **Code** module to the booking page and paste exactly (replace the origin
with your real booking origin):

```html
<div style="max-width:720px;margin:0 auto;">
  <script
    src="https://booking.gjecaj.al/embed.js"
    data-origin="https://booking.gjecaj.al"></script>
</div>
```

The script inserts a responsive iframe pointing at `/reserve` and auto-resizes it
to fit (no inner scrollbar). It listens only for `gjecaj:resize` messages from
the exact `data-origin`, and ignores messages from any other origin.

## How the pieces fit

- `embed.js` (on the WP page): creates the iframe, validates incoming
  `message` events against `data-origin`, and resizes the iframe to the posted
  height.
- `EmbedResizer` (in `/reserve`): posts `{ type: "gjecaj:resize", height }` to
  the embedding page's origin (from the referrer), so the iframe height tracks
  the content — no double scrollbar.

## Live verification checklist (run once deployed)

- [ ] The correct booking application URL is used in `data-origin`.
- [ ] The WordPress origin is in `ALLOWED_ORIGINS`.
- [ ] The iframe loads; no CORS errors in the browser console.
- [ ] Height auto-adjusts; no nested/double scrollbar.
- [ ] Mobile responsive.
- [ ] Indoor / Outdoor / No-preference flow works.
- [ ] Privacy link opens.
- [ ] A booking completes; confirmation screen shows.
- [ ] Guest and owner emails arrive (with logo + assigned tables).
- [ ] Manage/cancel link works.
- [ ] Area closures respected; 18:00 cap respected; combined-table booking works.
- [ ] Special requests captured and shown in emails.
- [ ] Browser back/forward behave.
- [ ] No JS console errors; no blocked CORS requests.
- [ ] `postMessage` accepts only the trusted origin (verified by the origin check
      in `embed.js`).

## If access is unavailable

If WordPress admin access or the live booking URL is unavailable, **stop and
request it** — do not claim the embed was tested live without testing it.
