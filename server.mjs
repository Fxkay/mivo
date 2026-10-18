/**
 * Minimal dependency-free development server + OpenAI ephemeral-token endpoint.
 * For production, add accounts/authentication, per-user quotas, and persistent rate limiting.
 */
import http from 'node:http';
import { getTutorInstructions } from './lesson.js';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1-mini';
const requests = new Map();
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function bodyJson(req) {
  let data = '';
  for await (const part of req) { data += part; if (data.length > 2048) throw Error('Request too large.'); }
  return JSON.parse(data || '{}');
}
async function makeToken(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    let candidate;
    try { candidate = new URL(origin); } catch { return json(res, 403, { error: 'Invalid request origin.' }); }
    const expectedHost = String(req.headers.host || '');
    if (candidate.host !== expectedHost || !['http:', 'https:'].includes(candidate.protocol))
      return json(res, 403, { error: 'Cross-origin voice requests are not allowed.' });
  }
  if (!process.env.OPENAI_API_KEY) return json(res, 503, { error: 'Live tutor needs an OPENAI_API_KEY on the server. The free guided lesson works without one.' });
  const ip = req.socket.remoteAddress || 'local';
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter(t => now - t < 600000);
  if (recent.length >= 12) return json(res, 429, { error: 'Too many voice session requests. Please try again later.' });
  recent.push(now); requests.set(ip, recent);
  try {
    const payload = await bodyJson(req);
    const uid = typeof payload.anonymousId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(payload.anonymousId) ? payload.anonymousId : ip;
    const hashed = createHash('sha256').update(uid).digest('hex');
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'OpenAI-Safety-Identifier': hashed },
      body: JSON.stringify({
        session: {
          type: 'realtime', model: MODEL, output_modalities: ['audio'],
          instructions: getTutorInstructions('learn', { step: 0 }),
          audio: {
            input: { transcription: { model: 'gpt-4o-mini-transcribe' }, turn_detection: { type: 'semantic_vad' } },
            output: { voice: 'marin' }
          }
        }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.value) return json(res, response.status >= 400 && response.status < 500 ? 502 : 503, { error: data.error?.message || 'OpenAI did not return a voice token.' });
    return json(res, 200, { value: data.value, expires_at: data.expires_at });
  } catch (err) {
    console.error('Token request failed:', err.message);
    return json(res, 500, { error: 'Could not start the live tutor. Check the server connection and API access.' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/realtime-token') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    return makeToken(req, res);
  }
  if (!['GET','HEAD'].includes(req.method || '')) return json(res, 405, { error: 'Method not allowed' });
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const path = resolve(join(root, '.' + pathname));
  if ((!path.startsWith(root + sep) && path !== root) || pathname.split('/').some(p => p.startsWith('.')) || !['.html','.js','.css','.svg'].includes(extname(path))) {
    return json(res, 404, { error: 'Not found' });
  }
  try {
    const stats = await stat(path);
    if (!stats.isFile()) throw Error('Not a file');
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': contentTypes[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { json(res, 404, { error: 'Not found' }); }
});
server.listen(PORT, HOST, () => console.log(`Mivo Dutch lesson ready → http://localhost:${PORT}\n${process.env.OPENAI_API_KEY ? 'OpenAI live tutor: configured' : 'Live tutor: requires OPENAI_API_KEY (guided lesson works without it)'}`));
