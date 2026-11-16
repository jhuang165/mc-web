// Batch 77 mpknots77: leash knots on the dedicated server (server-leads.js, server-hanging.js), a cauldron click with food / potion / milk / sword in hand, and the bucket in Adventure.
// Bytecode-read (javap -c -p): adf (ItemLead) a(add, yz, ahb, IIIIfff) = onItemUse (render type 11 only, remote true, else func_150909_a, always true) and static a(yz, ahb, III) = func_150909_a
// (su.b first, the +-7 box around the block's integer corner, sw.bN with sw.bO == player, su.a only for the first mob, sw.b(knot, true)); su (EntityLeashKnot) c(yz) = interactFirst
// (a lead in hand and not remote: the player's leashed mobs in the +-7 box around the knot attach; then, remote false and nothing attached: B() (the knot dies) and, only for a Creative player,
// the mobs held by this knot are cleared with sw.a(true, false), no drop); akz (BlockFence) a(...) = onBlockActivated (remote true, else adf.a); yz.a(IIIILadd) canPlayerEdit =
// allowEdit || stack != null && add.z() == adb.v() == true; bao (Minecraft.rightClickMouse): bje.a(...) true clears the flag, so sendUseItem is skipped.
import test from "node:test";
import assert from "node:assert/strict";
import { World, FENCE, PHYSICS } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { CAULDRON, BUCKET_ITEM, WATER_BUCKET_ITEM } from "./stone-utility.js";
import { ITEM_POTION } from "./potion-use.js";

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const LEAD = 2020, MILK = 343, BREAD = 201, STONE = 1;
const NORMAL = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const wireId = (m) => Number(String(m.id).replace(/^mob-/, ""));

function fixture(mode = "survival") {
  const world = new World("b77-knots");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: mode, mobs: true });
  s.rules.chunkStream = false; s.rules.spawnProtection = 0; s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id, n, x = 64.5, z = 64.5) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); p.moved = true; p.survival.protection = 0; return p; };
const give = (p, id, count = 1, damage = 0) => { p.survival.inventory.main.fill(null); p.survival.inventory.main[0] = makeStack(id, count, damage); p.survival.inventory.current = 0; };
const tick = (s, n = 1) => { for (let i = 0; i < n; i++) s.tick(); };
const cow = (s, x = 66.5, z = 64.5) => { const c = s.mobs.mobs.create("cow", x, 10, z); s.mobs.mobs.entities.push(c); return c; };
const tie = (s, p, c) => { give(p, LEAD, 5); s.queueAnimUse(p.id ?? "a", wireId(c), false); s.tick(); };
// Aims from outside face `side` of block (bx, by, bz) and clicks (a real server ray).
function aimClick(s, p, [bx, by, bz], side = 0, sneak = false) {
  const n = NORMAL[side], cx = bx + 0.5, cy = by + 0.5, cz = bz + 0.5, ex = cx + n[0] * 1.2, ey = cy + n[1] * 1.2, ez = cz + n[2] * 1.2;
  const dx = cx - ex, dy = cy - ey, dz = cz - ez, h = Math.hypot(dx, dz);
  p.position.copy({ x: ex, y: ey - PHYSICS.eye, z: ez }); p.previous.copy(p.position);
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, h);
  p.input = { ...p.input, sneak };
  return s_edit(s, p);
}
const s_edit = (s, p) => s.dimensions.within(p, () => s.edit(p, true));
const items = (s) => s.items.items.filter((i) => i.stack?.id === LEAD || i.id === LEAD);
const leadCount = (s) => s.items.items.filter((i) => (i.stack?.id ?? i.id) === LEAD).length;

test("a real fence click ties the holder's mob to a new knot; the lead stays in hand (ItemLead.func_150909_a)", () => {
  const s = fixture(), a = join(s, "a", 1), c = cow(s);
  s.world.put(66, 10, 70, FENCE, 0, false);
  tie(s, a, c);
  assert.equal(c.leash.holderId, "a");
  const n = a.survival.inventory.main[0].count;
  assert.equal(aimClick(s, a, [66, 10, 70], 2), true);
  assert.deepEqual(c.leash.knot, { x: 66, y: 10, z: 70 });
  assert.equal(s.mobs.mobs.knotList.length, 1);
  assert.equal(a.survival.inventory.main[0].count, n, "func_150909_a uses no lead");
});

test("sneaking: an item other than a lead skips BlockFence.onBlockActivated (no tie); a lead still ties through ItemLead.onItemUse", () => {
  const s = fixture(), a = join(s, "a", 1), c = cow(s);
  s.world.put(66, 10, 70, FENCE, 0, false);
  tie(s, a, c);
  a.survival.inventory.main[1] = makeStack(STONE, 3); a.survival.inventory.current = 1;
  aimClick(s, a, [66, 10, 70], 2, true);
  assert.equal(c.leash.holder, "player", "a sneaking click with stone does not tie");
  assert.equal(s.mobs.mobs.knotList?.length ?? 0, 0);
  a.survival.inventory.current = 0;
  assert.equal(aimClick(s, a, [66, 10, 70], 2, true), true);
  assert.deepEqual(c.leash.knot, { x: 66, y: 10, z: 70 }, "a sneaking click with the lead ties");
});

test("a lead on a fence with no leashed mob near is consumed (onItemUse true) and makes no knot; other items fall through", () => {
  const s = fixture(), a = join(s, "a", 1);
  s.world.put(66, 10, 70, FENCE, 0, false);
  give(a, LEAD, 2);
  assert.equal(aimClick(s, a, [66, 10, 70], 2), true);
  assert.equal(s.mobs.mobs.knotList?.length ?? 0, 0);
  assert.equal(a.survival.inventory.main[0].count, 2);
});

test("only the clicker's own mobs join; a mob more than 7 blocks outside the box stays on its lead", () => {
  const s = fixture(), a = join(s, "a", 1), b = join(s, "b", 2, 68.5, 64.5);
  const near = cow(s), far = cow(s, 66.5, 64.5), theirs = cow(s, 67.5, 64.5);
  s.world.put(66, 10, 70, FENCE, 0, false);
  tie(s, a, near); give(b, LEAD, 1); s.queueAnimUse("b", wireId(theirs), false); s.tick();
  assert.equal(theirs.leash.holderId, "b");
  give(a, LEAD, 1); s.queueAnimUse("a", wireId(far), false); s.tick();
  assert.equal(far.leash.holderId, "a");
  far.x = 66.5; far.z = 80.5; // 10.5 blocks from the fence's corner: outside the +-7 box
  aimClick(s, a, [66, 10, 70], 2);
  assert.ok(near.leash.knot && !far.leash.knot && theirs.leash.holderId === "b");
});

function knotWorld(mode = "survival") {
  const s = fixture(mode), a = join(s, "a", 1), c = cow(s);
  s.world.put(66, 10, 70, FENCE, 0, false);
  tie(s, a, c); aimClick(s, a, [66, 10, 70], 2);
  const k = s.mobs.mobs.knotList[0], id = s.vehicles.hanging.knotIds.get(k) ?? (s.vehicles.hanging.track(() => null), s.vehicles.hanging.knotIds.get(k));
  return { s, a, c, k, key: "k" + id };
}

test("right-click a knot (act): the holder's other mobs join with a lead in hand; with nothing to attach the knot dies, the mobs lose the lead next tick and the lead item drops (Survival)", () => {
  const { s, a, c, k, key: kk } = knotWorld();
  const d = cow(s, 67.5, 66.5); give(a, LEAD, 3); s.queueAnimUse("a", wireId(d), false); s.tick();
  assert.equal(d.leash.holder, "player");
  a.position.copy({ x: 66.5, y: 10, z: 68.5 }); give(a, LEAD, 3);
  assert.equal(s.vehicles.hanging.act(a, kk, false), true);
  assert.ok(d.leash.knot && !k.dead, "the second mob joins");
  give(a, 0, 0); a.survival.inventory.main[0] = null;
  const before = s.items.items.length;
  assert.equal(s.vehicles.hanging.act(a, kk, false), true);
  assert.ok(k.dead, "the knot dies");
  tick(s, 2);
  assert.ok(!c.leash && !d.leash, "both lose the lead");
  assert.equal(s.items.items.length - before, 2, "and each lead drops");
});

test("right-click a knot in Creative frees its mobs with no lead drop; a hit kills the knot, drops nothing itself, and the mobs drop the lead", () => {
  const w = knotWorld("creative");
  w.a.position.copy({ x: 66.5, y: 10, z: 68.5 }); w.a.survival.inventory.main.fill(null);
  const before = w.s.items.items.length;
  assert.equal(w.s.vehicles.hanging.act(w.a, w.key, false), true);
  assert.ok(w.k.dead && !w.c.leash);
  tick(w.s, 3);
  assert.equal(w.s.items.items.length, before, "Creative: no drop");
  const h = knotWorld();
  h.a.position.copy({ x: 66.5, y: 10, z: 68.5 });
  const b2 = h.s.items.items.length;
  assert.equal(h.s.vehicles.hanging.act(h.a, h.key, true), true);
  assert.ok(h.k.dead); assert.equal(h.s.items.items.length, b2, "the hit drops nothing by itself");
  tick(h.s, 2);
  assert.ok(!h.c.leash); assert.equal(h.s.items.items.length, b2 + 1, "the mob drops the lead");
});

test("a lead breaks beyond 10 blocks from a player holder and drops; a knot holder is the same", () => {
  const s = fixture(), a = join(s, "a", 1), c = cow(s);
  tie(s, a, c);
  const before = s.items.items.length;
  a.position.x = 64.5; c.x = 64.5 + 9.5; c.z = 64.5; tick(s, 1);
  assert.ok(c.leash, "9.5 blocks holds");
  c.x = 64.5 + 11; tick(s, 1);
  assert.ok(!c.leash, "beyond 10 breaks");
  assert.equal(s.items.items.length, before + 1);
});

test("a knot whose fence is gone dies on its 101st tick, with no drop; the mob then loses the lead and drops it", () => {
  const { s, c, k } = knotWorld();
  s.world.put(66, 10, 70, 0, 0, false);
  const before = s.items.items.length;
  tick(s, 99); assert.ok(!k.dead && c.leash, "still there");
  tick(s, 4); assert.ok(k.dead, "dead after the age check");
  tick(s, 2); assert.ok(!c.leash);
  assert.equal(s.items.items.length, before + 1, "one lead from the mob, none from the knot");
});

test("a cauldron click with food, a drinkable potion, a milk bucket or a sword starts no use on the server; a sneaking click with the item does", () => {
  const cases = [[BREAD, 0], [MILK, 0], [ITEM_POTION, 8197], [112, 0]];
  for (const [id, dmg] of cases) {
    for (const sneak of [false, true]) {
      const s = fixture(), a = join(s, "a", 1);
      s.world.put(66, 10, 70, CAULDRON, 0, false);
      give(a, id, 1, dmg); a.survival.food = 5;
      aimClick(s, a, [66, 10, 70], 1, sneak);
      s.handleUse(a, true);
      assert.equal(!!a.itemInUse, sneak, `item ${id} sneak ${sneak}`);
    }
  }
  const s = fixture(), a = join(s, "a", 1); s.world.put(66, 10, 70, CAULDRON, 0, false);
  give(a, BREAD, 1); a.survival.food = 5; aimClick(s, a, [66, 10, 70], 1); tick(s, 3);
  s.handleUse(a, true);
  assert.ok(a.itemInUse, "a later, separate click starts eating again");
});

test("Adventure players use a bucket (canPlayerEdit is true with an item in hand)", () => {
  const s = fixture(), a = join(s, "a", 1);
  a.survival.mode = "adventure";
  give(a, WATER_BUCKET_ITEM, 1);
  s.world.put(66, 9, 70, 1, 0, false); s.world.put(66, 10, 70, 0, 0, false);
  aimClick(s, a, [66, 9, 70], 1);
  assert.notEqual(s.world.get(66, 10, 70), 0, "water is placed above the stone");
  assert.equal(a.survival.held.id, BUCKET_ITEM, "an empty bucket is left");
});
