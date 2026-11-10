// Block.getMixedBrightnessForBlock (aji.c(ahl, x, y, z): a BlockSlab at brightness 0 reads the cell below) against the unchanged 1.7.10 classes
// (tools/probes/SlabLightProbe.java, public/research/slab-light-reference.json): 408 neighbourhoods around half and double slabs, stairs, farmland, soul
// sand, plants and glass, built under opaque cubes, beside torches and glowstone and in dark cells, three ambient-occlusion settings. Per vertex the
// Tessellator colour bytes and brightness int against the mesher's vertex colour bytes and light coords, exactly.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ChunkMesher, Mesher } from "./chunk-mesher.js";
import { LightVolume, isSlabBlock, cellPacked } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";
import { render } from "./render-settings.js";
import { meshAnaglyph } from "./anaglyph.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/slab-light-reference.json", import.meta.url), "utf8"));
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
const SLABS = new Set([43, 44, 125, 126]);

test("mesher vertex colour bytes and light coords equal RenderBlocks' Tessellator input (408 neighbourhoods around slabs, stairs, farmland and others, three AO settings)", () => {
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
  assert.ok(quads > 3000 && vertices === quads * 4, `${quads} quads compared`);
});


test("the fixtures reach the slab rule: slabs whose own cell reads 0 with light in the cell below, and a stair or farmland beside a torch", () => {
  let requery = 0, capped = 0, stairTorch = 0, farmland = 0;
  for (const fx of ref.fixtures) {
    const here = cellIndex(B, B, B), below = cellIndex(B, B - 1, B), above = cellIndex(B, B + 1, B);
    const near = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].map(([a, b, c]) => cellIndex(B + a, B + b, B + c));
    const lightAround = Math.max(...near.map((i) => fx.light[i] >> 4)) + Math.max(...near.map((i) => fx.light[i] & 15));
    if (SLABS.has(fx.id) && lightAround === 0 && fx.light[below] !== 0 && ![43, 125].includes(fx.id) + 0) requery++;
    if (SLABS.has(fx.id) && lightAround === 0 && fx.light[below] !== 0) { if (fx.ids[above] === 1 || fx.ids[above] === 3 || fx.ids[above] === 4 || fx.ids[above] === 17 || fx.ids[above] === 5) capped++; }
    if ([53, 67, 108, 114, 128, 156].includes(fx.id) && near.some((i) => fx.ids[i] === 50)) stairTorch++;
    if (fx.id === 60 && near.some((i) => fx.ids[i] === 1)) farmland++;
    void here;
  }
  assert.ok(requery > 20 && capped > 8 && stairTorch > 5 && farmland > 8, JSON.stringify({ requery, capped, stairTorch, farmland }));
});

test("without the re-query the mesher would differ on the recorded fixtures (the rule is what the probe pins)", () => {
  const saved = { ...render }, anaglyph = meshAnaglyph.on;
  meshAnaglyph.on = false; render.fancy = true; render.ao = 2;
  let differing = 0;
  const lightOf = (fx, noRule) => {
    const src = source(fx);
    if (noRule) {
      const volume = { world: src.world, skyAt: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : fx.light[i] >> 4; }, blockAt: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : fx.light[i] & 15; }, emission: (x, y, z) => { const i = cellIndex(x, y, z); return i < 0 ? 0 : ref.lightValues[fx.ids[i]]; } };
      src.light.packed = (x, y, z) => cellPacked(volume, x, y, z);
    }
    const mesher = new ChunkMesher(src), M = { solid: new Mesher(), water: new Mesher(), ice: new Mesher(), flow: new Mesher(), lava: new Mesher(), lavaFlow: new Mesher(), fire: [new Mesher(), new Mesher()], portal: new Mesher() };
    mesher.meshBlock(M, src.world.get(B, B, B), B, B, B);
    return Array.from(M.solid.light).join();
  };
  try { for (const fx of ref.fixtures) if (SLABS.has(fx.id) || fx.id === 67) if (lightOf(fx, false) !== lightOf(fx, true)) differing++; }
  finally { Object.assign(render, saved); meshAnaglyph.on = anaglyph; }
  assert.ok(differing > 20, `${differing} fixtures differ without the rule`);
});

test("isSlabBlock covers exactly the port ids of the native BlockSlab blocks (43, 44, 125, 126)", () => {
  for (const original of [43, 44, 125, 126]) for (const meta of [0, 1, 2, 3, 5, 8, 9]) {
    const c = fromOriginal(original, meta);
    assert.ok(c && isSlabBlock(c.id), `${original}:${meta} -> ${c?.id}`);
  }
  for (const original of [1, 53, 60, 67, 88, 78, 85, 156]) assert.ok(!isSlabBlock(fromOriginal(original, 0).id), `${original} is not a slab`);
});
