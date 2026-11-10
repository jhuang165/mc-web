// RenderBlocks vertices for render types other than 0 against the unchanged 1.7.10 classes (tools/probes/RenderTypesProbe.java,
// public/research/render-types-2-reference.json): crossed squares (1), torches (2), fluids (4), crops (6), doors (7), ladders (8), rails (9),
// stairs (10), fences (11), cactus (13), beds (14), panes (18), vines (20), the lily pad (23), double plants (40). Random 5x5x5 neighbourhoods at
// ambient occlusion 0, 1 and 2; per vertex the Tessellator position and uv floats, colour bytes and brightness int against ChunkMesher.meshBlock.
// Quads are matched by their corner positions (the port emits fluid and torch quads in another order, in several layers), then the four
// vertices by position, so vertex order inside a quad is not part of the comparison. Run with RT_REPORT=1 to print the per-type table.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ChunkMesher, Mesher } from "./chunk-mesher.js";
import { LightVolume } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";
import { render } from "./render-settings.js";
import { meshAnaglyph } from "./anaglyph.js";
import { solidBlock } from "./world.js";
import { tileByName, ATLAS_COLUMNS, ATLAS_ROWS } from "./block-textures.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/render-types-2-reference.json", import.meta.url), "utf8"));
const lightValues = JSON.parse(readFileSync(new URL("../public/research/light-float-reference.json", import.meta.url), "utf8")).lightValues; // aji.m() per original id, from the batch 36 record
const R = 2, N = 5, B = 8;
const cellIndex = (x, y, z) => { const dx = x - B, dy = y - B, dz = z - B; return Math.abs(dx) > R || Math.abs(dy) > R || Math.abs(dz) > R ? -1 : ((dx + R) * N + (dy + R)) * N + (dz + R); };
const f32 = new Float32Array(1), i32 = new Int32Array(f32.buffer);
const bitsToFloat = (b) => { i32[0] = b; return f32[0]; };

function source(fx) {
  const cells = fx.ids.map((id, i) => fromOriginal(id, fx.metas[i]) || { id: 0, meta: 0 });
  const world = { height: 64, get: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : cells[i].id; }, getMeta: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : cells[i].meta; } };
  world.solid = (x, y, z) => { const b = world.get(x, y, z); return solidBlock(b, world.getMeta(x, y, z)); };
  const volume = {
    world,
    skyAt: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : fx.light[i] >> 4; },
    blockAt: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : fx.light[i] & 15; },
    emission: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : lightValues[fx.ids[i]]; },
  };
  const light = { world, packed: (...a) => LightVolume.prototype.packed.call(volume, ...a) };
  const tint = fx.tint, t = () => (fx.plantTint ?? tint); // a pot's plant is coloured by its own block (fern: the grass colour at the pot)
  return { world, light, repeaterLit: (x, y, z) => fx.ids[cellIndex(x, y, z)] === 94, litFurnaces: new Set(), colorX: 0, colorZ: 0, biomeColors: { grass: t, foliage: t, grassAt: t, foliageAt: t, water: t } };
}
const layers = (M) => [M.solid, M.water, M.ice, M.flow, M.lava, M.lavaFlow, ...M.fire, M.portal];
// The fluid layers sample their own textures (the animated still and flow frames, uv across the whole texture), not the block atlas.
const fluidIcon = (M, layer) => (layer === M.water ? "water_still" : layer === M.flow ? "water_flow" : layer === M.lava ? "lava_still" : layer === M.lavaFlow ? "lava_flow" : layer === M.fire[0] ? "fire_layer_0" : layer === M.fire[1] ? "fire_layer_1" : null);
// A vertex: position floats, tile (-1 unknown), in-tile fraction, colour bytes, light int.
function jsQuads(M) {
  const out = [];
  for (const layer of layers(M)) for (let q = 0, colors = layer.colors(), pos = 0; q < layer.p.length / 12; q++) {
    // Mesher.quad(.., twoSided) adds a second index triple pair with the reversed winding; RenderBlocks draws that back face as a second quad.
    const twoSided = layer.idx[pos + 6] === layer.idx[pos] && layer.idx[pos + 7] === layer.idx[pos] + 2;
    pos += twoSided ? 12 : 6;
    const v = [];
    for (let i = 0; i < 4; i++) {
      const k = q * 4 + i, u = layer.uv[k * 2], t = layer.uv[k * 2 + 1];
      const col = [0, 1, 2].map((c) => Math.trunc(Math.fround(Math.fround(colors[k * 3 + c]) * 255) + 0.5));
      v.push({ pos: [0, 1, 2].map((c) => Math.fround(layer.p[k * 3 + c])), u, t, col, light: (layer.light[k * 2 + 1] << 16) | layer.light[k * 2] });
    }
    // The tile of a quad is the one under its uv centroid (a torch side's uv runs from edge to edge of its tile).
    const cu = v.reduce((a, e) => a + e.u, 0) / 4, ct = v.reduce((a, e) => a + e.t, 0) / 4, tile = Math.floor(cu * ATLAS_COLUMNS) + ATLAS_COLUMNS * Math.floor((1 - ct) * ATLAS_ROWS);
    const icon = fluidIcon(M, layer);
    for (const e of v) { e.tile = tile; if (icon) e.icon = icon; }
    out.push(v);
    if (twoSided) out.push(v);
  }
  return out;
}
function nativeQuads(flat) {
  const out = [];
  for (let q = 0; q < flat.length / 28; q++) {
    const v = [];
    for (let i = 0; i < 4; i++) {
      const o = (q * 4 + i) * 7, c = flat[o + 5], u = bitsToFloat(flat[o + 3]), idx = Math.floor(u / 2);
      v.push({ pos: [bitsToFloat(flat[o]), bitsToFloat(flat[o + 1]), bitsToFloat(flat[o + 2])], icon: ref.icons[idx], frac: u - 2 * idx, v: bitsToFloat(flat[o + 4]), col: [c & 255, (c >> 8) & 255, (c >> 16) & 255], light: flat[o + 6] });
    }
    out.push(v);
  }
  return out;
}
const key = (quad) => quad.map((v) => v.pos.map((p) => Math.round(p * 1000)).join(",")).sort().join("|");
const group = (quads) => { const g = new Map(); for (const q of quads) (g.get(key(q)) || g.set(key(q), []).get(key(q))).push(q); return g; };
const near = (a, b) => a.every((p, i) => p === b[i]);

// Per vertex fields that can differ.
const FIELDS = ["position", "uv", "tile", "colour", "light"];
function compareVertex(js, nat, rect) {
  const bad = [];
  if (!near(js.pos, nat.pos)) bad.push("position");
  const fu = js.icon ? js.u : (js.u - rect.u0) / (rect.u1 - rect.u0), fv = js.icon ? 1 - js.t : (rect.v1 - js.t) / (rect.v1 - rect.v0);
  if (Math.abs(fu - nat.frac) > 3e-3 || Math.abs(fv - nat.v) > 3e-3) bad.push("uv"); // within 0.05 texel: the port insets every tile by 0.02 texel (tileRect, torches by none), and the native u carries the icon index (2 * index + fraction), good to about 6e-5
  if (js.icon ? js.icon !== nat.icon : tileByName(nat.icon) !== js.tile) bad.push("tile");
  if (!near(js.col, nat.col)) bad.push("colour");
  if (js.light !== nat.light) bad.push("light");
  return bad;
}

const tileRectFor = (tile) => { const x = tile % ATLAS_COLUMNS, y = Math.floor(tile / ATLAS_COLUMNS); return { u0: (x * 16 + 0.02) / (ATLAS_COLUMNS * 16), u1: ((x + 1) * 16 - 0.02) / (ATLAS_COLUMNS * 16), v0: 1 - ((y + 1) * 16 - 0.02) / (ATLAS_ROWS * 16), v1: 1 - (y * 16 + 0.02) / (ATLAS_ROWS * 16) }; };
function run() {
  const saved = { ...render }, anaglyph = meshAnaglyph.on;
  meshAnaglyph.on = false;
  render.fancy = true;
  const stats = {}, details = [];
  try {
    for (const [n, fx] of ref.fixtures.entries()) for (const ao of [0, 1, 2]) {
      render.ao = ao;
      const src = source(fx), mesher = new ChunkMesher(src), b = src.world.get(B, B, B);
      const M = { solid: new Mesher(), water: new Mesher(), ice: new Mesher(), flow: new Mesher(), lava: new Mesher(), lavaFlow: new Mesher(), fire: [new Mesher(), new Mesher()], portal: new Mesher() };
      mesher.meshBlock(M, b, B, B, B);
      const s = (stats[`${fx.id}:${fx.type}`] ??= { id: fx.id, type: fx.type, fixtures: 0, vertices: 0, exact: 0, nativeOnly: 0, jsOnly: 0, order: 0, bad: Object.fromEntries(FIELDS.map((f) => [f, 0])) });
      const jsG = group(jsQuads(M)), nat = group(nativeQuads(fx.ao[ao]));
      if (process.env.RT_DUMP && +process.env.RT_DUMP === n && ao === 0) { console.log("port keys", [...jsG.keys()].join("\n  ")); console.log("native keys", [...nat.keys()].join("\n  ")); }
      s.fixtures++;
      for (const [k, list] of nat) {
        const js = jsG.get(k) || [];
        const pool = js.slice();
        list.forEach((nq, i) => {
          s.vertices += 4;
          // Quads at the same corners (the two sides of a plane, a grass overlay): take the port quad that differs least.
          const tile0 = tileByName(nq[0].icon), rect0 = tileRectFor(tile0);
          const cost = (q) => nq.reduce((a, nv) => { const jv = q.find((u) => near(u.pos.map((p) => Math.round(p * 1000)), nv.pos.map((p) => Math.round(p * 1000)))); return a + (jv ? compareVertex(jv, nv, rect0).length : 5); }, 0);
          const pick = pool.map((q, j) => [cost(q), j]).sort((a, b) => a[0] - b[0])[0];
          const jq = pick && pool.splice(pick[1], 1)[0];
          if (!jq) { s.nativeOnly += 4; details.push(`fixture ${n} (${fx.id}:${fx.meta} -> port ${b}) ao ${ao}: native quad missing from the port ${k}`); return; }
          let same = true;
          const rect = rect0;
          nq.forEach((nv, vi) => {
            const jv = jq.find((u) => near(u.pos.map((p) => Math.round(p * 1000)), nv.pos.map((p) => Math.round(p * 1000)))), bad = jv ? compareVertex(jv, nv, rect) : ["position"];
            if (!bad.length) s.exact++; else { same = false; for (const f of bad) s.bad[f]++; if (details.length < 40000) details.push(`fixture ${n} (${fx.id}:${fx.meta}) ao ${ao} vertex ${vi} ${nv.pos.join(",")}: ${bad.join("+")} port ${JSON.stringify(jv && { col: jv.col, light: jv.light, tile: jv.tile, uv: (jv.icon ? [jv.u, 1 - jv.t] : [(jv.u - rect.u0) / (rect.u1 - rect.u0), (rect.v1 - jv.t) / (rect.v1 - rect.v0)]).map((x) => +x.toFixed(4)) })} native ${JSON.stringify({ col: nv.col, light: nv.light, icon: nv.icon, uv: [+nv.frac.toFixed(4), +nv.v.toFixed(4)] })}`); }
            if (jv && jq.indexOf(jv) === vi) s.order++;
          });
        });
        s.jsOnly += 4 * pool.length;
      }
      for (const [k, list] of jsG) if (!nat.has(k)) { s.jsOnly += 4 * list.length; details.push(`fixture ${n} (${fx.id}:${fx.meta} -> port ${b}) ao ${ao}: port quad missing natively ${k}`); }
    }
  } finally { Object.assign(render, saved); meshAnaglyph.on = anaglyph; }
  return { stats, details };
}

test("render types other than 0: mesher vertices equal RenderBlocks' Tessellator input", () => {
  const { stats, details } = run();
  if (process.env.RT_REPORT) {
    for (const s of Object.values(stats)) console.log(`${s.id}:${s.type} fixtures ${s.fixtures} native vertices ${s.vertices} exact ${s.exact} nativeOnly ${s.nativeOnly} jsOnly ${s.jsOnly} sameOrder ${s.order} bad ${JSON.stringify(s.bad)}`);
    console.log(details.filter((d) => !process.env.RT_FILTER || new RegExp(process.env.RT_FILTER).test(d)).slice(0, +process.env.RT_REPORT > 1 ? +process.env.RT_REPORT : 60).join("\n"));
  }
  // Known gaps: id:type -> [exact, nativeOnly, jsOnly] vertex counts, pinned so they cannot silently get worse.
  // Known gaps, "id:type": [exact vertices at least, nativeOnly at most, jsOnly at most].
  // Types not listed here (wire, lever, repeater, comparator, pistons, tripwire, hook, plates,
  // daylight sensor and more) must match the native vertices exactly.
  const KNOWN = {
  };
  assert.ok(Object.keys(stats).length > 25);
  for (const [key, s] of Object.entries(stats)) {
    const known = KNOWN[key];
    if (!known) {
      assert.deepEqual([s.exact, s.nativeOnly, s.jsOnly], [s.vertices, 0, 0], `render type ${key} must match the native vertices exactly`);
    } else {
      assert.ok(s.exact >= known[0] && s.nativeOnly <= known[1] && s.jsOnly <= known[2], `render type ${key} regressed: ${s.exact}/${s.nativeOnly}/${s.jsOnly}`);
    }
  }
});
