// Batch 87 ride87: the horse jump bar and C0B action 6 (blk.e / bjk.i / nh.a(jj) / wi.w, bytecode-read), the C0C jump flag on the server, single player's
// boat lily pad break (World.func_147480_a, no player) and the Creative armour right click (ItemArmor.onItemRightClick + ItemInWorldManager.tryUseItem's restore).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import './entities.js'; // load order: entities.js first (horse-live.js <-> entities.js cycle)
import { heldJumpPower } from "./horse.js";
import { MpHorseRider } from "./multiplayer/client-horse.js";
import { makeSide, spawn, stock } from "../tools/sweep-use75.mjs";
import { horseJumpCounter, horseSeats, installHorse } from "./horse-live.js";
import { applyPlayerEdit } from "./player-edit-simulation.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { Farming } from "./farming.js";
import { Trees } from "./trees.js";
import { JavaRandom } from "./java-random.js";
import { makeStack } from "./inventory.js";

const f = Math.fround;
const tick = (s, n = 1) => { for (let i = 0; i < n; i++) s.tick(); };

// One rider through a key sequence; returns the sent values and the bar after each tick.
function run(keys, onHorse = true) {
  const r = { jumpCounter: 0, jumpPower: 0, wasJump: false }, sent = [], bars = [];
  for (const k of keys) { horseJumpCounter(r, k, onHorse, (p) => sent.push(p)); bars.push(r.jumpPower); }
  return { r, sent, bars };
}

test("heldJumpPower is blk.e's float formula", () => {
  for (let a = 0; a < 10; a++) assert.equal(heldJumpPower(a), f(a * f(0.1)));
  assert.equal(heldJumpPower(10), f(f(0.8) + f(f(2) * f(0.1))));
  assert.equal(heldJumpPower(10), 1);
  assert.equal(heldJumpPower(11), f(f(0.8) + f(f(1) * f(0.1))));
  assert.equal(heldJumpPower(29), f(f(0.8) + f(f(2 / 20) * f(0.1))));
});

test("the press tick sets a = 0 and bO = 0; each held tick after it a++; the release sends (int)(bO * 100) and keeps the bar 10 ticks", () => {
  const { r, sent, bars } = run([true, true, true, false]);
  assert.deepEqual(bars.slice(0, 3), [0, heldJumpPower(1), heldJumpPower(2)]);
  assert.deepEqual(sent, [Math.trunc(f(heldJumpPower(2) * 100))]);
  assert.equal(sent[0], 20);
  assert.equal(r.jumpCounter, -10);
  assert.equal(bars[3], heldJumpPower(2), "not cleared by the release");
  const more = run([true, true, true, false, ...Array(10).fill(false)]);
  assert.equal(more.bars[12], heldJumpPower(2), "a = -1");
  assert.equal(more.bars[13], 0, "a = 0 clears bO");
});

test("a one-tick tap sends 0 (wi.w then jumps at 0.4 with the rear); a press inside the cooldown restarts at once", () => {
  assert.deepEqual(run([true, false]).sent, [0]);
  const { sent, bars } = run([true, true, false, false, true, true, false]);
  assert.deepEqual(sent, [10, 10]);
  assert.equal(bars[4], 0); assert.equal(bars[5], heldJumpPower(1));
});

test("off a horse the bar is 0 and nothing is sent; the counter is kept", () => {
  const r = { jumpCounter: -4, jumpPower: 0.5, wasJump: true }, sent = [];
  horseJumpCounter(r, false, false, (p) => sent.push(p));
  assert.deepEqual(sent, []); assert.equal(r.jumpPower, 0); assert.equal(r.jumpCounter, -4); assert.equal(r.wasJump, false);
});

test("MpHorseRider: any ridden horse (isRidingHorse = instanceof EntityHorse) charges, draws the bar and sends", () => {
  const sent = [], q = new MpHorseRider((p) => sent.push(p)), bare = { type: "horse", health: 20, horse: { saddled: false } };
  q.tick(bare, true); q.tick(bare, true); q.tick(bare, false);
  assert.deepEqual(sent, [10]);
  assert.equal(q.bar().visible, true);
  assert.equal(q.bar().width, Math.trunc(f(heldJumpPower(1)) * 183));
});

test("single player's charge runs the same counter and hands the value to wi.w", () => {
  const got = [], e = { type: "horse", horse: { saddled: true } }, seats = horseSeats({ entities: [e], horseJump: (m, p) => got.push([m, p]) });
  const rider = { vehicle: { horse: true, entity: e }, jumpCounter: 0, jumpPower: 0, wasJump: false };
  for (const k of [true, true, true, true, false]) seats.charge(rider, { jump: k });
  assert.deepEqual(got, [[e, 30]]);
  const pig = { type: "pig" };
  rider.vehicle = { horse: true, entity: pig }; seats.charge(rider, { jump: true }); seats.charge(rider, { jump: false });
  assert.equal(got.length, 1, "a pig is not a horse"); assert.equal(rider.jumpPower, 0);
});

test("wi.w: unsaddled changes nothing; 0 jumps at 0.4 with the rear; a negative value counts as 0 without the rear; 90 and up is 1", () => {
  const W = function () {}; installHorse(W);
  const host = { horseRear(e) { e.rearing = true; } }, jump = (e, p) => W.prototype.horseJump.call(host, e, p);
  const bare = { horse: { saddled: false }, jumpPower: 0.7, jumpHeld: true };
  jump(bare, 50); assert.equal(bare.jumpPower, 0.7); assert.equal(bare.jumpHeld, true);
  const e = { horse: { saddled: true } };
  jump(e, 0); assert.equal(e.jumpPower, f(0.4)); assert.equal(e.rearing, true);
  const n = { horse: { saddled: true } };
  jump(n, -5); assert.equal(n.jumpPower, f(0.4)); assert.equal(n.rearing, undefined);
  const big = { horse: { saddled: true } }; jump(big, 2147483647); assert.equal(big.jumpPower, 1);
});

function riddenHorse() {
  const side = makeSide(), e = spawn(side, "horse");
  Object.assign(e.horse, { tame: true, saddled: true, speed: 0.3, jump: 0.7 }); e.health = 30; e.growingAge = 0; e.onGround = true;
  side.p.survival.inventory.main[0] = null; side.s.mobs.interact(side.p, Number(String(e.id).slice(4)), false);
  assert.ok(side.p.mount); tick(side.s, 3);
  return { side, e };
}
const input = (side, c, ride) => side.s.input("a", { type: "input", controls: { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, ...c }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null), ...(ride ? { ride } : {}) });

test("server: the C0C jump flag is the rider's isJumping and jumps no horse; only C0B 6 does, with any int", () => {
  const { side, e } = riddenHorse();
  for (let i = 0; i < 12; i++) { input(side, { jump: i < 11 }, { s: 0, f: 0, j: i < 11, k: false }); tick(side.s); }
  assert.ok(!(e.jumpPower > 0) && !e.jumpingHorse);
  assert.equal(side.p.mount.rider.jumping, false);
  input(side, { jump: true }, { s: 0, f: 0, j: true, k: false }); tick(side.s);
  assert.equal(side.p.mount.rider.jumping, true);
  assert.ok(!(e.jumpPower > 0) && !e.jumpingHorse);
  assert.equal(side.s.horseJump("a", 5000), true);
  assert.equal(e.jumpPower, 1);
  assert.equal(side.s.horseJump("a", 1.5), false, "not an int");
});

test("server: Creative armour is worn and stays in the hand, and the whole window goes back (S30); Survival empties the hand", () => {
  for (const mode of ["creative", "survival"]) {
    const side = makeSide(mode); stock(side, 408, 0, 1); side.p.itemsOut = [];
    side.s.edit(side.p, true, true);
    const inv = side.p.survival.inventory;
    assert.equal(inv.getStack(39 - 0)?.id, 408, mode);
    assert.equal(inv.main[0]?.id ?? null, mode === "creative" ? 408 : null, mode);
    if (mode === "creative") assert.equal(inv.main[0].count, 1);
    const s30 = side.p.itemsOut.find((m) => m.type === "invItems");
    assert.ok(s30, `${mode}: sendContainerToPlayer`);
    assert.equal(s30.main[0]?.id ?? null, mode === "creative" ? 408 : null);
    side.p.itemsOut = []; side.s.edit(side.p, true, true);
    assert.equal(side.p.itemsOut.some((m) => m.type === "invItems"), false, "a worn slot changes nothing and resends nothing");
  }
});

test("single player: Creative armour is worn and stays in the hand; Survival moves it", () => {
  for (const mode of ["creative", "survival"]) {
    const world = new World("ride87"), survival = new Survival({ food: 20, slots: [makeStack(408, 1)] }, mode);
    const state = { screen: "playing", heldTool: 408, world, survival, position: { x: 10.5, y: 10, z: 10.5 }, velocity: { x: 0, y: 0, z: 0 }, motion: { sneaking: false, sprinting: false },
      mobs: {}, farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(18) }), fire: {}, grounded: true, fallDistance: 0, wasInWater: false, yaw: 0, eating: null,
      mining: null, mineCooldown: 0, mineHeld: true, flowers: {}, boneRandom: new JavaRandom(21), itemRand: new JavaRandom(22) };
    const result = applyPlayerEdit(state, { place: true, target: null, aimedEntity: null }, {});
    assert.equal(result.branch, "equip-armor", mode);
    assert.equal(survival.inventory.getStack(39)?.id, 408, mode);
    assert.equal(survival.held?.id ?? null, mode === "creative" ? 408 : null, mode);
  }
});

test("main.js: the single-player boat clears a lily pad through boatClearCell (2001, the drop, air), not breakPlayerBlock", async () => {
  const src = await readFile(new URL("./main.js", import.meta.url), "utf8");
  const at = src.indexOf("const boatHooks = {"), body = src.slice(at, src.indexOf("\n  };", at));
  const clear = body.slice(body.indexOf("clear: (x, y, z, block) =>"));
  assert.match(clear, /boatClearCell\(world, x, y, z, block,/);
  assert.match(clear, /aux: \(id, ax, ay, az, data\) => multiplayerBreakFx\(\[ax, ay, az\], data & 4095, data >> 12\)/);
  assert.match(clear, /items\.dropBlock\(/);
  assert.doesNotMatch(clear, /breakBlock\(/);
});
