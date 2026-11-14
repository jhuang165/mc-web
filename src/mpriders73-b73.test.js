// Batch 73 mpriders73: the dedicated server's riders take the fall a boat or cart passes on (damage, Jump Boost, S29 fall sounds), the server arrow pickup uses the ridden
// box, and a rider's carried fallDistance is never spent natively (MountFallProbe, executed on the unchanged 1.7.10 classes; tools/verify-mountfall73.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, RAIL } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { passFall } from "./vehicle-riders.js";
import { JUMP_BOOST } from "./damage-fx.js";
import { STAT } from "./stats.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/mountfall73-reference.json", import.meta.url)));
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture() {
  const world = new World("mpriders73-b73");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  for (let x = 60; x <= 80; x++) world.put(x, 10, 70, RAIL, 1, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  s.rules.chunkStream = false;
  return s;
}
function ride(kind) {
  const s = fixture(), p = s.addPlayer("a", "ax", key(1));
  p.position.copy({ x: 64.5, y: 10, z: 70.5 }); p.previous.copy(p.position); s.input("a", input()); s.tick(); p.survival.protection = 0;
  const v = s.vehicles.spawnVehicle(kind, 64.5, 10, 70.5);
  s.tick();
  assert.ok(s.vehicles.act(p, { v: `${kind === "boat" ? "b" : "c"}${v.id}`, hit: false }) !== false || p.mount);
  assert.ok(p.mount, "seated");
  return { s, p, v };
}

test("the reference: a rider's own move (dy 0) never lands or spends a carried fall; a free gravity step does (executed)", () => {
  const rec = reference.records.filter(r => r.case === "mountfall");
  assert.equal(rec.length, 8);
  for (const r of rec.filter(x => x.dy === 0)) { assert.equal(r.falls, 0); assert.equal(r.onGround, false); assert.equal(r.after, 5); }
  for (const r of rec.filter(x => x.gap === 0.03 && x.dy < 0)) { assert.equal(r.falls, 1); assert.equal(r.fallArg, 5); }
  assert.ok(rec.filter(x => x.gap === 0.2 && x.dy < 0).every(r => r.falls === 0));
});

test("a server cart landing passes its fall to the riding player: ceil(8 - 3) damage and the fall sounds go to S29", () => {
  const { s, p, v } = ride("minecart");
  assert.equal(v.rider, p.mount.rider);
  const h = p.survival.health; s.soundsOut.length = 0;
  passFall(v, 8);
  assert.equal(p.survival.health, h - 5);
  const names = s.soundsOut.map(x => x.name);
  assert.ok(names.some(n => /fall/.test(n)), `a fall sound: ${names}`);
  assert.ok(s.soundsOut.every(x => x.except === null && x.volume > 0));
  s.soundsOut.length = 0; p.survival.health = 20;
  passFall(v, 3); // not above 3 blocks: nothing
  assert.equal(p.survival.health, 20); assert.equal(s.soundsOut.length, 0);
});

test("Jump Boost lowers a server rider's fall and Creative takes none", () => {
  const { s, p, v } = ride("boat");
  p.survival.effects.add({ id: JUMP_BOOST, amplifier: 1, duration: 600 });
  passFall(v, 8);
  assert.equal(p.survival.health, 20 - 3, "ceil(8 - 3 - 2)");
  p.survival.health = 20; p.survival.effects.clear(); s.soundsOut.length = 0; p.survival.mode = "creative";
  passFall(v, 20);
  assert.equal(p.survival.health, 20); assert.equal(s.soundsOut.length, 0);
});

test("the distance-fallen statistic counts a vehicle's fall once", () => {
  const { p, v } = ride("minecart");
  const before = p.stats.get(STAT.fall);
  passFall(v, 8);
  assert.equal(p.stats.get(STAT.fall) - before, 800);
  passFall(v, 1.5); // EntityPlayer.fall counts from 2 blocks
  assert.equal(p.stats.get(STAT.fall) - before, 800);
});

test("ridingBox: the cart's box, null on foot or when it is dead", () => {
  const { s, p, v } = ride("minecart");
  assert.deepEqual(s.vehicles.ridingBox(p), v.bb);
  v.dead = true;
  assert.equal(s.vehicles.ridingBox(p), null);
  const q = s.addPlayer("b", "bx", key(2));
  assert.equal(s.vehicles.ridingBox(q), null);
});

test("server arrow pickup: a riding player's box is the union grown (1, 0, 1), so an arrow above the head is out of reach; on foot it is within (1, 0.5, 1)", () => {
  const { s, p } = ride("minecart");
  const arrows = s.dispense.arrows, at = p.position;
  const stuck = () => { const a = arrows.make({ x: at.x, y: at.y + 2.2, z: at.z, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: null, pickup: 1 }); Object.assign(a, { inGround: true, shake: 0, xTile: 64, yTile: 9, zTile: 64, inTile: 3 }); arrows.list.push(a); return a; };
  const a = stuck();
  s.dispense.collectArrows(s.dispense);
  assert.equal(a.dead, false, "riding: the union box is not grown upward");
  s.vehicles.dismount(p);
  s.dispense.collectArrows(s.dispense);
  assert.equal(a.dead, true, "on foot: grown 0.5 upward");
});
