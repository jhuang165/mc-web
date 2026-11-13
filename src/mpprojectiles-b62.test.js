// Batch 62 (mpprojectiles): the dedicated server's one projectile system: arrows and balls hit players, skeletons shoot, witches throw, players' bows and thrown items, arrow pickup,
// the snipeSkeleton credit, saving and the per-dimension filter. No sockets.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { RemoteDispense } from "./multiplayer/client-dispense.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { BOW, ARROW } from "./bow.js";

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = "survival") {
  const world = new World("mp-proj-b62");
  for (let x = 14; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode, mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id, n, x = 64.5, z = 64.5) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); s.tick(); p.survival.protection = 0; p.dispOut = null; return p; };
const run = (s, n, ps = []) => { const log = ps.map(() => []); for (let i = 0; i < n; i++) { s.tick(); ps.forEach((p, k) => { log[k].push(...(p.dispOut ?? [])); p.dispOut = null; p.itemsOut = null; }); } return log; };
// An arrow in flight along +z (yaw 0 looks along -z in this build: motion is given directly).
const shoot = (s, from, to, extra = {}) => {
  const a = s.dispense.arrows.make({ x: from.x, y: from.y, z: from.z, mx: to.mx ?? 0, my: 0, mz: to.mz ?? 1.5, yaw: 0, pitch: 0 }, s.dispense.arrows.rng(), { shooter: null, pickup: 1, ...extra });
  s.dispense.arrows.list.push(a); return a;
};
const give = (p, id, n = 1) => { p.survival.inventory.add(makeStack(id, n)); };

test("an arrow from a dispenser hurts a survival player, leaves a stuck arrow on them, and passes through a Creative one", () => {
  const s = fixture(), p = join(s, "a", 1, 64.5, 70.5), c = join(s, "c", 2, 66.5, 70.5);
  c.survival.mode = "creative";
  const h = p.survival.health;
  shoot(s, { x: 64.5, y: 11.3, z: 62 }, {}); shoot(s, { x: 66.5, y: 11.3, z: 62 }, {});
  run(s, 12);
  assert.ok(p.survival.health < h, `the survival player took the arrow (${h} -> ${p.survival.health})`);
  assert.equal(p.survival.arrowCount, 1, "stuck arrow counted");
  assert.equal(c.survival.health, 20, "Creative takes nothing");
  assert.equal(s.dispense.arrows.list.filter(a => a.z > 71 && a.x > 66).length, 1, "the arrow went on past the Creative player");
});

test("an arrow of a player credits the shooter: a skeleton killed from 60 blocks awards snipeSkeleton, one killed from 10 does not", () => {
  const s = fixture(), p = join(s, "a", 1, 16.5, 64.5);
  const sk = s.mobs.mobs.create("skeleton", 76.5, 10, 64.5); s.mobs.mobs.entities.push(sk);
  const a = shoot(s, { x: 70.5, y: 10.6, z: 64.5 }, { mx: 1.5, mz: 0 }, { shooter: "player", damage: 100, owner: p, ownerName: p.name });
  const awards = () => (s.events ?? []).filter(e => e.type === "award" && e.achievement === "snipeSkeleton");
  run(s, 6);
  assert.equal(sk.health <= 0, true, `skeleton dead (${sk.health})`);
  assert.equal(awards().length, 1);
  // near: 10 blocks
  const t = fixture(), q = join(t, "b", 1, 66.5, 64.5);
  const k2 = t.mobs.mobs.create("skeleton", 76.5, 10, 64.5); t.mobs.mobs.entities.push(k2);
  t.dispense.arrows.list.push(t.dispense.arrows.make({ x: 72.5, y: 10.6, z: 64.5, mx: 1.5, my: 0, mz: 0, yaw: 0, pitch: 0 }, t.dispense.arrows.rng(), { shooter: "player", pickup: 1, damage: 100, owner: q, ownerName: q.name }));
  run(t, 6);
  assert.equal(k2.health <= 0, true);
  assert.equal((t.events ?? []).filter(e => e.achievement === "snipeSkeleton").length, 0);
});

test("a skeleton on the server shoots a player in sight with a real arrow", () => {
  const s = fixture();
  for (let x = 14; x <= 110; x++) for (let z = 20; z <= 110; z++) s.world.put(x, 16, z, 1, 0, false); // b62 lead: a roof, so the skeleton does not burn in daylight, flee and lose its target (made the test flaky)
  const p = join(s, "a", 1, 64.5, 70.5);
  const sk = s.mobs.mobs.create("skeleton", 64.5, 10, 62.5); s.mobs.mobs.entities.push(sk);
  const h = p.survival.health; let shot = 0;
  for (let i = 0; i < 200; i++) { s.tick(); p.dispOut = null; p.itemsOut = null; shot = Math.max(shot, s.dispense.arrows.list.length); if (p.survival.health < h) break; }
  assert.ok(shot > 0, "an arrow flew");
  assert.ok(p.survival.health < h, "and one hit");
});

test("a witch on the server throws a potion that flies in the projectile system", () => {
  const s = fixture(), p = join(s, "a", 1, 64.5, 70.5);
  const w = s.mobs.mobs.create("witch", 64.5, 10, 64.5); s.mobs.mobs.entities.push(w);
  let thrown = 0;
  for (let i = 0; i < 200 && !thrown; i++) { s.tick(); p.dispOut = null; p.itemsOut = null; thrown = s.dispense.potions?.projectiles.balls.length ?? 0; }
  assert.ok(thrown > 0, "a potion is in flight");
});

test("a player's bow: draw, release with C07, one arrow used, the arrow flies owned by the player", () => {
  const s = fixture(), p = join(s, "a", 1, 64.5, 64.5);
  give(p, BOW); give(p, ARROW, 5);
  p.survival.inventory.current = p.survival.inventory.main.findIndex(x => x?.id === BOW);
  assert.ok(s.handleUse(p, true), "draw starts");
  for (let i = 0; i < 20; i++) s.tick();
  assert.ok(p.itemInUse?.bow);
  s.handleUse(p, false);
  assert.equal(p.itemInUse, null);
  assert.equal(s.dispense.arrows.list.length, 1);
  const a = s.dispense.arrows.list[0];
  assert.equal(a.owner, p); assert.equal(a.pickup, 1);
  assert.equal(p.survival.count(ARROW), 4, "an arrow was used");
});

test("thrown items: a snowball is thrown from a right click, uses one, and a pearl teleports the thrower with 5 fall damage", () => {
  const s = fixture(), p = join(s, "a", 1, 64.5, 64.5);
  give(p, 312, 3); p.survival.inventory.current = p.survival.inventory.main.findIndex(x => x?.id === 312);
  p.pitch = -0.2; // looking slightly up
  assert.equal(s.edit(p, true), true);
  assert.equal(s.dispense.balls.balls.length, 1);
  assert.equal(s.dispense.balls.balls[0].thrower, p);
  assert.equal(p.survival.count(312), 2);
  s.dispense.balls.balls.length = 0;
  give(p, 378, 1); p.survival.inventory.current = p.survival.inventory.main.findIndex(x => x?.id === 378);
  p.pitch = 0.3; p.yaw = 0;
  s.edit(p, true);
  const pearl = s.dispense.balls.balls[0];
  assert.equal(pearl.kind, "enderPearl");
  const h = p.survival.health;
  run(s, 40);
  assert.ok(p.position.z < 60 || p.position.z > 70 || p.position.y !== 10, `teleported (${p.position.x}, ${p.position.y}, ${p.position.z})`);
  assert.equal(p.survival.health, h - 5);
});

test("splash potion and Bottle o' Enchanting thrown by a player", () => {
  const s = fixture(), p = join(s, "a", 1);
  p.survival.inventory.add(makeStack(385, 1, 16396)); p.survival.inventory.current = p.survival.inventory.main.findIndex(x => x?.id === 385);
  s.edit(p, true);
  assert.equal(s.dispense.potions.projectiles.balls.length, 1);
  assert.equal(s.dispense.potions.projectiles.balls[0].thrower, p);
  assert.equal(p.survival.count(385), 0);
  const q = fixture(), r = join(q, "b", 1);
  r.survival.inventory.add(makeStack(1951, 1)); r.survival.inventory.current = r.survival.inventory.main.findIndex(x => x?.id === 1951);
  q.edit(r, true);
  assert.equal(q.dispense.potions.projectiles.balls[0].kind, "expBottle");
});

test("a stuck arrow is picked up by a player touching it: arrow added, pop sound and projCollect sent", () => {
  const s = fixture(), p = join(s, "a", 1, 64.5, 64.5);
  const a = shoot(s, { x: 64.5, y: 10.05, z: 64.0 }, { mz: 0 }, {});
  Object.assign(a, { inGround: true, shake: 0, xTile: 64, yTile: 9, zTile: 64, inTile: 3 });
  const [log] = run(s, 2, [p]);
  assert.equal(p.survival.count(ARROW), 1);
  assert.equal(s.dispense.arrows.list.length, 0);
  assert.ok(log.some(m => m.type === "projCollect" && m.taken[0].by === p.id));
  assert.ok(log.some(m => m.type === "dispFx" && m.events.some(e => e.name === "random.pop")));
  const seen = []; new RemoteDispense({ collect: (i, by) => seen.push([i, by]) }).apply({ type: "projCollect", taken: [{ i: 3, by: 7 }] });
  assert.deepEqual(seen, [[3, 7]]);
});

test("projectiles in flight are saved and loaded with their shooter's name", () => {
  const s = fixture(), p = join(s, "a", 1);
  shoot(s, { x: 70.5, y: 12, z: 70.5 }, { mz: 1 }, { shooter: "player", owner: p, ownerName: p.name });
  s.dispense.balls.balls.push({ ...s.dispense.balls.spawnThrowable({ x: 70, y: 10, z: 70 }, 0, 0, "snowball") });
  const data = JSON.parse(JSON.stringify(s.dispense.save()));
  assert.equal(data.lanes[0].arrows[0].by, p.name);
  const t = fixture(); t.dispense.load(data);
  assert.equal(t.dispense.arrows.list.length, 1);
  assert.equal(t.dispense.arrows.list[0].ownerName, p.name);
  assert.ok(t.dispense.balls.balls.length >= 1);
});

test("a Nether player is sent nothing of the Overworld's projectiles, and the reverse", () => {
  const s = fixture(), p = join(s, "a", 1, 64.5, 64.5), q = join(s, "b", 2, 66.5, 64.5);
  q.dimension = 1;
  shoot(s, { x: 65.5, y: 12, z: 66 }, { mz: 0.1 });
  const [lp, lq] = run(s, 3, [p, q]);
  assert.ok(lp.some(m => m.type === "dispEnts" && m.ents.length), "the Overworld player sees it");
  assert.ok(!lq.some(m => m.type === "dispEnts" && m.ents.length), "the Nether player does not");
});
