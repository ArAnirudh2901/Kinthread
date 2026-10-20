// Save the relationship map as a PNG, entirely on the device: the live SVG is copied with its computed
// styles inlined (classes and web fonts do not travel into an SVG drawn as an image), drawn at 2x,
// then captioned with the answer and a colour key so the picture stands on its own.

const PROPS = [
  'display', 'visibility', 'opacity', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'paint-order', 'font-family',
  'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-transform', 'text-anchor', 'dominant-baseline',
];
const KEY = [['the question', '--copper', true], ['a fact from the story', '--sea-ink', false], ['the answer', '--lichen', false]];

const first = (family) => family.split(',')[0].trim().replace(/^["']|["']$/g, '');

const asDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(blob);
});

// @font-face rules for the families the map uses, with their files inlined
async function fontCss(families) {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }   // cross-origin sheet
    for (const r of rules) {
      if (r.type !== CSSRule.FONT_FACE_RULE || !families.has(first(r.style.getPropertyValue('font-family')))) continue;
      const src = r.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/);
      if (!src) continue;
      try {
        const res = await fetch(new URL(src[1], sheet.href || location.href));
        if (!res.ok) continue;
        const url = await asDataUrl(await res.blob());
        out.push(r.cssText.replace(/src:[^;]+;/, `src: url(${url});`));
      } catch { /* a missing font falls back to the system one */ }
    }
  }
  return out.join('\n');
}

function wrap(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function downloadMap(svg, { title, subtitle, filename, legend }) {
  const vb = svg.viewBox.baseVal;
  const W = vb && vb.width ? vb.width : svg.clientWidth;
  const H = vb && vb.height ? vb.height : svg.clientHeight;
  const root = getComputedStyle(document.documentElement);
  const token = (name) => root.getPropertyValue(name).trim();

  const clone = svg.cloneNode(true);
  const from = [svg, ...svg.querySelectorAll('*')];
  const to = [clone, ...clone.querySelectorAll('*')];
  const families = new Set();
  from.forEach((el, i) => {
    const cs = getComputedStyle(el);
    if (el.tagName === 'text') families.add(first(cs.fontFamily));
    // keep GSAP's inline transforms; add the computed paint
    to[i].setAttribute('style', `${el.getAttribute('style') || ''};${PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';')}`);
  });
  clone.setAttribute('width', W);
  clone.setAttribute('height', H);
  clone.querySelectorAll('title').forEach((t) => t.remove());
  // internal hooks (data-key uses a NUL separator, invalid in XML) and a11y wiring are not part of the picture
  to.forEach((el) => [...el.attributes].forEach(({ name }) => { if (/^(data-|aria-|class$|role$)/.test(name)) el.removeAttribute(name); }));
  const css = await fontCss(families);
  if (css) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = css;
    clone.prepend(style);
  }

  const img = new Image();
  const xml = new XMLSerializer().serializeToString(clone).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();

  const sheet = svg.closest('[data-sheet]');
  const bgSheet = sheet ? getComputedStyle(sheet).backgroundColor : '';
  const bg = bgSheet && bgSheet !== 'rgba(0, 0, 0, 0)' ? bgSheet : getComputedStyle(document.body).backgroundColor;
  const ink = getComputedStyle(document.body).color;
  const muted = token('--text-2') || ink;
  const font = getComputedStyle(document.body).fontFamily;
  const mono = token('--font-mono') || 'monospace';

  const pad = 28;
  const outW = Math.max(W + pad * 2, 420);
  const textW = outW - pad * 2;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `600 19px ${font}`;
  const titleLines = title ? wrap(probe, title, textW) : [];
  probe.font = `400 12.5px ${font}`;
  const subLines = wrap(probe, subtitle || 'Kinthread', textW);
  probe.font = `500 11.5px ${mono}`;
  // colour key, flowing onto a second row when narrow
  const keyRows = [[]];
  if (legend) {
    let x = 0;
    for (const [label, color, dashed] of KEY) {
      const w = 26 + probe.measureText(label).width + 18;
      if (x + w > textW && keyRows.at(-1).length) { keyRows.push([]); x = 0; }
      keyRows.at(-1).push({ label, color: token(color), dashed, x });
      x += w;
    }
  }
  const keyH = legend ? keyRows.length * 20 + 6 : 0;
  const captionH = 18 + titleLines.length * 26 + 4 + subLines.length * 18 + 10;
  const outH = pad + H + keyH + captionH + pad / 2;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(outW * scale);
  canvas.height = Math.round(outH * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, (outW - W) / 2, pad, W, H);

  let y = pad + H;
  if (legend) {
    ctx.font = `500 11.5px ${mono}`;
    ctx.textBaseline = 'middle';
    for (const row of keyRows) {
      y += 20;
      for (const k of row) {
        ctx.strokeStyle = k.color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash(k.dashed ? [4, 4] : []);
        ctx.beginPath();
        ctx.moveTo(pad + k.x, y);
        ctx.lineTo(pad + k.x + 20, y);
        ctx.stroke();
        ctx.fillStyle = muted;
        ctx.fillText(k.label, pad + k.x + 26, y);
      }
    }
    ctx.setLineDash([]);
    y += 6;
  }
  ctx.textBaseline = 'alphabetic';
  y += 18;
  ctx.fillStyle = ink;
  ctx.font = `600 19px ${font}`;
  for (const line of titleLines) { y += 26; ctx.fillText(line, pad, y - 6); }
  y += 4;
  ctx.fillStyle = muted;
  ctx.font = `400 12.5px ${font}`;
  for (const line of subLines) { y += 18; ctx.fillText(line, pad, y - 4); }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
