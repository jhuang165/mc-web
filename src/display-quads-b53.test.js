// Batch 53 (tag b53dq): the shapes RenderBlocks.renderBlockAsItem (blm.a(aji, int, float)) draws for a minecart's display block, EXECUTED on the real 1.7.10 client classes with a recording
// LWJGL GL11 stub, the static Tessellator's raw buffer and icons registered by the real Block.registerIcons (tools/probes/DisplayQuadsProbe.java, tools/verify-display-quads.mjs).
// Replayed here against displayQuads / displayGeometry / displayTint / displayTopTint. The icon of each draw is only checked by name against the metadata, not against the port's atlas tile.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { displayShape, displayQuads, displayGeometry, displayTint, displayTopTint } from "./cart-display-shape.js";
import { setColormaps } from "./biome-colors.js";
import { blockTile, tileRect } from "./block-textures.js";

const ref = JSON.parse(await readFile(new URL("../public/research/display-quads-reference.json", import.meta.url), "utf8"));
const recs = ref.records, fr = Math.fround, near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m}: ${a} vs ${b}`);
const quadsOf = (draw) => { const out = []; for (let i = 0; i < draw.vertices.length; i += 4) out.push(draw.vertices.slice(i, i + 4)); return out; };
const SHAPE_BY_TYPE = { 1: "cross", 6: "crops", 19: "stem", 2: "torch" };
const at = (id, meta, name) => recs.find((r) => r.id === id && r.meta === meta && (!name || r.name === name));
// the colour glColor4f held at each draw call, in order
const drawColors = (r) => { let c = null; const out = []; for (const l of r.calls) { const p = l.split(" "); if (p[0] === "color") c = p.slice(1).map(Number); else if (p[0] === "draw") out.push(c); } return out; };

test("the reference is an executed record set of the unchanged client", () => {
  assert.equal(ref.tag, "b53dq");
  for (const c of ["blm", "bmh", "aji"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
  assert.ok(recs.length >= 90);
  for (const r of recs) assert.equal(r.draws.length, r.calls.filter((l) => l.startsWith("draw")).length, "one captured buffer per glDrawArrays");
});

test("displayShape follows the executed render type of every recorded block", () => {
  for (const r of recs) assert.equal(displayShape(r.id), SHAPE_BY_TYPE[r.renderType] ?? "item", `block ${r.id} render type ${r.renderType}`);
});

test("the flat shapes' quads match the executed Tessellator vertices, in order (cross, crops, stem, torch)", () => {
  let n = 0;
  for (const r of recs) {
    const shape = SHAPE_BY_TYPE[r.renderType];
    if (!shape) continue;
    assert.equal(r.draws.length, 1, `${r.name} ${r.id}:${r.meta} draws one batch`);
    const d = r.draws[0], native = quadsOf(d), mine = displayQuads(shape);
    assert.equal(d.mode, 7);
    assert.equal(native.length, mine.length, `${shape} quad count of ${r.id}:${r.meta}`);
    native.forEach((q, i) => q.forEach((v, j) => {
      for (let k = 0; k < 3; k++) near(mine[i].verts[j][k], v.pos[k], `${shape} ${r.id}:${r.meta} quad ${i} vertex ${j} pos ${k}`);
      for (let k = 0; k < 2; k++) near(mine[i].uv[j][k], v.uv[k], `${shape} ${r.id}:${r.meta} quad ${i} vertex ${j} uv ${k}`);
      assert.deepEqual(v.normal, [0, -127, 0], "every flat vertex carries the item normal (0, -1, 0)");
      assert.equal(d.hasColor, false, "no per-vertex colour: the colour is the glColor4f call");
    }));
    n++;
  }
  assert.ok(n >= 60, `${n} flat records replayed`);
});

test("the flat shapes' sizes, as executed", () => {
  const counts = { cross: 16, crops: 32, stem: 16, torch: 24 };
  for (const r of recs) { const s = SHAPE_BY_TYPE[r.renderType]; if (s) assert.equal(r.draws[0].count, counts[s]); }
  // crops stand on the origin (no 1/16 drop in the item path), the stem is a quarter block, the torch 10/16 tall with its top at 7..9 / 6..8 of the tile
  const ys = (shape) => displayQuads(shape).flatMap((q) => q.verts.map((v) => v[1]));
  assert.deepEqual([Math.min(...ys("crops")), Math.max(...ys("crops"))], [-0.5, 0.5]);
  assert.deepEqual([Math.min(...ys("stem")), Math.max(...ys("stem"))], [-0.5, -0.25]);
  const top = at(50, 0).draws[0].vertices;
  near(top[0].uv[0], 7 / 16, "torch top u"); near(top[0].uv[1], 6 / 16, "torch top v"); near(top[0].pos[1], 0.125, "torch top y");
});

test("wheat, carrots and potatoes stage icons and the stems' meta icons follow the metadata", () => {
  for (let m = 0; m < 8; m++) {
    assert.equal(at(59, m, "wheat").draws[0].vertices[0].icon, `wheat_stage_${m}`);
    assert.match(at(141, m, "carrots").draws[0].vertices[0].icon, /^carrots_stage_[0-3]$/);
    assert.match(at(142, m, "potatoes").draws[0].vertices[0].icon, /^potatoes_stage_[0-3]$/);
    for (const [id, name] of [[104, "pumpkin-stem"], [105, "melon-stem"]]) assert.match(at(id, m, name).draws[0].vertices[0].icon, /^(pumpkin|melon)_stem_disconnected$/);
  }
});

test("the colour renderBlockAsItem sets (displayTint, executed glColor4f) for every recorded block at brightness 1", () => {
  const grass = at(31, 1, "case").calls[0].split(" ").slice(1, 4).map(Number); // the executed tall grass colour = ColorizerGrass(0.5, 1.0) of the shipped map
  const packed = (Math.round(grass[0] * 255) << 16) | (Math.round(grass[1] * 255) << 8) | Math.round(grass[2] * 255);
  setColormaps(new Int32Array(65536).fill(packed), new Int32Array(65536).fill(0x48b518));
  for (const r of recs) {
    if (r.brightness !== 1) continue;
    const first = drawColors(r)[0], want = displayTint(r.id, r.meta) ?? [1, 1, 1];
    if (r.id === 2) { assert.equal(displayTint(2, r.meta), null); assert.deepEqual(first, [1, 1, 1, 1]); continue; }
    want.forEach((c, k) => near(c, first[k], `block ${r.id}:${r.meta} channel ${k}`));
    assert.equal(first[3], 1);
  }
});

test("the grass block tints its top face alone, and the faces come bottom, top, then the four sides", () => {
  const r = at(2, 0, "case"), top = displayTopTint(2), colors = drawColors(r);
  assert.equal(r.draws.length, 6);
  assert.deepEqual(r.draws.map((d) => d.vertices[0].icon), ["dirt", "grass_top", "grass_side", "grass_side", "grass_side", "grass_side"]);
  assert.deepEqual(r.draws.map((d) => d.vertices[0].normal), [[0, -127, 0], [0, 127, 0], [0, 0, -127], [0, 0, 127], [-127, 0, 0], [127, 0, 0]]);
  top.forEach((c, k) => near(c, colors[1][k], `grass top channel ${k}`));
  for (const i of [0, 2, 3, 4, 5]) assert.deepEqual(colors[i], [1, 1, 1, 1], `face ${i} is white`);
  assert.ok(r.calls[1].startsWith("rotate 90.0 0.0 1.0 0.0"), "the cube path turns the block 90 degrees about y");
});

test("brightness multiplies the colour (blm.a's third argument; the display draws at 1)", () => {
  const dim = (id, meta, name) => recs.find((r) => r.id === id && r.meta === meta && r.name === name);
  const full = (id, meta, i = 0) => drawColors(at(id, meta, "case"))[i], half = (id, meta, i = 0) => drawColors(dim(id, meta, "dim"))[i];
  for (const [id, meta] of [[31, 1], [38, 0], [50, 0], [53, 0]]) full(id, meta).slice(0, 3).forEach((c, k) => near(half(id, meta)[k], fr(c * 0.5), `dim ${id} channel ${k}`));
  half(2, 0, 1).forEach((c, k) => near(c, k < 3 ? fr(drawColors(at(2, 0, "case"))[1][k] * 0.5) : 1, `dim grass top channel ${k}`));
  assert.deepEqual(half(2, 0, 0), [0.5, 0.5, 0.5, 1], "the grass block's other faces take the brightness grey");
});

test("the cube path's controls draw 6 faces (stone), 12 (stairs), 24 (fence), 6 (cactus) and the log's icons", () => {
  const faces = (id, meta = 0) => at(id, meta, "case").draws.length;
  assert.equal(faces(1), 6); assert.equal(faces(53), 12); assert.equal(faces(85), 24); assert.equal(faces(81), 6);
  assert.deepEqual(at(17, 5, "case").draws.map((d) => d.vertices[0].icon), ["log_spruce", "log_spruce", "log_spruce", "log_spruce", "log_spruce_top", "log_spruce_top"], "the item path draws the log by meta & 3 with the tops on the x faces for meta 4..7");
  for (const id of [1, 20, 44, 17, 116]) assert.equal(displayShape(id), "item");
  for (const q of at(53, 0, "case").draws) assert.equal(q.count, 4);
});

test("displayGeometry places the executed quads and maps their uv into the block's atlas tile", () => {
  for (const [id, meta] of [[31, 1], [59, 7], [104, 4], [50, 0], [37, 0]]) {
    const r = at(id, meta), shape = displayShape(id), g = displayGeometry(shape, { id, meta }), t = tileRect(blockTile(id, 0, false, meta));
    const pos = g.getAttribute("position"), uv = g.getAttribute("uv"), verts = r.draws[0].vertices;
    assert.equal(pos.count, verts.length);
    verts.forEach((v, i) => {
      for (let k = 0; k < 3; k++) near(pos.getComponent(i, k), v.pos[k], `${id} position`);
      near(uv.getComponent(i, 0), t.u0 + (t.u1 - t.u0) * v.uv[0], `${id} u`);
      near(uv.getComponent(i, 1), t.v1 - (t.v1 - t.v0) * v.uv[1], `${id} v`);
    });
  }
});
