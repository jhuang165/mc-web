import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World, BLOCKS, SIGN_POST, WALL_SIGN, blockBounds, solidBlock } from "./world.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { itemFromOriginal } from "./region-import.js";
import { ITEMS, MATERIALS, RECIPES } from "./survival.js";
import { lightOpacity } from "./lighting.js";
import { CREATIVE_TABS } from "./creative.js";
import { splitRuntime, joinRuntime } from "./chunk-runtime.js";
import { rayBounds } from "./projectiles.js";
import { SIGN_RENDER, signLayout } from "./sign-layout.js";
import { signAngle } from "./sign-renderer.js";
import {
  ITEM_SIGN, SIGN_ITEMS, SIGN_TEXT, Signs, SignEditModel, acceptLine, clickedFace, filterText, isAllowedChar, placeSign, readLine, signDrops,
  signShouldPop, standingMeta,
} from "./signs.js";

const ref = JSON.parse(await readFile(new URL("../public/research/sign-reference.json", import.meta.url)));
const by = (c, kind) => ref.records.filter((r) => r.case === c && (kind === undefined || r.kind === kind));
// The probe stands the sign at (8, 64, 8); the test world uses a lower level.
const X = 8, Y = 30, Z = 8, f = Math.fround;
const world = new World("signs", "meadow", 1);
const exact = (id, meta = 0) => { const m = fromOriginal(id, meta); return m?.exact ? m : null; };
const put = (x, y, z, id, meta = 0) => { const m = exact(id, meta); if (!m) return false; world.put(x, y, z, m.id, m.meta, false); return true; };
const clear = () => { for (let x = 4; x <= 12; x++) for (let y = Y - 3; y <= Y + 3; y++) for (let z = 4; z <= 12; z++) world.put(x, y, z, 0, 0, false); };
const count = { tested: 0, skipped: 0 };
const must = (ok) => { if (ok) count.tested++; else count.skipped++; return ok; };
const near = (a, b, m) => { assert.equal(a.length, b.length, m); a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${m}: ${a} vs ${b}`)); };
const player = (n = 16, creative = false) => ({ creative, n, count() { return this.n; }, take() { this.n--; return true; } });

test("registry, item, names, drops and recipe match the native classes", () => {
  assert.deepEqual([SIGN_POST, WALL_SIGN, ITEM_SIGN], [175, 176, 480]);
  assert.equal(fromOriginal(63, 5).id, SIGN_POST);
  assert.equal(fromOriginal(68, 3).id, WALL_SIGN);
  assert.deepEqual(toOriginal(SIGN_POST, 9), [63, 9]);
  assert.deepEqual(toOriginal(WALL_SIGN, 4), [68, 4]);
  assert.deepEqual(itemFromOriginal(323, 0), { id: ITEM_SIGN, damage: 0, clamped: false });
  assert.deepEqual(SIGN_ITEMS, { 323: ITEM_SIGN });
  const [standing, wall] = by("facts"), item = by("item")[0];
  for (const [id, facts] of [[SIGN_POST, standing], [WALL_SIGN, wall]]) {
    assert.equal(f(MATERIALS[id].hardness), f(facts.hardness));
    assert.equal(MATERIALS[id].drop, ITEM_SIGN);
    assert.equal(MATERIALS[id].kind, undefined, "no tool is required");
    assert.equal(lightOpacity(id), facts.lightOpacity);
    assert.equal(solidBlock(id, 0), false, "BlockSign has no collision box");
    assert.equal(facts.render, -1);
    assert.equal(facts.opaque, false);
    for (const d of facts.drops) assert.deepEqual(d, [323, 0, 1]);
  }
  assert.deepEqual(signDrops(), [{ id: ITEM_SIGN, count: 1, damage: 0 }]);
  assert.equal(ITEMS[ITEM_SIGN].stack, item.stackLimit);
  assert.equal(ITEMS[ITEM_SIGN].stack, 16);
  assert.equal(ITEMS[ITEM_SIGN].name, ref.names["item.sign.name"]);
  assert.equal(BLOCKS[SIGN_POST].name, ref.names["tile.sign.name"]);
  assert.equal(SIGN_TEXT.edit, ref.names["sign.edit"]);
  assert.equal(SIGN_TEXT.done, ref.names["gui.done"]);
  const tab = CREATIVE_TABS[item.tab].items.map((s) => (Array.isArray(s) ? s[0] : s));
  assert.ok(tab.includes(ITEM_SIGN), "the Decoration tab lists the sign");
  const recipe = RECIPES.find((r) => r.output?.id === ITEM_SIGN || r.id === "sign");
  assert.ok(recipe, "CraftingManager: six planks and a stick make three signs");
  assert.equal(ITEMS[SIGN_POST], undefined, "the sign blocks are not items");
});

test("BlockSign bounds, selection, collision and ray boxes per metadata", () => {
  const shapes = by("shape");
  assert.equal(shapes.length, 32);
  for (const r of shapes) {
    clear();
    const id = r.id === 63 ? SIGN_POST : WALL_SIGN;
    world.put(X, Y, Z, id, r.meta, false);
    near(blockBounds(world, X, Y, Z), r.bounds, `bounds ${r.id}:${r.meta}`);
    assert.equal(r.collision, null);
    near(rayBounds(world, X, Y, Z, id), r.selection, `ray box ${r.id}:${r.meta}`);
  }
});

test("ItemSign.onItemUse: yaw, face, support, occupancy, stack and the edit screen", () => {
  const yaws = by("place", "yaw");
  assert.equal(yaws.length, 47);
  for (const r of yaws) assert.equal(standingMeta(r.yaw), r.sets[0][4], `yaw ${r.yaw}`);
  const faces = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  const click = (block, side, yaw = 0, p = player()) => {
    const opened = [], drops = [];
    const res = placeSign({ world, survival: p, yawDegrees: yaw }, { id: ITEM_SIGN, target: { block, adjacent: [block[0] + faces[side][0], block[1] + faces[side][1], block[2] + faces[side][2]] } }, {
      signs, openEditor: (t) => opened.push(t), updateBlock: () => {}, renderHotbar: () => {}, markUnsaved: () => {}, sound: () => {},
    });
    return { res, opened, drops, p };
  };
  var signs = new Signs();
  for (const r of by("place", "side")) {
    clear(); signs = new Signs();
    put(X, Y, Z, 1);
    const { res, opened, p } = click([X, Y, Z], r.side, r.yaw);
    assert.equal(res.placed, r.result, `side ${r.side}`);
    assert.equal(p.n, r.stack, `stack side ${r.side}`);
    assert.equal(opened.length, r.opened);
    if (r.result) {
      const [x, y, z] = res.position, set = r.sets[0];
      assert.equal(world.getMeta(x, y, z), set[4], `meta side ${r.side}`);
      assert.deepEqual(toOriginal(world.get(x, y, z), 0)[0], set[3]);
      assert.deepEqual(signs.tile(x, y, z).text, r.tile.text);
      assert.equal(signs.tile(x, y, z).editable, true);
    }
  }
  for (const r of by("place", "support")) {
    clear(); signs = new Signs();
    if (!must(put(X, Y, Z, r.block, 0))) continue;
    assert.equal(click([X, Y, Z], 1).res.placed, r.result, `support ${r.block}`);
  }
  for (const r of by("place", "occupied")) {
    clear(); signs = new Signs();
    put(X, Y, Z, 1);
    if (!must(put(X, Y + 1, Z, r.block, r.meta))) continue;
    assert.equal(click([X, Y, Z], 1).res.placed, r.result, `occupied ${r.block}:${r.meta}`);
  }
  for (const r of by("place", "count")) {
    clear(); signs = new Signs(); put(X, Y, Z, 1);
    const { p } = click([X, Y, Z], 1, 0, player(r.count));
    assert.equal(p.n, r.stack);
  }
  // Creative keeps the stack (ItemStack.tryPlaceItemIntoWorld restores it).
  clear(); signs = new Signs(); put(X, Y, Z, 1);
  assert.equal(click([X, Y, Z], 1, 0, player(16, true)).p.n, 16);
  assert.equal(clickedFace([1, 1, 1], [1, 0, 1]), 0);
  assert.ok(count.tested > 80, `replayed ${count.tested} exact-mapped cases (${count.skipped} skipped)`);
});

test("BlockSign.onNeighborBlockChange: support, wall facing and the pop", () => {
  for (const r of by("neighbour", "standing")) {
    clear();
    if (!must(put(X, Y - 1, Z, r.below, 0))) continue;
    world.put(X, Y, Z, SIGN_POST, r.meta, false);
    assert.equal(signShouldPop(world, X, Y, Z), r.cells[0][0] === 0, `standing below ${r.below}:${r.meta}`);
    assert.equal(r.drops.some((d) => d[0] === 323), r.cells[0][0] === 0);
  }
  const side = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const r of by("neighbour", "wall")) {
    clear();
    for (let k = 0; k < 4; k++) if (!put(X + side[k][0], Y, Z + side[k][1], k === r.where ? r.support : 1, 0) && k === r.where) break;
    if (!must(exact(r.support, 0))) continue;
    world.put(X, Y, Z, WALL_SIGN, r.meta, false);
    assert.equal(signShouldPop(world, X, Y, Z), r.cells[0][0] === 0, `wall meta ${r.meta} support ${r.support}@${r.where}`);
  }
  assert.ok(count.tested > 300, `replayed ${count.tested} exact-mapped cases`);
});

test("TileEntitySign: text, NBT round trip, editable flag and the persisted list", () => {
  const fresh = by("tile")[0].fresh;
  const signs = new Signs(), t = signs.create(3, 70, -5);
  assert.deepEqual([t.text, t.editable], [fresh.text, fresh.editable]);
  for (const r of by("nbt")) {
    const loaded = Signs.fromJSON([{ x: 3, y: 70, z: -5, text: r.lines }]).tile(3, 70, -5);
    assert.deepEqual(loaded.text, r.roundTrip.text, r.name);
    assert.equal(loaded.editable, r.readEditable, r.name);
    assert.deepEqual(r.lines.map(readLine), r.read, r.name);
  }
  // A saved record round-trips and is not editable afterwards.
  signs.update(3, 70, -5, ["Hello", "World", "", "!"]);
  const back = Signs.fromJSON(JSON.parse(JSON.stringify(signs.toJSON())));
  assert.deepEqual(back.tile(3, 70, -5).text, ["Hello", "World", "", "!"]);
  assert.equal(back.update(3, 70, -5, ["x", "", "", ""]), false, "a loaded tile is not editable");
  assert.equal(signs.remove(3, 70, -5), true);
  assert.equal(signs.tile(3, 70, -5), null);
  // Runtime chunking keeps the list in its column (chunk-runtime.js).
  const record = { id: "w", signs: [{ x: 3, y: 70, z: -5, text: ["a", "", "", ""] }, { x: 40, y: 64, z: 40, text: ["b", "", "", ""] }] };
  const { metadata, columns } = splitRuntime(record);
  assert.equal(columns.length, 2);
  assert.deepEqual(joinRuntime(metadata, columns).signs.map((s) => s.text[0]).sort(), ["a", "b"]);
});

test("ChatAllowedCharacters, the client filter and processUpdateSign", () => {
  const chars = by("chars")[0], denied = [];
  for (let c = 0; c < chars.count; c++) if (!isAllowedChar(c)) denied.push(c);
  assert.deepEqual(denied, chars.denied);
  assert.equal(chars.count - denied.length, chars.allowedCount);
  for (const [raw, want] of by("filter")[0].samples) assert.equal(filterText(raw), want, JSON.stringify(raw));
  assert.equal(acceptLine("123456789012345"), "123456789012345");
  assert.equal(acceptLine("1234567890123456"), "!?");
  assert.equal(acceptLine("a§b"), "!?");
  assert.equal(acceptLine("café"), "café");
  const signs = new Signs(); signs.create(1, 1, 1);
  assert.equal(signs.update(1, 1, 1, ["fine", "this is far too long", "a\u007f", ""]), true);
  assert.deepEqual(signs.tile(1, 1, 1).text, ["fine", "!?", "!?", ""]);
  assert.equal(signs.update(2, 2, 2, ["x"]), false, "no tile, no update");
});

test("GuiEditSign key handling and the renderer constants", () => {
  const g = ref.bytecode.gui, m = new SignEditModel();
  assert.deepEqual([g.keys.up, g.keys.down, g.keys.enter, g.keys.numpadEnter, g.keys.backspace, g.keys.escape], [200, 208, 28, 156, 14, 1]);
  assert.equal(g.maxLine, 15);
  m.keyCode(g.keys.up); assert.equal(m.line, 3);
  m.keyCode(g.keys.down); assert.equal(m.line, 0);
  m.keyCode(g.keys.enter); m.keyCode(g.keys.numpadEnter); assert.equal(m.line, 2);
  for (const ch of "abcdefghijklmnopqrst") m.type(ch);
  assert.equal(m.lines[2], "abcdefghijklmno", "a line is cut at 15 characters");
  m.type("§"); m.type("\u007f"); assert.equal(m.lines[2].length, 15);
  m.keyCode(g.keys.backspace); assert.equal(m.lines[2], "abcdefghijklmn");
  m.keyCode(g.keys.backspace); m.line = 3; m.keyCode(g.keys.backspace); assert.equal(m.lines[3], "");
  assert.equal(m.display(3), ">  <");
  assert.equal(m.display(2), "abcdefghijklm");
  m.keyCode(g.keys.escape); assert.equal(m.done, true);
  const r = ref.bytecode.render;
  assert.equal(SIGN_RENDER.scale, f(r.scale));
  assert.deepEqual(SIGN_RENDER.wallAngle, r.wallRotate);
  assert.deepEqual(SIGN_RENDER.wallTranslate, r.wallTranslate);
  assert.deepEqual([SIGN_RENDER.board.box, SIGN_RENDER.board.uv, SIGN_RENDER.stick.box, SIGN_RENDER.stick.uv], [r.boardBox, r.boardUV, r.stickBox, r.stickUV]);
  assert.equal(SIGN_RENDER.modelScale, r.modelScale);
  assert.equal(SIGN_RENDER.lineSpacing, r.lineSpacing);
  assert.equal(SIGN_RENDER.maxDistanceSquared, r.maxRenderDistanceSquared);
  assert.equal(SIGN_RENDER.textScale, f(f(0.016666668) * SIGN_RENDER.scale));
  assert.deepEqual(SIGN_RENDER.textTranslate, [0, 0.5, 0.07]);
  assert.equal(signAngle(SIGN_POST, 4), 90 * 1);
  assert.equal(signAngle(WALL_SIGN, 2), 180);
  assert.equal(signLayout().boardGui, 93.75);
  assert.equal(g.model.scale, -93.75);
});
