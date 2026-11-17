// Batch 79 corpse79: right clicks on dying mobs and on leash knots.
// Bytecode-read (javap -c -p, whole jar): yz.q (EntityPlayer.interactWith) = Entity.interactFirst (sa.c), then ItemStack.interactWithEntity (add.a) for a living target, no health test.
// sw.c (EntityLiving.interactFirst) tests no health; the mob interacts rx, wf (feeding), wh (cow bucket), wo (pig saddle ride), wp (sheep shears), xz (creeper flint), wn (wolf), wv (ocelot), wi (horse)
// read no health either, only yv (EntityVillager.interact) tests Z() = isEntityAlive (!isDead && health > 0); items acj (dye on a sheep), adm (name tag), adt (saddle on a pig) none. sv.a(ro, F)
// (attackEntityFrom) returns false for health <= 0 after resetting entityAge. A dying mob is not isDead until its 20-tick animation ends, so canBeCollidedWith holds and getMouseOver picks it.
// su (EntityLeashKnot): su(world, x, y, z) -> ss(world) setSize 0.5 / 0.5, then setPosition(x + 0.5, y + 0.5, z + 0.5), su.a(int) (setDirection) empty: the box is the 0.5 cube from the position up.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { RemoteMobs } from "./multiplayer/remote-mobs.js";
import { predictAnimalUse } from "./multiplayer/animal-use.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { DYE } from "./world.js";

const WHEAT = 305, SHEARS = 125, BUCKET = 340, MILK = 343, SADDLE = 363, NAME_TAG = 375, LEAD = 2020;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture() {
  const world = new World("b79-corpse");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s) => { const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("a", input()); return p; };
const mob = (s, type, x = 66.5, z = 64.5) => { const m = s.mobs.mobs.create(type, x, 10, z); s.mobs.mobs.entities.push(m); return m; };
const wire = (m) => Number(String(m.id).replace(/^mob-/, ""));
const give = (p, id, count = 1, damage = 0, extra = {}) => { p.survival.inventory.main.fill(null); p.survival.inventory.main[0] = { ...makeStack(id, count, damage), ...extra }; p.survival.inventory.current = 0; };
const held = (p) => p.survival.inventory.main[0];
const click = (s, p, m) => s.mobs.interact(p, wire(m), false);

test("server: a corpse takes shears, a dye, wheat, a saddle, a bucket and a name tag (EntityPlayer.interactWith has no health test)", () => {
  const s = fixture(), p = join(s);
  const sheep = mob(s, "sheep"); s.tick(); sheep.health = 0;
  give(p, SHEARS); assert.equal(click(s, p, sheep), true); assert.equal(sheep.sheared, true, "sheared");
  const sheep2 = mob(s, "sheep"); s.tick(); sheep2.health = 0;
  give(p, DYE, 2, 1); assert.equal(click(s, p, sheep2), true); assert.equal(sheep2.color, ~1 & 15, "dyed"); assert.equal(held(p).count, 1);
  const pig = mob(s, "pig"); s.tick(); pig.health = 0;
  give(p, SADDLE); assert.equal(click(s, p, pig), true); assert.equal(pig.saddled, true, "saddled");
  const cow = mob(s, "cow"); s.tick(); cow.health = 0;
  give(p, WHEAT, 2); assert.equal(click(s, p, cow), true); assert.equal(cow.love, 600, "in love"); assert.equal(held(p).count, 1);
  give(p, BUCKET); assert.equal(click(s, p, cow), true); assert.equal(held(p).id, MILK, "milked");
  const cow2 = mob(s, "cow"); s.tick(); cow2.health = 0;
  give(p, NAME_TAG, 1, 0, { displayName: "Gone" }); assert.equal(click(s, p, cow2), true); assert.equal(cow2.customName, "Gone", "named");
});

test("server: a lead ties an unleashed corpse (sw.c), and an adult villager corpse does not trade (EntityVillager.interact tests isEntityAlive)", () => {
  const s = fixture(), p = join(s);
  const pig = mob(s, "pig"); s.tick(); pig.health = 0;
  give(p, LEAD, 2); assert.equal(click(s, p, pig), true); assert.equal(pig.leash?.holder, "player");
  const v = mob(s, "villager", 62.5); s.tick(); v.health = 0;
  give(p, 0, 0); p.survival.inventory.main[0] = null;
  assert.equal(click(s, p, v), false, "no trade window");
});

test("single player: pick returns an unleashed corpse, and the same click rules run on it", () => {
  const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const w = new EntityWorld(terrain, [{ id: "mob-1", type: "sheep", x: 64, y: 0, z: 66, health: 8 }], () => 0.5);
  Object.assign(w.ai.player, { x: 64, y: 0, z: 64 });
  const e = w.entities[0];
  e.health = 0;
  assert.equal(w.pick({ x: 64, y: 0.5, z: 64 }, { x: 0, y: 0, z: 1 }, 6)?.entity, e, "an unleashed corpse is aimed");
  const shear = new Survival({ slots: [makeStack(SHEARS, 1)] }, "survival");
  assert.equal(w.shear(e, SHEARS, shear), true);
  const dye = new Survival({ slots: [makeStack(DYE, 3, 1)] }, "survival");
  assert.equal(w.dye(e, dye.held, dye), true);
  const tag = new Survival({ slots: [{ ...makeStack(NAME_TAG, 1), displayName: "Z" }] }, "survival");
  assert.equal(w.nameTagUse(e, tag), true);
  assert.equal(e.customName, "Z");
  const lead = new Survival({ slots: [makeStack(LEAD, 2)] }, "survival");
  assert.equal(w.leashInteract(e, lead), true, "tied");
  assert.equal(w.attack(e, 276, new Survival({}, "survival"), { x: 64, z: 64, yaw: 0 }), false, "attackEntityFrom ignores a corpse");
});

test("multiplayer client: the copy of a corpse is picked, and a click on it is predicted like a living mob's", () => {
  const s = fixture(), p = join(s), cow = mob(s, "cow"); s.tick();
  const remote = new RemoteMobs(s.world, {});
  remote.apply(JSON.parse(JSON.stringify(p.mobPackets ?? []))); p.mobPackets = null;
  const copy = remote.copies.get(wire(cow));
  assert.ok(copy, "the copy exists");
  const o = { x: copy.mob.x - 3, y: copy.mob.y + 0.5, z: copy.mob.z }, d = { x: 1, y: 0, z: 0 };
  assert.ok(remote.pick(o, d, 6), "alive: picked");
  copy.mob.health = 0;
  assert.equal(remote.pick(o, d, 6)?.entity, copy.mob, "dying: still picked");
  const sv = new Survival({ slots: [makeStack(BUCKET, 1)] }, "survival");
  assert.equal(predictAnimalUse(copy.mob, sv).handled, true, "milked on the copy");
});

test("server knot box: a summoned knot is aimed at on its floored tile like the client copy; a placed knot keeps its block centre", () => {
  const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const w = new EntityWorld(terrain, [], () => 0.5);
  const k = w.knotSummon(10.9, 5.9, 20.9);
  // Copy box: centre 10.5, 5.5, 20.5. A ray at x 10.9 along z passes the live box (10.65 to 11.15) but not the copy's box (10.25 to 10.75 grown 0.1).
  assert.equal(w.knotRay(k, { x: 11.0, y: 6.0, z: 10 }, { x: 0, y: 0, z: 1 }, 6), null, "outside the copy box");
  assert.ok(w.knotRay(k, { x: 10.5, y: 6.0, z: 10 }, { x: 0, y: 0, z: 1 }, 20) !== null, "inside the copy box");
  const p = w.knotCreate(30, 0, 40);
  assert.ok(w.knotRay(p, { x: 30.5, y: 0.7, z: 35 }, { x: 0, y: 0, z: 1 }, 6) !== null);
});
