// The F3 debug screen of Minecraft Java 1.7.10, read from GuiIngame.renderGameOverlay (bbv.a(float,boolean,int,int), the
// "debug" profiler section), Minecraft.runGameLoop (bao) and RenderGlobal (bma) with javap; every format string, position and colour
// below is in public/research/debug-screen-reference.json. This file holds the pure line/pie builders (tested in
// debug-overlay.test.js) and a small DOM/canvas renderer; main.js only feeds it the player and world state each frame.
//
// bytecode-read: left column drawStringWithShadow at x 2: the five lines y 2..42 in white (0xFFFFFF), then x/y/z/f/lc/ws at
// y 64, 72, 80, 88, 96, 104 in 0xE0E0E0; right column right aligned at scaledWidth - width - 2, y 2 and 12, 0xE0E0E0; no
// background box. Shift+F3 (bbj.ay = Shift held when F3 goes down) draws the profiler pie of Minecraft.a(long) in raw pixels.
import * as THREE from "three";
import { bitmapHtml } from "./bitmap-text.js";
import { font, getStringWidth } from "./font-renderer.js";
import { javaFloat } from "./options-txt.js";
import { javaFixed } from "./profiler.js";
import { lightOpacity } from "./lighting.js";

const f = Math.fround;
export const WHITE = 0xffffff, GREY = 0xe0e0e0; // 16777215 and 14737632
// Direction.directions (p.c): the names for (yaw * 4 / 360 + 0.5) floored & 3.
export const FACING = Object.freeze(["SOUTH", "WEST", "NORTH", "EAST"]);
export const LEFT_X = 2;
export const LEFT_Y = Object.freeze({ title: 2, renderers: 12, entities: 22, particles: 32, chunkCache: 42, x: 64, y: 72, z: 80, facing: 88, light: 96, walk: 104, shader: 112 });
export const RIGHT_X_MARGIN = 2, RIGHT_Y = Object.freeze({ used: 2, allocated: 12 });
export const WALK_SPEED = f(0.1), FLY_SPEED = f(0.05); // PlayerCapabilities defaults (yw: g = 0.1F, f = 0.05F)

// MathHelper.floor_double (qh.c(double)).
export const floorD = (v) => { const i = Math.trunc(v); return v < i ? i - 1 : i; };
// MathHelper.wrapAngleTo180_float (qh.g): float % 360, then one fold into [-180, 180).
export function wrapAngle(a) {
  let v = f(f(a) % 360);
  if (v >= 180) v = f(v - 360);
  if (v < -180) v = f(v + 360);
  return v;
}
// The "f:" index: floor(yaw * 4.0F / 360.0F (float) + 0.5D) & 3.
export const facingIndex = (yaw) => floorD(f(f(f(yaw) * 4) / 360) + 0.5) & 3;
// The port's yaw (radians, 0 faces -Z as in three.js) to Entity.rotationYaw degrees (0 faces +Z, increasing towards west).
export const nativeYaw = (yaw) => f(180 - (yaw * 180) / Math.PI);
// "x: %.5f (%d) // c: %d (%d)": the block coordinate, its chunk (>> 4) and the offset in the chunk (& 15).
export const chunkCoords = (n) => ({ block: n, chunk: n >> 4, local: n & 15 });
const df = (d) => javaFixed(f(d), 3); // a Float argument is widened to double before %.3f

/** "Minecraft 1.7.10 (" + debugFPS-string + ")" with Minecraft.debug = "N fps, M chunk updates". */
export const titleLine = (fps, chunkUpdates) => `Minecraft 1.7.10 (${fps} fps, ${chunkUpdates} chunk updates)`;
// RenderGlobal.getDebugInfoRenders (bma.d) and getDebugInfoEntities (bma.e).
export const rendersLine = (r) => `C: ${r.rendered}/${r.loaded}. F: ${r.clipped}, O: ${r.occluded}, E: ${r.skipping}`;
export const entitiesLine = (e) => `E: ${e.rendered}/${e.total}. B: ${e.hidden}, I: ${e.total - e.hidden - e.rendered}`;
// Minecraft.getParticleStatistics (bao.t): "P: " + EffectRenderer.getStatistics() + ". T: " + World.getDebugLoadedEntities() ("All: n").
export const particlesLine = (particles, entities) => `P: ${particles}. T: All: ${entities}`;
// World.getProviderName on a WorldClient: ChunkProviderClient.makeString.
export const chunkCacheLine = (loaded, listed = loaded) => `MultiplayerChunkCache: ${loaded}, ${listed}`;
export const xLine = (x) => { const c = chunkCoords(floorD(x)); return `x: ${javaFixed(x, 5)} (${c.block}) // c: ${c.chunk} (${c.local})`; };
export const zLine = (z) => { const c = chunkCoords(floorD(z)); return `z: ${javaFixed(z, 5)} (${c.block}) // c: ${c.chunk} (${c.local})`; };
export const yLine = (feet, eyes) => `y: ${javaFixed(feet, 3)} (feet pos, ${javaFixed(eyes, 3)} eyes pos)`;
export const facingLine = (yawDeg) => { const i = facingIndex(yawDeg); return `f: ${i} (${FACING[i]}) / ${javaFloat(wrapAngle(yawDeg))}`; };
// "lc: " + (topFilledSegment + 15) + " b: " + biome + " bl: " + block + " sl: " + sky + " rl: " + real (apx.b(x & 15, y, z & 15, 0)).
export const lightLine = (l) => `lc: ${l.topSegment + 15} b: ${l.biome} bl: ${l.block} sl: ${l.sky} rl: ${l.real}`;
export const walkLine = (walk, fly, onGround, height) => `ws: ${df(walk)}, fs: ${df(fly)}, g: ${!!onGround}, fl: ${height}`;

/** The left column: [{ text, y, color }] from a state read off the world; the lc line needs a loaded chunk and 0 <= y < 256. */
export function leftLines(s) {
  const out = [
    { text: titleLine(s.fps, s.chunkUpdates), y: LEFT_Y.title, color: WHITE },
    { text: rendersLine(s.renders), y: LEFT_Y.renderers, color: WHITE },
    { text: entitiesLine(s.entities), y: LEFT_Y.entities, color: WHITE },
    { text: particlesLine(s.particles, s.entities.total), y: LEFT_Y.particles, color: WHITE },
    { text: chunkCacheLine(s.chunkCache), y: LEFT_Y.chunkCache, color: WHITE },
    { text: xLine(s.x), y: LEFT_Y.x, color: GREY },
    { text: yLine(s.feetY, s.eyeY), y: LEFT_Y.y, color: GREY },
    { text: zLine(s.z), y: LEFT_Y.z, color: GREY },
    { text: facingLine(s.yaw), y: LEFT_Y.facing, color: GREY },
  ];
  if (s.light) out.push({ text: lightLine(s.light), y: LEFT_Y.light, color: GREY });
  out.push({ text: walkLine(s.walkSpeed ?? WALK_SPEED, s.flySpeed ?? FLY_SPEED, s.onGround, s.height), y: LEFT_Y.walk, color: GREY });
  return out;
}

// Runtime.maxMemory / totalMemory / freeMemory: long division throughout, then / 1024 / 1024.
const mb = (n) => Math.trunc(Math.trunc(n / 1024) / 1024);
export const usedMemoryLine = (max, total, free) => { const used = total - free; return `Used memory: ${max > 0 ? Math.trunc((used * 100) / max) : 0}% (${mb(used)}MB) of ${mb(max)}MB`; };
export const allocatedMemoryLine = (max, total) => `Allocated memory: ${max > 0 ? Math.trunc((total * 100) / max) : 0}% (${mb(total)}MB)`;
/** assumed: the browser has no Runtime. performance.memory (Chromium) gives limit / total / used heap; elsewhere the limit falls back to
 *  navigator.deviceMemory GiB (assumed) and the heap to 0. */
export function readMemory(perf = globalThis.performance, nav = globalThis.navigator) {
  const m = perf?.memory;
  if (m && m.jsHeapSizeLimit) return { max: m.jsHeapSizeLimit, total: m.totalJSHeapSize, free: m.totalJSHeapSize - m.usedJSHeapSize };
  return { max: (nav?.deviceMemory || 0) * 1024 ** 3, total: 0, free: 0 };
}
/** The right column, right aligned: [{ text, x, y, color }] with x = scaledWidth - getStringWidth - 2. */
export function rightLines(mem, scaledWidth, width = getStringWidth) {
  const a = usedMemoryLine(mem.max, mem.total, mem.free), b = allocatedMemoryLine(mem.max, mem.total);
  return [
    { text: a, x: scaledWidth - width(a) - RIGHT_X_MARGIN, y: RIGHT_Y.used, color: GREY },
    { text: b, x: scaledWidth - width(b) - RIGHT_X_MARGIN, y: RIGHT_Y.allocated, color: GREY },
  ];
}

// ---- the Shift+F3 profiler pie (Minecraft.a(long), bao) ----
export const PIE = Object.freeze({ radius: 160, margin: 10, extrude: 10, alpha: 200, backX: 176, backTop: 112, steps: 4 });
/** String.hashCode, then Result.getColor: (hash & 0xAAAAAA) + 0x444444. */
export function javaHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; }
export const sectorColor = (name) => (javaHash(name) & 0xaaaaaa) + 0x444444;
export const sideColor = (c) => (c & 0xfefefe) >> 1;
// DecimalFormat("##0.00"): at least one integer digit, two decimals, no grouping.
export const pct = (v) => v.toFixed(2);
/** Minecraft.b(int) (updateDebugProfilerName): 0 goes up one level, n picks the nth row (not "unspecified"). */
export function selectSection(profiler, name, digit) {
  const list = profiler.results(name);
  if (!list || !list.length) return name;
  const self = list.shift();
  if (digit === 0) {
    if (self.name.length > 0) { const i = name.lastIndexOf("."); if (i >= 0) return name.substring(0, i); }
    return name;
  }
  const row = list[digit - 1];
  if (row && row.name !== "unspecified") return (name.length > 0 ? name + "." : name) + row.name;
  return name;
}
/** The pie of results(name): centre, labels and the sector arcs, in raw pixels like the native glOrtho(0, displayWidth, displayHeight, 0). */
export function pieModel(list, w, h) {
  if (!list || !list.length) return null;
  const rows = list.slice(), self = rows.shift(), r = PIE.radius;
  const cx = w - r - PIE.margin, cy = h - r * 2;
  const head = (self.name === "unspecified" ? "" : "[0]") + (self.name.length === 0 ? "ROOT" : self.name + " ");
  const text = [{ text: head, x: cx - r, y: cy - r / 2 - 16, color: WHITE }, { text: pct(self.total) + "%", rightX: cx + r, y: cy - r / 2 - 16, color: WHITE }];
  let sum = 0;
  const sectors = rows.map((row, i) => {
    const steps = floorD(row.use / PIE.steps) + 1, a0 = sum;
    sum += row.use;
    const color = sectorColor(row.name);
    const label = (row.name === "unspecified" ? "[?]" : `[${i + 1}]`) + row.name;
    const y = cy + r / 2 + i * 8 + 20;
    text.push({ text: label, x: cx - r, y, color }, { text: pct(row.use) + "%", rightX: cx + r - 50, y, color }, { text: pct(row.total) + "%", rightX: cx + r, y, color });
    return { color, side: sideColor(color), a0, use: row.use, steps };
  });
  return { cx, cy, r, text, sectors, back: { x0: cx - PIE.backX, x1: cx + PIE.backX, y0: cy - PIE.backTop, y1: cy + r * 2 } };
}
// The rim point at fraction `a` percent: (sin * r, cos * r * 0.5) with a = 2 pi percent / 100 as a float.
export const rim = (m, percent) => { const a = f((percent * Math.PI * 2) / 100); return [m.cx + f(Math.sin(a)) * m.r, m.cy - f(Math.cos(a)) * m.r * 0.5]; };
const css = (c) => `#${(c & 0xffffff).toString(16).padStart(6, "0")}`;
/** Draw the pie on a 2D canvas: a black 200/255 back panel, the side walls, then the top fans. */
export function drawPie(ctx, m) {
  const b = m.back;
  ctx.fillStyle = `rgba(0,0,0,${PIE.alpha / 255})`;
  ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  for (const s of m.sectors) {
    ctx.fillStyle = css(s.side);
    for (let j = s.steps; j > 0; j--) {
      const p = rim(m, s.a0 + (s.use * j) / s.steps), q = rim(m, s.a0 + (s.use * (j - 1)) / s.steps);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0], q[1] + PIE.extrude); ctx.lineTo(p[0], p[1] + PIE.extrude); ctx.fill();
    }
    ctx.fillStyle = css(s.color);
    ctx.beginPath(); ctx.moveTo(m.cx, m.cy);
    for (let j = s.steps; j >= 0; j--) { const p = rim(m, s.a0 + (s.use * j) / s.steps); ctx.lineTo(p[0], p[1]); }
    ctx.fill();
  }
}

// ---- state sampling (browser-only; the counts are approximations, see debug-screen.md) ----
/** Top filled 16-high segment of the chunk's columns + 15 is added by lightLine; heights are the height map (opaque top + 1). */
export function columnStats(world, cx, cz) {
  let top = -1;
  for (let x = cx * 16; x < cx * 16 + 16; x++) for (let z = cz * 16; z < cz * 16 + 16; z++) {
    const col = world.columnBlocks?.(x, z);
    if (!col) continue;
    for (let y = col.length - 1; y > top; y--) if (col[y]) { top = y; break; }
  }
  return { topSegment: top < 0 ? 0 : (top >> 4) << 4 };
}
export function heightValue(world, x, z) {
  const col = world.columnBlocks?.(x, z);
  if (!col) return 0;
  for (let y = col.length - 1; y >= 0; y--) if (lightOpacity(col[y]) > 0) return y + 1;
  return 0;
}
const frustum = new THREE.Frustum(), proj = new THREE.Matrix4(), box = new THREE.Box3(), pt = new THREE.Vector3(), sphere = new THREE.Sphere();
/** assumed: RenderGlobal counts 16^3 WorldRenderers; the port meshes whole columns, so every resident column counts as height/16
 *  sections, "rendered" = sections inside the camera frustum, "clipped" = the rest, occluded and skipping-pass stay 0. */
export function rendererStats(scene, world) {
  camera(scene);
  const h = world.height ?? 256, secs = Math.max(1, h >> 4);
  let loaded = 0, rendered = 0;
  for (const key of scene.chunks.keys()) {
    const [x, z] = key.split(",").map(Number);
    for (let s = 0; s < secs; s++) {
      loaded++;
      box.min.set(x, s * 16, z); box.max.set(x + 16, s * 16 + 16, z + 16);
      if (frustum.intersectsBox(box)) rendered++;
    }
  }
  return { loaded, rendered, clipped: loaded - rendered, occluded: 0, skipping: 0 };
}
function camera(scene) {
  scene.camera.updateMatrixWorld();
  proj.multiplyMatrices(scene.camera.projectionMatrix, scene.camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(proj);
}
/** assumed: RenderGlobal.renderEntities counts; `points` are [x, y, z, radius] of every loaded entity (the local player separately). */
export function entityStats(scene, points, player) {
  camera(scene);
  let rendered = 0, hidden = 0;
  for (const p of points) {
    sphere.center.set(p[0], p[1], p[2]); sphere.radius = p[3] ?? 1;
    if (frustum.intersectsSphere(sphere)) rendered++; else hidden++;
  }
  if (player.thirdPerson) rendered++; // the viewpoint entity is only drawn in third person
  return { total: points.length + 1, rendered, hidden };
}

const CSS = `#debug{position:fixed;left:0;top:0;right:auto;bottom:auto;width:100%;height:100%;padding:0;margin:0;border:0;border-radius:0;background:none;pointer-events:none;overflow:hidden;white-space:pre;z-index:5;text-shadow:none}
#debug.hidden{display:none}
#debug .dl{position:absolute;white-space:pre;height:calc(9*var(--u));line-height:calc(8*var(--u));font-size:calc(8*var(--u))}
#debug .dl.raw{--u:1px}
#debug-pie{position:fixed;left:0;top:0;pointer-events:none}`;

/** The overlay controller: update(state) per frame while the debug screen is on; hidden() when it is off. */
export class DebugOverlay {
  constructor(root) {
    this.root = root; this.lines = new Map(); this.key = "";
    const style = document.createElement("style"); style.textContent = CSS; document.head.append(style);
    this.canvas = document.createElement("canvas"); this.canvas.id = "debug-pie"; this.canvas.style.display = "none"; root.prepend(this.canvas); // under the labels
    this.pieNames = new Map();
  }
  setLine(id, text, color, left, top, raw = false) {
    let el = this.lines.get(id);
    if (!el) { el = document.createElement("div"); el.className = "dl mc-text" + (raw ? " raw" : ""); this.root.append(el); this.lines.set(id, el); }
    const key = `${text}|${color}|${font.version}`;
    if (el.dataset.key !== key) { el.dataset.key = key; el.innerHTML = bitmapHtml(text, color); }
    el.style.left = left; el.style.top = top;
    el.style.display = "";
    el.dataset.live = this.frame;
  }
  /** s: { u (GUI px per unit), scaledWidth, left: leftLines state, mem, pie: { list } | null, w, h } */
  update(s) {
    this.frame = (this.frame ?? 0) + 1;
    this.root.style.setProperty("--u", `${s.u}px`);
    leftLines(s.left).forEach((l, i) => this.setLine("L" + i, l.text, l.color, `calc(${LEFT_X}*var(--u))`, `calc(${l.y}*var(--u))`));
    rightLines(s.mem, s.scaledWidth).forEach((l, i) => this.setLine("R" + i, l.text, l.color, `calc(${l.x}*var(--u))`, `calc(${l.y}*var(--u))`));
    const m = s.pie ? pieModel(s.pie.list, s.w, s.h) : null;
    if (m) {
      const c = this.canvas, dpr = Math.max(1, devicePixelRatio || 1);
      if (c.width !== Math.round(s.w * dpr) || c.height !== Math.round(s.h * dpr)) { c.width = Math.round(s.w * dpr); c.height = Math.round(s.h * dpr); c.style.width = s.w + "px"; c.style.height = s.h + "px"; }
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, s.w, s.h); drawPie(ctx, m);
      c.style.display = "";
      m.text.forEach((t, i) => {
        const id = "P" + i, wd = getStringWidth(t.text);
        this.setLine(id, t.text, t.color, `${t.x ?? t.rightX - wd}px`, `${t.y}px`, true);
      });
    } else this.canvas.style.display = "none";
    for (const [id, el] of this.lines) if (el.dataset.live != this.frame) el.style.display = "none";
  }
  hide() { this.canvas.style.display = "none"; }
}
