// Deterministic low-resolution pixel-art generator for the Manhattan map set.
//
// Run with:  node scripts/build-maps.mjs
//
// It writes PNG artwork to public/maps/ and a TypeScript region registry to
// lib/generated-maps.ts. Everything is drawn on a coarse tile grid so the
// result shares one pixel density and palette with the existing campus map.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { manhattanOutline, manhattanAspect } from "./manhattan-outline.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PNG = path.join(ROOT, "public", "maps");
const OUT_TS = path.join(ROOT, "lib", "generated-maps.ts");

// Palette sampled from public/maps/morningside-pixel-v2.png (k-means, 14 clusters).
const P = {
  outline: "#093330",
  water: "#458cd3",
  waterHi: "#6fb0e6",
  waterLo: "#2f6fae",
  grass: "#61cf57",
  grassHi: "#a2d67b",
  grassLo: "#3fb14a",
  tree: "#3fb14a",
  treeHi: "#61cf57",
  treeLo: "#0c5e3e",
  trunk: "#694535",
  road: "#505e6f",
  roadHi: "#6b7a8c",
  roadLo: "#3d4a5a",
  line: "#faf2bf",
  sand: "#faf2bf",
  wall: "#e7cd9b",
  wallHi: "#faf2bf",
  wallLo: "#c9a873",
  roofBlue: "#458cd3",
  roofBlueHi: "#6fb0e6",
  roofRed: "#dd6c4f",
  roofRedHi: "#ea8a6d",
  stone: "#baaf9b",
  stoneLo: "#928970",
  black: "#093330",
};

const TILE = 16; // art pixels per design tile; one source of truth for density.

function rgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function shift(hex, amount) {
  const [r, g, b] = rgb(hex);
  const c = v => Math.max(0, Math.min(255, v + amount));
  return `#${[c(r), c(g), c(b)].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    // RGBA so the overworld can stay transparent outside the Manhattan contour.
    this.data = Buffer.alloc(width * height * 4);
  }
  set(x, y, color, alpha = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = color[0]; this.data[i + 1] = color[1]; this.data[i + 2] = color[2]; this.data[i + 3] = alpha;
  }
  getAlpha(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.data[(y * this.width + x) * 4 + 3];
  }
  fillRect(x, y, w, h, hex, alpha = 255) {
    const c = rgb(hex);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, alpha);
  }
  strokeRect(x, y, w, h, hex, alpha = 255) {
    this.fillRect(x, y, w, 1, hex, alpha); this.fillRect(x, y + h - 1, w, 1, hex, alpha);
    this.fillRect(x, y, 1, h, hex, alpha); this.fillRect(x + w - 1, y, 1, h, hex, alpha);
  }
  // Paint only where the contour already exists, so highlights never spill into water.
  fillRectOnLand(x, y, w, h, hex, alpha = 255) {
    const c = rgb(hex);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (this.getAlpha(x + i, y + j) > 0) this.set(x + i, y + j, c, alpha);
    }
  }
  strokeRectOnLand(x, y, w, h, hex, alpha = 255) {
    const c = rgb(hex);
    const put = (px, py) => { if (this.getAlpha(px, py) > 0) this.set(px, py, c, alpha); };
    for (let i = 0; i < w; i++) { put(x + i, y); put(x + i, y + h - 1); }
    for (let j = 0; j < h; j++) { put(x, y + j); put(x + w - 1, y + j); }
  }
  text(str, x, y, scale, hex, spacing = 1) {
    const c = rgb(hex);
    let cursor = x;
    for (const raw of str.toUpperCase()) {
      const glyph = FONT[raw] ?? FONT[" "];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] !== "#") continue;
          for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++)
            this.set(cursor + col * scale + sx, y + row * scale + sy, c, 255);
        }
      }
      cursor += (5 + spacing) * scale;
    }
    return cursor - x - spacing * scale;
  }
  async save(file) {
    await sharp(this.data, { raw: { width: this.width, height: this.height, channels: 4 } })
      .png({ compressionLevel: 9 }).toFile(file);
  }
}

// 5x7 uppercase bitmap font, so labels stay crisp at every zoom level.
const FONT = (() => {
  const G = {
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
    H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
    K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    M: ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#", "#...#"],
    N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    W: ["#...#", "#...#", "#...#", "#...#", "#.#.#", "##.##", "#...#"],
    X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    6: [".###.", "#...#", "#....", "####.", "#...#", "#...#", ".###."],
    7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    9: [".###.", "#...#", "#...#", ".####", "....#", "#...#", ".###."],
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
    ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
    "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
    "&": [".##..", "#..#.", "#..#.", ".##..", "#.#.#", "#..#.", ".##.#"],
    "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  };
  return G;
})();

function textWidth(str, scale, spacing = 1) {
  return str.length * (5 + spacing) * scale - spacing * scale;
}

// ---- Sprites ---------------------------------------------------------------

function drawTree(c, x, y, rng) {
  const jx = rng() < 0.5 ? 0 : 1;
  const xx = x + jx;
  c.fillRect(xx + 2, y + 7, 2, 4, P.trunk);
  c.fillRect(xx + 1, y + 1, 6, 8, P.treeLo);
  c.fillRect(xx, y + 3, 8, 4, P.treeLo);
  c.fillRect(xx + 2, y + 2, 4, 6, P.tree);
  c.fillRect(xx + 2, y + 2, 2, 2, P.treeHi);
}

function drawBuilding(c, x, y, w, h, roof, options = {}) {
  const roofColor = roof ?? (options.landmark ? P.roofRed : P.roofBlue);
  const roofHi = options.landmark ? P.roofRedHi : P.roofBlueHi;
  c.fillRect(x + 3, y + 4, w, h, P.outline); // drop shadow
  c.fillRect(x, y, w, h, P.wall);
  c.fillRect(x, y + h - 2, w, 2, P.wallLo);
  const rh = Math.max(4, Math.round(h * 0.34));
  c.fillRect(x, y, w, rh, roofColor);
  c.fillRect(x, y, w, 1, roofHi);
  c.fillRect(x, y + rh - 1, w, 1, shift(roofColor, -40));
  // windows
  for (let wy = y + rh + 3; wy < y + h - 4; wy += 5) {
    for (let wx = x + 3; wx < x + w - 3; wx += 5) {
      c.fillRect(wx, wy, 2, 2, P.road);
    }
  }
  if (options.tower) {
    const tw = Math.max(4, w - 8);
    c.fillRect(x + 4, y - 10, tw, 10, P.wall);
    c.fillRect(x + 4, y - 10, tw, 3, roofColor);
    c.fillRect(x + 4, y - 10, 2, 10, P.wallHi);
    c.strokeRect(x + 4, y - 10, tw, 10, P.outline);
  }
  c.strokeRect(x, y, w, h, P.outline);
  if (options.door) {
    const dw = Math.min(4, w - 6);
    c.fillRect(x + Math.round((w - dw) / 2), y + h - 7, dw, 7, P.trunk);
    c.strokeRect(x + Math.round((w - dw) / 2) - 1, y + h - 8, dw + 2, 8, P.outline);
  }
}

function drawGrass(c, x, y, w, h, rng) {
  c.fillRect(x, y, w, h, P.grass);
  const count = Math.round((w * h) / 40);
  for (let i = 0; i < count; i++) {
    const px = x + Math.floor(rng() * w);
    const py = y + Math.floor(rng() * h);
    c.fillRect(px, py, 2, 2, rng() < 0.5 ? P.grassHi : P.grassLo);
  }
}

function drawRoadH(c, x, y, w, thickness) {
  c.fillRect(x, y, w, thickness, P.road);
  c.fillRect(x, y, w, 1, P.roadLo);
  c.fillRect(x, y + thickness - 1, w, 1, P.roadLo);
  for (let i = 6; i < w - 6; i += 16) c.fillRect(x + i, y + Math.floor(thickness / 2), 8, 1, P.line);
}
function drawRoadV(c, x, y, h, thickness) {
  c.fillRect(x, y, thickness, h, P.road);
  c.fillRect(x, y, 1, h, P.roadLo);
  c.fillRect(x + thickness - 1, y, 1, h, P.roadLo);
  for (let i = 6; i < h - 6; i += 16) c.fillRect(x + Math.floor(thickness / 2), y + i, 1, 8, P.line);
}

// ---- Map assembly ----------------------------------------------------------

class Builder {
  constructor(id, label, cols, rows, seed) {
    this.id = id; this.label = label; this.cols = cols; this.rows = rows;
    this.canvas = new Canvas(cols * TILE, rows * TILE);
    this.regions = [];
    this.rng = mulberry32(seed);
  }
  region(name, col, row, w, h, extra = {}) {
    const x = col * TILE, y = row * TILE, pw = w * TILE, ph = h * TILE;
    this.regions.push({
      name,
      points: `${x},${y} ${x + pw},${y} ${x + pw},${y + ph} ${x},${y + ph}`,
      ...extra,
    });
    return { x, y, w: pw, h: ph };
  }
  // Draws a centered label inside a pixel-space box, clamped to the canvas.
  drawLabelBox(text, boxX, boxY, boxW, boxH, scale = 1, color = P.sand, halo = P.black, spacing = 1) {
    const str = text.toUpperCase();
    const width = textWidth(str, scale, spacing);
    const x = Math.max(1, Math.min(this.canvas.width - width - 1, boxX + Math.round((boxW - width) / 2)));
    const y = Math.max(1, Math.min(this.canvas.height - 7 * scale - 1, boxY + Math.round((boxH - 7 * scale) / 2)));
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      this.canvas.text(str, x + dx, y + dy, scale, halo, spacing);
    }
    this.canvas.text(str, x, y, scale, color, spacing);
  }
}

// -- Overworld (Manhattan island) -------------------------------------------

function buildOverworld() {
  const cols = 28, rows = 60;
  const b = new Builder("manhattan", "Manhattan", cols, rows, 991);
  const c = b.canvas;
  const W = cols * TILE, H = rows * TILE;

  // Real Manhattan coastline (scripts/manhattan-outline.mjs), scaled so both
  // axes share units. The ocean stays transparent around the contour.
  const offsetX = (W - manhattanAspect * H) / 2;
  const poly = manhattanOutline.map(([x, y]) => [x * H + offsetX, y * H]);
  const spanAt = y => {
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i + 1 < xs.length; i += 2) { lo = Math.min(lo, xs[i]); hi = Math.max(hi, xs[i + 1]); }
    return lo <= hi ? [lo, hi] : null;
  };
  const rawL = new Array(H).fill(NaN), rawR = new Array(H).fill(NaN);
  for (let y = 0; y < H; y++) { const span = spanAt(y); if (span) { rawL[y] = span[0]; rawR[y] = span[1]; } }
  // Smooth the coast so pier stubs read as one clean pixel outline.
  const smooth = values => {
    const out = new Array(H).fill(NaN), half = 5;
    for (let y = 0; y < H; y++) {
      if (Number.isNaN(values[y])) continue;
      let sum = 0, n = 0;
      for (let j = y - half; j <= y + half; j++) { if (j < 0 || j >= H || Number.isNaN(values[j])) continue; sum += values[j]; n++; }
      out[y] = sum / n;
    }
    return out;
  };
  const left = smooth(rawL), right = smooth(rawR);
  const yAt = t => Math.min(H - 1, Math.max(0, Math.round(t * (H - 1))));
  const edgeAt = t => { const y = yAt(t); return [left[y], right[y]]; };
  const xAt = (t, f) => { const [l, r] = edgeAt(t); return l + f * (r - l); };

  // North-to-south bands, each split into one or more named neighborhoods.
  const bands = [
    { t0: 0.000, t1: 0.050, splits: [],           names: ["Inwood"] },
    { t0: 0.050, t1: 0.115, splits: [0.46],       names: ["Hudson", "Fort G."] },
    { t0: 0.115, t1: 0.200, splits: [],           names: ["Wash. Heights"] },
    { t0: 0.200, t1: 0.270, splits: [],           names: ["Hamilton Hts"] },
    { t0: 0.270, t1: 0.345, splits: [0.48],       names: ["M'ville", "Harlem"] },
    { t0: 0.345, t1: 0.420, splits: [0.50],       names: ["Columbia", "East Harlem"] },
    { t0: 0.420, t1: 0.500, splits: [0.30, 0.62], names: ["UWS", "Central Pk", "UES"] },
    { t0: 0.500, t1: 0.575, splits: [0.30, 0.62], names: ["Hell's K", "Times Sq", "Midtown E"] },
    { t0: 0.575, t1: 0.645, splits: [0.30, 0.62], names: ["Chelsea", "Garment", "Murray Hill"] },
    { t0: 0.645, t1: 0.720, splits: [0.31, 0.60], names: ["Greenwich", "Union Sq", "Gramercy"] },
    { t0: 0.720, t1: 0.795, splits: [0.30, 0.62], names: ["SoHo", "NoHo", "East Vlg"] },
    { t0: 0.795, t1: 0.870, splits: [0.32, 0.64], names: ["Tribeca", "Chinatown", "Lower E"] },
    { t0: 0.870, t1: 0.940, splits: [0.46],       names: ["Battery Pk", "Financial"] },
    { t0: 0.940, t1: 1.000, splits: [],           names: ["Battery"] },
  ];
  const DETAILED = new Set(["Columbia"]);
  const DARK = "#0a1a2b";
  const BOUNDARY = "#9fb6cc";
  const edgesOf = band => [0, ...band.splits, 1];

  // 1. fill every region: Columbia bright, all other districts dark.
  for (const band of bands) {
    const edges = edgesOf(band);
    for (let y = yAt(band.t0); y < yAt(band.t1); y++) {
      const l = left[y], r = right[y];
      if (Number.isNaN(l)) continue;
      for (let i = 0; i < band.names.length; i++) {
        const xa = Math.round(l + edges[i] * (r - l)), xb = Math.round(l + edges[i + 1] * (r - l));
        if (xb <= xa) continue;
        const detailed = DETAILED.has(band.names[i]);
        c.fillRect(xa, y, xb - xa, 1, detailed ? P.grass : DARK, detailed ? 235 : 175);
      }
    }
  }
  // 2. darker rim so the contour reads against the water.
  for (let y = 0; y < H; y++) {
    if (Number.isNaN(left[y])) continue;
    c.fillRect(Math.round(left[y]), y, 2, 1, "#000000", 220);
    c.fillRect(Math.round(right[y]) - 2, y, 2, 1, "#000000", 220);
  }
  // 3. light boundaries between neighborhoods.
  for (const band of bands) {
    for (const t of [band.t0, band.t1]) {
      const y = yAt(t);
      if (Number.isNaN(left[y])) continue;
      const xa = Math.round(left[y]), xb = Math.round(right[y]);
      c.fillRect(xa, y, xb - xa, 1, BOUNDARY, 205);
    }
    for (const split of band.splits) {
      for (let y = yAt(band.t0); y <= yAt(band.t1); y++) {
        if (Number.isNaN(left[y])) continue;
        c.fillRect(Math.round(left[y] + split * (right[y] - left[y])), y, 1, 1, BOUNDARY, 205);
      }
    }
  }
  // 4. bright outline around the detailed district.
  for (const band of bands) {
    const edges = edgesOf(band);
    for (let i = 0; i < band.names.length; i++) {
      if (!DETAILED.has(band.names[i])) continue;
      const f0 = edges[i], f1 = edges[i + 1];
      for (let y = yAt(band.t0); y <= yAt(band.t1); y++) {
        if (Number.isNaN(left[y])) continue;
        c.fillRect(Math.round(left[y] + f0 * (right[y] - left[y])), y, 1, 1, P.sand, 255);
        c.fillRect(Math.round(left[y] + f1 * (right[y] - left[y])) - 1, y, 1, 1, P.sand, 255);
      }
      for (const t of [band.t0, band.t1]) {
        const y = yAt(t);
        if (Number.isNaN(left[y])) continue;
        const xa = Math.round(left[y] + f0 * (right[y] - left[y]));
        const xb = Math.round(left[y] + f1 * (right[y] - left[y]));
        c.fillRect(xa, y, xb - xa, 1, P.sand, 255);
      }
    }
  }
  // 5. hit regions + labels.
  for (const band of bands) {
    const y0 = yAt(band.t0), y1 = yAt(band.t1);
    const edges = edgesOf(band);
    for (let i = 0; i < band.names.length; i++) {
      const name = band.names[i];
      const detailed = DETAILED.has(name);
      const f0 = edges[i], f1 = edges[i + 1];
      const points = [
        `${Math.round(xAt(band.t0, f0))},${y0}`,
        `${Math.round(xAt(band.t0, f1))},${y0}`,
        `${Math.round(xAt(band.t1, f1))},${y1}`,
        `${Math.round(xAt(band.t1, f0))},${y1}`,
      ].join(" ");
      b.regions.push({ name, points, kind: "district", ...(detailed ? { goto: "columbia" } : {}) });
      const mid = (band.t0 + band.t1) / 2;
      const boxX = Math.round(xAt(mid, f0));
      const boxW = Math.round(xAt(mid, f1)) - boxX;
      b.drawLabelBox(name, boxX, y0, boxW, y1 - y0, 1, detailed ? P.outline : "#c7d3dd", detailed ? P.sand : "#000000", 0);
    }
  }

  return b;
}

// -- Local neighborhood maps -------------------------------------------------

function localMap(config) {
  const { id, label, seed, places, park = null, water = null } = config;
  const cols = 40, rows = 30;
  const b = new Builder(id, label, cols, rows, seed);
  const c = b.canvas;
  const W = cols * TILE, H = rows * TILE;

  drawGrass(c, 0, 0, W, H, b.rng);

  // road grid
  const roadRows = [4, 11, 18, 25];
  const roadCols = [5, 13, 21, 29, 36];
  for (const row of roadRows) drawRoadH(c, 0, row * TILE, W, 3);
  for (const col of roadCols) drawRoadV(c, col * TILE, 0, H, 3);

  // optional water strip on the right edge
  if (water) {
    c.fillRect((cols - water) * TILE, 0, water * TILE, H, P.water);
    for (let i = 0; i < 160; i++) {
      const x = (cols - water) * TILE + Math.floor(b.rng() * water * TILE);
      const y = Math.floor(b.rng() * H);
      c.fillRect(x, y, 3, 1, b.rng() < 0.5 ? P.waterHi : P.waterLo);
    }
  }

  // filler buildings in the blocks, decorative (skip the named-place footprints)
  const occupied = places.map(p => ({ c0: p[1], r0: p[2], c1: p[1] + p[3], r1: p[2] + p[4] }));
  const inOccupied = (c0, r0, c1, r1) =>
    occupied.some(o => c0 < o.c1 && c1 > o.c0 && r0 < o.r1 && r1 > o.r0);
  // Leave a one-tile grass margin so no building is clipped by the map edge.
  const blockCols = [[1, 4], [6, 12], [14, 20], [22, 28], [30, 35], [37, 38]];
  const blockRows = [[1, 3], [5, 10], [12, 17], [19, 24], [26, 28]];
  for (const [r0, r1] of blockRows) {
    for (const [c0, c1] of blockCols) {
      const bw = c1 - c0 + 1, bh = r1 - r0 + 1;
      if (bw < 3 || bh < 3) continue;
      if (water && c0 >= cols - water) continue;
      const wanted = bw >= 6 && bh >= 5 ? 2 : 1;
      let placed = 0;
      for (let attempt = 0; attempt < 8 && placed < wanted; attempt++) {
        const w = 3 + Math.floor(b.rng() * Math.min(3, bw - 2));
        const h = 3 + Math.floor(b.rng() * Math.min(3, bh - 2));
        const cc = c0 + Math.floor(b.rng() * (bw - w));
        const rr = r0 + Math.floor(b.rng() * (bh - h));
        if (inOccupied(cc, rr, cc + w, rr + h)) continue;
        drawBuilding(c, cc * TILE, rr * TILE, w * TILE, h * TILE,
          b.rng() < 0.5 ? P.roofBlue : P.roofRed, { door: b.rng() < 0.6 });
        placed++;
      }
      for (let t = 0; t < 3; t++) {
        const tc = c0 + Math.floor(b.rng() * bw), tr = r0 + Math.floor(b.rng() * bh);
        if (inOccupied(tc, tr, tc + 1, tr + 1)) continue;
        drawTree(c, (tc * TILE) & ~1, (tr * TILE) & ~1, b.rng);
      }
    }
  }

  if (park) {
    drawGrass(c, park[0] * TILE, park[1] * TILE, park[2] * TILE, park[3] * TILE, b.rng);
    for (let i = 0; i < 26; i++) {
      const tx = park[0] * TILE + Math.floor(b.rng() * park[2] * TILE);
      const ty = park[1] * TILE + Math.floor(b.rng() * park[3] * TILE);
      drawTree(c, tx & ~1, ty & ~1, b.rng);
    }
  }

  // named places (the clickable locations)
  for (const place of places) {
    const [name, col, row, w, h, opts = {}] = place;
    const r = b.region(name, col, row, w, h, { kind: "place" });
    if (opts.park) {
      drawGrass(c, r.x, r.y, r.w, r.h, b.rng);
      for (let t = 0; t < Math.round((r.w * r.h) / 900); t++) {
        const tx = r.x + 6 + Math.floor(b.rng() * (r.w - 12));
        const ty = r.y + 6 + Math.floor(b.rng() * (r.h - 12));
        drawTree(c, tx & ~1, ty & ~1, b.rng);
      }
    } else if (opts.water) {
      c.fillRect(r.x, r.y, r.w, r.h, P.water);
      c.strokeRect(r.x, r.y, r.w, r.h, P.grassLo);
    } else {
      drawBuilding(c, r.x, r.y, r.w, r.h, opts.roof ?? P.roofBlue,
        { landmark: true, tower: opts.tower, door: true });
    }
  }
  return b;
}

const LOCAL_MAPS = [
  {
    id: "harlem", label: "Harlem", seed: 101,
    places: [
      ["Apollo Theater", 6, 5, 5, 4, { roof: P.roofRed, tower: true }],
      ["Studio Museum", 14, 5, 5, 4, { roof: P.roofBlue }],
      ["Schomburg Center", 22, 5, 5, 4, { roof: P.roofRed }],
      ["125th Street", 6, 19, 6, 3, { park: true }],
      ["Harlem Meer", 30, 19, 6, 5, { water: true }],
      ["Sylvia's", 14, 26, 4, 3, { roof: P.roofRed }],
    ],
  },
  {
    id: "centralpark", label: "Central Park", seed: 202,
    places: [
      ["Bethesda Terrace", 6, 5, 7, 5, { park: true }],
      ["Bow Bridge", 15, 5, 5, 5, { water: true }],
      ["Belvedere Castle", 22, 5, 6, 5, { roof: P.roofRed, tower: true }],
      ["Great Lawn", 6, 19, 8, 7, { park: true }],
      ["Strawberry Fields", 15, 19, 6, 5, { park: true }],
      ["Central Park Zoo", 22, 19, 6, 5, { roof: P.roofBlue }],
      ["Loeb Boathouse", 30, 19, 6, 5, { water: true }],
    ],
  },
  {
    id: "timessquare", label: "Times Square", seed: 303,
    places: [
      ["Times Square Plaza", 6, 5, 8, 5, { park: true }],
      ["One Times Square", 16, 5, 5, 6, { roof: P.roofRed, tower: true }],
      ["Broadway Theaters", 23, 5, 7, 4, { roof: P.roofRed }],
      ["TKTS Booth", 6, 19, 5, 4, { roof: P.roofBlue }],
      ["Madame Tussauds", 13, 19, 5, 4, { roof: P.roofRed }],
      ["Port Authority", 21, 19, 8, 5, { roof: P.roofBlue }],
    ],
  },
  {
    id: "unionsquare", label: "Union Square", seed: 404,
    places: [
      ["Union Square Park", 6, 5, 9, 7, { park: true }],
      ["Greenmarket", 6, 19, 6, 4, { park: true }],
      ["George Washington Statue", 14, 19, 5, 4, { park: true }],
      ["Union Square Station", 21, 5, 8, 4, { roof: P.roofBlue }],
      ["The Strand", 21, 19, 6, 4, { roof: P.roofRed }],
      ["Forbidden Planet", 29, 19, 5, 4, { roof: P.roofBlue }],
    ],
  },
  {
    id: "soho", label: "SoHo", seed: 505,
    places: [
      ["Cast-Iron District", 6, 5, 7, 6, { roof: P.roofRed, tower: true }],
      ["Prince Street", 15, 5, 5, 4, { roof: P.roofBlue }],
      ["Broadway Shopping", 22, 5, 8, 4, { roof: P.roofRed }],
      ["Spring Street", 6, 19, 6, 4, { roof: P.roofBlue }],
      ["SoHo Square", 14, 19, 6, 5, { park: true }],
      ["Crosby Street", 22, 19, 6, 4, { roof: P.roofRed }],
    ],
  },
  {
    id: "wallstreet", label: "Financial District", seed: 606,
    places: [
      ["New York Stock Exchange", 6, 5, 7, 6, { roof: P.roofBlue, tower: true }],
      ["Federal Hall", 15, 5, 6, 5, { roof: P.roofRed }],
      ["Charging Bull", 23, 5, 5, 5, { park: true }],
      ["Wall Street", 6, 19, 8, 5, { park: true }],
      ["Trinity Church", 16, 19, 6, 5, { roof: P.roofRed, tower: true }],
      ["Battery Park", 26, 19, 8, 6, { park: true }],
    ],
  },
];

// ---- Emit ------------------------------------------------------------------

function ts(mapList) {
  const entries = mapList.map(m => {
    const regions = m.regions.map(r => {
      const parts = [`name: ${JSON.stringify(r.name)}`, `points: ${JSON.stringify(r.points)}`];
      if (r.goto) parts.push(`goto: ${JSON.stringify(r.goto)}`);
      if (r.kind) parts.push(`kind: ${JSON.stringify(r.kind)}`);
      return `    { ${parts.join(", ")} },`;
    }).join("\n");
    return `  {\n    id: ${JSON.stringify(m.id)},\n    label: ${JSON.stringify(m.label)},\n    width: ${m.width},\n    height: ${m.height},\n    image: "/maps/${m.id}-pixel.png",\n    regions: [\n${regions}\n    ],\n  },`;
  }).join("\n");
  return `// AUTO-GENERATED by scripts/build-maps.mjs. Do not edit by hand.\nexport type MapRegion = {\n  name: string;\n  points: string;\n  goto?: string;\n  kind?: "district" | "place";\n};\nexport type GeneratedMap = {\n  id: string;\n  label: string;\n  width: number;\n  height: number;\n  image: string;\n  regions: MapRegion[];\n};\nexport const generatedMaps: GeneratedMap[] = [\n${entries}\n];\n`;
}

async function main() {
  const builders = [buildOverworld(), ...LOCAL_MAPS.map(localMap)];
  const list = [];
  for (const b of builders) {
    await b.canvas.save(path.join(OUT_PNG, `${b.id}-pixel.png`));
    list.push({
      id: b.id, label: b.label,
      width: b.canvas.width, height: b.canvas.height,
      regions: b.regions,
    });
  }
  const fs = await import("node:fs/promises");
  await fs.writeFile(OUT_TS, ts(list));
  console.log(`Wrote ${builders.length} maps and ${OUT_TS}`);
  for (const m of list) console.log(`  ${m.id}: ${m.width}x${m.height}, ${m.regions.length} regions`);
}

main();
