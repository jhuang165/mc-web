// Batch 76 mpcauldron76: the cauldron on the dedicated server (multiplayer/server-cauldron.js) and a sweep of paintings, item frames and leash knots on the server glue
// (multiplayer/server-hanging.js) against the executed reference (hanging-reference.json: ItemHangingEntity.onItemUse, EntityItemFrame.interactFirst, attackEntityFrom).
// Bytecode-read (javap -c -p, ajw = BlockCauldron): onBlockActivated, onEntityCollidedWithBlock, fillWithRain (nextInt(20) == 1, level < 3), comparator = level;
// mt (WorldServer) calls fillWithRain only when the biome can rain (ahu.e) and it is raining, at the precipitation-height block; ss.j (EntityHanging.hitByEntity) makes a player's
// attack on a hanging entity end in attackEntityFrom(player, 0.0F) with no exhaustion; acz.a (ItemHangingEntity.onItemUse) checks canPlayerEdit, which an item in hand passes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, PHYSICS } from "./world.js";
import { makeStack } from "./inventory.js";
import { JavaRandom } from "./java-random.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { CAULDRON, BUCKET_ITEM, WATER_BUCKET_ITEM, ITEM_CAULDRON } from "./stone-utility.js";
import { ITEM_POTION, ITEM_GLASS_BOTTLE } from "./potion-use.js";
import { PAINTING_ITEM, FRAME_ITEM, ARTS } from "./hanging.js";

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const NORMAL = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

// An air world with a stone floor far below and the given stone cells; the player aims from outside face `side` of the block (bx, by, bz).
function fixture(cells = [], { creative = false, held = null } = {}) {
  const world = new World("b76-cauldron");
  for (let x = 2; x <= 30; x++) for (let z = 2; z <= 30; z++) for (let y = 1; y <= 40; y++) world.put(x, y, z, 0, 0, false);
  world.spawn = () => ({ x: 8.5, y: 34, z: 8.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: creative ? "creative" : "survival", mobs: false });
  s.rules.chunkStream = false; s.rules.doMobSpawning = false; s.rules.spawnProtection = 0;
  for (const [x, y, z, id, meta = 0] of cells) world.put(x, y, z, id, meta, false);
  const p = s.addPlayer("a", "Alice", key(1)); s.input("a", input());
  p.moved = true; p.survival.protection = 0;
  p.survival.inventory.main.fill(null);
  if (held) { p.survival.inventory.main[0] = held; p.survival.inventory.current = 0; }
  const aim = (bx, by, bz, side) => {
    const n = NORMAL[side], cx = bx + 0.5, cy = by + 0.5, cz = bz + 0.5, ex = cx + n[0] * 1.2, ey = cy + n[1] * 1.2, ez = cz + n[2] * 1.2;
    const dx = cx - ex, dy = cy - ey, dz = cz - ez, h = Math.hypot(dx, dz);
    p.position.copy({ x: ex, y: ey - PHYSICS.eye, z: ez }); p.previous.copy(p.position);
    p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, h);
  };
  const click = () => s.dimensions.within(p, () => s.edit(p, true));
  return { s, p, world, aim, click, inv: p.survival.inventory, items: () => s.items.items };
}
const level = (f, x = 8, y = 10, z = 8) => f.world.getMeta(x, y, z);
const cauldronWorld = (lvl, heldStack, opts = {}) => {
  const f = fixture([[8, 10, 8, CAULDRON, lvl]], { ...opts, held: heldStack });
  f.aim(8, 10, 8, 1);
  return f;
};

// ---- cauldron ----
test("a water bucket fills the cauldron to 3 and leaves an empty bucket; Creative keeps the full bucket; a full cauldron keeps the full bucket and still consumes the click", () => {
  for (const lvl of [0, 1, 2]) {
    const f = cauldronWorld(lvl, makeStack(WATER_BUCKET_ITEM, 1));
    assert.equal(f.click(), true);
    assert.equal(level(f), 3);
    assert.equal(f.inv.main[0].id, BUCKET_ITEM, `level ${lvl}: the held stack is replaced by an empty bucket`);
  }
  const c = cauldronWorld(1, makeStack(WATER_BUCKET_ITEM, 1), { creative: true });
  assert.equal(c.click(), true);
  assert.equal(level(c), 3);
  assert.equal(c.inv.main[0].id, WATER_BUCKET_ITEM);
  const full = cauldronWorld(3, makeStack(WATER_BUCKET_ITEM, 1));
  assert.equal(full.click(), true);
  assert.equal(level(full), 3);
  assert.equal(full.inv.main[0].id, WATER_BUCKET_ITEM);
});

test("an empty bucket, a lava bucket and a stick leave the cauldron alone; a lava bucket places nothing beside it", () => {
  for (const id of [BUCKET_ITEM, 342, 280]) {
    const f = cauldronWorld(2, makeStack(id, 1));
    const before = [...Array(5)].map((_, i) => f.world.get(8 + (i - 2), 11, 8)).join();
    f.click();
    assert.equal(level(f), 2, `item ${id}`);
    assert.equal(f.inv.main[0].id, id);
    assert.equal([...Array(5)].map((_, i) => f.world.get(8 + (i - 2), 11, 8)).join(), before, `item ${id} placed nothing above`);
  }
});

test("a glass bottle takes one level and gives a water bottle (the bottle stack shrinks after the add)", () => {
  const f = cauldronWorld(3, makeStack(ITEM_GLASS_BOTTLE, 2));
  assert.equal(f.click(), true);
  assert.equal(level(f), 2);
  assert.equal(f.inv.main[0].id, ITEM_GLASS_BOTTLE); assert.equal(f.inv.main[0].count, 1);
  const potion = f.inv.main.find((s, i) => i && s?.id === ITEM_POTION);
  assert.ok(potion && potion.count === 1 && !(potion.damage > 0));
  // a lone bottle: the water bottle goes to a free slot and the emptied slot is cleared (the add runs before the decrement)
  const one = cauldronWorld(1, makeStack(ITEM_GLASS_BOTTLE, 1));
  one.click();
  assert.equal(level(one), 0);
  assert.equal(one.inv.main[0], null);
  assert.equal(one.inv.main.filter((s) => s?.id === ITEM_POTION).length, 1);
  // an empty cauldron gives nothing
  const dry = cauldronWorld(0, makeStack(ITEM_GLASS_BOTTLE, 1));
  dry.click();
  assert.equal(level(dry), 0); assert.equal(dry.inv.main[0].id, ITEM_GLASS_BOTTLE);
});

test("a glass bottle with a full inventory spawns the water bottle at the cauldron centre, 1.5 above the cell, without a pickup delay; Creative gets no bottle but the level still drops", () => {
  const f = cauldronWorld(2, makeStack(ITEM_GLASS_BOTTLE, 3));
  for (let i = 1; i < 36; i++) f.inv.main[i] = makeStack(1, 64);
  f.click();
  assert.equal(level(f), 1);
  const dropped = f.items().find((e) => e.stack.id === ITEM_POTION);
  assert.ok(dropped, "a thrown water bottle");
  assert.deepEqual([dropped.x, dropped.px, dropped.z, dropped.delay], [8.5, 8.5, 8.5, 0]);
  assert.ok(Math.abs(dropped.py - (11.5 - 0.125)) < 1e-9 || dropped.y > 11, "spawned at y + 1.5");
  assert.equal(f.inv.main[0].count, 2);
  const c = cauldronWorld(2, makeStack(ITEM_GLASS_BOTTLE, 3), { creative: true });
  c.click();
  assert.equal(level(c), 1);
  assert.equal(c.inv.main[0].count, 3);
  assert.equal(c.inv.main.filter((s) => s?.id === ITEM_POTION).length, 0);
  assert.equal(c.items().length, 0);
});

// ItemArmor.removeColor / BlockCauldron wash: cauldron-wash-reference.json (CauldronWashProbe, the unchanged classes) replayed through the server's click.
test("washing: every recorded leather piece / colour / level / mode (128 + 8 rows) gives the executed result on the server", () => {
  const ref = JSON.parse(readFileSync(new URL("../public/research/cauldron-wash-reference.json", import.meta.url), "utf8"));
  let checked = 0;
  for (const r of ref.rows) {
    const stack = r.kind === "wash" ? makeStack(r.armor, 1, 0, undefined, r.prior === null ? {} : { color: r.prior }) : makeStack(103, 1, 0);
    const f = cauldronWorld(r.level, stack, { creative: r.creative });
    f.click();
    assert.equal(level(f), r.newLevel, JSON.stringify(r));
    if (r.kind === "wash") {
      const held = f.inv.main[0];
      assert.equal(held.count, r.count);
      assert.equal(held.color ?? null, r.color, JSON.stringify(r));
    }
    checked++;
  }
  assert.equal(checked, 136);
});

test("sneaking with an item in hand skips the cauldron, so the bucket's own use runs; sneaking empty-handed still uses it", () => {
  const f = fixture([[8, 10, 8, CAULDRON, 1]], { held: makeStack(WATER_BUCKET_ITEM, 1) });
  f.aim(8, 10, 8, 1); f.p.input.sneak = true;
  f.click();
  assert.equal(level(f), 1, "the cauldron was not activated");
  assert.equal(f.world.get(8, 11, 8) !== 0, true, "the water bucket placed its liquid above the cauldron");
});

test("a cauldron click sends no item-use packet: a lava bucket, a snowball and a glass bottle do nothing beyond the cauldron's own use", () => {
  const f = cauldronWorld(0, makeStack(342, 1));
  f.click();
  assert.equal(f.inv.main[0].id, 342);
  const ball = cauldronWorld(0, makeStack(332, 4)); // snowball
  ball.click();
  assert.equal(ball.inv.main[0].count, 4);
});

test("rain fills a cauldron on a one-in-twenty roll, up to 3, only while it rains; the comparator reads the level", () => {
  const cells = [];
  for (let x = 16; x < 32; x++) for (let z = 16; z < 32; z++) cells.push([x, 10, z, CAULDRON, 0]);
  const f = fixture(cells);
  f.p.position.copy({ x: 24.5, y: 11, z: 24.5 }); f.p.previous.copy(f.p.position); f.s.tick();
  const r = f.s.weather.random, next = r.nextInt.bind(r);
  r.nextInt = (n) => (n === 20 ? 1 : n === 16 ? 0 : next(n)); // the roll always hits and the 1-in-16 gate always opens
  const total = () => { let t = 0; for (let x = 16; x < 32; x++) for (let z = 16; z < 32; z++) { const m = f.world.getMeta(x, 10, z); assert.ok(m >= 0 && m <= 3); t += m; } return t; };
  for (let i = 0; i < 20; i++) f.s.tick();
  assert.equal(total(), 0, "clear sky: nothing");
  Object.assign(f.s.weather, { raining: true, rain: 1, prevRain: 1, rainTime: 99999 });
  const t0 = total();
  for (let i = 0; i < 40; i++) f.s.tick();
  assert.ok(total() > t0, "rain raised some cauldron");
  for (let i = 0; i < 400; i++) f.s.tick();
  total();
});

// ---- paintings and item frames ----
test("every executed ItemHangingEntity.onItemUse record (30) gives the same result through the server's own ray", () => {
  const ref = JSON.parse(readFileSync(new URL("../public/research/hanging-reference.json", import.meta.url), "utf8"));
  let checked = 0;
  for (const c of ref.cases.filter((x) => x.kind === "place")) {
    const creative = c.name.endsWith("creative");
    const f = fixture([[8, 65 - 40, 8, 1], ...(c.blocked ? [[8, 65 - 40, 7, 1]] : [])], { creative, held: makeStack(c.frame ? FRAME_ITEM : PAINTING_ITEM, 3) });
    f.aim(8, 25, 8, c.side);
    // a real ray cannot reach the north face through the blocker standing in front of it: the same target goes straight to the item's onItemUse
    const used = c.blocked && c.side === 2 ? f.s.vehicles.hanging.useHeld(f.p, { block: [8, 25, 8], adjacent: [8, 25, 7] }) : f.click(), hang = f.s.vehicles.hanging.entities;
    assert.equal(used, c.side >= 2 ? true : false, `${c.name} side ${c.side} return`);
    if (c.side >= 2 && !c.entity) assert.equal(f.inv.main[0].count, 3, `${c.name} side ${c.side} stack kept`);
    if (!c.entity) { assert.equal(hang.length, 0, `${c.name} side ${c.side}`); }
    else {
      assert.equal(hang.length, 1, `${c.name} side ${c.side}`);
      const e = hang[0], want = c.entity[0];
      assert.equal(e.dir, want[0]);
      assert.deepEqual([e.tx, e.ty, e.tz], [8, 25, 8]);
      assert.equal(f.inv.main[0].count, creative ? 3 : 2, `${c.name} side ${c.side}: Survival takes one, Creative restores the stack`);
      if (c.frame) { assert.equal(e.kind, "frame"); assert.deepEqual(e.bb.map((v) => +(v - [8, 25, 8, 8, 25, 8][0]).toFixed(6)).length, 6); }
      else assert.ok(ARTS[e.art]);
    }
    checked++;
  }
  assert.equal(checked, 30);
});

// Frame interact / attack steps of the executed record, through ServerHanging.act (C02 interact and attack) with the server's held stack.
test("every executed item-frame scenario (10) gives the same frame, held stack and drops on the server, and a hit costs no exhaustion", () => {
  const ref = JSON.parse(readFileSync(new URL("../public/research/hanging-reference.json", import.meta.url), "utf8"));
  const wallId = 1;
  for (const c of ref.cases.filter((x) => x.kind === "frame")) {
    const cells = [];
    for (let t = -4; t <= 4; t++) for (let y = 21; y <= 27; y++) cells.push([12 + t, y, 12, wallId]);
    const f = fixture(cells, { creative: c.creative });
    const hang = f.s.vehicles.hanging;
    hang.h.makeRandom = () => new JavaRandom(7);
    const e = hang.h.createFrame(12, 24, 12, 2);
    hang.h.entities.push(e);
    if (c.dropChance >= 0) e.dropChance = c.dropChance;
    f.p.position.copy({ x: 12.5, y: 24, z: 10.5 }); f.p.previous.copy(f.p.position);
    const first = c.steps.find((st) => st[0] === "insert")?.[2];
    if (first) f.inv.main[0] = makeStack(first[0], 3, first[2]);
    let exhausted = 0;
    f.p.survival.exhaust = () => { exhausted++; };
    for (const [name, , item, rotation, dead, , drops] of c.steps) {
      for (const d of f.s.items.items.splice(0)) void d;
      const key = "h" + e.id;
      if (name === "insert" || name === "rotate") hang.act(f.p, key, false);
      else if (name === "hit") hang.act(f.p, key, true);
      else if (name === "force") hang.h.broken(e, null), hang.drops();
      else if (name === "move") { hang.h.kill(e, null); hang.drops(); }
      else continue;
      assert.deepEqual([e.item ? [e.item.id, e.item.count, e.item.damage ?? 0] : null, e.rotation, e.dead], [item ? [item[0], item[1], item[2]] : null, rotation, dead], `${c.name} ${name}`);
      const got = f.s.items.items.map((i) => [i.stack.id, i.stack.count, i.stack.damage ?? 0, i.x, i.delay]).sort();
      const want = drops.map(([id, count, damage, x, , , delay]) => [id === 389 ? FRAME_ITEM : id, count, damage ?? 0, 12 + x, delay]).sort();
      assert.deepEqual(got.map(([id, n, d, , delay]) => [id, n, d, delay]), want.map(([id, n, d, , delay]) => [id, n, d, delay]), `${c.name} ${name} drops`);
    }
    assert.equal(exhausted, 0, `${c.name}: EntityHanging.hitByEntity ends the attack before addExhaustion`);
  }
});

test("a click on a painting or frame needs the native reach: under 6 blocks from posY, and a line of sight past 3 blocks", () => {
  const cells = [];
  for (let t = -4; t <= 4; t++) for (let y = 21; y <= 27; y++) cells.push([12 + t, y, 12, 1]);
  const f = fixture(cells);
  const hang = f.s.vehicles.hanging, e = hang.h.createFrame(12, 24, 12, 2);
  hang.h.entities.push(e);
  const at = (z, y = 24) => { f.p.position.copy({ x: 12.5, y, z }); f.p.previous.copy(f.p.position); };
  at(10.5); assert.equal(hang.act(f.p, "h" + e.id, true), true);
  const e2 = hang.h.createFrame(12, 24, 12, 2); hang.h.entities.push(e2);
  at(6.5); assert.equal(hang.act(f.p, "h" + e2.id, true), true, "5.4 blocks away, clear line");
  const e3 = hang.h.createFrame(12, 24, 12, 2); hang.h.entities.push(e3);
  at(5.5); assert.equal(hang.act(f.p, "h" + e3.id, true), false, "6.4 blocks away");
  // reach is measured to the entity position (posY = the frame centre), not to the nearest point of its box: 5.99 from posY is fine
  const e4 = hang.h.createFrame(12, 24, 12, 2); hang.h.entities.push(e4);
  f.p.position.copy({ x: 12.5, y: 24.5 - 5.9, z: 11.9375 }); f.p.previous.copy(f.p.position);
  assert.equal(hang.act(f.p, "h" + e4.id, true), true);
  // 6.2 below the centre but only about 4.3 from the nearest point of the box to the eye: the old box rule accepted it, native getDistanceSqToEntity refuses
  const e5 = hang.h.createFrame(12, 24, 12, 2); hang.h.entities.push(e5);
  f.p.position.copy({ x: 12.5, y: 24.5 - 6.2, z: 11.9375 }); f.p.previous.copy(f.p.position);
  assert.equal(hang.act(f.p, "h" + e5.id, true), false);
});

test("a hit on a frame, painting or knot costs no exhaustion and never stops the sprint", () => {
  const cells = [];
  for (let t = -4; t <= 4; t++) for (let y = 21; y <= 27; y++) cells.push([12 + t, y, 12, 1]);
  const f = fixture(cells);
  const hang = f.s.vehicles.hanging, e = hang.h.createPainting(f.world, 12, 24, 12, 2);
  hang.h.entities.push(e);
  f.p.position.copy({ x: 12.5, y: 24, z: 10.5 }); f.p.previous.copy(f.p.position);
  let exhausted = 0; f.p.survival.exhaust = () => { exhausted++; };
  f.p.motion.sprinting = true;
  assert.equal(hang.act(f.p, "h" + e.id, true), true);
  assert.equal(e.dead, true);
  assert.equal(exhausted, 0);
  assert.equal(f.p.motion.sprinting, true);
  assert.equal(f.s.items.items.filter((i) => i.stack.id === PAINTING_ITEM).length, 1, "survival: the painting drops");
});

// Single player shared the same bottle rule and was wrong in Creative (it gave a bottle and used one up) and for a full inventory (it threw the bottle from the player).
test("single player: bottleFromCauldron keeps Creative's bottle, and a full inventory spawns the bottle at the cauldron", async () => {
  const { bottleFromCauldron } = await import("./potion-use.js");
  const spawned = [], inv = { main: Array(36).fill(null), current: 0, add(s) { const i = this.main.findIndex((x, n) => n && !x); if (i > 0) { this.main[i] = { ...s }; s.count = 0; } }, get held() { return this.main[0]; } };
  inv.main[0] = makeStack(ITEM_GLASS_BOTTLE, 2);
  const state = { survival: { creative: true, inventory: inv }, items: { spawn: (...a) => spawned.push(a) } };
  assert.equal(bottleFromCauldron(state, 2, [3, 4, 5]), 1);
  assert.equal(inv.main[0].count, 2); assert.equal(inv.main.filter((s) => s?.id === ITEM_POTION).length, 0);
  state.survival.creative = false;
  for (let i = 1; i < 36; i++) inv.main[i] = makeStack(1, 64);
  assert.equal(bottleFromCauldron(state, 2, [3, 4, 5]), 1);
  assert.equal(inv.main[0].count, 1);
  assert.deepEqual([spawned[0][1], spawned[0][2], spawned[0][3], spawned[0][4].delay], [3.5, 5.5, 5.5, 0]);
});
