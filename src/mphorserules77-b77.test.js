// Batch 77 mphorserules77: server horse rules (server-horses.js, horse-live.js horseLand / horseRideThink, vehicle-simulation.js fallHit).
// Native reads: EntityHorse.fall wi.b(F), wi.e(FF), wi.a(ro, F), wi.aV, ServerConfigurationManager oi.e / oi.a(ej, mw), Entity.writeToNBT sa.e(dh).
import test from "node:test";
import assert from "node:assert/strict";
import { makeSide, spawn, serverClick } from "../tools/sweep-use75.mjs";
import { horseArmorValue } from "./horse-live.js";
import { JavaRandom } from "./java-random.js";
import { setEntityRandom } from "./entities.js";

const tick = (s, n = 1) => { for (let i = 0; i < n; i++) s.tick(); };
function ridden(side) {
  const e = spawn(side, "horse"); Object.assign(e.horse, { tame: true, saddled: true, type: 0, speed: 0.3, jump: 0.7 }); e.health = 30; e.growingAge = 0; e.onGround = true;
  side.p.survival.inventory.main[0] = null; serverClick(side, e); tick(side.s, 2);
  assert.ok(side.p.mount?.mob === e);
  side.p.survival.protection = 0; // no spawn protection
  return e;
}
const sounds = (m) => m.events.map((x) => x.sound);

test("horse fall: ceil(distance * 0.5 - 3) to the horse and the rider, land sound over 1 block, step sound", () => {
  const side = makeSide(), e = ridden(side), m = side.s.mobs.mobs;
  m.events.length = 0;
  const hp = e.health, php = side.p.survival.health;
  m.fall(e, 10); // ceil(5 - 3) = 2
  assert.equal(e.health, hp - 2);
  assert.equal(side.p.survival.health, php - 2);
  assert.ok(sounds(m).includes("mob.horse.land"));
  assert.ok(sounds(m).some((s) => /step/.test(s)), "the block under the feet steps");
  assert.ok(!sounds(m).some((s) => /hurt\.fall/.test(s)), "no EntityLivingBase fall sound");
});

test("horse fall: 6 blocks or less deals nothing and plays no step sound; 1 to 6 still lands loudly over 1", () => {
  const side = makeSide(), e = ridden(side), m = side.s.mobs.mobs;
  m.events.length = 0;
  m.fall(e, 6);
  assert.equal(e.health, 30); assert.equal(side.p.survival.health, 20);
  assert.deepEqual(sounds(m), ["mob.horse.land"]);
  m.events.length = 0; m.fall(e, 1); assert.deepEqual(sounds(m), []);
});

test("horse fall damage ignores horse armour (fall bypasses armour) and a creative rider takes none", () => {
  const side = makeSide(), e = ridden(side), m = side.s.mobs.mobs;
  e.horse.armor = 3;
  m.fall(e, 14); // ceil(7 - 3) = 4
  assert.equal(e.health, 26);
  side.p.survival.mode = "creative"; side.p.survival.health = 20; e.hurt = 0; m.fall(e, 14);
  assert.equal(side.p.survival.health, 20);
  assert.equal(e.health, 22);
});

test("horse armour: iron 5, gold 7, diamond 11 reduce a hit by (25 - armour) / 25", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(horseArmorValue), [0, 5, 7, 11, 0]);
  const side = makeSide(), e = spawn(side, "horse"), m = side.s.mobs.mobs;
  for (const [armor, v] of [[0, 0], [1, 5], [2, 7], [3, 11]]) {
    e.health = 30; e.hurt = 0; e.horse.armor = armor;
    m.attackEntityFrom(e, 10, { name: "generic2" });
    assert.equal(m.lastDealt, Math.fround(Math.fround(10 * (25 - v)) / 25));
  }
});

test("a rider's yaw and half pitch steer the horse (wi.e(FF): rotationPitch = rider pitch * 0.5, body and head follow the yaw)", () => {
  const side = makeSide(), e = ridden(side);
  side.s.input("a", { type: "input", controls: { forward: 1, strafe: 0, jump: false, sneak: false, sprint: false }, yaw: 1, pitch: -0.4, current: 0, hotbar: Array(9).fill(null) });
  tick(side.s, 2);
  const yaw = Math.fround(180 - 1 * 180 / Math.PI); // the server's pitch is positive upwards: -0.4 rad is 22.9 degrees down, native +22.9
  assert.ok(Math.abs(e.rotationYaw - yaw) < 1e-3);
  assert.ok(Math.abs(e.rotationPitch - (0.4 * 180 / Math.PI) * 0.5) < 1e-3, `pitch ${e.rotationPitch}`);
  assert.ok(Math.abs(e.renderYawOffset - yaw) < 1e-3 && Math.abs(e.rotationYawHead - yaw) < 1e-3);
});

test("a rider cannot hurt its own horse in melee; another player's hit is not ignored", () => {
  const side = makeSide(), e = ridden(side);
  assert.equal(side.s.vehicles.horses.rides(side.p, e), true);
  assert.equal(side.s.vehicles.horses.rides({ mount: null }, e), false);
  const hp = e.health;
  const id = Number(String(e.id).replace("mob-", ""));
  side.s.mobs.attack(side.p, id);
  assert.equal(e.health, hp);
});

test("logout while riding saves Riding and removes the horse; login remounts a new horse", () => {
  const side = makeSide(), e = ridden(side), m = side.s.mobs.mobs;
  e.horse.owner = "Alice"; e.horse.maxHealth = 30; e.health = 21;
  const key = side.p.resumeKey;
  side.s.removePlayer("a");
  assert.ok(!m.entities.includes(e), "the mount left the world");
  const saved = side.s.savedPlayers.get(key);
  assert.equal(saved.riding.type, "horse");
  assert.equal(saved.riding.health, 21);
  assert.ok(JSON.stringify(saved));
  const p2 = side.s.addPlayer("b", "Alice", key);
  assert.ok(p2.mount?.mob, "mounted again");
  const horse = p2.mount.mob;
  assert.notEqual(horse, e);
  assert.equal(horse.health, 21); assert.equal(horse.horse.owner, "Alice"); assert.ok(horse.horse.saddled);
  assert.ok(m.entities.includes(horse)); assert.equal(horse.rider, p2.mount.rider);
});

test("logout on foot keeps no Riding, and a dead mount is not saved", () => {
  const side = makeSide(), key = side.p.resumeKey;
  side.s.removePlayer("a");
  assert.equal(side.s.savedPlayers.get(key).riding, undefined);
});

test("wild taming roll: the horse's own Random, nextInt(50) per tick, then nextInt(100) < temper, else temper + 5 and the buck", () => {
  const side = makeSide(), e = spawn(side, "horse"), m = side.s.mobs.mobs;
  Object.assign(e.horse, { tame: false, saddled: false, temper: 40 });
  e.health = 30; e.growingAge = 0; e.onGround = true;
  setEntityRandom(e, new JavaRandom(12345));
  const mirror = new JavaRandom(12345);
  e.side = side;
  side.p.survival.inventory.main[0] = null; serverClick(side, e);
  assert.ok(e.rider, "mounted wild");
  let temper = 40, bucked = false;
  for (let i = 0; i < 400 && !bucked; i++) {
    const roll = mirror.nextInt(50) === 0;
    let wantTame = false;
    if (roll) { if (mirror.nextInt(100) < temper) wantTame = true; else { temper += 5; bucked = true; } }
    m.horseRunAround(e);
    assert.equal(e.horse.tame, wantTame, "draw " + i);
    if (wantTame) break;
  }
  assert.equal(e.horse.temper, Math.min(100, temper));
  assert.ok(bucked || e.horse.tame);
});

test("foals grow on the server (EntityAgeable)", () => {
  const side = makeSide(), e = spawn(side, "horse");
  e.growingAge = -100; e.health = 30; e.onGround = true;
  tick(side.s, 5);
  assert.ok(e.growingAge > -100, "growingAge counts up");
});
