// Batch 83 attack83. (1) EntityPlayer.attackTargetEntityWithCurrentItem (yz.r(sa), bytecode-read) slows the attacker (motionX / Z * 0.6) inside
// `if (target.attackEntityFrom(...))`: the server's EntityPlayerMP on every landed knockback hit, the attacker's own client only where its copy
// answers true (another player, a dragon part, a crystal, a cart, a boat; a mob copy returns false when remote). The End crystal is no
// EntityLivingBase: no critical, no weapon enchantments, no wear. (2) processPlayer's jump rule on the integrated server's PlayerView.
// (3) A lying player is a 0.2 x 0.2 box for placement and aim. (4) A placement the client's ItemBlock check refuses sends only the C08 255.
// (5) processPlayer's riding and sleeping branches on the dedicated server's copy.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { attackerSlowdown } from "./multiplayer/server-attack-slowdown.js";
import { vehicleSprintPush } from "./multiplayer/server-vehicle-hit.js";
import { serverCopyBefore, serverCopyAfter, serverCopyOf } from "./multiplayer/server-copy-step.js";
import { clientPlacementBlocker, remotePlayerBox } from "./multiplayer/client-placement-entities.js";
import { pickPlayer } from "./multiplayer/server-pvp.js";
import { clientWithholdsPlace } from "./right-click-swing.js";
import { ITEM_CAKE } from "./stems-cake.js";
import { JUMP_MOTION } from "./player-movement.js";
import { Stats, STAT } from "./stats.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

const f = Math.fround;
const DIAMOND_SWORD = 115;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ""} ${a} vs ${b}`);

function flat(name, lo = 30, hi = 50) {
  const world = new World(name);
  for (let x = lo; x <= hi; x++) for (let z = lo; z <= hi; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  return world;
}
const viewer = { x: 40.5, y: 10, z: 43.5, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };

// --- (1) the attack slowdown ---
test("crystal hit: no critical, no wear, no stat, but the 0.3 exhaustion; the client copy lands (clientLands), a mob copy does not", () => {
  const w = new EntityWorld(flat("attack83-crystal"), [], () => 0.5);
  const crystal = w.create("ender_crystal", 40.5, 10, 40.5), pig = w.create("pig", 44.5, 10, 40.5);
  w.entities.push(crystal, pig);
  const s = new Survival({ slots: [makeStack(DIAMOND_SWORD, 1)] });
  w.tick(viewer, s);
  const info = {}, worn = s.held.damage;
  assert.equal(w.attack(crystal, DIAMOND_SWORD, s, { x: 40.5, z: 43.5, yaw: 0 }, 1, true, info), true, "wz.a answers true");
  assert.equal(info.critical, false, "the critical needs `instanceof sv`");
  assert.equal(info.clientLands, true);
  assert.equal(info.knockback, 1, "the sprint push still counts (the enchantment level is read only for sv)");
  assert.equal(s.held.damage, worn, "ItemStack.hitEntity only for sv (or the dragon behind a part)");
  assert.equal(w.lastAttackDamage, 0, "no damageDealt stat");
  close(s.exhaustion, f(0.3), "addExhaustion(0.3) for every landed target");
  const mob = {};
  assert.equal(w.attack(pig, DIAMOND_SWORD, s, { x: 44.5, z: 43.5, yaw: 0 }, 1, true, mob), true);
  assert.equal(mob.critical, true);
  assert.equal(mob.clientLands, false, "sv.a returns false on the client (isRemote)");
  assert.equal(s.held.damage, worn + 1);
});

test("attackerSlowdown: the server copy slows on every landed knockback hit; the client velocity only where its copy lands", () => {
  const p = () => ({ velocity: { x: 0.2, y: 0, z: 0.2 }, motion: { sprinting: true }, survival: { serverPlayer: { motion: { x: 0.5, y: 0.1, z: 0.5 } } } });
  const mob = p();
  assert.equal(attackerSlowdown(mob, { knockback: 1, clientLands: false }), true);
  assert.equal(mob.velocity.x, 0.2, "the client keeps its speed on a mob");
  close(mob.survival.serverPlayer.motion.x, 0.3, "the EntityPlayerMP copy slows");
  assert.equal(mob.survival.serverPlayer.motion.y, 0.1);
  assert.equal(mob.motion.sprinting, false);
  const crystal = p();
  attackerSlowdown(crystal, { knockback: 1, clientLands: true });
  close(crystal.velocity.x, 0.12);
  close(crystal.survival.serverPlayer.motion.z, 0.3);
  const none = p();
  assert.equal(attackerSlowdown(none, { knockback: 0, clientLands: true }), false);
  assert.equal(none.survival.serverPlayer.motion.x, 0.5);
  // A cart or boat (EntityMinecart / EntityBoat.attackEntityFrom true on both sides): both copies slow.
  const cart = { ...p(), yaw: 0 }, v = { vx: 0, vy: 0, vz: 0 };
  assert.equal(vehicleSprintPush(cart, v), true);
  close(cart.velocity.x, 0.12);
  close(cart.survival.serverPlayer.motion.x, 0.3);
});

function pvpPair() {
  const world = flat("attack83-pvp", 50, 80);
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

test("pvp: the attacker's client slows on every hit past the damage gate (bll.a true), landed or not; its server copy only when the hit landed", () => {
  const { s, ps: [a] } = pvpPair();
  a.survival.inventory.main[0] = makeStack(DIAMOND_SWORD, 1); a.survival.inventory.current = 0;
  const c = serverCopyOf(a);
  a.motion.sprinting = true; a.velocity.x = 0.2; a.velocity.z = 0.2; c.motion.x = 0.5;
  assert.equal(s.pvpRules.attack(a, "p1"), true);
  close(a.velocity.x, 0.12); close(c.motion.x, 0.3);
  assert.equal(a.motion.sprinting, false);
  a.motion.sprinting = true; a.velocity.x = 0.2; c.motion.x = 0.5;
  assert.equal(s.pvpRules.attack(a, "p1"), false, "inside the victim's hurt window");
  close(a.velocity.x, 0.12, "the client's own attackEntityFrom on bll was true");
  assert.equal(a.motion.sprinting, false);
  assert.equal(c.motion.x, 0.5, "the server's victim refused: its EntityPlayerMP keeps its motion");
});

// --- (2) the integrated server's jump rule ---
test("PlayerView: processPlayer's jump rule after mw.i() (copy grounded, packet airborne and rising), then mw.D = the packet's onGround", () => {
  const w = new EntityWorld(flat("attack83-jump"), [], () => 0.5), s = new Survival({});
  for (let i = 0; i < 3; i++) w.tick(viewer, s);
  const p = w.ai.player;
  assert.equal(p.onGround, true, "the copy rests on the floor");
  assert.equal(p.packetDy, 0, "no position packet while standing still");
  const up = { ...viewer, y: viewer.y + 0.42 };
  p.update(up, s, 0);
  close(p.packetDy, 0.42, "d15: the packet's y minus the last accepted posY");
  Object.assign(p, { packetGround: false, sprinting: true, yaw: 0 });
  w.serverPlayerUpdate(p);
  assert.equal(p.motion.y, JUMP_MOTION);
  close(Math.hypot(p.motion.x, p.motion.z), f(0.2), "the sprint push");
  assert.equal(p.onGround, false, "mw.D = jd.i()");
  // A test or replay that gives no packet flag keeps the old copy (no jump), and a sleeper's branch has none.
  const legacy = new EntityWorld(flat("attack83-jump2"), [], () => 0.5);
  for (let i = 0; i < 3; i++) legacy.tick(viewer, s);
  const q = legacy.ai.player;
  q.update(up, s, 0);
  legacy.serverPlayerUpdate(q);
  assert.ok(q.motion.y < 0, "no packetGround: no jump");
  Object.assign(q, { packetGround: false, sleeping: true, onGround: true, packetDy: 0.42 });
  legacy.serverPlayerUpdate(q);
  assert.ok(q.motion.y < JUMP_MOTION / 2, "the sleeping branch returns before the jump rule");
});

test("single player hands the C03 / C0B flags to the integrated server's copy (main.js living state, living-simulation.js)", () => {
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8"), living = readFileSync(new URL("./living-simulation.js", import.meta.url), "utf8");
  assert.match(main, /sneaking: !!motion\.sneaking, flying, rider, packetGround: grounded, sprinting: !!motion\.sprinting, yaw/);
  assert.match(living, /mobs\.ai\.player\.packetGround = !!state\.packetGround/);
});

// --- (3) a lying player's box ---
const P = [40, 12, 40], ABOVE = [40, 13, 40];
const cell = [ABOVE[0], ABOVE[1], ABOVE[2], ABOVE[0] + 1, ABOVE[1] + 1, ABOVE[2] + 1];
const copies = (players) => clientPlacementBlocker(() => ({ players: new Map(players.map((p, i) => [i, p])), mobs: null, vehicles: null, primed: [] }));
const at = (x, y, z, extra = {}) => ({ state: { x, y, z, ...extra }, last: { x, y, z, ...extra } });
const SLEEP = [40, 12, 40, 0];

test("client copies: a lying player is 0.2 x 0.2 from its wire y (sleepInBedAt setSize(0.2F, 0.2F)), not 0.6 x 1.8", () => {
  const cx = ABOVE[0] + 0.5, cz = ABOVE[2] + 0.5;
  assert.equal(copies([at(cx, ABOVE[1] - 1, cz)])(cell), true, "standing below, 1.8 high, reaches into the cell");
  assert.equal(copies([at(cx, ABOVE[1] - 1, cz, { sleep: SLEEP })])(cell), false, "lying there, the 0.2 box stays under it");
  assert.equal(copies([at(cx, ABOVE[1] + 0.1, cz, { sleep: SLEEP })])(cell), true, "a lying box inside the cell still blocks");
  assert.equal(copies([at(ABOVE[0] + 1.2, ABOVE[1], cz, { sleep: SLEEP })])(cell), false, "0.1 half width: 0.2 past the edge is clear");
  assert.equal(copies([at(ABOVE[0] + 1.2, ABOVE[1], cz)])(cell), true, "a standing one 0.2 past the edge reaches in (0.3 half width)");
  const box = remotePlayerBox({ x: 1, y: 2, z: 3, sleep: SLEEP });
  close(box[3] - box[0], f(0.2)); close(box[4] - box[1], f(0.2));
  assert.equal(remotePlayerBox({ x: 1, y: 2, z: 3, sleep: [1, 2] })[4] - 2, f(1.8), "a malformed sleep field is standing (remoteSleepPose's test)");
});

test("pickPlayer: the aim at a lying player meets only its 0.2 box", () => {
  const sleeper = new Map([["p1", at(5, 10, 0, { sleep: SLEEP })]]);
  assert.equal(pickPlayer(sleeper, { x: 0, y: 11, z: 0 }, { x: 1, y: 0, z: 0 }, 6), null, "a metre over its box");
  assert.equal(pickPlayer(sleeper, { x: 0, y: 10.1, z: 0 }, { x: 1, y: 0, z: 0 }, 6)?.id, "p1");
  const standing = new Map([["p1", at(5, 10, 0)]]);
  assert.equal(pickPlayer(standing, { x: 0, y: 11, z: 0 }, { x: 1, y: 0, z: 0 }, 6)?.id, "p1");
});

// The placer at (64.5, 10, 64.5) looks east at a stone at (67, 11, 64): the placed cell is (66, 11, 64).
function placeSim() {
  const world = flat("attack83-place", 50, 80);
  world.put(67, 11, 64, 1, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival" }), ps = [];
  for (let i = 0; i < 2; i++) {
    const p = s.addPlayer("p" + i, "P" + i, key(i + 11));
    p.position.copy(i ? { x: 70.5, y: 10, z: 70.5 } : { x: 64.5, y: 10, z: 64.5 });
    s.input("p" + i, input()); ps.push(p);
  }
  for (let i = 0; i < 3; i++) s.tick();
  const [a, o] = ps;
  a.survival.inventory.main[0] = makeStack(1, 8); a.survival.inventory.current = 0;
  a.yaw = -Math.PI / 2; a.pitch = 0; a.moved = true;
  return { s, world, a, o };
}

test("server placement: a sleeper's 0.2 box decides, the standing box no longer applies to it", () => {
  for (const [pos, sleeping, blocked] of [[{ x: 66.5, y: 10, z: 64.5 }, false, true], [{ x: 66.5, y: 10, z: 64.5 }, true, false], [{ x: 66.5, y: 11.2, z: 64.5 }, true, true]]) {
    const { s, world, a, o } = placeSim();
    o.position.copy(pos); o.sleeping = sleeping;
    s.edit(a, true);
    assert.equal(world.get(66, 11, 64), blocked ? 0 : 1, `${sleeping ? "lying" : "standing"} at y ${pos.y}`);
  }
});

// --- (4) the C08 255 ---
test("air edit: the C08 with direction 255 alone places nothing and resends no cell; queueEdit carries the flag", () => {
  const { s, world, a } = placeSim();
  a.resendCells = null;
  s.edit(a, true, true);
  assert.equal(world.get(66, 11, 64), 0);
  assert.equal(a.resendCells, null, "no block C08, so no S23");
  assert.equal(s.queueEdit("p0", { place: true, air: true }), true);
  assert.equal(s.actions.at(-1).air, true);
  s.tick();
  assert.equal(world.get(66, 11, 64), 0);
  s.queueEdit("p0", { place: true });
  assert.equal(s.actions.at(-1).air, undefined);
  s.tick();
  assert.equal(world.get(66, 11, 64), 1, "the block C08 places");
});

function clientWorld() {
  const world = new World("attack83-client");
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 3; dy++) world.set(P[0] + dx, P[1] + dy, P[2] + dz, 0, false, 0);
  world.set(...P, 1, false, 0);
  return world;
}
const top = { block: [...P], adjacent: [...ABOVE], hit: [P[0] + 0.5, P[1] + 1, P[2] + 0.5] };

test("clientWithholdsPlace: an ItemBlock refused by a client copy sends no block C08; a free cell, an ItemReed placer and an activated block do", () => {
  const world = clientWorld(), survival = new Survival({ slots: [makeStack(1, 4)] });
  const args = { world, target: top, held: survival.held, survival, position: { x: 100.5, y: 60, z: 100.5 }, yaw: 0, flowers: {} };
  const entities = copies([at(ABOVE[0] + 0.5, ABOVE[1], ABOVE[2] + 0.5)]);
  assert.equal(clientWithholdsPlace(args), false, "a free cell");
  assert.equal(clientWithholdsPlace({ ...args, entities }), true, "another player's copy in the cell");
  assert.equal(clientWithholdsPlace({ ...args, entities: copies([at(ABOVE[0] + 0.5, ABOVE[1] - 1, ABOVE[2] + 0.5, { sleep: SLEEP })]) }), false, "a lying copy under the cell");
  assert.equal(clientWithholdsPlace({ ...args, position: { x: ABOVE[0] + 0.5, y: ABOVE[1], z: ABOVE[2] + 0.5 } }), true, "the placer's own box (func_150936_a excludes no entity)");
  const cake = new Survival({ slots: [makeStack(ITEM_CAKE, 1)] });
  assert.equal(clientWithholdsPlace({ ...args, held: cake.held, survival: cake, entities }), false, "ItemReed sends the C08 (its onItemUse tests the entities)");
  world.set(...P, 13, false, 0); // the port's crafting table (STATIONS): onBlockActivated answers first
  assert.equal(clientWithholdsPlace({ ...args, entities }), false);
});

// --- (5) the riding and sleeping branches ---
function copyWorld() {
  const world = new World("attack83-copy");
  for (let x = 60; x <= 68; x++) for (let z = 60; z <= 68; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  return world;
}
const fakePlayer = (y, extra = {}) => {
  const charged = [];
  return { charged, position: { x: 64.5, y, z: 64.5 }, grounded: false, stats: new Stats(), motion: { sprinting: false }, yaw: 0,
    survival: { health: 20, creative: false, exhaust(n) { charged.push(n); } }, ...extra };
};

test("riding copy: mw.D = the packet's onGround before mw.i(), the copy moves on its motion, charges nothing (yz.k), and takes no jump", () => {
  const world = copyWorld(), p = fakePlayer(14, { mount: { id: "pig" }, grounded: true });
  const c = serverCopyOf(p);
  c.motion.x = 0.4; c.motion.y = 0; c.onGround = false;
  assert.equal(serverCopyBefore(p, IDLE_INPUT, world), null);
  assert.equal(c.riding, true);
  close(c.motion.x, 0.4 * f(f(0.6) * f(0.91)), "ground friction: the packet's onGround came first");
  assert.equal(p.charged.length, 0);
  assert.equal(p.stats.get(STAT.walk) + p.stats.get(STAT.fly), 0);
  const from = { ...p.position };
  p.position.y += 0.42; p.grounded = false;
  serverCopyAfter(p, from);
  assert.ok(c.motion.y < JUMP_MOTION, "the riding branch returns before the jump rule");
});

test("sleeping copy: mw.i() on the 0.2 x 0.2 box with its charge, the copy's own onGround kept", () => {
  const world = copyWorld(), p = fakePlayer(10.7375, { sleeping: true });
  world.put(64, 10, 64, 1, 0, false); world.put(64, 11, 63, 1, 0, false); // a full block beside the head would stop a 0.6 box, not a 0.2 one
  const c = serverCopyOf(p);
  c.motion.z = -0.5; c.onGround = false;
  const m = serverCopyBefore(p, IDLE_INPUT, world);
  assert.ok(m && typeof m === "object", "charged like the walking branch");
  assert.ok(c.motion.z < -0.1, `the 0.2 box slides clear of the wall: ${c.motion.z}`);
  const own = c.onGround;
  p.grounded = !own;
  serverCopyAfter(p, { ...p.position });
  assert.equal(c.onGround, own, "the sleeping branch never sets mw.D from the packet");
});
