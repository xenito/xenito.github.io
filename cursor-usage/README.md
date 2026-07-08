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
