// Batch 54 (tag b53dq records, re-recorded with every borrowed icon named): the cube-path and hopper shapes of RenderBlocks.renderBlockAsItem against the port's display geometry,
// vertex by vertex, plus the item normal and the chest path. Executed: public/research/display-quads-reference.json (tools/probes/DisplayQuadsProbe.java) and chest-item-reference.json.
// Bytecode-read: blt.a (EntityRenderer.renderWorld) calls RenderHelper bam.b (enableStandardItemLighting: ambient 0.4, two diffuse 0.6 lights) around the entity pass.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { fromOriginal } from "./block-registry.js";
import { blockItemGeometry, blockCubeGeometry, blockItemTurn } from "./first-person.js";
import { displayShape, displayQuads, displayGeometry } from "./cart-display-shape.js";
import { tileAtUv, tileRect, TILES } from "./block-textures.js";
import { ITEM_LIGHTS } from "./light-material.js";

const ref = JSON.parse(await readFile(new URL("../public/research/display-quads-reference.json", import.meta.url), "utf8"));
const chestRef = JSON.parse(await readFile(new URL("../public/research/chest-item-reference.json", import.meta.url), "utf8"));
const FLAT = new Set([1, 6, 19, 2]);
const cubePath = ref.records.filter((r) => r.name === "case" && !FLAT.has(r.renderType) && r.id !== 154);
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-4, `${m}: ${a} vs ${b}`);
const key = (p) => p.map((x) => Math.round(x * 1e4)).join(",");
// the port's quads of a geometry as four-vertex perimeters in drawing order: positions in the 0..1 block frame, uv as fractions of the tile the quad lies in, and that tile's name
function portQuads(g) {
  const pos = g.getAttribute("position"), uv = g.getAttribute("uv"), nor = g.getAttribute("normal"), idx = g.index, out = [];
  const perimeter = (t) => { // a quad's four vertices from its two triangles
    const t1 = t.slice(0, 3), t2 = t.slice(3), e = t2.find((v) => !t1.includes(v)), n = t1.find((v) => !t2.includes(v)), k = t1.indexOf(n);
    return [n, t1[(k + 1) % 3], e, t1[(k + 2) % 3]];
  };
  for (let i = 0; i < idx.count; i += 6) {
    const q = perimeter([0, 1, 2, 3, 4, 5].map((k) => idx.getX(i + k)));
    const mid = [0, 1].map((c) => (uv.getComponent(q[0], c) + uv.getComponent(q[2], c)) / 2), tile = tileAtUv(mid[0], mid[1]), R = tileRect(tile);
    out.push({ tile: TILES[tile], vs: q.map((j) => ({ p: [0, 1, 2].map((k) => pos.getComponent(j, k) + 0.5), f: [(uv.getComponent(j, 0) - R.u0) / (R.u1 - R.u0), (R.v1 - uv.getComponent(j, 1)) / (R.v1 - R.v0)], n: [0, 1, 2].map((k) => nor.getComponent(j, k)) })) });
  }
  return out;
}
const nativeQuads = (r) => r.draws.flatMap((d) => { const q = []; for (let i = 0; i < d.vertices.length; i += 4) q.push(d.vertices.slice(i, i + 4)); return q; });
// every native quad finds the port quad on the same four corners, with the same winding, the same uv per corner, the same tile (when the icon is named) and the same face normal
function compare(r, g, label) {
  const nat = nativeQuads(r), mine = portQuads(g), used = new Set();
  assert.equal(mine.length, nat.length, `${label} quad count`);
  nat.forEach((q, qi) => {
    const want = q.map((v) => key(v.pos)).sort().join("|");
    const j = mine.findIndex((c, ci) => !used.has(ci) && c.vs.map((v) => key(v.p)).sort().join("|") === want);
    assert.ok(j >= 0, `${label} quad ${qi} has a port quad on its corners`);
    used.add(j);
    const c = mine[j], ks = q.map((v) => key(v.pos)), pk = c.vs.map((v) => key(v.p)), o = pk.indexOf(ks[0]);
    assert.ok([0, 1, 2, 3].every((i) => pk[(o + i) % 4] === ks[i]), `${label} quad ${qi}: same winding direction (corner order up to the starting corner)`);
    q.forEach((v, i) => {
      const m = c.vs[(o + i) % 4];
      near(m.f[0], v.uv[0], `${label} quad ${qi} u`); near(m.f[1], v.uv[1], `${label} quad ${qi} v`);
      v.normal.forEach((n, k) => near(m.n[k], n / 127, `${label} quad ${qi} normal ${k}`));
    });
    assert.equal(c.tile, q[0].icon, `${label} quad ${qi} tile`);
  });
}

test("the cube-path records name every icon (the borrowed ones too) and cover stairs, fence, wall, anvil, dragon egg, cactus, beacon", () => {
  assert.ok(cubePath.length >= 21);
  for (const r of ref.records) for (const d of r.draws) for (const v of d.vertices) assert.notEqual(v.icon, "?", `${r.id}:${r.meta} icon`);
  const ids = new Set(cubePath.map((r) => r.id));
  for (const id of [53, 85, 139, 145, 122, 81, 138, 44, 116, 17]) assert.ok(ids.has(id), `block ${id} recorded`);
  assert.deepEqual(ref.records.find((r) => r.id === 138).draws.map((d) => d.vertices[0].icon).filter((_, i) => i % 6 === 0), ["obsidian", "beacon", "glass"], "the beacon draws its base, core and shell with their own icons");
});

test("the port's cube-path display geometry is the executed quads: corners, winding, uv, tile and normal (only the start corner and face order differ)", () => {
  for (const r of cubePath) {
    const cell = fromOriginal(r.id, r.meta), g = blockItemGeometry(cell.id, cell.meta, 1) ?? blockCubeGeometry(cell.id, cell.meta, 1);
    compare(r, g, `block ${r.id}:${r.meta}`);
    // renderBlockAsItem turns types 0, 16, 22, 26, 31, 39 by 90 degrees about y: the recorded glRotatef is the port's blockItemTurn
    const turned = r.calls.some((c) => c.startsWith("rotate 90.0 0.0 1.0 0.0"));
    assert.equal(blockItemTurn(cell.id, cell.meta) !== 0, turned, `block ${r.id} turn`);
  }
});

test("the hopper (type 38) is drawn as its 17 executed quads, vertex for vertex in order, unturned", () => {
  const r = ref.records.find((x) => x.id === 154), quads = displayQuads("hopper");
  assert.equal(displayShape(154), "hopper");
  assert.equal(quads.length, 17);
  assert.ok(!r.calls.some((c) => c.startsWith("rotate")), "no turn");
  r.draws.forEach((d, i) => {
    assert.equal(quads[i].tile, d.vertices[0].icon, `quad ${i} icon`);
    d.vertices.forEach((v, j) => {
      for (let k = 0; k < 3; k++) near(quads[i].verts[j][k] + 0.5, v.pos[k], `quad ${i} vertex ${j} pos`);
      for (let k = 0; k < 2; k++) near(quads[i].uv[j][k], v.uv[k], `quad ${i} vertex ${j} uv`);
    });
  });
  const g = displayGeometry("hopper", { id: 133, meta: 0 });
  compare(r, g, "hopper");
  for (const q of portQuads(g)) assert.ok(["hopper_outside", "hopper_top", "hopper_inside"].includes(q.tile));
});

test("every flat vertex carries the native item normal (0, -1, 0): a constant 0.4 diffuse under the standard item lighting", () => {
  for (const shape of ["cross", "crops", "stem", "torch"]) {
    const g = displayGeometry(shape, { id: 31, meta: 1 }), n = g.getAttribute("normal");
    for (let i = 0; i < n.count; i++) assert.deepEqual([n.getX(i), n.getY(i), n.getZ(i)], [0, -1, 0], `${shape} vertex ${i}`);
  }
  // native lighting of that normal: ambient 0.4 plus 0.6 times each light's max(0, N.L); both lights point up (y .81), so a downward normal gets no diffuse (the port's entityMaterial formula, the fixed-function one)
  const diffuse = (n) => Math.min(1, 0.4 + 0.6 * ITEM_LIGHTS.reduce((s, l) => s + Math.max(0, n[0] * l.x + n[1] * l.y + n[2] * l.z), 0));
  near(diffuse([0, -1, 0]), 0.4, "flat display diffuse");
  assert.ok(diffuse([1, 0, 0]) > 0.45, "the computed side normals the port used before were brighter");
});

test("the chest family in a cart is the executed chest item path: the item model, turned 90 degrees, with outward normals", async () => {
  const THREE = await import("three"), { chestModel, chestItemModel } = await import("./chest-renderer.js");
  const boxes = (group) => { group.updateMatrixWorld(true); const out = []; group.traverse((n) => { if (n.isMesh) { n.geometry.computeBoundingBox(); const b = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld); out.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => Math.round(v * 1e4) / 1e4).join(",")); } }); return out.sort(); };
  const cart = chestModel(new THREE.MeshBasicMaterial(), false).root; cart.position.y = -0.5; // minecart-renderer.buildCustom's chest branch
  const holder = new THREE.Group(); holder.add(cart);
  assert.deepEqual(boxes(holder), boxes(chestItemModel(new THREE.MeshBasicMaterial())));
  const first = chestRef.items[0].events, turn = first.find((e) => e[0] === "R");
  assert.deepEqual(turn, ["R", 90, 0, 1, 0]);
  // the recorded vertex normals, taken through the model's S(1, -1, -1), are the geometric outward normals of the quads (what BoxGeometry's normals are)
  const bf = new Float32Array(1), bi = new Int32Array(bf.buffer), fl = (b) => { bi[0] = b; return bf[0]; };
  let n = 0;
  for (const e of first.filter((x) => x[0] === "D")) {
    const v = []; for (let i = 0; i < e[1]; i++) { const w = e[2].slice(i * 8, i * 8 + 8), nb = w[6]; v.push({ p: [fl(w[0]), fl(w[1]), fl(w[2])], n: [nb & 255, (nb >> 8) & 255, (nb >> 16) & 255].map((x) => (x > 127 ? x - 256 : x)) }); }
    const wp = v.map((a) => [a.p[0], -a.p[1], -a.p[2]]), e1 = [0, 1, 2].map((k) => wp[1][k] - wp[0][k]), e2 = [0, 1, 2].map((k) => wp[2][k] - wp[1][k]);
    const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nw = [v[0].n[0], -v[0].n[1], -v[0].n[2]];
    nw.forEach((c, k) => assert.equal(Math.sign(c) + 0, Math.sign(+g[k].toFixed(6)) + 0, `chest quad ${n} normal axis ${k}`));
    n++;
  }
  assert.equal(n, 18, "three parts of six faces");
});
