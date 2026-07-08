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
 * Usage: node server.js  (then open http://localhost:4321)
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;
const UPSTREAM = 'cursor.com';

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
    const token = req.headers['x-session-token'] || process.env.CURSOR_SESSION_TOKEN;
    if (!token) return sendJson(res, 401, { error: 'no session token: set CURSOR_SESSION_TOKEN or paste one in the UI' });
    return proxy(req, res, String(token).trim());
  }

  if (url.pathname === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  if (url.pathname === '/config') {
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
  console.log(process.env.CURSOR_SESSION_TOKEN ? 'Using session token from CURSOR_SESSION_TOKEN env var.' : 'No CURSOR_SESSION_TOKEN set — paste your token in the UI.');
});
