// Local test server for the self-reporting browser harness: serves the built site (out/) with the same
// isolation headers as Cloudflare, plus /__<name>.html harness pages from this folder. Pages POST their
// results here; they are appended to result.jsonl (git-ignored).
//   node tools/harness/server.mjs [outDir] [port]   then open http://127.0.0.1:8791/__solve.html
import { appendFile, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(process.argv[2] || path.join(here, '../../out'));
const port = +process.argv[3] || 8791;
const slow = +process.env.SLOW || 0;   // ms per MB for model parts (/m/): mimics a phone connection
// network profile for model parts, switchable at runtime by a harness page (POST /__profile):
// { rate: KB/s per stream, jitter: 0-1, stallEvery: KB, stallMs, latency: ms before the first byte }
let profile = null, net = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// One shared line for all model downloads, like a real connection: { mbps | schedule: [[seconds, mbps], ...] (cycled),
// rtt (ms per request), jitter (0-1), stallEveryMB + stallMs, skip (share of each part sent at once: jump to the end
// game of a slow download), dropAtMB (cut the connection once, mid-download) }
function rateAt(t) {
  if (!profile.schedule) return profile.mbps * 125000;
  const cycle = profile.schedule.reduce((x, [s]) => x + s, 0);
  let k = ((t - net.start) / 1000) % cycle;
  for (const [s, mbps] of profile.schedule) { if (k < s) return mbps * 125000; k -= s; }
  return profile.schedule[0][1] * 125000;
}
async function throttled(res, buf) {
  const { rtt = 0, jitter = 0, stallEveryMB = 0, stallMs = 0, skip = 0, dropAtMB = 0 } = profile;
  if (rtt) await sleep(rtt);
  const first = Math.floor(buf.length * skip);
  if (first) { res.write(buf.subarray(0, first)); net.served += first; }
  const chunk = 16 * 1024;
  for (let i = first; i < buf.length; i += chunk) {
    if (res.destroyed) return;
    const n = Math.min(chunk, buf.length - i);
    // reserve time on the shared line; a dead zone (0 Mbps) waits for the next live segment
    let start = Math.max(Date.now(), net.free), rate = rateAt(start);
    while (rate === 0) { start += 250; rate = rateAt(start); }
    net.free = start + (n / rate) * 1000 * Math.max(0.05, 1 + jitter * (Math.random() * 2 - 1));
    const stallsBefore = stallEveryMB ? Math.floor(net.served / (stallEveryMB * 1e6)) : 0;
    net.served += n;
    if (stallEveryMB && Math.floor(net.served / (stallEveryMB * 1e6)) > stallsBefore) net.free += stallMs;
    await sleep(net.free - Date.now());
    if (dropAtMB && !net.dropped && net.served >= dropAtMB * 1e6) { net.dropped = true; res.destroy(); return; }
    res.write(buf.subarray(i, i + n));
  }
  res.end();
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.gz': 'application/octet-stream' };

createServer(async (req, res) => {
  // no X-Frame-Options: the harness loads the site in iframes at several widths
  const h = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'no-store' };
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/__profile') {
    let body = '';
    for await (const c of req) body += c;
    profile = body ? JSON.parse(body) : null;
    net = { start: Date.now(), free: Date.now(), served: 0, dropped: false };
    res.writeHead(204, h).end();
    return;
  }
  if (req.method === 'POST') {
    let body = '';
    for await (const c of req) body += c;
    await appendFile(path.join(here, 'result.jsonl'), body + '\n');
    res.writeHead(204, h).end();
    return;
  }
  const page = /^\/__([a-z]+)\.html$/.exec(url.pathname);
  let p = page ? path.join(here, `${page[1]}.html`) : path.join(root, decodeURIComponent(url.pathname));
  if (!p.startsWith(root) && !p.startsWith(here)) { res.writeHead(403, h).end(); return; }
  try {
    if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html');
    let buf = await readFile(p);
    const range = /^bytes=(\d+)-$/.exec(req.headers.range || '');
    if (range && +range[1] < buf.length) {
      const start = +range[1], whole = buf.length;
      buf = buf.subarray(start);
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${whole - 1}/${whole}`);
    }
    res.writeHead(res.statusCode === 206 ? 206 : 200, { ...h, 'Accept-Ranges': 'bytes', 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Content-Length': buf.length });
    if (profile && url.pathname.startsWith('/m/')) { await throttled(res, buf); return; }
    if (!slow || !url.pathname.startsWith('/m/')) { res.end(buf); return; }
    for (let i = 0; i < buf.length; i += 1 << 20) { res.write(buf.subarray(i, i + (1 << 20))); await new Promise((r) => setTimeout(r, slow)); }
    res.end();
  } catch {
    res.writeHead(404, h).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log('listening', port, 'serving', root));
