// Batch 63 (mpprojectiles2): a player's potion kill is theirs, the pickup message carries the arrow's place, primed TNT / rockets / fireballs survive a save,
// and drinkable potions work on the server. The client bow draw and the fly-in live in main.js (no test; checked by reading).
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { RemoteDispense } from "./multiplayer/client-dispense.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { ARROW } from "./bow.js";
import { ITEM_POTION, ITEM_GLASS_BOTTLE } from "./potions.js";
import { WitchPotions } from "./witch-potions.js";

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = "survival", saved = {}) {
  const world = new World("mp-proj-b63");
  for (let x = 14; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation(saved, { world, gameMode, mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id, n, x = 64.5, z = 64.5) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); s.tick(); p.survival.protection = 0; p.dispOut = null; return p; };
const holdPotion = (p, damage) => { p.survival.inventory.add(makeStack(ITEM_POTION, 1, damage)); p.survival.inventory.current = p.survival.inventory.main.findIndex(x => x?.id === ITEM_POTION); };

test("a mob killed by a player's splash potion drops loot credited to the player (recentlyHit)", () => {
  const s = fixture(), p = join(s, "a", 1);
  const z = s.mobs.mobs.create("pig", 64.5, 10, 60.5); z.health = 1; s.mobs.mobs.entities.push(z);
  const ball = { x: 64.5, y: 10.5, z: 60.5, damage: 16428, owner: "player", thrower: p, hit: z };
  const potions = s.dispense.potionsOf(s.dispense);
  potions.impact({ x: 64.5, y: 10.5, z: 60.5, damage: 16428, owner: "player", hit: z }, null, null, { x: p.position.x, z: p.position.z, name: p.name }); // harming II
  assert.ok(z.health <= 0, "dead");
  assert.equal(z.recentlyHit, 100, "counted as a player hit");
});

test("single player: a potion thrown by 'player' is also a player hit", () => {
  const w = new World("b63-sp"); const mobs = { entities: [], events: [], hits: [], attackEntityFrom(e, d, src) { this.hits.push(src); return true; } };
  const e = { type: "pig", x: 5.5, y: 10, z: 5.5, health: 20, growingAge: 0 }; mobs.entities.push(e);
  new WitchPotions(mobs).impact({ x: 5.5, y: 10.5, z: 5.5, damage: 16428, owner: "player", hit: e }, null, null);
  assert.equal(mobs.hits[0]?.player, true);
  void w;
});

test("a drinkable potion on the server: 32 ticks, effects, glass bottle returned; Creative keeps the potion", () => {
  const s = fixture(), p = join(s, "a", 1);
  holdPotion(p, 8226); // swiftness 3:00? (any drinkable bottle with an effect)
  assert.ok(s.handleUse(p, true));
  for (let i = 0; i < 31; i++) s.tick();
  assert.ok(p.itemInUse, "still drinking at tick 31");
  assert.equal(p.survival.effects.has(1), false);
  s.tick(); s.tick();
  assert.equal(p.itemInUse, null);
  assert.equal(p.survival.effects.has(1), true, "speed applied");
  assert.equal(p.survival.count(ITEM_POTION), 0);
  assert.equal(p.survival.count(ITEM_GLASS_BOTTLE), 1, "glass bottle");
  const c = fixture("creative"), q = join(c, "c", 2);
  holdPotion(q, 8226);
  q.survival.inventory.current = q.survival.inventory.main.findIndex(x => x?.id === ITEM_POTION);
  assert.ok(c.handleUse(q, true));
  for (let i = 0; i < 34; i++) c.tick();
  assert.equal(q.survival.effects.has(1), true);
  assert.equal(q.survival.count(ITEM_POTION), 1, "Creative keeps the potion");
  assert.equal(q.survival.count(ITEM_GLASS_BOTTLE), 0);
});

test("a splash potion is thrown, not drunk", () => {
  const s = fixture(), p = join(s, "a", 1);
  holdPotion(p, 16386);
  assert.equal(s.handleUse(p, true), false);
});

test("projCollect carries the arrow's last place and the client hook receives it", () => {
  const s = fixture(), p = join(s, "a", 1, 64.5, 64.5);
  const a = s.dispense.arrows.make({ x: 64.5, y: 10.05, z: 64, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, s.dispense.arrows.rng(), { shooter: null, pickup: 1 });
  s.dispense.arrows.list.push(a); Object.assign(a, { inGround: true, shake: 0, xTile: 64, yTile: 9, zTile: 64, inTile: 3 });
  const log = []; for (let i = 0; i < 2; i++) { s.tick(); log.push(...(p.dispOut ?? [])); p.dispOut = null; p.itemsOut = null; }
  const m = log.find(x => x.type === "projCollect");
  assert.equal(p.survival.count(ARROW), 1);
  assert.ok(Number.isFinite(m.taken[0].x) && Number.isFinite(m.taken[0].y));
  const seen = []; new RemoteDispense({ collect: (i, by, at) => seen.push([i, by, at]) }).apply(JSON.parse(JSON.stringify(m)));
  assert.equal(seen.length, 1); assert.ok(Number.isFinite(seen[0][2].x));
  new RemoteDispense({ collect: (i, by, at) => seen.push(at) }).apply({ type: "projCollect", taken: [{ i: 1, by: 2 }] });
  assert.equal(seen[1], null, "an old message without a place still arrives");
});

test("primed TNT, firework rockets and fireballs are saved and restored", () => {
  const s = fixture(), p = join(s, "a", 1);
  const t = s.dispense.prime(70.5, 11, 70.5, false); t.fuse = 33;
  s.dispense.rockets.launch(72.5, 10, 72.5, null);
  s.mobs.mobs.fireballs.launch({ large: true, owner: null, x: 80, y: 12, z: 80, exact: [0.1, 0, 0] });
  const data = JSON.parse(JSON.stringify(s.dispense.save()));
  const l = data.lanes[0];
  assert.equal(l.tnt.length, 1); assert.equal(l.tnt[0].fuse, 33);
  assert.equal(l.rockets.rockets.length, 1);
  assert.equal(l.fireballs.length, 1);
  const u = fixture("survival", { projectiles: data });
  assert.equal(u.dispense.primed.length, 1);
  assert.equal(u.dispense.primed[0].fuse, 33);
  assert.ok(Math.abs(u.dispense.primed[0].x - 70.5) < 1e-6 && Math.abs(u.dispense.primed[0].y - t.y) < 1e-6);
  assert.equal(u.dispense.rockets.rockets.length, 1);
  assert.equal(u.mobs.mobs._fireballs?.list.length ?? 0, 0, "fireballs wait for the mobs");
  join(u, "b", 1); u.tick();
  assert.equal(u.mobs.mobs._fireballs.list.length, 1);
  void p;
});

test("a saved potion in flight loads while the simulation is built (the mobs do not exist yet) and flies on", () => {
  const s = fixture(), p = join(s, "a", 1);
  holdPotion(p, 16428); s.edit(p, true);
  assert.equal(s.dispense.potions.projectiles.balls.length, 1);
  const data = JSON.parse(JSON.stringify(s.dispense.save()));
  const u = fixture("survival", { projectiles: data });
  assert.equal(u.dispense.potions, null, "waits for the mobs");
  u.tick();
  assert.equal(u.dispense.potions.projectiles.balls.length, 1);
  assert.equal(u.dispense.potions.projectiles.balls[0].ownerName, p.name);
});
