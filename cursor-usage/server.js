#!/usr/bin/env node
/**
 * Cursor plan & usage viewer — zero-dependency Node server.
 *
 * Serves the single-page UI and proxies requests to cursor.com's dashboard
 * API (which is cookie-authenticated and CORS-restricted, so a browser page
 * cannot call it directly).
 *
 * Auth: your WorkosCursorSessionToken cookie value, either via the
 * CURSOR_SESSION_TOKEN env var or pasted into the UI (sent per-request in the
 * x-session-token header; never persisted server-side).
 *
 * Access control: all data endpoints require an access PIN (default 2911,
 * override with the ACCESS_PIN env var) so the server can be exposed on a
 * local network, e.g. to view from a phone.
 *
 * Usage: node server.js  (then open http://localhost:4321)
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;
const UPSTREAM = 'cursor.com';
const ACCESS_PIN = process.env.ACCESS_PIN || '2911';

function pinOk(req) {
  const given = String(req.headers['x-access-pin'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(ACCESS_PIN).digest();
  return crypto.timingSafeEqual(a, b);
}

// Only these upstream paths may be proxied.
const ALLOWED = new Set([
  '/api/auth/me',
  '/api/auth/stripe',
  '/api/usage',
  '/api/dashboard/get-aggregated-usage-events',
  '/api/dashboard/get-filtered-usage-events',
  '/api/dashboard/get-hard-limit',
]);

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function proxy(req, res, token) {
  const url = new URL(req.url, 'http://localhost');
  const upstreamPath = url.pathname.replace(/^\/proxy/, '') + url.search;
  const bare = upstreamPath.split('?')[0];
  if (!ALLOWED.has(bare)) return sendJson(res, 403, { error: 'path not allowed: ' + bare });

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const upstreamReq = https.request(
      {
        hostname: UPSTREAM,
        path: upstreamPath,
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
          Cookie: 'WorkosCursorSessionToken=' + token,
          Origin: 'https://' + UPSTREAM,
          Referer: 'https://' + UPSTREAM + '/dashboard',
          'User-Agent': 'Mozilla/5.0 (cursor-usage-viewer)',
        },
      },
      (upstreamRes) => {
        const out = [];
        upstreamRes.on('data', (c) => out.push(c));
        upstreamRes.on('end', () => {
          const payload = Buffer.concat(out);
          res.writeHead(upstreamRes.statusCode || 502, {
            'Content-Type': upstreamRes.headers['content-type'] || 'application/json',
          });
          res.end(payload);
        });
      }
    );
    upstreamReq.on('error', (err) => sendJson(res, 502, { error: 'upstream request failed: ' + err.message }));
    upstreamReq.end(body);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/proxy/')) {
    if (!pinOk(req)) return sendJson(res, 403, { error: 'wrong PIN', pinRequired: true });
    const token = req.headers['x-session-token'] || process.env.CURSOR_SESSION_TOKEN;
    if (!token) return sendJson(res, 401, { error: 'no session token: set CURSOR_SESSION_TOKEN or paste one in the UI' });
    return proxy(req, res, String(token).trim());
  }

  if (url.pathname === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  // Doubles as the PIN check for the UI: 403 until the correct PIN is supplied.
  if (url.pathname === '/config') {
    if (!pinOk(req)) return sendJson(res, 403, { error: 'wrong PIN', pinRequired: true });
    return sendJson(res, 200, { hasEnvToken: Boolean(process.env.CURSOR_SESSION_TOKEN) });
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const file = path.join(__dirname, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) return sendJson(res, 500, { error: 'index.html missing' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`Cursor usage viewer running at http://localhost:${PORT}`);
  console.log(`Access PIN: ${ACCESS_PIN}${process.env.ACCESS_PIN ? '' : ' (default — override with the ACCESS_PIN env var)'}`);
  console.log(process.env.CURSOR_SESSION_TOKEN ? 'Using session token from CURSOR_SESSION_TOKEN env var.' : 'No CURSOR_SESSION_TOKEN set — paste your token in the UI.');
});
