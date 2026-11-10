// RenderBlocks colours against the unchanged 1.7.10 classes (tools/probes/LightFloatProbe.java, public/research/light-float-reference.json):
// 168 random neighbourhoods around a render type 0 block, three ambient-occlusion settings, per vertex the Tessellator colour bytes and
// brightness int (what blm.b hands bmh.b(FFF) / bmh.b(I)) against the mesher's vertex colour bytes and light coords, exactly.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ChunkMesher, Mesher } from "./chunk-mesher.js";
import { LightVolume, aoValue, aoClear, useNeighborBrightness, lightEmission } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";
import { render } from "./render-settings.js";
import { meshAnaglyph } from "./anaglyph.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/light-float-reference.json", import.meta.url), "utf8"));
const R = 2, N = 5, B = 8;
const cellIndex = (x, y, z) => { const dx = x - B, dy = y - B, dz = z - B; return Math.abs(dx) > R || Math.abs(dy) > R || Math.abs(dz) > R ? -1 : ((dx + R) * N + (dy + R)) * N + (dz + R); };

function source(fx) {
  const cells = fx.ids.map((id, i) => { const c = fromOriginal(id, fx.metas[i]); assert.ok(c || id === 0, `original block ${id}:${fx.metas[i]} has a port block`); return c || { id: 0, meta: 0 }; });
  const lit = new Set();
  fx.ids.forEach((id, i) => { if (id === 62) lit.add(`${B + Math.floor(i / 25) - R},${B + Math.floor(i / 5) % 5 - R},${B + i % 5 - R}`); });
  const world = { height: 64, get: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : cells[i].id; }, getMeta: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : cells[i].meta; } };
  const volume = {
    world,
    skyAt: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : fx.light[i] >> 4; },
    blockAt: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : fx.light[i] & 15; },
    emission: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : ref.lightValues[fx.ids[i]]; },
  };
  const light = { world, packed: (x, y, z) => LightVolume.prototype.packed.call(volume, x, y, z) };
  const tint = fx.tint;
  return { world, light, litFurnaces: lit, colorX: 0, colorZ: 0, biomeColors: { grass: () => tint, foliage: () => tint } };
}

// Quads of the layers, keyed by their corner positions (1/64 block from the block origin); a quad is [[x, y, z, r, g, b, light] x4].
function jsQuads(M) {
  const out = [];
  for (const layer of [M.solid, M.ice]) for (let q = 0, colors = layer.colors(); q < layer.p.length / 12; q++) {
    const v = [];
    for (let i = 0; i < 4; i++) {
      const k = q * 4 + i, s = colors;
      const col = [0, 1, 2].map((c) => Math.trunc(Math.fround(Math.fround(s[k * 3 + c]) * 255) + 0.5));
      v.push([0, 1, 2].map((c) => Math.round((layer.p[k * 3 + c] - B) * 64)).concat(col, [(layer.light[k * 2 + 1] << 16) | layer.light[k * 2]]));
    }
    out.push(v);
  }
  return out;
}
function nativeQuads(flat) {
  const out = [];
  for (let q = 0; q < flat.length / 20; q++) {
    const v = [];
    for (let i = 0; i < 4; i++) { const o = (q * 4 + i) * 5, c = flat[o + 3]; v.push([flat[o], flat[o + 1], flat[o + 2], c & 255, (c >> 8) & 255, (c >> 16) & 255, flat[o + 4]]); }
    out.push(v);
  }
  return out;
}
const key = (quad) => quad.map((v) => v.slice(0, 3).join(",")).sort().join("|");
const byKey = (quads) => quads.map((q) => [key(q), q]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

// Face culling (shouldSideBeRendered): batch 37 fixed the six neighbourhoods batch 36 pinned here (stained glass beside another colour, a slab
// or cake beside a block that hides only part of its face), so every neighbourhood now emits exactly the faces the native class does.
const CULLING_KNOWN = [];

test("mesher vertex colour bytes and light coords equal RenderBlocks' Tessellator input (168 neighbourhoods, three AO settings)", () => {
  const saved = { ...render }, anaglyph = meshAnaglyph.on;
  meshAnaglyph.on = false;
  render.fancy = true;
  let quads = 0, vertices = 0;
  const culled = new Set();
  try {
    for (const [n, fx] of ref.fixtures.entries()) for (const ao of [0, 1, 2]) {
      render.ao = ao;
      const src = source(fx), mesher = new ChunkMesher(src), b = src.world.get(B, B, B);
      const M = { solid: new Mesher(), water: new Mesher(), ice: new Mesher(), flow: new Mesher(), lava: new Mesher(), lavaFlow: new Mesher(), fire: [new Mesher(), new Mesher()], portal: new Mesher() };
      mesher.meshBlock(M, b, B, B, B);
      // A grass side has two quads at the same corners (the base and the tinted overlay): group by corners and pair in emission order.
      const group = (list) => { const g = new Map(); for (const [k, q] of list) (g.get(k) || g.set(k, []).get(k)).push(q); return g; };
      const jsG = group(byKey(jsQuads(M))), nat = group(byKey(nativeQuads(fx.ao[ao])));
      const tag = `fixture ${n} (${fx.id}:${fx.meta}) ao ${ao}`;
      if (jsG.size !== nat.size || [...jsG].some(([k, l]) => !nat.has(k) || nat.get(k).length !== l.length)) culled.add(`${fx.id}:${fx.meta} f${n}`);
      for (const [k, q] of [...jsG].flatMap(([k, l]) => l.map((quad, i) => [k + "#" + i, quad, nat.get(k)?.[i]]).filter((e) => e[2]).map(([kk, quad2, nq2]) => [kk, quad2, nq2]))) {
        const nq = nat.get(k.split("#")[0])[+k.split("#")[1]];
        for (const v of q) {
          const m = nq.find((u) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2]);
          assert.deepEqual(v.slice(3), m.slice(3), `${tag} quad ${k} vertex ${v.slice(0, 3)}: [r,g,b,light] mesher vs native`);
        }
        quads++; vertices += 4;
      }
    }
  } finally { Object.assign(render, saved); meshAnaglyph.on = anaglyph; }
  assert.deepEqual([...culled], CULLING_KNOWN);
  assert.ok(quads > 1500 && vertices === quads * 4, `${quads} quads compared`);
});

test("block tables (AO value, corner-open, neighbour brightness, light value) equal the native Block methods for every ported block", () => {
  let checked = 0;
  for (let original = 0; original < 179; original++) {
    const c = fromOriginal(original, 0);
    if (!c) continue;
    const id = c.id;
    assert.equal(aoValue(id), ref.aoValues[original], `aji.I() of ${original}`);
    assert.equal(aoClear(id), id === 0 || ref.cornerOpen[original] === 1, `aji.l() of ${original}`);
    assert.equal(useNeighborBrightness(id), ref.neighborBrightness[original] === 1, `aji.n() of ${original}`);
    if (original !== 62 && original !== 94) assert.equal(lightEmission(id), ref.lightValues[original], `aji.m() of ${original}`); // the furnace and the repeater take their light from the lit/powered state, not the block id
    checked++;
  }
  assert.ok(checked > 120, `${checked} blocks checked`);
});
