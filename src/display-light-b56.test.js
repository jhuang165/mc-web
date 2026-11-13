// Batch 56 (b56dl): the display lighting terms and the render-type sweep, replayed against public/research/display-light-reference.json (tools/probes/DisplayLightProbe.java; the
// real Entity.getBrightness / getBrightnessForRender / isBurning on a chunk-backed World stand-in, and the real RenderBlocks.renderBlockAsItem on a recording GL11).
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { displayShape, displayTint } from "./cart-display-shape.js";
import { entityBrightness, entityLightY, entityPacked, shadeDisplay, SAMPLE_HEIGHT, BURNING_PACKED } from "./display-light.js";
import { LightVolume } from "./lighting.js";
import { lightBrightnessTable } from "./dimensions.js";
import { fromOriginal } from "./block-registry.js";
import { blockItemTurn } from "./first-person.js";
import { hangingGeometry, FRAME_PIXELS } from "./hanging.js";
import { itemFromOriginal } from "./region-import.js";
import { blockTile, TILES } from "./block-textures.js";
import { ITEMS } from "./survival.js";
import { SIZE } from "./world.js";
import { REEDS_ITEM } from "./plants.js";

const ref = JSON.parse(await readFile(new URL("../public/research/display-light-reference.json", import.meta.url), "utf8"));
const rows = (kind) => ref.records.filter((r) => r.kind === kind), f = Math.fround;

test("the sweep covers every registered 1.7.10 block", () => {
  assert.equal(rows("sweep").length, 170);
});

test("every block id: the port draws nothing exactly where renderBlockAsItem draws nothing", () => {
  const bad = [];
  for (const r of rows("sweep")) {
    const draws = Math.max(...r.quads) !== 0; // -1 is a thrown chest helper: the chest family draws through its tile entity renderer
    if (draws === (displayShape(r.id) === "none")) bad.push(r.id + ":t" + r.renderType + ":" + Math.max(...r.quads) + ":" + displayShape(r.id));
  }
  assert.deepEqual(bad, []);
  // the nether portal (render type 0) draws a cube: the sweep found the port listing it as empty
  assert.notEqual(displayShape(90), "none");
  for (const id of [0, 165, 166, 167, 168, 169, 176, 200, 255]) assert.equal(displayShape(id), "none", "no 1.7.10 block " + id);
});

test("every block id: the flat and hopper shapes follow the executed render type", () => {
  const shape = { 1: "cross", 6: "crops", 19: "stem", 2: "torch", 38: "hopper" };
  for (const r of rows("sweep")) {
    if (Math.max(...r.quads) === 0) continue;
    assert.equal(displayShape(r.id), shape[r.renderType] ?? "item", "id " + r.id + " type " + r.renderType);
  }
});

test("every block id on the item path: the turn about Y matches the executed rotate 90", () => {
  const bad = [];
  for (const r of rows("sweep")) {
    if (displayShape(r.id) !== "item" || r.renderType === 22) continue; // chests are turned by the minecart renderer's own branch
    const cell = fromOriginal(r.id, 0);
    if (!cell) continue;
    const turned = blockItemTurn(cell.id, cell.meta) !== 0;
    if (turned !== r.turned[0]) bad.push(r.id + ":t" + r.renderType + (r.turned[0] ? ":turned" : ":not turned"));
  }
  assert.deepEqual(bad, []);
});

test("renderBlockAsItem multiplies its glColor by the brightness it is handed (the cart passes Entity.getBrightness)", () => {
  for (const r of rows("sweep")) {
    r.firstColor.forEach((c, meta) => {
      if (c === null || !String(c).startsWith("color ")) return;
      const [, cr, cg, cb] = c.split(" ").map(Number);
      const tint = r.id === 18 ? displayTint(18, meta) : displayTint(r.id, meta);
      if (!tint || r.id === 31 || r.id === 104 || r.id === 105) return; // those tints depend on loaded colormaps or on the meta: compared in the next test
      assert.ok(Math.abs(cr - f(tint[0] * 0.37)) < 2e-7 && Math.abs(cg - f(tint[1] * 0.37)) < 2e-7 && Math.abs(cb - f(tint[2] * 0.37)) < 2e-7, `id ${r.id} meta ${meta}: ${c}`);
    });
  }
  const plain = rows("sweep").find((r) => r.id === 1);
  assert.deepEqual(new Set(plain.firstColor), new Set(["color 0.37 0.37 0.37 1.0"]));
});

test("shadeDisplay scales the native tint by the brightness and never compounds", () => {
  const tint = { x: 0.5, y: 0.25, z: 1, set(x, y, z) { Object.assign(this, { x, y, z }); } }, material = { uniforms: { tint: { value: tint } }, userData: {} };
  shadeDisplay(material, 0.5); shadeDisplay(material, 0.5); shadeDisplay(material, 1);
  assert.deepEqual([tint.x, tint.y, tint.z], [0.5, 0.25, 1]);
  shadeDisplay(material, 0.37);
  assert.ok(Math.abs(tint.x - 0.185) < 1e-12 && Math.abs(tint.z - 0.37) < 1e-12);
});

// the light of each probe scenario (mirrors DisplayLightProbe.entity calls)
const section = (fn) => fn;
function scenario(r) {
  const m = /^flat s(\d+) b(\d+)$/.exec(r.name);
  if (m) return { light: () => [+m[1], +m[2]], cells: [] };
  if (r.name.startsWith("rows y")) return { light: (x, y) => [Math.min(15, y - 60), Math.min(15, Math.floor((y - 60) / 2))], cells: [] };
  switch (r.name) {
    case "slab neighbours": return { light: (x, y, z) => (x === 9 && y === 65 && z === 8 ? [12, 2] : [3, 1]), cells: [[8, 65, 8, 44]] };
    case "slab neighbours above": return { light: (x, y) => (y === 66 ? [14, 0] : [2, 6]), cells: [[8, 65, 8, 44]] };
    case "stairs neighbours": return { light: (x) => (x === 7 ? [9, 9] : [1, 1]), cells: [[8, 65, 8, 53]] };
    case "dark slab over light": return { light: (x, y) => (y < 65 ? [15, 15] : [0, 0]), cells: [[8, 65, 8, 44]] };
    case "dark air over light": return { light: (x, y) => (y < 65 ? [15, 15] : [0, 0]), cells: [] };
    case "lit furnace cell": return { light: (x, y, z) => (x === 8 && y === 65 && z === 8 ? [0, 13] : [0, 0]), cells: [[8, 65, 8, 62]] };
    case "opaque cell": return { light: () => [0, 0], cells: [[8, 65, 8, 1]] };
    case "unloaded": return { light: () => [15, 15], cells: [] };
    case "burning": return { light: () => [2, 0], cells: [] };
    default: throw new Error(r.name);
  }
}
// a port LightVolume whose sky and block arrays hold the scenario's light in the section y 64..79 of chunk (0, 0); the rest reads 0
function volume(light, cells, hasNoSky) {
  const placed = new Map(cells.map(([x, y, z, id]) => [x + "," + y + "," + z, fromOriginal(id, 0).id]));
  const world = { height: 256, hasNoSky, get: (x, y, z) => placed.get(x + "," + y + "," + z) ?? 0 };
  const vol = new LightVolume(world, () => 0, { defer: true });
  for (let x = 0; x < 16; x++) for (let y = 64; y < 80; y++) for (let z = 0; z < 16; z++) {
    const [sky, block] = light(x, y, z), at = (x * SIZE + z) * 256 + y;
    vol.sky[at] = hasNoSky ? 0 : sky; vol.block[at] = block;
  }
  return vol;
}

test("the port's light table is the executed WorldProvider table", () => {
  for (const r of rows("entity")) assert.deepEqual(lightBrightnessTable(r.dimension === 0 ? 0 : 0.1), r.table.map(f), r.name + " dim " + r.dimension);
});

test("Entity.getBrightness: the port's cell, level and table entry equal the executed float", () => {
  for (const r of rows("entity")) {
    const sc = scenario(r), vol = volume(sc.light, sc.cells, r.dimension !== 0), table = lightBrightnessTable(r.dimension === 0 ? 0 : 0.1);
    const level = (x, y, z) => { const p = vol.packed(x, y, z, false, false); return Math.max((p >> 20) - r.sub, (p >> 4) & 15); };
    assert.equal(entityBrightness(level, table, r.pos[0], r.minY, r.pos[2], r.maxY - r.minY, r.loaded), f(r.brightness), `${r.name} sub ${r.sub} dim ${r.dimension} y ${r.pos[1]}`);
  }
});

test("Entity.getBrightnessForRender: the packed lightmap coordinates equal the executed value, and a burning entity is drawn at 15728880", () => {
  for (const r of rows("entity")) {
    const sc = scenario(r), vol = volume(sc.light, sc.cells, r.dimension !== 0);
    const y = entityLightY(r.minY, r.maxY - r.minY), packed = r.loaded ? vol.packed(Math.floor(r.pos[0]), y, Math.floor(r.pos[2]), false, false) : 0;
    // the executed value of a burning entity's getBrightnessForRender is still the light; RenderManager.renderEntityStatic substitutes 15728880 (bytecode-read)
    assert.equal(packed, r.packed, `${r.name} sub ${r.sub} dim ${r.dimension}`);
    assert.equal(entityPacked(packed, r.burning), r.burning ? BURNING_PACKED : r.packed);
  }
  const burning = rows("entity").find((r) => r.name === "burning");
  assert.equal(burning.burning, true);
  assert.equal(BURNING_PACKED, 15 << 20 | 15 << 4);
});

test("the slab rule of the block mesher does not apply to an entity: a dark slab cell reads 0 (executed)", () => {
  const r = rows("entity").find((x) => x.name === "dark slab over light"), sc = scenario(r), vol = volume(sc.light, sc.cells, false);
  assert.equal(r.packed, 0);
  assert.equal(vol.packed(8, 65, 8, false, false), 0);
  assert.notEqual(vol.packed(8, 65, 8), 0, "the mesher's Block.getMixedBrightnessForBlock keeps its rule");
});

test("the sample height is 0.66 of the box", () => {
  assert.equal(SAMPLE_HEIGHT, 0.66);
  const rowsY = rows("entity").filter((r) => r.name.startsWith("rows y"));
  assert.ok(rowsY.some((r) => r.packed !== rowsY[0].packed), "the executed rows cross a cell boundary");
});

test("item frames: the port's box and sample cell equal the executed frame", () => {
  const vol = volume(section((x, y, z) => [(x * 5 + y * 3 + z * 7) % 16, (x * 11 + y + z * 13 + 3) % 16]), [], false);
  for (const r of rows("frame")) {
    const dir = +r.name.slice(-1), g = hangingGeometry(dir, 8, 66, 8, FRAME_PIXELS, FRAME_PIXELS);
    assert.deepEqual(g.bb.map(f), [r.box[0], r.box[1], r.box[2], r.box[3], r.box[4], r.box[5]].map(f), r.name + " box");
    assert.deepEqual([g.x, g.y, g.z].map(f), r.pos.map(f), r.name + " position");
    const y = g.y + (g.bb[4] - g.bb[1]) * SAMPLE_HEIGHT;
    assert.equal(vol.packed(Math.floor(g.x), Math.floor(y), Math.floor(g.z), false, false), r.packed, r.name);
  }
});

test("dropped items: the sampled cell changes at box bottom 65.835 as executed (0.25 * 0.66), not at 65.83", () => {
  const vol = volume(section((x, y, z) => [(x * 5 + y * 3 + z * 7) % 16, (x * 11 + y + z * 13 + 3) % 16]), [], false);
  for (const r of rows("item")) {
    const bottom = r.box[1];
    assert.equal(vol.packed(8, Math.floor(bottom + 0.25 * SAMPLE_HEIGHT), 8, false, false), r.packed, r.name);
  }
  const at = (y) => rows("item").find((r) => r.name === "item y" + y).packed;
  assert.notEqual(at(65.834), at(65.835));
});

test("sugar cane and the dead shrub: executed icon names and Item.getColorFromItemStack against the port's tiles and tints", () => {
  const icon = (id, damage) => rows("itemIcon").find((r) => r.id === id && r.damage === damage);
  // sugar cane: ItemReed draws items/reeds untinted
  assert.equal(icon(338, 0).icon, "reeds");
  assert.equal(icon(338, 0).pass0, 0xffffff);
  assert.equal(ITEMS[REEDS_ITEM].texture, "reeds");
  assert.equal(itemFromOriginal(338, 0).id, REEDS_ITEM);
  // the tall grass block item: damage 0 is the white deadbush, 1 and 2 the grass-coloured tallgrass and fern
  for (const [d, name] of [[0, "deadbush"], [1, "tallgrass"], [2, "fern"]]) {
    const it = itemFromOriginal(31, d);
    assert.equal(icon(31, d).icon, name);
    assert.equal(TILES[blockTile(it.id, 2, false, it.damage)], name);
  }
  assert.equal(icon(31, 0).pass0, 0xffffff);
  assert.equal(icon(31, 1).pass0, 0x7cbd6b);
  assert.equal(icon(31, 2).pass0, 0x7cbd6b);
  assert.equal(displayTint(31, 0), null);
  // the leaves items: oak 0x48B518, spruce 0x619961, birch 0x80A755 (jungle the basic colour)
  assert.deepEqual([0, 1, 2, 3].map((d) => icon(18, d).pass0), [0x48b518, 0x619961, 0x80a755, 0x48b518]);
  assert.deepEqual([0, 1, 2, 3].map((d) => icon(18, d).icon), ["leaves_oak", "leaves_spruce", "leaves_birch", "leaves_jungle"]);
  assert.equal(icon(106, 0).pass0, 0x48b518);
  assert.equal(icon(111, 0).pass0, 0x208030);
});
