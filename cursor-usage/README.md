# Cursor Plan & Usage Viewer

A tiny, zero-dependency local web view of your Cursor plan and current-period
usage: plan tier, billing window, included-usage spend, total tokens, and a
per-model token/cost breakdown.

It uses the same cookie-authenticated endpoints as the official dashboard at
[cursor.com/dashboard/usage](https://cursor.com/dashboard/usage). A small local
Node proxy is required because those endpoints are CORS-restricted, so a plain
static page can't call them from the browser.

## Run

```bash
node server.js
# open http://localhost:4321
```

Requires Node 18+. No npm install needed.

## Access PIN

Every data request requires an access PIN, so the server can be exposed on
your local network (e.g. to check usage from your phone) without anyone else
on the network being able to read your data. The default PIN is `2911`;
override it with the `ACCESS_PIN` env var:

```bash
ACCESS_PIN=2911 node server.js
```

The UI asks for the PIN once per browser tab session. The PIN protects the
usage data only — don't expose the server to the public internet, since the
PIN is short and the session token it guards grants full account access.

## View from your iPhone (server on your computer)

1. Start the server on your computer with your token pre-set:

   ```bash
   CURSOR_SESSION_TOKEN='paste-value-here' node server.js
   ```

2. Find your computer's local IP (`ipconfig getifaddr en0` on macOS,
   `hostname -I` on Linux, `ipconfig` on Windows).
3. On the iPhone (same Wi-Fi), open `http://<computer-ip>:4321` in Safari and
   enter the PIN.

## Run the server on the iPhone itself

You can run the whole thing on the phone with [iSH](https://apps.apple.com/app/ish-shell/id1436902243)
(a free Alpine Linux emulator from the App Store):

1. Install iSH, open it, and install Node and curl:

   ```bash
   apk add nodejs curl
   ```

2. Download the two files from this repo:

   ```bash
   mkdir cursor-usage && cd cursor-usage
   curl -fsSLO https://raw.githubusercontent.com/xenito/xenito.github.io/master/cursor-usage/server.js
   curl -fsSLO https://raw.githubusercontent.com/xenito/xenito.github.io/master/cursor-usage/index.html
   ```

3. Start the server (paste your session token — copy it from a desktop
   browser and send it to the phone via AirDrop/Notes, or type it into the
   web UI later instead):

   ```bash
   CURSOR_SESSION_TOKEN='paste-value-here' node server.js
   ```

4. Open Safari on the same phone and go to `http://localhost:4321`.

Notes for iSH: it emulates x86, so Node starts slowly (give it ~10-30
seconds); iOS suspends background apps, so either keep iSH in the foreground
or use its "stay open in background" location trick (Settings inside iSH);
the server stops when iOS kills the app.

## Authentication

You need your Cursor session cookie. In a browser where you're signed in to
cursor.com: DevTools → Application → Cookies → `https://cursor.com` → copy the
value of `WorkosCursorSessionToken`.

Then either:

- paste it into the page when prompted, or
- export it before starting the server:

```bash
CURSOR_SESSION_TOKEN='paste-value-here' node server.js
```

The token is only ever forwarded to cursor.com; it is not stored or logged.
Treat it like a password — it grants full access to your Cursor account, and
it expires when your dashboard session does.

## What's shown

| Card | Source |
| --- | --- |
| Plan | `GET /api/auth/stripe` (membership type) |
| Billing period | `GET /api/usage` (`startOfMonth` = your cycle start) |
| Included usage spent | Sum of per-model `totalCents` vs. plan budget (Pro $20 / Pro+ $70 / Ultra $400) |
| Tokens by model | `POST /api/dashboard/get-aggregated-usage-events` |

These are undocumented dashboard endpoints, so field names may change without
notice. The numbers on cursor.com/dashboard are always authoritative.
