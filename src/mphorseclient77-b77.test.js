// Batch 77 mphorseclient77: the client half of horses on the dedicated server (multiplayer/client-horse.js, animal-use.js predictions, mob state wire).
import test from "node:test";
import assert from "node:assert/strict";
import { makeSide, spawn, stock } from "../tools/sweep-use75.mjs";
import { MpHorseRider, mountedHorse } from "./multiplayer/client-horse.js";
import { predictAnimalUse } from "./multiplayer/animal-use.js";
import { mobState } from "./multiplayer/server-mobs.js";
import { RemoteMobs } from "./multiplayer/remote-mobs.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { heldJumpPower } from "./horse.js";

const WHEAT = 305, APPLE = 200, SADDLE = 363, LEAD = 2020, CHEST = 41, GOLD_APPLE = 372; // live item ids (originalId maps them to 296, 260, 329, 420, 54, 322)
const tick = (s, n = 1) => { for (let i = 0; i < n; i++) s.tick(); };
const ctl = (side, c) => side.s.input("a", { type: "input", controls: { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, ...c }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const saddled = (extra = {}) => ({ type: "horse", health: 30, growingAge: 0, horse: { type: 0, tame: true, saddled: true, ...extra } });

// b87 ride87: the counter is the bytecode-read blk.e block (horse-live.js horseJumpCounter): the press tick sets a = 0, each held tick after it a++, the release sends
// (int)(bO * 100) and keeps bO through the -10 cooldown; a press inside the cooldown restarts at once.
test("the jump counter charges while the key is held and sends (int)(power * 100) on release", () => {
  const sent = [], r = new MpHorseRider((p) => sent.push(p)), mob = saddled();
  for (let i = 0; i < 7; i++) r.tick(mob, true); // press + 6 held ticks: a = 6
  assert.deepEqual(sent, []);
  assert.equal(r.rider.jumpPower, heldJumpPower(6));
  r.tick(mob, false);
  assert.deepEqual(sent, [Math.trunc(Math.fround(heldJumpPower(6) * 100))]);
  assert.equal(r.rider.jumpPower, heldJumpPower(6), "the bar keeps the released fill");
  for (let i = 0; i < 9; i++) r.tick(mob, false);
  assert.equal(r.rider.jumpPower, heldJumpPower(6), "still drawn at a = -1");
  r.tick(mob, false);
  assert.equal(r.rider.jumpPower, 0, "a reaches 0 after 10 ticks");
  r.tick(mob, true); r.tick(mob, true);
  assert.equal(r.rider.jumpPower, heldJumpPower(1));
});

test("the bar is the jump bar of the single-player HUD and shows on any ridden horse (isRidingHorse)", () => {
  const r = new MpHorseRider(() => {}), mob = saddled();
  assert.deepEqual(r.bar(), { visible: false, width: 0 });
  for (let i = 0; i < 21; i++) r.tick(mob, true);
  assert.equal(r.bar().visible, true);
  assert.equal(r.bar().width, Math.trunc(Math.fround(heldJumpPower(20)) * 183));
  const bare = saddled({ saddled: false }), sent = [], q = new MpHorseRider((p) => sent.push(p));
  for (let i = 0; i < 5; i++) q.tick(bare, true);
  assert.equal(q.bar().visible, true); assert.equal(q.rider.jumpPower, heldJumpPower(4));
  q.tick(bare, false); assert.deepEqual(sent, [40], "sent on an unsaddled horse too (wi.w ignores it)");
  q.tick(null, true); assert.equal(q.bar().visible, false); assert.equal(q.rider.jumpPower, 0);
});

test("mountedHorse finds the stand-in from the players row's seat key", () => {
  const horse = saddled(), cow = { type: "cow", health: 10 };
  const rm = { copies: new Map([[5, { mob: horse }], [6, { mob: cow }]]) };
  assert.equal(mountedHorse(rm, "m5"), horse); assert.equal(mountedHorse(rm, "m6"), null);
  assert.equal(mountedHorse(rm, "c5"), null); assert.equal(mountedHorse(rm, false), null);
});

test("server: only the horseJump wire message jumps the horse; the held key charges nothing", () => {
  const side = makeSide(), e = spawn(side, "horse");
  Object.assign(e.horse, { tame: true, saddled: true, speed: 0.3, jump: 0.7 }); e.health = 30; e.growingAge = 0; e.onGround = true;
  side.p.survival.inventory.main[0] = null; side.s.mobs.interact(side.p, Number(String(e.id).slice(4)), false);
  assert.ok(side.p.mount); tick(side.s, 3);
  ctl(side, { jump: true }); tick(side.s, 8); ctl(side, { jump: false }); tick(side.s, 1);
  assert.ok(!(e.jumpPower > 0) && !e.jumpingHorse, "the held key charges nothing");
  assert.equal(side.s.horseJump("a", 50), true); assert.ok(e.jumpPower > 0);
});

test("mob state carries tame, health and the live maximum; the copy's stand-in reads them", () => {
  const side = makeSide(), e = spawn(side, "horse");
  Object.assign(e.horse, { tame: true, saddled: true }); e.health = 17.5;
  const s = mobState(e);
  assert.equal(s.horse.tame, 1); assert.equal(s.horse.hp, 18); assert.ok(s.horse.max >= 15);
  const world = new World("b77"), rm = new RemoteMobs(world), mob = rm.factory.create("horse", 1, 10, 1);
  rm.state(mob, { ...s, horse: s.horse });
  assert.equal(mob.horse.tame, true); assert.equal(mob.health, 18); assert.equal(mob.horse.maxHealth, s.horse.max);
});

// The prediction against the real server on identical fixtures: stack and the claim.
function standIn(e) { return JSON.parse(JSON.stringify({ type: e.type, health: e.health, growingAge: e.growingAge ?? 0, love: e.love ?? 0, horse: e.horse })); }
function agree(label, setup, id, damage = 0, { sneak = false, kind = "horse", count = 3 } = {}) {
  const side = makeSide(), e = spawn(side, kind); setup(e);
  stock(side, id, damage, count); if (!id) side.p.survival.inventory.main[0] = null;
  const mine = new Survival({}, "survival"); mine.inventory.main[0] = id ? makeStack(id, count, damage) : null; mine.inventory.current = 0;
  const copy = standIn(e), r = predictAnimalUse(copy, mine, { sneak, selfId: "a" });
  if (sneak) ctl(side, { sneak: true });
  side.s.queueAnimUse("a", Number(String(e.id).slice(4)), r.handled); tick(side.s, 1);
  const a = side.p.survival.inventory.main[0], b = mine.inventory.main[0];
  assert.deepEqual([a?.count ?? 0, a?.damage ?? 0], [b?.count ?? 0, b?.damage ?? 0], label + ": stack");
  return { side, e, copy, r };
}
const tame = (e) => { Object.assign(e.horse, { tame: true }); e.growingAge = 0; };

test("prediction: feeding a hurt tame horse eats one item and heals the copy like the server", () => {
  const { e, copy, r } = agree("apple", (e) => { tame(e); e.health = 10; }, APPLE);
  assert.equal(r.handled, true); assert.equal(copy.health, e.health);
});
test("prediction: a full-health tame horse is not fed by wheat; a golden apple is eaten for love", () => {
  agree("wheat at full", (e) => { tame(e); e.health = e.horse.maxHealth ?? 30; }, WHEAT);
  const { e, copy } = agree("golden apple", (e) => { tame(e); e.health = 30; }, GOLD_APPLE);
  assert.equal(copy.love > 0, e.love > 0);
});
test("prediction: a chest on a tame donkey is used, sneaking adults and a horse are not", () => {
  const don = agree("chest donkey", (e) => { e.horse.type = 1; tame(e); }, CHEST, 0, { kind: "donkey" });
  assert.equal(don.r.handled, true); assert.equal(don.copy.horse.chested, true); assert.equal(don.e.horse.chested, true);
  agree("chest horse", (e) => tame(e), CHEST);
});
test("prediction: an empty hand mounts, the saddle and a sneak open the window, each is a claimed click (b78: a wild horse's wheat is temper, not on the wire, and is left to the server: mphorse78-b78.test.js)", () => {
  for (const [label, setup, id, o] of [["empty", tame, 0, {}], ["saddle", tame, SADDLE, {}], ["sneak", tame, 0, { sneak: true }]]) {
    const { r } = agree(label, setup, id, 0, o);
    assert.equal(r.handled, true, label);
  }
});
test("prediction: a foal is not mounted (the click is left to the server)", () => {
  const { r } = agree("foal", (e) => { tame(e); e.growingAge = -24000; }, 0);
  assert.equal(r.handled, false);
});
test("prediction: a lead ties any leashable mob (one lead spent) and the holder's click frees it", () => {
  for (const kind of ["horse", "cow", "pig"]) {
    const { side, e, copy, r } = agree("tie " + kind, (e) => { if (e.horse) tame(e); }, LEAD);
    assert.equal(r.handled, true, kind); assert.ok(e.leash, "server tied"); assert.deepEqual(copy.leadWire, { kind: "player", id: "a" });
    // free: the copy's S1B holder is this player
    const mine = new Survival({}, "survival"); mine.inventory.main[0] = makeStack(LEAD, 1, 0); mine.inventory.current = 0;
    const freed = predictAnimalUse(copy, mine, { selfId: "a" }); assert.equal(freed.handled, true); assert.equal(copy.leadWire, null);
    side.s.queueAnimUse("a", Number(String(e.id).slice(4)), true); tick(side.s, 1);
    assert.ok(!e.leash, "server freed");
  }
});
test("prediction: another holder's lead and a monster are not predicted; Creative keeps the lead", () => {
  const sv = new Survival({}, "survival"); sv.inventory.main[0] = makeStack(LEAD, 2, 0); sv.inventory.current = 0;
  assert.equal(predictAnimalUse({ type: "cow", health: 10, growingAge: 0, leadWire: { kind: "player", id: "zz" } }, sv, { selfId: "a" }).handled, false);
  assert.equal(predictAnimalUse({ type: "zombie", health: 20 }, sv, { selfId: "a" }).handled, false);
  assert.equal(sv.inventory.main[0].count, 2);
  const cr = new Survival({}, "creative"); cr.inventory.main[0] = makeStack(LEAD, 2, 0); cr.inventory.current = 0;
  assert.equal(predictAnimalUse({ type: "cow", health: 10, growingAge: 0 }, cr, { selfId: "a" }).handled, true);
  assert.equal(cr.inventory.main[0].count, 2);
});
