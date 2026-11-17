// Batch 78 mpadventure78: Adventure refusals that 1.7.10 does not make (server and single player), a leashed corpse in its death animation, and a non-lead item on a knot's fence.
// Bytecode-read (javap -c -p, whole jar): yz.a(IIIILadd) = canPlayerEdit: allowEdit || stack != null && add.z(); add.z() = adb.v() = true and no Item class overrides adb.v(); every caller (ItemBlock abg, reed abl,
// bucket abo, hoe, seeds, dye, sign, fireball, firework, painting, ...) passes the stack in hand, so Adventure never refuses an item use. mx (ItemInWorldManager) tryUseItem and activateBlockOrUseItem read
// no game type. yz.d(III) = isCurrentToolAdventureModeExempt is read only by mx.a(IIII) / mx.b(III) (dig), bje / bao (client dig) and nh (server dig). sw.c (EntityLiving.interactFirst) tests no health, and
// nh.a(ja) (processUseEntity) only the entity != null, the reach and the sight line. su.c (EntityLeashKnot.interactFirst) answers true for any item.
import test from "node:test";
import assert from "node:assert/strict";
import { World, FENCE, PHYSICS, SAPLING, DYE } from "./world.js";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { applyPlayerEdit } from "./player-edit-simulation.js";
import { useFireCharge } from "./spawn-egg-use.js";
import { ITEM_FIRE_CHARGE } from "./spawn-eggs.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { ITEM_CAKE } from "./stems-cake.js";

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const LEAD = 2020, STONE = 1, DIRT = 2, WOOD_HOE = 120; // internal block ids: 1 grass, 2 dirt (farming.till)
const NORMAL = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const wireId = (m) => Number(String(m.id).replace(/^mob-/, ""));

function fixture(mode = "survival") {
  const world = new World("b78-adventure");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: mode, mobs: true });
  s.rules.chunkStream = false; s.rules.spawnProtection = 0; s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id, n, x = 64.5, z = 64.5) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); p.moved = true; p.survival.protection = 0; return p; };
const give = (p, id, count = 1, damage = 0) => { p.survival.inventory.main.fill(null); p.survival.inventory.main[0] = makeStack(id, count, damage); p.survival.inventory.current = 0; };
const cow = (s, x = 66.5, z = 64.5) => { const c = s.mobs.mobs.create("cow", x, 14, z); s.mobs.mobs.entities.push(c); return c; };
const tie = (s, p, c) => { give(p, LEAD, 5); s.queueAnimUse(p.id ?? "a", wireId(c), false); s.tick(); };
// Aims from outside face `side` of block (bx, by, bz) at the point (fx, fy, fz) within it (default the centre) and right-clicks: a real server ray.
function aimClick(s, p, [bx, by, bz], side = 0, sneak = false, at = [0.5, 0.5, 0.5], d = 1.2) {
  const n = NORMAL[side], cx = bx + at[0], cy = by + at[1], cz = bz + at[2], ex = cx + n[0] * d, ey = cy + n[1] * d, ez = cz + n[2] * d;
  const dx = cx - ex, dy = cy - ey, dz = cz - ez, h = Math.hypot(dx, dz);
  p.position.copy({ x: ex, y: ey - PHYSICS.eye, z: ez }); p.previous.copy(p.position);
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, h);
  p.input = { ...p.input, sneak };
  return s.dimensions.within(p, () => s.edit(p, true));
}
const adventure = () => { const s = fixture("adventure"), a = join(s, "a", 1); a.survival.mode = "adventure"; return { s, a }; };

test("server, Adventure: a hoe tills, a cake is placed, a fire charge lights, bone meal grows a sapling (canPlayerEdit is true with a stack in hand)", () => {
  { const { s, a } = adventure(); s.world.put(66, 12, 70, DIRT, 0, false); give(a, WOOD_HOE, 1); aimClick(s, a, [66, 12, 70], 1, false, undefined, 4.5); assert.equal(s.world.get(66, 12, 70), 29, "tilled"); }
  { const { s, a } = adventure(); s.world.put(66, 12, 70, STONE, 0, false); give(a, ITEM_CAKE, 1); aimClick(s, a, [66, 12, 70], 1, false, undefined, 4.5); assert.notEqual(s.world.get(66, 13, 70), 0, "cake placed"); assert.equal(a.survival.held, null); }
  { const { s, a } = adventure(); s.world.put(66, 12, 70, STONE, 0, false); give(a, ITEM_FIRE_CHARGE, 2); aimClick(s, a, [66, 12, 70], 1, false, undefined, 4.5); assert.notEqual(s.world.get(66, 13, 70), 0, "fire"); assert.equal(a.survival.held.count, 1); }
  { const { s, a } = adventure(); s.world.put(66, 12, 70, DIRT, 0, false); s.world.put(66, 13, 70, SAPLING, 0, false); give(a, DYE, 3, 15); aimClick(s, a, [66, 13, 70], 1, false, undefined, 4.5); assert.equal(a.survival.held.count, 2, "bone meal spent"); }
});

test("server, Adventure: a block item is placed like in Survival (ItemBlock.canPlayerEdit passes); the same click in Survival agrees", () => {
  for (const mode of ["survival", "adventure"]) {
    const s = fixture(mode), a = join(s, "a", 1); a.survival.mode = mode; give(a, STONE, 4);
    s.world.put(66, 12, 70, STONE, 0, false);
    aimClick(s, a, [66, 12, 70], 1, false, undefined, 4.5);
    assert.equal(s.world.get(66, 13, 70), STONE, mode);
  }
});

test("single player: useFireCharge works in Adventure", () => {
  const survival = new Survival({ slots: [makeStack(ITEM_FIRE_CHARGE, 2)] }, "adventure");
  const lit = [];
  const state = { survival, world: { height: 256, get: () => 0, inside: () => true }, fire: { ignite: (...q) => lit.push(q), drain: () => [] } };
  assert.equal(useFireCharge(state, { block: [1, 5, 1], adjacent: [1, 6, 1] }), true);
  assert.deepEqual(lit, [[1, 6, 1]]);
  assert.equal(survival.held.count, 1);
});

test("server: a non-lead item (or an empty hand) clicked on a knot's fence where the ray meets the knot hits the knot, sneaking or not; no block is placed", () => {
  for (const sneak of [false, true]) {
    const s = fixture(), a = join(s, "a", 1), c = cow(s);
    s.world.put(66, 14, 70, FENCE, 0, false);
    tie(s, a, c); aimClick(s, a, [66, 14, 70], 2);
    assert.equal(s.mobs.mobs.knotList.length, 1);
    give(a, STONE, 4);
    assert.equal(aimClick(s, a, [66, 14, 70], 2, sneak), true, "the click was the knot's");
    assert.equal(s.mobs.mobs.knotList.length, 0, "the knot died (EntityLeashKnot.interactFirst, nothing to attach)");
    assert.equal(s.world.get(66, 14, 69), 0, "no stone against the fence");
    assert.equal(a.survival.held.count, 4);
  }
});

test("server: a ray that passes below the knot's box meets the post, not the knot: a stone is placed and the knot stays", () => {
  const s = fixture(), a = join(s, "a", 1), c = cow(s);
  s.world.put(66, 14, 70, FENCE, 0, false);
  tie(s, a, c); aimClick(s, a, [66, 14, 70], 2);
  give(a, STONE, 4);
  aimClick(s, a, [66, 14, 70], 2, false, [0.5, 0.05, 0.5], 3);
  assert.equal(s.mobs.mobs.knotList.length, 1, "the knot stays");
  assert.equal(s.world.get(66, 14, 69), STONE, "the stone goes against the post");
});

test("server: a leashed mob in its death animation is freed by the holder's click and re-tied to a knot by a lead click on the fence", () => {
  const s = fixture(), a = join(s, "a", 1), c = cow(s);
  s.world.put(66, 14, 70, FENCE, 0, false);
  tie(s, a, c);
  c.health = 0;
  assert.ok(s.mobs.mobs.entities.includes(c), "the corpse is still an entity");
  give(a, LEAD, 3);
  aimClick(s, a, [66, 14, 70], 2);
  assert.deepEqual(c.leash?.knot, { x: 66, y: 14, z: 70 }, "the corpse joins the knot (getEntitiesWithinAABB has no health test)");
  c.leash = { holder: "player", holderId: "a" };
  const leads = () => s.items.items.filter((i) => (i.stack?.id ?? i.id) === LEAD).length, before = leads();
  a.survival.inventory.main[0] = null;
  assert.equal(s.mobs.interact(a, wireId(c), false), true, "the click reaches the corpse");
  assert.ok(!c.leash, "freed");
  s.tick();
  assert.equal(leads(), before + 1, "the lead dropped");
});

test("single player: a corpse with a lead is picked, freed by the holder's click and re-tied by leashedNear", () => {
  const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const w = new EntityWorld(terrain, [{ id: "mob-1", type: "pig", x: 64, y: 0, z: 66, health: 10 }], () => 0.5);
  Object.assign(w.ai.player, { x: 64, y: 0, z: 64 });
  const e = w.entities[0];
  w.setLeash(e, { holder: "player" });
  e.health = 0;
  assert.equal(w.pick({ x: 64, y: 0.5, z: 64 }, { x: 0, y: 0, z: 1 }, 6)?.entity, e, "a corpse that carries a lead is aimed");
  assert.equal(w.leashedNear({ x: 64, y: 0, z: 66 }).length, 1, "and joins a knot");
  const survival = new Survival({}, "survival");
  assert.equal(w.leashInteract(e, survival), true);
  assert.equal(e.leash, undefined, "freed");
  e.health = 0;
  w.pick({ x: 64, y: 0.5, z: 64 }, { x: 0, y: 0, z: 1 }, 6);
});

test("single player: a stone clicked on an aimed knot hits the knot (entity first); a click the ray missed no longer reaches it", () => {
  const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : (x === 66 && y === 0 && z === 64) ? FENCE : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const w = new EntityWorld(terrain, [], () => 0.5);
  Object.assign(w.ai.player, { x: 64, y: 0, z: 64 });
  const k = w.knotCreate(66, 0, 64), stand = w.knotEntity(`mob-${900000000 + 1}`) ?? w.pick({ x: 66.5, y: 0.75, z: 60 }, { x: 0, y: 0, z: 1 }, 6).entity;
  const survival = new Survival({ slots: [makeStack(STONE, 4)] }, "survival");
  assert.equal(w.leashInteract(stand, survival), true);
  assert.ok(k.dead, "the knot died");
  assert.equal(survival.held.count, 4);
  // leashFence: knotHit false skips the stand-in; undefined keeps it (lead or empty hand).
  const k2 = w.knotCreate(66, 0, 64);
  assert.equal(w.leashFence([66, 0, 64], new Survival({}, "survival"), false), false);
  assert.ok(!k2.dead);
  assert.equal(w.leashFence([66, 0, 64], new Survival({}, "survival")), true);
  assert.ok(k2.dead);
});
