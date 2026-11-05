import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import * as W from "./wolf.js";

// tools/probes/WolfProbe.java (tools/verify-wolf.mjs): the unchanged EntityWolf (wv), EntityTameable (tg) and
// ModelWolf (bio) classes of 1.7.10 on a world double.
export const reference = JSON.parse(await readFile(new URL("../public/research/wolf-reference.json", import.meta.url)));
const f = Math.fround;
// The original's item ids as the project numbers them.
const REAL = { 352: W.BONE, 351: W.DYE, 319: 202, 320: 203, 363: 204, 364: 205, 365: 318, 366: 319, 367: 206 };
const stack = (s) => (s ? { id: REAL[s.id] ?? s.id, damage: s.damage, count: s.count } : null);
const wolf = (extra = {}) => ({ type: "wolf", health: 8, love: 0, growingAge: 0, ...W.wolfFields(), ...extra });
const tamedWolf = (extra = {}) => wolf({ owner: "player", ...extra });
const view = (e) => ({ tamed: W.isTamed(e), angry: e.angry, sitting: e.sitting, sitWish: e.sitWish, health: e.health, maxHealth: W.maxHealth(e), collar: e.collar, begging: e.begging });
const same = (e, want) => assert.deepEqual(view(e), { ...want, owner: undefined }, "wolf state");
const compare = (e, w) => { const { owner, ...rest } = w; assert.deepEqual(view(e), rest); assert.equal(!!e.owner, owner !== ""); };
// Entity.rand with a fixed value.
const run = (e, row, item, owner = true, creative = false) => W.interact(e, item, owner, creative, new JavaRandom(row.seed ?? 7));

test("the wolf constants are the original's", () => {
  const facts = reference.facts;
  assert.equal(W.WOLF_WIDTH, f(facts.width));
  assert.equal(W.WOLF_HEIGHT, f(facts.height));
  assert.equal(W.WOLF_SPEED, facts.speed);
  assert.equal(W.WILD_MAX_HEALTH, facts.wildMax);
  assert.equal(W.TAMED_MAX_HEALTH, facts.tamedMax);
  assert.equal(W.DEFAULT_COLLAR, facts.collarDefault);
  assert.equal(W.WOLF_EYE_HEIGHT, f(facts.eyeHeight));
  assert.equal(W.WOLF_MAX_GROUP, facts.maxSpawnGroup);
  assert.equal(W.WOLF_SOUNDS.volume, f(reference.soundFixed.volume));
  assert.equal(W.WOLF_SOUNDS.hurt, reference.soundFixed.hurt);
  assert.equal(W.WOLF_SOUNDS.death, reference.soundFixed.death);
  assert.equal(`${W.WOLF_SOUNDS.step}|${f(0.15)}|1.0`.replace(/\|0\.15000000596046448\|/, "|0.15|"), reference.step.sounds[0]);
  assert.equal(W.WOLF_SOUNDS.stepVolume, f(0.15));
  const fresh = wolf();
  compare(fresh, facts.wildDefault);
});

test("the tail angle follows the datawatcher health, angry and wild", () => {
  reference.tail.tamedByHealth.forEach((want, health) => assert.equal(W.tailAngle(tamedWolf({ dwHealth: health })), f(want), "health " + health));
  assert.equal(W.tailAngle(tamedWolf({ angry: true })), f(reference.tail.angry));
  assert.equal(W.tailAngle(wolf()), f(reference.tail.wild));
  // A tamed wolf that has not run an AI update shows the datawatcher's initial 1.0.
  assert.equal(W.tailAngle(tamedWolf()), f(reference.tail.freshTamed));
  // An angry wolf's tail, tamed or not.
  assert.equal(W.tailAngle(wolf({ angry: true })), f(reference.tail.angry));
});

test("taming with bones rolls 1 in 3 on Entity.rand and consumes the bone either way", () => {
  const rows = reference.interact.filter((r) => r.kind === "bone");
  assert.equal(rows.length, 300);
  let tamed = 0;
  for (const row of rows) {
    const e = wolf(), item = { id: W.BONE, damage: 0, count: 3 };
    const out = run(e, row, item);
    assert.equal(out.handled, row.result, "seed " + row.seed);
    assert.equal(3 - out.consume, row.held.count);
    assert.deepEqual([out.status], row.states);
    compare(e, row.wolf);
    if (out.tamed) tamed++;
  }
  assert.equal(tamed, rows.filter((r) => r.wolf.tamed).length);
  assert.ok(tamed > 80 && tamed < 120);
});

test("an angry wolf is not tamed and keeps the bone; creative keeps the stack", () => {
  const row = reference.interact.find((r) => r.kind === "boneAngry");
  const e = wolf({ angry: true }), out = run(e, row, { id: W.BONE, damage: 0, count: 3 });
  assert.equal(out.handled, row.result);
  assert.equal(3 - out.consume, row.held.count);
  compare(e, row.wolf);
  const last = reference.interact.find((r) => r.kind === "boneLast");
  assert.equal(last.held, null);
  assert.equal(run(wolf(), { seed: 1 }, { id: W.BONE, damage: 0, count: 1 }, true, true).consume, 0);
});

test("a tamed wolf eats only its favourite meats and heals by the food value", () => {
  const rows = reference.interact.filter((r) => r.kind === "meat");
  assert.equal(rows.length, 30);
  for (const row of rows) {
    const e = tamedWolf({ health: row.startHealth, dwHealth: row.startHealth }), item = { id: REAL[row.item] ?? 201, damage: 0, count: 2 };
    const out = run(e, row, item);
    assert.equal(out.handled, row.result, "item " + row.item + " at " + row.startHealth);
    assert.equal(e.health, row.wolf.health, "item " + row.item + " at " + row.startHealth);
    assert.equal(out.consume, row.startHealth < 20 && row.favourite ? 1 : 0);
    if (row.startHealth < 20 && row.favourite) assert.equal(out.heal, row.heal);
  }
  // Fish and bread are no favourite: nothing is eaten.
  const e = tamedWolf({ health: 5, dwHealth: 5 });
  assert.equal(W.interact(e, { id: 201, damage: 0 }, true, false, new JavaRandom(1)).heal, 0);
  assert.equal(e.health, 5);
});

test("dyes set the collar to 15 - damage, are used up only when it changes", () => {
  assert.deepEqual(reference.dye.colorOfDamage, Array.from({ length: 16 }, (_, d) => 15 - d));
  for (const row of reference.interact.filter((r) => r.kind === "dye")) {
    const e = tamedWolf(), out = run(e, row, { id: W.DYE, damage: row.damage, count: 2 });
    assert.equal(out.handled, row.result, "damage " + row.damage);
    assert.equal(2 - out.consume, row.held.count);
    compare(e, row.wolf);
  }
  const same = reference.interact.find((r) => r.kind === "dyeSame"), e = tamedWolf(), out = run(e, same, { id: W.DYE, damage: 1, count: 2 });
  assert.equal(out.handled, same.result);
  assert.equal(out.consume, 0);
  compare(e, same.wolf);
  const creative = reference.interact.find((r) => r.kind === "dyeCreativePlayer"), c = tamedWolf(), o = run(c, creative, { id: W.DYE, damage: 4, count: 2 }, true, true);
  assert.equal(o.consume, 0);
  compare(c, creative.wolf);
});

test("the owner's click toggles the sit wish, not a stranger's, and a breeding item never does", () => {
  const sit = reference.interact.find((r) => r.kind === "sit"), e = tamedWolf();
  assert.equal(W.interact(e, null, true, false, new JavaRandom(1)).handled, sit.first.result);
  compare(e, sit.first.wolf);
  e.sitting = true; // the Sit task started
  assert.equal(W.interact(e, null, true, false, new JavaRandom(1)).handled, sit.second.result);
  compare(e, sit.second.wolf);
  const stranger = reference.interact.find((r) => r.kind === "sitStranger"), s = tamedWolf();
  assert.equal(W.interact(s, null, false, false, new JavaRandom(1)).handled, stranger.result);
  compare(s, stranger.wolf);
  const meat = reference.interact.find((r) => r.kind === "sitWithBreedItem"), m = tamedWolf({ health: 20, dwHealth: 20 }), out = W.interact(m, { id: 204, damage: 0, count: 2 }, true, false, new JavaRandom(1));
  assert.equal(out.handled, meat.result);
  assert.equal(out.love, meat.inLove);
  compare(m, meat.wolf);
  const stick = reference.interact.find((r) => r.kind === "sitWithStick"), k = tamedWolf();
  assert.equal(W.interact(k, { id: 280, damage: 0, count: 1 }, true, false, new JavaRandom(1)).handled, stick.result);
  compare(k, stick.wolf);
});

test("the living sound: angry growls, a third pants or whines (below 10 health), the rest bark", () => {
  const setups = [() => wolf(), () => wolf({ angry: true }), () => tamedWolf(), () => tamedWolf({ dwHealth: 5 }), () => tamedWolf({ dwHealth: 10 })];
  assert.equal(reference.sound.length, 300);
  for (const row of reference.sound) assert.equal(W.wolfSay(setups[row.mode](), new JavaRandom(row.seed)), row.say, `mode ${row.mode} seed ${row.seed}`);
});

test("damage from a mob is halved as (amount + 1) / 2, a player's or generic damage is not", () => {
  const rows = Object.fromEntries(reference.hurt.map((r) => [r.source, r]));
  const sources = { player: { attacker: true, player: true }, mob: { attacker: true, player: false }, generic: {} };
  for (const [name, source] of Object.entries(sources)) assert.equal(8 - W.hurtAmount(5, source), rows[name].health, name);
  assert.equal(W.hurtAmount(5, { attacker: true, arrow: true }), 5);
});

test("a tamed wolf bites for 4, a wild one for 2", () => {
  for (const row of reference.attack) assert.equal(row.sheepBefore - row.sheepAfter, W.attackStrength(row.tamed ? tamedWolf() : wolf()));
});

test("shouldAttackEntity and canMateWith follow the original", () => {
  const t = reference.target, me = tamedWolf({ owner: "a" });
  assert.equal(W.shouldAttackEntity(me, { type: "creeper" }), t.creeper);
  assert.equal(W.shouldAttackEntity(me, { type: "sheep" }), t.sheep);
  assert.equal(W.shouldAttackEntity(me, tamedWolf({ owner: "a", type: "wolf" })), t.ownWolf);
  assert.equal(W.shouldAttackEntity(me, tamedWolf({ owner: "b" })), t.otherTamedWolf);
  assert.equal(W.shouldAttackEntity(me, wolf()), t.wildWolf);
  assert.equal(W.shouldAttackEntity(me, { isPlayer: true }), t.ownerAsTarget);
  assert.equal(reference.mate.length, 66);
  for (const r of reference.mate) {
    const a = wolf({ owner: r.tamedA ? "p" : "", sitting: r.sitA, love: r.loveA ? 600 : 0 }), b = wolf({ owner: r.tamedB ? "p" : "", sitting: r.sitB, love: r.loveB ? 600 : 0 });
    assert.equal(W.canMateWith(a, b), r.result, JSON.stringify(r));
  }
});

test("a puppy of a tamed parent is tamed with the wild 8 health, a blank owner gives a wild one", () => {
  const [wild, tamed, blank] = reference.child;
  assert.deepEqual(W.puppyFields(wolf()), {});
  assert.equal(wild.child.tamed, false);
  assert.deepEqual(W.puppyFields(tamedWolf()), { owner: "player" });
  assert.equal(tamed.child.tamed, true);
  assert.equal(tamed.child.health, 8);
  assert.equal(tamed.child.collar, W.DEFAULT_COLLAR);
  assert.deepEqual(W.puppyFields(wolf({ owner: "  " })), {});
  assert.equal(blank.child.tamed, false);
});

test("the wet shake: timer 0.05 a tick, the shake sound once, splashes after 0.4, 2.0 ends it", () => {
  const e = wolf({ wet: true, health: 8 }), ticks = [];
  const sounds = [];
  for (let i = 0; i < 100 && (e.wet || e.shaking); i++) {
    const out = W.updateWolf(e, { inWater: false, onGround: true, hasPath: false });
    if (out.shakeSound) sounds.push(i);
    ticks.push({ bs: e.wet, bt: e.shaking, bu: e.shakeTime, bv: e.prevShakeTime, splashes: out.splashes });
  }
  assert.equal(sounds.length, 1);
  assert.equal(reference.shake.ticks.length, ticks.length);
  reference.shake.ticks.forEach((r, i) => assert.deepEqual(ticks[i], { bs: r.bs, bt: r.bt, bu: f(r.bu), bv: f(r.bv), splashes: r.splashes }, "tick " + i));
  assert.ok(reference.shake.sounds[0].startsWith("mob.wolf.shake|0.4|"));
  // Water resets it; a wolf with a path or in the air does not start shaking.
  const w = wolf({ wet: true });
  W.updateWolf(w, { inWater: false, onGround: true, hasPath: true });
  assert.equal(w.shaking, false);
  W.updateWolf(w, { inWater: true, onGround: false, hasPath: false });
  assert.deepEqual([w.wet, w.shaking, w.shakeTime], [true, false, 0]);
  // Status 8 on a client: the shake starts from 0.
  assert.deepEqual([reference.shakeStatus.bt, reference.shakeStatus.bu, reference.shakeStatus.bv], [true, 0, 0]);
});

test("the shake angle, shading and begging tilt match the original's functions", () => {
  for (const r of reference.angles.shake) {
    const e = wolf({ shakeTime: f(r.bu), prevShakeTime: f(r.bv) });
    if ("shade" in r) assert.equal(W.wetShade(e, r.partial), f(r.shade), JSON.stringify(r));
    else assert.equal(W.shakeAngle(e, r.partial, r.offset), f(r.shake), JSON.stringify(r));
  }
  const e = wolf();
  reference.begging.ticks.forEach(([tilt, prev], i) => {
    e.begging = i < 12;
    W.updateWolf(e, { inWater: false, onGround: true, hasPath: false });
    assert.equal(e.headTilt, f(tilt), "tick " + i);
    assert.equal(e.prevHeadTilt, f(prev), "tick " + i);
  });
  for (const r of reference.angles.interested) assert.equal(W.interestedAngle(wolf({ headTilt: f(r.bq), prevHeadTilt: f(r.br) }), r.partial), f(r.interested), JSON.stringify(r));
});
