# Terrazza / Gjeçaj — Sistem Rezervimesh · Audit i Plotë i Veçorive

_Gjeneruar: 6 Shtator 2026 · repo: `LorencBzhetaj/restorant` · për krahasim me sisteme të tjera_

Ky dokument liston **çdo veçori të implementuar** dhe **çfarë mund të bëjë secili aktor** (Klienti, Admini/Stafi, Sistemi). Në fund: çfarë **nuk** ka ende dhe rruga drejt SaaS.

---

## 1. Përmbledhje teknike (stack)

| Shtresa | Teknologjia |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, API routes) |
| Gjuha | TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) |
| ORM / DB | Prisma + PostgreSQL (Neon në prodhim) |
| Validim | Zod + React Hook Form |
| Grafikë | Recharts |
| Email | Nodemailer (SMTP) me abstraksion; demo-mode pa kredenciale |
| Deploy | Vercel (build: `prisma generate && next build`) |

**Arkitektura**: motor disponueshmërie i pavarur (`src/lib/availability.ts`), logjika e biznesit te Server Actions (`src/server/actions.ts`) + querie leximi (`src/server/data.ts`), të gjitha të ekspozuara edhe si **REST API** publike me CORS për embed/WordPress.

---

## 2. Aktorët

- **Klienti (publik)** — pa login. Bën rezervim, merr email konfirmimi, menaxhon/anullon rezervimin me link.
- **Admini / Stafi** — akseson `/dashboard` (aktualisht **pa autentikim** — shih §10).
- **Sistemi** — motori i disponueshmërisë, dërgimi i email-eve, parandalimi i mbivendosjes.
- **Sisteme të jashtme** (p.sh. WordPress) — përmes REST API + `embed.js`.

---

## 3. KLIENTI — çfarë mund të bëjë

### 3.1 Flow-i i rezervimit (publik) — `/reserve`
Rrjedhë 2-hapëshe (tavolina caktohet automatikisht; klienti **nuk** zgjedh tavolinë):

1. **Hapi 1 — Datë & orë** (`/reserve`)
   - Zgjedh **numrin e personave** (stepper +/−, kufizuar nga `maxPartySize`).
   - Zgjedh **datën** (14 ditët e ardhshme, chip horizontale).
   - Sheh **oraret e lira** të grupuara në **Drekë / Darkë**, të llogaritura live sipas kapacitetit për atë datë+persona.
   - Mesazh nëse s'ka disponueshmëri; sugjerim për datë tjetër/grup më të vogël.
   - Për grupe > `maxPartySize`: mesazh "na telefononi".

2. **Hapi 2 — Të dhënat** (`/reserve/details`)
   - Formular: **Emri*** , Mbiemri, **Telefoni*** , **Email*** (i detyrueshëm — aty vjen konfirmimi), Kërkesa speciale (notes).
   - Panel përmbledhës: tavolina (caktohet automatikisht), personat, data, ora.
   - Validim me Zod (email i vlefshëm i detyrueshëm).
   - "Confirm reservation" → krijon rezervimin, dërgon email-et.

3. **Ekrani i suksesit**
   - "Table reserved!" + përmbledhje.
   - "Confirmation email sent to {email}".
   - Buton **"Manage / cancel"** (→ `/r/{token}`) + "New reservation".

### 3.2 Menaxhimi/Anullimi i rezervimit — `/r/{cancelToken}`
- Faqe publike e aksesueshme me token-in unik (nga email-i ose ekrani i suksesit).
- Shfaq statusin + detajet (personat, data, ora, tavolina).
- Nëse aktiv (Confirmed/Seated): buton **"Cancel my reservation"** me dialog konfirmimi → anullon + dërgon email anullimi te klienti dhe pronari.
- Nëse i anulluar/kryer: shfaq statusin përkatës (pa buton).

### 3.3 Çfarë merr klienti me email
- **Konfirmim rezervimi** (me buton "Cancel my reservation").
- **Njoftim anullimi** (kur anullohet).
- **Njoftim riplanifikimi** (kur admini e zhvendos).
- **Faleminderit** (kur shënohet "Completed").

---

## 4. ADMINI / STAFI — çfarë mund të bëjë (`/dashboard`)

### 4.1 Dashboard (`/dashboard`)
KPI (sot): Rezervime sot · Kuverta (persona) sot · Të ardhshme · Të ardhura est. sot · Të përfunduara sot · Të anulluara sot · No-show sot · Të ardhura est. muaji.
Grafikë (14 ditë): Të ardhura est. · Rezervime · **Kuverta sipas zonës** · **Shpërndarja sipas madhësisë së grupit**.
Lista: **rezervimet e sotme** + **rezervimet e ardhshme**.
> Të ardhurat janë vlerësim (`kuverta × €35/kuvertë` — konstante demo).

### 4.2 Rezervim i ri / walk-in (nga topbar-i, çdo faqe)
- Dialog: persona + datë + orë (nga disponueshmëria live) + zgjedh tavolinë (ose "any") + emër/telefon.
- Përdor **të njëjtin motor** si rezervimet online; dërgon email konfirmimi.
- Burimi shënohet "Walk-in"/"Phone".

### 4.3 Plani i katit / Floor plan (`/dashboard/floor`)
- **Hartë vizuale e tavolinave** (round/square/rect sipas formës, të pozicionuara në rrjet 12×8).
- Navigim **dita** (prev/next/Today) + **përzgjedhës ore** (12:00–22:00).
- Ngjyrat sipas statusit në atë orë: **e lirë** / **e zënë**.
- Numëron "X të lira / Y të zëna".
- Klik mbi tavolinë të zënë → hap detajet e rezervimit (me veprimet e §4.4).
- Listë anësore: të gjitha rezervimet e asaj dite.

### 4.4 Rezervimet (`/dashboard/reservations`)
- Tabelë me **filtra** (All / Confirmed / Seated / Completed / Cancelled / No-show) + numërues + **kërkim**.
- Klik → dialog detajesh me veprime:
  - **Seat** (shëno të ulur) · **Complete** (përfundo) · **No-show** · **Cancel** (me dialog konfirmimi)
  - **Reschedule**: ndrysho datë/orë (+ opsionalisht tavolinë), me rikontroll disponueshmërie.
  - Shfaq **njoftimet** e dërguara për atë rezervim (kanal Email, status).

### 4.5 Tavolinat (`/dashboard/tables`)
- **Parapamje e planit të katit** (read-only).
- Tabelë me të gjitha tavolinat (emër, vende, zonë, #rezervime, status).
- **Shto/Ndrysho tavolinë**: emër, vende, zonë, formë (square/round/rect), pozicion në rrjet (x,y,w,h), aktiv/joaktiv.
- **Aktivizo/çaktivizo** tavolinë (switch).

### 4.6 Klientët / CRM (`/dashboard/customers`)
- Listë me kërkim: emër, telefon, vizita, të përfunduara, shpenzim est., vizita e fundit.
- **Profili i klientit** (`/dashboard/customers/{id}`):
  - Kontakt (telefon, email), statistika (vizita, të përfunduara, të anulluara, no-show, kuverta totale, shpenzim est., vizita e fundit, **zona e preferuar**, madhësia mesatare e grupit).
  - **Historiku i rezervimeve**.
  - **Shënime** të editueshme.

### 4.7 Cilësimet (`/dashboard/settings`) — **ruhen në DB**
- **Detaje**: emër, slogan, telefon, WhatsApp, email (pronari), adresë, monedhë.
- **Rregulla rezervimi**: **kohëzgjatja e qëndrimit** (turn), **intervali i sllotave**, **buffer mes rezervimeve**, **madhësia max e grupit online**.
- **Oraret e hapjes**: turne të shumta për ditë (drekë/darkë), shto/fshi.
- **Mbylljet (closures)**: data/interval kur restoranti është i mbyllur (festë, event privat), shto/fshi.

---

## 5. MOTORI I DISPONUESHMËRISË (zemra e sistemit)

Për çdo (datë + numër personash), një orë ofrohet vetëm nëse **≥1 tavolinë aktive**:
- ka **vende ≥ personat**,
- bie brenda një **turni hapjeje** dhe mbaron para mbylljes (`start + turn ≤ fund turni`),
- **nuk** është ditë mbylljeje (closure),
- është **e lirë** gjithë qëndrimin, duke respektuar **buffer**-in mes rezervimeve,
- nuk është në të kaluarën.

- **"Any table"**: cakton automatikisht tavolinën **më të vogël që mjafton** (`pickTableForSlot`).
- **Parandalim i mbivendosjes**: rikontroll përfundimtar brenda një **transaksioni** para krijimit (`isTableBookable` + clash-check në `$transaction`) → dy klientë s'mund të zënë të njëjtën tavolinë njëkohësisht.
- I njëjti motor përdoret nga: rezervimi online, floor-plan-i i adminit, walk-in, API-ja.
- **Kapaciteti për orë = numri i tavolinave (që nxënë grupin) të lira në atë interval.** Rregullohet nga: tavolinat (numër+vende), kohëzgjatja e qëndrimit, buffer-i, intervali — të gjitha te Cilësimet/Tavolinat.

Statuset e rezervimit: **Confirmed → Seated → Completed**, ose **Cancelled / NoShow**.

---

## 6. NJOFTIMET (Email)

- Abstraksion provider-i (`src/lib/email.ts`): SMTP real kur konfiguruar; ndryshe **demo-mode** (regjistrohet pa dërguar).
- Dërgohen **te klienti dhe te pronari** (email-i i pronarit merret nga Cilësimet).
- Të nxitura automatikisht: **BookingConfirmation, Cancellation, Reschedule, Completed, NoShow**.
- Email-i i konfirmimit përmban **buton anullimi** (link me token).
- Çdo njoftim regjistrohet në DB dhe shfaqet te detajet e rezervimit në admin.

---

## 7. REST API + EMBED (për WordPress / sisteme të jashtme)

Të gjitha me **CORS** (konfigurohen origjinat me `ALLOWED_ORIGINS`).

| Metoda | Endpoint | Funksioni |
|---|---|---|
| GET | `/api/availability?date=&party=` | Oraret e lira për datë+persona |
| GET | `/api/availability?date=&time=&party=` | Statusi i çdo tavoline në një orë |
| POST | `/api/reservations` | Krijon rezervim (JSON) → kthen `manageUrl` |
| GET | `/api/reservations/{token}` | Lexon rezervimin |
| POST | `/api/reservations/{token}/cancel` | Anullon rezervimin |

**Embed** (`/public/embed.js`): një `<script>` që fut iframe të `/reserve` dhe **rregullon lartësinë vetë** (postMessage) — plug-and-play për WordPress.

---

## 8. MODELI I TË DHËNAVE (Prisma)

- **RestaurantTable**: name, seats, section, shape, x/y/w/h (plani i katit), isActive, sortOrder.
- **Customer**: firstName, lastName, phone, whatsappNumber?, email?, notes?.
- **Reservation**: cancelToken (unik), tableId, customerId, startDateTime, endDateTime, partySize, status, notes?, source (Online/Walk-in/Phone).
- **OpeningHour**: dayOfWeek, startTime, endTime, isActive (turne të shumta/ditë).
- **Closure**: startDate, endDate, reason?.
- **Notification**: reservationId, type, channel (Email), status, message, recipient.
- **RestaurantSetting**: name, tagline, phone, whatsapp, address, email, currency, turnDurationMinutes, bookingInterval, seatingBuffer, maxPartySize, timezone.

FK-të, indekset dhe unique-t janë vendosur (p.sh. index mbi `[tableId, startDateTime]`, unique mbi `cancelToken`).

---

## 9. VALIDIMI & SIGURIA (e implementuar)

- Validim server-side me Zod për çdo mutacion.
- Çmimi/kohëzgjatja/disponueshmëria **rillogariten në server** — s'besohet klienti.
- Transaksion kundër mbivendosjes.
- Anullim me token të paparashikueshëm (cuid), jo me id sekuencial.
- CORS i konfigurueshëm; `.env` jashtë git-it.

---

## 10. ÇFARË NUK KA ENDE (rëndësishme për krahasim)

- ❌ **Autentikim/roles për adminin** — `/dashboard` është **i hapur** (duhet login para prodhimit real).
- ❌ **Multi-tenant / multi-restorant** (SaaS) — një restorant i vetëm për tani.
- ❌ **Reminder-a automatikë (24h/2h)** — tipet ekzistojnë, por s'ka **cron/scheduler** që t'i dërgojë.
- ❌ **Pagesa / depozita online**.
- ❌ **Bashkim tavolinash** për grupe të mëdha (secili rezervim = 1 tavolinë).
- ❌ **Rate limiting** në API.
- ❌ **Lista pritjeje (waitlist)**, rezervime të përsëritura, menu/porosi.
- ❌ **Panel njoftimesh/audit log** i plotë (njoftimet ruhen, por s'ka faqe e dedikuar).
- ❌ **i18n** (UI në anglisht; të dhënat shqip).
- ⚠️ Të ardhurat në dashboard janë **vlerësim** (konstante €35/kuvertë), jo pagesa reale.

---

## 11. RRUGA PËR GJEÇAJ.AL DHE SAAS (rekomandime)

**Faza 1 — Gjeçaj (tani):**
1. Autentikim i thjeshtë për `/dashboard` (login pronari).
2. Konfiguro tavolinat/oraret reale te admini; opsionalisht reset i pastër (pa të dhëna demo).
3. Embed te faqja gjeçaj.al (`embed.js`) ose linku i drejtpërdrejtë `/reserve`.
4. SMTP real (info@villagjecaj.com) — tashmë i verifikuar.
5. Reminder-a: shto një cron (Vercel Cron) që dërgon 24h/2h.

**Faza 2 — SaaS (më vonë):**
1. Multi-tenant: shto `tenantId` te të gjitha entitetet + zgjidhja e tenant-it nga subdomeni/slug.
2. Auth me role (Owner/Staff), ftesa stafi.
3. Onboarding vetësh: krijimi i restorantit, tavolinave, orareve.
4. Planet/abonimi (Stripe), kufij përdorimi.
5. Rate limiting, audit log, njoftime WhatsApp/SMS si kanale shtesë (abstraksioni ekziston).

---

_Për çdo veçori më sipër ekziston kodi përkatës në repo. Ky sistem mbulon plotësisht: rezervim publik → email me anullim → menaxhim i plotë nga admini (floor plan, rezervime, tavolina, klientë, cilësime) → API/embed._
