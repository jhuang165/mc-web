// Batch 80 corpse80: right clicks on dying mobs that batch 79 still gated on a living mob, and the dying dragon's parts.
// Bytecode-read (javap -c -p, 1.7.10 jar): wv.a(yz) (EntityWolf.interact), wn.a(yz) (EntityOcelot), wi.a(yz) / wi.g(yz) (EntityHorse), wm.a(yz) (EntityMooshroom),
// wo.a(yz) (EntityPig), yq.a(yz) (EntityZombie) and abp.a (ItemCarrotOnAStick) test no health. sv.f(F) (heal) returns at getHealth <= 0, sv.g(F) (setHealth) clamps
// to 0..max. Entity.updateRidden lets the rider go only once the mount isDead (the deathTime 20 setDead). The dragon's parts (wy) keep R() true and freeze during
// the 200-tick death (xa.e returns after the death puff); wy.a(ro, F) -> xa.a(wy, ro, F) returns true at any health, and a part takes no interact.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";
import { EntityWorld, entityHit } from "./entities.js";
import { interact as wolfClick } from "./wolf.js";
import { feedHorse } from "./horse.js";
import { RED_MUSHROOM } from "./mooshroom.js";
import { canCure } from "./zombie-villager.js";
import { spawnDragonIfAbsent, setDragonRandom } from "./dragon-mobs.js";
import { JavaRandom } from "./lighting.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { RemoteMobs } from "./multiplayer/remote-mobs.js";
import { predictAnimalUse, serverAnimalUse } from "./multiplayer/animal-use.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

const BONE = 311, PORKCHOP = 319, SHEARS = 125, BOWL = 371, STEW = 370, GOLDEN_APPLE = 372, WEAKNESS = 18, DIAMOND_SWORD = 115;
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const one = (type, extra = {}) => { const w = new EntityWorld(grass, [{ id: "mob-1", type, x: 64, y: 0, z: 66, health: 8, ...extra }], () => 0.5); Object.assign(w.ai.player, { x: 64, y: 0, z: 64 }); return w; };
const holding = (id, n = 4, damage = 0) => new Survival({ slots: [makeStack(id, n, damage)] }, "survival");

test("wolf: a tamed corpse uses the meat without healing (sv.f returns at health <= 0); a bone tame revives it at 20 (sv.g)", () => {
  const w = one("wolf", { owner: "player" }), e = w.entities[0];
  e.dwHealth = 8; e.health = 0; // the watcher 18 keeps the last live value: bp() does not run during the death
  const s = holding(PORKCHOP, 2);
  assert.equal(w.wolfInteract(e, s), true);
  assert.equal(e.health, 0, "no heal");
  assert.equal(s.held.count, 1, "the meat is used");
  const wild = { type: "wolf", health: 0, dwHealth: 8, angry: false, owner: null };
  const out = wolfClick(wild, { id: BONE, damage: 0, count: 1 }, false, false, { nextInt: () => 0 });
  assert.equal(out.tamed, true);
  assert.equal(wild.health, 20, "setHealth(20) revives the corpse");
});

test("ocelot: the owner's click toggles a dying cat's sitting (wn.a has no health test)", () => {
  const w = one("ocelot", { owner: "player", ocelotType: 1 }), e = w.entities[0];
  e.health = 0;
  assert.equal(w.ocelotInteract(e, new Survival({}, "survival")), true);
  assert.equal(e.sitWish, !e.sitting, "the sit wish toggles");
});

test("horse: food on a corpse is used without healing, and a corpse is mounted and carries its rider until deathTime 20", () => {
  const fed = feedHorse({ type: 0, health: 0, maxHealth: 20, age: 0, tame: true, temper: 0 }, 296);
  assert.equal(fed.used, true);
  assert.equal(fed.horse.health, 0);
  const w = one("horse", { health: 20, horse: { type: 0, tame: true, saddled: true, owner: "player", speed: 0.225, jump: 0.7, maxHealth: 20 } }), e = w.entities[0];
  e.health = 0; e.death = 0;
  const r = { player: true, x: 0, y: 0, z: 0, yaw: 0, moveForward: 0, moveStrafing: 0, fallDistance: 0, vehicle: null }, seats = w.horseSeats;
  seats.player = r;
  assert.equal(w.horseInteract(e, new Survival({}), { horses: seats }), true);
  assert.equal(r.vehicle?.entity, e, "mounted");
  assert.equal(r.vehicle.dead, false, "still carried at deathTime 0");
  e.death = 19; assert.equal(r.vehicle.dead, false);
  e.death = 20; assert.equal(r.vehicle.dead, true, "let go at setDead");
});

test("mooshroom: a corpse gives stew, and shears leave a cow at health 0 starting its own death", () => {
  const w = one("mooshroom", { growingAge: 0 }), e = w.entities[0];
  e.health = 0; e.death = 5;
  const bowl = holding(BOWL, 1);
  assert.equal(w.mooshroomInteract(e, bowl), true);
  assert.equal(bowl.held?.id, STEW);
  const shears = holding(SHEARS, 1);
  assert.equal(w.mooshroomInteract(e, shears), true);
  const cow = w.entities.find((x) => x.type === "cow");
  assert.ok(cow, "the cow is spawned");
  assert.equal(cow.health, 0, "wh.g(aS()) clamps to 0");
  assert.equal(cow.death, 0, "a fresh deathTime");
  assert.equal(w.events.filter((x) => x.drop === RED_MUSHROOM).length, 5, "5 red mushrooms");
});

test("zombie villager: a dying weakened zombie villager takes the golden apple (yq.a has no health test)", () => {
  const z = { type: "zombie", villager: true, health: 0, effects: [{ id: WEAKNESS, amplifier: 0, duration: 100 }] };
  assert.equal(canCure(z, GOLDEN_APPLE, 0), true);
  const w = one("zombie", { villager: true }), e = w.entities[0];
  e.effects = [{ id: WEAKNESS, amplifier: 0, duration: 100 }]; e.health = 0;
  const s = holding(GOLDEN_APPLE, 2);
  assert.equal(w.cure(e, GOLDEN_APPLE, s, 0), true);
  assert.ok(Number.isInteger(e.conversionTime), "conversion started");
  assert.equal(s.held.count, 1);
});

test("pig: a saddled corpse takes the player (wo.a has no health test)", () => {
  const w = one("pig", { saddled: true }), e = w.entities[0];
  e.health = 0; e.death = 3;
  const r = { player: true, x: 0, y: 0, z: 0, yaw: 0, vehicle: null }, seats = Object.assign(w.horseSeats, { player: r });
  assert.equal(w.pigMount(e, seats), true);
  assert.equal(r.vehicle?.entity, e);
  assert.equal(r.vehicle.dead, false);
});

// --- server fixture (as corpse79-b79.test.js) ---
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture() {
  const world = new World("b80-corpse");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s) => { const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("a", input()); return p; };
const mob = (s, type, x = 66.5, z = 64.5) => { const m = s.mobs.mobs.create(type, x, 10, z); s.mobs.mobs.entities.push(m); return m; };
const wire = (m) => Number(String(m.id).replace(/^mob-/, ""));
const click = (s, p, m) => s.mobs.interact(p, wire(m), false);
const empty = (p) => { p.survival.inventory.main.fill(null); p.survival.inventory.current = 0; };

test("server: a saddled corpse pig takes the player and keeps it until its deathTime 20 setDead", () => {
  const s = fixture(), p = join(s), pig = mob(s, "pig"); s.tick();
  pig.saddled = true; pig.health = 0; pig.death = 0;
  empty(p);
  assert.equal(click(s, p, pig), true);
  assert.equal(p.mount?.mob, pig, "riding the corpse");
  for (let i = 0; i < 10; i++) s.tick();
  assert.equal(p.mount?.mob, pig, "still riding at deathTime 10");
  for (let i = 0; i < 15; i++) s.tick();
  assert.ok(!p.mount, "let go once the pig is dead");
});

test("server: a tame corpse horse is mounted (wi.i / mountEntity have no health test)", () => {
  const s = fixture(), p = join(s), h = mob(s, "horse"); s.tick();
  Object.assign(h.horse, { tame: true, owner: p.id }); h.growingAge = 0; h.health = 0; h.death = 0;
  empty(p);
  assert.equal(click(s, p, h), true);
  assert.equal(p.mount?.mob, h);
});

test("dying dragon: its frozen parts are aimed at, a sword hit returns true and wears the sword, and a right click does nothing", () => {
  const cells = new Map();
  const world = { numericSeed: 1, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 64, z: 0 }), get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0,
    set(x, y, z, id) { cells.set(`${x},${y},${z}`, id); return true; }, inside: () => true, streaming: true, isTicking: () => true, height: 256 };
  const w = new EntityWorld(world, [], () => 0.5), d = spawnDragonIfAbsent(world, w), s = new Survival({}), player = { x: 200, y: 70, z: 200, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
  setDragonRandom(d, new JavaRandom(7));
  w.tick(player, s);
  d.health = 0;
  w.tick(player, s);
  const head = d.dragon.parts[0], box = [...head.box];
  for (let i = 0; i < 5; i++) w.tick(player, s);
  assert.deepEqual([...head.box], box, "the parts stay put during the death");
  const c = { x: (box[0] + box[3]) / 2, y: (box[1] + box[4]) / 2, z: (box[2] + box[5]) / 2 };
  const origin = { x: c.x, y: c.y + 4, z: c.z }, dir = { x: 0, y: -1, z: 0 };
  assert.ok(entityHit(origin, dir, d, 20) > 0);
  assert.equal(w.pick(origin, dir, 20)?.entity, d, "the corpse is picked");
  const sword = holding(DIAMOND_SWORD, 1);
  const before = sword.held.damage ?? 0;
  assert.equal(w.attack(d, DIAMOND_SWORD, sword, { x: c.x, z: c.z, yaw: 0 }), true, "xa.a(wy, ro, F) returns true");
  assert.equal(sword.held.damage, before + 1, "the sword wears");
  assert.equal(d.health, 0);
  assert.equal(serverAnimalUse(w, { survival: holding(BOWL, 1) }, d, {}), false, "the part takes no interact");
  assert.equal(predictAnimalUse(d, holding(BOWL, 1)).handled, false);
});

test("multiplayer client: a dying dragon copy is picked on its parts", () => {
  const remote = new RemoteMobs({ get: () => 0 }, {});
  const mob = { id: 9, type: "ender_dragon", x: 0, y: 100, z: 0, health: 0, dragon: { parts: [{ name: "head", box: [-1, 99, -1, 1, 101, 1] }] } };
  remote.copies.set(9, { mob });
  assert.equal(remote.pick({ x: 0, y: 110, z: 0 }, { x: 0, y: -1, z: 0 }, 20)?.entity, mob);
});
