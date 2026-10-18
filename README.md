# Tute Pickup Checker

Coordinators at each center open the app (hosted on **Vercel**), log in with their own PIN, scan a student's QR
(or type the index) and the phone shows:
- ✅ green **Give 3 tutes** with a tick-list (the tutes ticked on that student's row) → tap **Give ticked tutes ✓** to record them
- ❌ red, with the reason: not found / courier student / wrong center / fee not paid / no tutes ticked / **all tutes already collected**
- Always: last 4 NIC digits (to check the student's ID), the pickup slot, and the tutes the student already has

The **Google Sheet** (with an Apps Script) is the database and rule engine. All centers share it live, so a tute can't be collected twice.

```
phone ──► Vercel (React app + /api)  ──secret──►  Apps Script web app  ──►  Google Sheet
          login PIN → httpOnly cookie              only answers Vercel
```

## Why a student can't use their own QR

The QR is just `https://<your-app>/?i=<index>`. A student who scans it gets a PIN screen and nothing else (no name, center or tutes).

- Every data call needs a **signed, httpOnly, Secure, SameSite=Strict session cookie** that only a correct staff PIN creates (12 h).
- The **Apps Script URL is never sent to browsers** and it rejects every request without `API_SECRET`, which only Vercel knows.
- **One PIN per coordinator** (Staff tab), tied to one center. Delete a row and that person is locked out on their next tap, even with a live session.
- Wrong PINs: 5 per IP and 100 overall per 10 minutes, then a 10 minute lock.
- The page can't be framed or indexed (CSP, `X-Frame-Options`, `noindex`), and the index is removed from the address bar on load.
- Staff still check the **last 4 NIC digits**, so a forwarded QR is no use to someone else.

## One-time setup

### 1. Google Sheet + Apps Script
1. Create a new Google Sheet. **File → Settings → Time zone** = `(GMT+05:30) Colombo`.
2. **Extensions → Apps Script**. Delete what's there, paste in `apps-script/Code.gs`.
3. **+ → HTML**, add two files named exactly (no `.html`): `Cards` ← `apps-script/Cards.html`, `Logo` ← `apps-script/Logo.html` (both are one long line, paste it all).
4. Select `setup` → **Run** (allow the permissions). It creates **Students**, **Staff**, **Log**, **Settings**.
5. **Deploy → New deployment → ⚙ Web app**: Execute as **Me**, Who has access **Anyone**. Copy the link (ends in `/exec`). It's useless without the secret.
6. Reopen the Sheet → **Tute Pickup → Show API secret (for Vercel)** and copy it.

### 2. Vercel
1. Push this repo to GitHub and import it in Vercel (framework: Vite, nothing to change).
2. **Settings → Environment Variables**:
   | Name | Value |
   |---|---|
   | `APPS_SCRIPT_URL` | the `/exec` link from step 1.5 |
   | `API_SECRET` | the secret from step 1.6 |
   | `SESSION_SECRET` | any long random string, e.g. `openssl rand -hex 32` |
3. Deploy. In the Sheet → **Settings → App URL**, paste the Vercel link (e.g. `https://tute-pickup.vercel.app`).
   Optional: attach your own domain, and turn on Vercel's **Deployment Protection** for preview deployments.

### 3. Sheet data
- **Settings**: edit **Centers** (comma-separated) and **Slot Times** (Pickup Time dropdown). After changing either, run `setup` again.
- **Staff**: one row per coordinator: **Name**, **PIN** (6+ characters, unique), **Center**. Give each person their own PIN. Names and PINs turn red if repeated.
- **Students**: the 9 fixed columns, then one tick-box column per tute (header = tute name, `Tute 01`…`Tute 20` to start).
  To add a tute, type its name in the next empty header cell and run `setup` again. Keep names unique.

  | Index | Name | Mobile | NIC | Delivery | Center | Paid | Pickup Date | Pickup Time | Tute 01 | Tute 02 | … |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | 260001 | Kasun Perera | 0771234567 | 200712345678 | Pickup | Center B | ☑ | Sat 21 Sep 2026 | 10:30 AM | ☐ | ☑ | |

  - **Delivery**: `Physical` (gets tutes in class), `Pickup` (collects at a center), or `Courier`.
  - **Center**: the ONE center where they get tutes. Leave blank for courier. A coordinator only sees students of their own center.
  - **Pickup Date / Time**: shown to staff and put in the WhatsApp message. A guide only; students outside their slot are not blocked.
  - Cells turn **red** where Index / Mobile / NIC repeat (same student twice).

Coordinators open the Vercel link **in the phone's main browser** (Chrome on Android, Safari on iPhone), not inside WhatsApp, because that's where the camera opens scanned QR codes.

## Every month

1. **Paid**: tick students who paid (untick everyone at the start of the month).
2. **Tute columns**: tick the tutes each student should get. Tutes already collected never show again, so old ticks can stay.
3. **Pickup Date / Time**: set the new slots, then **Tute Pickup → QR cards** and press **WhatsApp** to message the new time (the QR itself doesn't change).
4. Courier list = filter Students by `Delivery = Courier`. **Log** tab = full record: one row per tute given, with when, where and which coordinator.

## QR codes → students (WhatsApp)

Reopen the Sheet (the menu appears after a fresh load) → **Tute Pickup → QR cards**. Each student gets one QR (with the logo) that stays the same all year:

1. **Download** → saves `260001.png`. 2. **WhatsApp** → opens that student's chat with the message typed. 3. Attach the image and send.

If **Download** does nothing, right-click the QR → **Save image as**. The cards dialog only opens for people who can edit the Sheet.

## Changing the code

```
npm install
npm run dev          # local preview with fake data: PIN 123456, index 260001 (/cards.html for the QR page)
npm test             # pickup rules + API gateway checks
npm run build        # the Vercel app (Vercel runs this itself)
npm run build:cards  # rebuilds apps-script/Cards.html — paste it over the Cards file in Apps Script
```

- **Code.gs changed**: Apps Script → **Deploy → Manage deployments → ✏️ → Version: New version**. A *new* deployment changes the link and you'd have to update `APPS_SCRIPT_URL`.
- **Cards.html changed**: paste it into the `Cards` file (no redeploy needed, only the Sheet menu uses it).
- **Upgrading from the earlier Apps Script–only version**: delete the old **Extra Tutes** column, the **Tutes** tab and the **PIN** row in Settings, then run `setup`.
