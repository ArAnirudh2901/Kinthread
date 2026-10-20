// Serves out/ with cross-origin isolation plus the WebGPU-vs-WebAssembly benchmark page.
// Usage: bun run build && node tools/bench-server.mjs  ->  open http://127.0.0.1:8791/__gpu.html
import { createServer } from 'node:http';
import { readFile, stat, appendFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../out');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const routes = {
  '/__gpu.html': path.resolve(import.meta.dirname, 'bench-webgpu.html'),
  '/__runtime.js': path.resolve(import.meta.dirname, '../src/lib/runtime.generated.js'),
};
createServer(async (req, res) => {
  const h = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cache-Control': 'no-store' };
  if (req.method === 'POST') {   // the page posts its results; printed here
    let body = '';
    for await (const c of req) body += c;
    console.log(body);
    await appendFile(path.resolve(import.meta.dirname, 'bench-results.jsonl'), `${body}\n`);
    return res.writeHead(204, h).end();
  }
  const url = new URL(req.url, 'http://x');
  let p = routes[url.pathname] || path.join(root, decodeURIComponent(url.pathname));
  try {
    if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html');
    res.writeHead(200, { ...h, 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }).end(await readFile(p));
  } catch { res.writeHead(404, h).end('not found'); }
}).listen(8791, '127.0.0.1', () => console.log('http://127.0.0.1:8791/__gpu.html'));
