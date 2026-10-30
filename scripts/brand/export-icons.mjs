/**
 * Docket 标记导出：深底钢笔 D（Dock / favicon）与黑色模板剪影（菜单栏）。
 * 几何与 docs/preview-letter-d.html 锁定版一致。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const VOID = "#0A0A0A";
const LETTER = "#F6F5F2";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sampleCubic(p0, p1, p2, p3, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

function sampleLine(a, b, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
  }
  return pts;
}

function concatStrokes(parts) {
  const out = [];
  for (const p of parts) {
    if (!out.length) {
      out.push(...p);
      continue;
    }
    const last = out[out.length - 1];
    const next = p[0];
    if (Math.hypot(last[0] - next[0], last[1] - next[1]) < 0.2) out.push(...p.slice(1));
    else out.push(...p);
  }
  return out;
}

function ribbon(pts, thin, thick) {
  if (pts.length < 2) return { d: "", outline: [] };
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let dx = next[0] - prev[0];
    let dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const nx = -dy;
    const ny = dx;
    const shade = Math.max(0, Math.min(1, dy * 0.92 + 0.08));
    const w = (thin + (thick - thin) * shade) / 2;
    left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  const r0 = Math.hypot(left[0][0] - right[0][0], left[0][1] - right[0][1]) / 2 || thin / 2;
  const last = pts.length - 1;
  const r1 = Math.hypot(left[last][0] - right[last][0], left[last][1] - right[last][1]) / 2 || thin / 2;
  let d = `M ${left[0][0].toFixed(2)} ${left[0][1].toFixed(2)}`;
  for (let i = 1; i < left.length; i++) d += ` L ${left[i][0].toFixed(2)} ${left[i][1].toFixed(2)}`;
  d += ` A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 0 1 ${right[last][0].toFixed(2)} ${right[last][1].toFixed(2)}`;
  for (let i = last - 1; i >= 0; i--) d += ` L ${right[i][0].toFixed(2)} ${right[i][1].toFixed(2)}`;
  d += ` A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 0 1 ${left[0][0].toFixed(2)} ${left[0][1].toFixed(2)} Z`;
  return { d, outline: left.concat(right) };
}

function penGlyph(thin, thick) {
  const stem = concatStrokes([
    sampleCubic([24, 30], [28, 18], [36, 11], [44, 16], 14),
    sampleCubic([44, 16], [42, 38], [37, 64], [33, 86], 28),
  ]);
  const stemBody = sampleCubic([44, 16], [42, 38], [37, 64], [33, 86], 28);
  const bowl = concatStrokes([
    sampleCubic([48, 18], [76, 10], [94, 30], [92, 52], 24),
    sampleCubic([92, 52], [90, 74], [70, 90], [36, 86], 24),
  ]);
  const strokes = [ribbon(stem, thin, thick), ribbon(bowl, thin, thick * 0.9)];
  const core = [ribbon(stemBody, thin, thick), strokes[1]];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of core) {
    for (const [x, y] of s.outline) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return {
    html: strokes.map((s) => `<path d="${s.d}"/>`).join(""),
    bbox: {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      w: maxX - minX,
      h: maxY - minY,
    },
  };
}

function placedGroup(size, thin, thick, fill) {
  const { html, bbox } = penGlyph(thin, thick);
  const target = size * fill;
  const scale = Math.min(target / bbox.w, target / bbox.h);
  const ox = size / 2 - bbox.cx * scale - size * 0.025;
  const oy = size / 2 - bbox.cy * scale + size * 0.02;
  return `<g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${scale.toFixed(4)})">${html}</g>`;
}

function wordmarkSvg(color) {
  const thin = 2.2;
  const thick = 9.5;
  const glyphs = {
    D: { w: 78, html: penGlyph(thin, thick).html },
    o: {
      w: 34,
      html: (() => {
        const loop = concatStrokes([
          sampleCubic([26, 50], [24, 36], [10, 38], [8, 56], 14),
          sampleCubic([8, 56], [6, 76], [18, 86], [28, 74], 14),
          sampleCubic([28, 74], [34, 64], [32, 52], [26, 50], 10),
        ]);
        return `<path d="${ribbon(loop, thin, thick * 0.62).d}"/>`;
      })(),
    },
    c: {
      w: 30,
      html: (() => {
        const open = concatStrokes([
          sampleCubic([26, 44], [18, 34], [6, 40], [6, 56], 12),
          sampleCubic([6, 56], [6, 78], [16, 86], [26, 78], 12),
        ]);
        return `<path d="${ribbon(open, thin, thick * 0.62).d}"/>`;
      })(),
    },
    k: {
      w: 36,
      html: (() => {
        const stem = sampleCubic([9, 16], [9, 16], [8, 58], [8, 84], 18);
        const arm = sampleCubic([9, 58], [16, 50], [26, 36], [32, 32], 12);
        const leg = sampleCubic([12, 56], [18, 64], [26, 80], [33, 84], 12);
        return [
          ribbon(stem, thin, thick * 0.82),
          ribbon(arm, thin, thick * 0.55),
          ribbon(leg, thin, thick * 0.62),
        ]
          .map((s) => `<path d="${s.d}"/>`)
          .join("");
      })(),
    },
    e: {
      w: 32,
      html: (() => {
        const loop = concatStrokes([
          sampleCubic([8, 58], [28, 52], [30, 40], [18, 36], 12),
          sampleCubic([18, 36], [6, 34], [4, 54], [8, 58], 10),
          sampleCubic([8, 58], [4, 74], [14, 86], [26, 80], 12),
        ]);
        return `<path d="${ribbon(loop, thin, thick * 0.62).d}"/>`;
      })(),
    },
    t: {
      w: 28,
      html: (() => {
        const stem = sampleCubic([14, 20], [14, 20], [13, 60], [16, 84], 16);
        const cross = sampleLine([4, 38], [26, 36], 8);
        return [ribbon(stem, thin, thick * 0.72), ribbon(cross, thin * 0.9, thin * 1.35)]
          .map((s) => `<path d="${s.d}"/>`)
          .join("");
      })(),
    },
  };
  const order = ["D", "o", "c", "k", "e", "t"];
  const gap = { D: -6, o: 2, c: 4, k: 2, e: 2, t: 0 };
  let x = 0;
  const parts = [];
  for (const ch of order) {
    parts.push(`<g transform="translate(${x},0)">${glyphs[ch].html}</g>`);
    x += glyphs[ch].w + (gap[ch] || 0);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 4 ${x} 92" fill="${color}" aria-label="Docket">${parts.join("")}</svg>\n`;
}

function squareIconSvg(size, fillColor, letterColor) {
  const thin = size <= 32 ? 5.5 : 3.2;
  const thick = size <= 32 ? 18 : 15;
  const fill = size <= 32 ? 0.76 : 0.68;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="${letterColor}" aria-hidden="true">
  <title>Docket</title>
  <rect width="${size}" height="${size}" fill="${fillColor}"/>
  ${placedGroup(size, thin, thick, fill)}
</svg>\n`;
}

function trayMarkSvg(size) {
  const thin = 5.5;
  const thick = 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="#000000" aria-hidden="true">
  <title>Docket</title>
  ${placedGroup(size, thin, thick, 0.76)}
</svg>\n`;
}

function write(rel, contents) {
  const path = join(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  return rel;
}

const appIcon = squareIconSvg(1024, VOID, LETTER);
write("public/app-icon.svg", appIcon);
write("public/favicon.svg", appIcon);
write("public/wordmark.svg", wordmarkSvg(LETTER));
write("public/tray-mark.svg", trayMarkSvg(1024));
console.log("wrote public/app-icon.svg public/favicon.svg public/wordmark.svg public/tray-mark.svg");
