// Batch 82 mpplace82. (a) The client's placement prediction and the multiplayer client's swing test the client world's entity copies
// (World.checkNoEntityCollision; bje.a returns false before the C08 when the held ItemBlock's abh.a canPlace refuses, bytecode-read).
// (b) A hit on a dragon part: no critical or enchantment sparks anywhere (the critical needs `instanceof sv`), but the attacker's client slows
// itself (wy.a(ro, F) -> xa.a(wy, ro, F) is true with no isRemote test) and the hit always lands, even inside the dragon's hurt window. Against
// another player the attacker's client also runs its own crit (bll.a(ro, F) is true). (c) EntityPlayerMP.onUpdateEntity (mw.i) moves the server's
// copy on its own motion before processPlayer applies the packet and charges addMovementStat for it (nh.a(jd) offsets 191 / 315 / 647).
import test from "node:test";
import assert from "node:assert/strict";
import { World, WATER } from "./world.js";
import { makeStack } from "./inventory.js";
import { Survival, ITEMS } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { spawnDragonIfAbsent, setDragonRandom } from "./dragon-mobs.js";
import { JavaRandom } from "./lighting.js";
import { dryPlace } from "./client-prediction.js";
import { rightClickSwings } from "./right-click-swing.js";
import { clientPlacementBlocker } from "./multiplayer/client-placement-entities.js";
import { attackerSlowdown } from "./multiplayer/server-attack-slowdown.js";
import { serverCopyBefore, serverCopyAfter, serverCopyOf } from "./multiplayer/server-copy-step.js";
import { chargeServerCopy } from "./server-copy-stat.js";
import { serverCopyMove } from "./entities.js";
import { queueKnockBack } from "./player-knockback.js";
import { JUMP_MOTION } from "./player-movement.js";
import { Stats, STAT } from "./stats.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

const f = Math.fround;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });

// --- (a) placement against the client's entity copies ---
const P = [40, 12, 40], ABOVE = [40, 13, 40];
function placeWorld() {
  const world = new World("mpplace82");
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 3; dy++) world.set(P[0] + dx, P[1] + dy, P[2] + dz, 0, false, 0);
  world.set(...P, 1, false, 0);
  return world;
}
const top = { block: [...P], adjacent: [...ABOVE], hit: [P[0] + 0.5, P[1] + 1, P[2] + 0.5] };
const stoneHolder = () => new Survival({ slots: [makeStack(1, 4)] });
const state = (world, entities) => ({ world, survival: stoneHolder(), position: { x: 100.5, y: 60, z: 100.5 }, flowers: {}, yaw: 0, entities });
const playerAt = (x, y, z, extra = {}) => ({ state: { x, y, z }, last: { x, y, z }, ...extra });
const copies = ({ players = [], mobs = [], carts = [], boats = [], primed = [] } = {}) => clientPlacementBlocker(() => ({
  players: new Map(players.map((p, i) => [i, p])),
  mobs: { list: () => mobs, factory: { size: (o) => o.size } },
  vehicles: { carts: { carts }, boats: { carts: boats } },
  primed,
}));

test("dryPlace: the state's entity test refuses the placement as the server's placeHeldBlock does; the hook overrides it", () => {
  const world = placeWorld(), blocked = () => true;
  const out = dryPlace(state(world, blocked), { id: 1, item: ITEMS[1], target: top });
  assert.equal(out.placed, false);
  assert.deepEqual(out.cells, [], "nothing drawn");
  assert.equal(out.result.reason, "entity-collision");
  assert.equal(world.get(...ABOVE), 0, "the scratch world is not the real one");
  assert.equal(dryPlace(state(world, null), { id: 1, item: ITEMS[1], target: top }).placed, true, "no entities: placed");
  assert.equal(dryPlace(state(world, blocked), { id: 1, item: ITEMS[1], target: top }, { entities: () => false }).placed, true, "hooks.entities wins");
});

test("client copies: another player, a mob, a cart, a boat and primed TNT in the cell block it; a player whose death ended and a box that only touches do not", () => {
  const box = [ABOVE[0], ABOVE[1], ABOVE[2], ABOVE[0] + 1, ABOVE[1] + 1, ABOVE[2] + 1];
  const cx = ABOVE[0] + 0.5, cz = ABOVE[2] + 0.5;
  assert.equal(copies()(box), false);
  assert.equal(copies({ players: [playerAt(cx, ABOVE[1] - 1, cz)] })(box), true, "a player standing below reaches into the cell (1.8 high)");
  assert.equal(copies({ players: [playerAt(cx, ABOVE[1] - 1.8, cz)] })(box), false, "head touching the floor only");
  assert.equal(copies({ players: [playerAt(cx, ABOVE[1], cz, { hidden: true })] })(box), false, "setDead at deathTime 20 (remote-death.js)");
  assert.equal(copies({ players: [playerAt(cx, ABOVE[1], cz, { deathTime: 5 })] })(box), true, "a dying player still blocks");
  assert.equal(copies({ mobs: [{ type: "pig", x: cx, y: ABOVE[1], z: cz, health: 10, size: [0.9, 0.9] }] })(box), true);
  assert.equal(copies({ mobs: [{ type: "pig", x: cx, y: ABOVE[1], z: cz, health: 0, death: 20, size: [0.9, 0.9] }] })(box), false);
  assert.equal(copies({ carts: [{ bb: [cx - 0.49, ABOVE[1], cz - 0.49, cx + 0.49, ABOVE[1] + 0.7, cz + 0.49] }] })(box), true);
  assert.equal(copies({ boats: [{ bb: [cx - 0.75, ABOVE[1], cz - 0.75, cx + 0.75, ABOVE[1] + 0.6, cz + 0.75] }] })(box), true);
  assert.equal(copies({ primed: [{ x: cx, y: ABOVE[1] + 0.2, z: cz, fuse: 40 }] })(box), true, "the TNT row's y is its box bottom");
  assert.equal(copies({ primed: [{ x: cx, y: ABOVE[1] + 1, z: cz, fuse: 40 }] })(box), false);
});

test("multiplayer swing: an ItemBlock refused by a copy in the cell does not swing (bje.a false before the C08)", () => {
  const world = placeWorld(), survival = stoneHolder();
  const args = { world, target: top, held: survival.held, survival, position: { x: 100.5, y: 60, z: 100.5 }, yaw: 0, flowers: {} };
  assert.equal(rightClickSwings(args), true, "a free cell: placed on the client, swings");
  const entities = copies({ players: [playerAt(ABOVE[0] + 0.5, ABOVE[1], ABOVE[2] + 0.5)] });
  assert.equal(rightClickSwings({ ...args, entities }), false, "another player in the cell");
});

// --- (b) the dragon part ---
function dragonWorld() {
  const cells = new Map();
  const world = { numericSeed: 1, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 64, z: 0 }), get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0,
    set(x, y, z, id) { cells.set(`${x},${y},${z}`, id); return true; }, inside: () => true, streaming: true, isTicking: () => true, height: 256 };
  const w = new EntityWorld(world, [], () => 0.5), d = spawnDragonIfAbsent(world, w), player = { x: 200, y: 70, z: 200, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
  setDragonRandom(d, new JavaRandom(7));
  w.tick(player, new Survival({}));
  return { w, d };
}
const SHARPNESS = 16, DIAMOND_SWORD = 115;

test("dragon part: a jump attack with Sharpness gives no critical and no enchantment sparks, lands inside the hurt window, and the part flag goes to the caller", () => {
  const { w, d } = dragonWorld();
  const sword = new Survival({ slots: [makeStack(DIAMOND_SWORD, 1, 0, undefined, { enchantments: [{ id: SHARPNESS, lvl: 3 }] })] });
  const info = {};
  assert.equal(w.attack(d, DIAMOND_SWORD, sword, { x: d.x, z: d.z + 3, yaw: 0 }, 1, true, info), true);
  assert.equal(info.critical, false, "flag needs `instanceof sv`: no S0B 4 and no client EntityCrit2FX");
  assert.equal(info.enchantCritical, false, "f1 is read only for an EntityLivingBase target: no S0B 5");
  assert.equal(info.part, true);
  assert.equal(info.knockback, 1, "the sprint knockback still counts for the attacker's slowdown");
  const worn = sword.held.damage;
  w.tick({ x: 200, y: 70, z: 200, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 }, new Survival({}));
  assert.ok(d.hurt > 0, "the dragon is in its hurt window");
  d.lastDamage = 100; // a stronger hit before it (a crystal blast): the old precheck refused the sword here
  const again = {};
  assert.equal(w.attack(d, DIAMOND_SWORD, sword, { x: d.x, z: d.z + 3, yaw: 0 }, 0, false, again), true, "xa.a(wy, ro, F) answers true inside the hurt window");
  assert.equal(sword.held.damage, worn + 1, "so the sword wears again (the wy branch before ItemStack.hitEntity)");
});

test("attackerSlowdown: a part hit with knockback slows the real motion (the client's own call is true); a mob hit only clears the sprint", () => {
  const p = () => ({ velocity: { x: 0.2, y: 0, z: 0.2 }, motion: { sprinting: true } });
  const part = p();
  assert.equal(attackerSlowdown(part, { knockback: 1, part: true }), true);
  assert.ok(Math.abs(part.velocity.x - 0.2 * 0.6) < 1e-12 && Math.abs(part.velocity.z - 0.2 * 0.6) < 1e-12);
  assert.equal(part.motion.sprinting, false);
  const mob = p();
  attackerSlowdown(mob, { knockback: 1, part: false });
  assert.equal(mob.velocity.x, 0.2);
  assert.equal(mob.motion.sprinting, false);
  const none = p();
  assert.equal(attackerSlowdown(none, { knockback: 0, part: true }), false);
  assert.equal(none.velocity.x, 0.2);
});

function pvpPair() {
  const world = new World("mpplace82-pvp");
  for (let x = 50; x <= 80; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival" }), ps = [];
  for (let i = 0; i < 2; i++) {
    const p = s.addPlayer("p" + i, i ? "Victim" : "Attacker", key(i + 1));
    p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 });
    s.input("p" + i, input()); ps.push(p);
  }
  for (let i = 0; i < 3; i++) s.tick();
  for (const p of ps) { p.survival.protection = 0; p.dispOut = []; }
  return { s, ps };
}

test("pvp: the attacker's own client draws its crit too (bll.a true), so the attacker gets two bursts and the victim one; a refused hit still shows the attacker's", () => {
  const { s, ps: [a, v] } = pvpPair();
  a.survival.inventory.main[0] = makeStack(DIAMOND_SWORD, 1); a.survival.inventory.current = 0;
  a.fallDistance = 2; a.grounded = false; a.inWater = false; a.mount = null;
  assert.equal(s.pvpRules.attack(a, "p1"), true);
  const crits = (q) => (q.dispOut ?? []).filter((m) => m.type === "pfx73").flatMap((m) => m.events);
  assert.deepEqual(crits(a).map((e) => e.m), [0, 0], "its own EntityCrit2FX, then the server's S0B 4");
  assert.equal(crits(v).length, 1, "the victim sees the server's");
  assert.equal(crits(a)[0].pl, "p1");
  a.dispOut = []; v.dispOut = [];
  assert.equal(s.pvpRules.attack(a, "p1"), false, "inside the victim's hurt window, same damage");
  assert.equal(crits(a).length, 1, "the client's own call does not wait on the server");
  assert.equal(crits(v).length, 0);
});

// --- (c) the server copy's own move ---
function pool() {
  const world = new World("mpplace82-copy");
  for (let x = 60; x <= 68; x++) for (let z = 60; z <= 68; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  for (let x = 60; x <= 68; x++) for (let z = 60; z <= 68; z++) for (let y = 10; y <= 16; y++) world.put(x, y, z, WATER, 0, false);
  return world;
}
const fakePlayer = (y, extra = {}) => {
  const charged = [];
  return { charged, position: { x: 64.5, y, z: 64.5 }, grounded: false, stats: new Stats(), motion: { sprinting: false }, yaw: 0,
    survival: { health: 20, creative: false, exhaust(n) { charged.push(n); } }, ...extra };
};

test("server copy under water: it sinks on its own motion and charges the dive stat and 0.015F a cm a second time (mw.i before processPlayer's own charge)", () => {
  const world = pool(), p = fakePlayer(12);
  let cm = 0;
  for (let i = 0; i < 40; i++) { serverCopyBefore(p, IDLE_INPUT, world); serverCopyAfter(p, { ...p.position }); }
  cm = p.stats.get(STAT.dive);
  assert.ok(cm > 0, "the copy dives");
  // The copy settles at water's terminal sink (vy * 0.8 - 0.02 -> 0.1 a tick), while its position comes back to the accepted one each tick.
  const last = p.charged.at(-1);
  assert.ok(Math.abs(last - f(f(f(0.015) * 10) * f(0.01))) < 1e-9, `10 cm a tick at the end: ${last}`);
  assert.equal(p.stats.get(STAT.walk), 0);
});

test("server copy at rest on the ground charges nothing; a knockback flies it (fly over 25 cm, no exhaustion) and its residue walks once it lands", () => {
  const world = pool();
  for (let x = 60; x <= 68; x++) for (let z = 60; z <= 68; z++) for (let y = 10; y <= 16; y++) world.put(x, y, z, 0, 0, false);
  const p = fakePlayer(10, { grounded: true });
  for (let i = 0; i < 5; i++) { serverCopyBefore(p, IDLE_INPUT, world); serverCopyAfter(p, { ...p.position }); }
  assert.equal(p.charged.length, 0);
  assert.equal(p.stats.get(STAT.walk) + p.stats.get(STAT.fly), 0, "the copy's motionY only meets the floor");
  const c = serverCopyOf(p);
  assert.equal(p.survival.serverPlayer, c, "queueKnockBack reaches the copy");
  queueKnockBack(p.survival, { x: p.position.x - 1, z: p.position.z });
  assert.ok(Math.abs(c.motion.x - f(0.4)) < 1e-6 && c.motion.y > 0.3, "EntityLivingBase.knockBack on the copy's motion");
  p.grounded = false;
  const m = serverCopyBefore(p, IDLE_INPUT, world);
  assert.equal(m.stat, "fly");
  assert.equal(m.amount, 40);
  assert.equal(m.exhaustion, 0);
  // On the ground with motion left: the walk charge at the copy's sprint flag.
  const e = { x: p.position.x + 0.1, y: 10, z: p.position.z, onGround: true, inWater: false };
  const walk = chargeServerCopy(world, p.position, e, { sprinting: true });
  assert.equal(walk.stat, "walk");
  assert.equal(walk.amount, 10);
  assert.ok(Math.abs(walk.exhaustion - f(f(f(0.099999994) * 10) * f(0.01))) < 1e-9);
});

test("processPlayer's jump rule: copy on the ground, packet airborne and rising -> EntityLivingBase.jump on the copy (no second jump stat or exhaustion)", () => {
  const world = pool();
  for (let x = 60; x <= 68; x++) for (let z = 60; z <= 68; z++) for (let y = 10; y <= 16; y++) world.put(x, y, z, 0, 0, false);
  const p = fakePlayer(10, { grounded: true });
  for (let i = 0; i < 2; i++) serverCopyBefore(p, IDLE_INPUT, world); // a fresh copy meets the floor on its second step (motionY -0.0784)
  const c = p.serverCopy;
  assert.equal(c.onGround, true);
  const from = { ...p.position };
  p.position.y += 0.42; p.grounded = false; p.motion.sprinting = true;
  serverCopyAfter(p, from);
  assert.equal(c.motion.y, JUMP_MOTION);
  assert.ok(Math.abs(Math.hypot(c.motion.x, c.motion.z) - f(0.2)) < 1e-6, "the sprint push");
  assert.equal(c.onGround, false, "mw.D = jd.i()");
  assert.equal(p.charged.length, 0);
  assert.equal(p.stats.get(STAT.jump), 0);
  // The copy's next step rises 0.42: airborne, under 25 cm sideways, so no stat.
  const m = serverCopyBefore(p, IDLE_INPUT, world);
  assert.equal(m.stat, null);
});

test("serverCopyMove: the shared step is the integrated server's PlayerView step (snap, no input, flier's motionY * 0.6)", () => {
  const world = pool();
  const e = serverCopyMove(world, { x: 64.5, y: 20, z: 64.5, motion: { x: 0.004, y: 0.5, z: 0 }, onGround: false, flying: true }, f(0.6), f(1.8));
  assert.equal(e.vx, 0, "below 0.005");
  assert.ok(Math.abs(e.vy - 0.3) < 1e-12, "flying keeps 0.6 of the motionY it had");
  assert.ok(Math.abs(e.y - 20.5) < 1e-9);
});

test("dedicated server: the copy ticks with the player, takes a mob's knockback at the hit and charges its own fly stat on top of the client's", () => {
  const world = new World("mpplace82-sim");
  for (let x = 50; x <= 80; x++) for (let z = 50; z <= 80; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival" });
  const p = s.addPlayer("a", "ax", key(1));
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input("a", input());
  for (let i = 0; i < 5; i++) s.tick();
  assert.ok(p.serverCopy && p.survival.serverPlayer === p.serverCopy);
  const fly = p.stats.get(STAT.fly);
  queueKnockBack(p.survival, { x: p.position.x - 1, z: p.position.z });
  s.tick();
  const gained = p.stats.get(STAT.fly) - fly;
  assert.ok(gained >= 75, `the client's 40 cm and the copy's 40 cm: ${gained}`);
});
