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
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.gz': 'application/octet-stream' };

createServer(async (req, res) => {
  // no X-Frame-Options: the harness loads the site in iframes at several widths
  const h = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'no-store' };
  const url = new URL(req.url, 'http://x');
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
    res.writeHead(200, { ...h, 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }).end(await readFile(p));
  } catch {
    res.writeHead(404, h).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log('listening', port, 'serving', root));
