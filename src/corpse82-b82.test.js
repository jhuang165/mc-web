// Batch 82 corpse82: what a dying mob's update still runs, the converting corpse's experience, and the horse herd tail.
// Bytecode-read (javap -c -p, 1.7.10 jar): World.updateEntityWithOptionalForce (ahb.a(sa, Z)) adds 1 to ticksExisted before every onUpdate; sv.h runs e() and then the body turn
// (sv.f(FF)) with no health test; rx.e (growth) and wf.e (inLove, the heart draws) test no health, and sv.e skips only the AI (sw.bn) when bh() is true; yq.e / yl.e (the sun) and
// yh.h (the angry sound) test no health; yq.h -> yq.cd only sets the zombie dead, and the rest of its onUpdate reaches sv.aF; wi.e's herd tail hands a path to td.a(ayf), which only
// the old-AI td.bq reads.
import test from "node:test";
import assert from "node:assert/strict";
import { Survival } from "./survival.js";
import { EntityWorld, setEntityRandom, entityRandom } from "./entities.js";
import { JavaRandom } from "./lighting.js";
import { herdTargetOf, closestBredHorse } from "./horse-live.js";

const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const player = { x: 64, y: 0, z: 64, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
const world = (mobs) => { const w = new EntityWorld(grass, mobs.map((m, i) => ({ id: `mob-${i + 1}`, x: 64, y: 0, z: 66, health: 8, ...m })), () => 0.5); Object.assign(w.ai.player, { x: 64, y: 0, z: 64 }); return w; };
const tick = (w, n = 1) => { for (let i = 0; i < n; i++) w.tick(player, new Survival({})); };
const corpse = (e, death = 0) => { e.health = 0; e.death = death; return e; };
const horse = (extra = {}) => ({ type: "horse", health: 20, horse: { type: 0, tame: false, speed: 0.225, jump: 0.7, maxHealth: 20, ...extra } });

test("a corpse grows (rx.e) and counts its love down with the heart draws (wf.e), with no health test", () => {
  const w = world([{ type: "cow", growingAge: -100 }]), calf = corpse(w.entities[0]);
  tick(w, 3);
  assert.equal(calf.growingAge, -97, "the dying calf still grows");
  // A fed adult corpse (b80: interact has no health test) is in love: love 11 -> 10 draws 3 gaussians and 3 floats on Entity.rand.
  const a = world([{ type: "cow", growingAge: 0, love: 11 }]), b = world([{ type: "cow", growingAge: 0, love: 0 }]);
  setEntityRandom(corpse(a.entities[0]), new JavaRandom(5)); setEntityRandom(corpse(b.entities[0]), new JavaRandom(5));
  tick(a); tick(b);
  assert.equal(a.entities[0].love, 10);
  const ref = new JavaRandom(5); for (let i = 0; i < 3; i++) ref.nextGaussian(); for (let i = 0; i < 3; i++) ref.nextFloat();
  assert.equal(entityRandom(a.entities[0]).nextInt(1 << 30), ref.nextInt(1 << 30), "the heart arguments were drawn");
  assert.equal(entityRandom(b.entities[0]).nextInt(1 << 30), new JavaRandom(5).nextInt(1 << 30), "no love, no draw");
  const baby = world([{ type: "cow", growingAge: -50, love: 30 }]);
  tick(baby); corpse(baby.entities[0]); tick(baby);
  assert.equal(baby.entities[0].love, 0, "a child loses its love");
});

test("a foal corpse's box widens as it grows (EntityHorse.setScaleForAge)", () => {
  const w = world([{ ...horse(), growingAge: -24000 }]), e = corpse(w.entities[0]);
  e.horse.eating = true; // movement-blocked: no AI wandering
  const [w0] = w.size(e);
  tick(w);
  assert.equal(e.growingAge, -23999);
  e.growingAge = -1; tick(w);
  assert.equal(e.growingAge, 0);
  assert.ok(w.size(e)[0] > w0, "the box is an adult's now");
});

test("a corpse's body turns after onLivingUpdate (sv.h): the body helper eases the body toward the head", () => {
  const w = world([{ type: "cow", growingAge: 0 }]), e = w.entities[0];
  tick(w);
  corpse(e);
  Object.assign(e, { rotationYaw: 60, rotationYawHead: 60, renderYawOffset: 0, prevRenderYawOffset: 0, bodyHeadYaw: 60, bodyTicks: 0, vx: 0, vz: 0 });
  tick(w, 15);
  assert.ok(e.renderYawOffset > 20, `the body followed the head (renderYawOffset ${e.renderYawOffset})`);
});

test("ticksExisted counts on a corpse; a blocked tick does not move EntityAITasks.tickCount, an unblocked horse corpse's does", () => {
  const w = world([{ type: "cow", growingAge: 0 }]), e = w.entities[0];
  tick(w, 2);
  const age = e.age, skipped = e.aiSkipped || 0;
  corpse(e); tick(w, 4);
  assert.equal(e.age, age + 4, "ticksExisted");
  assert.equal(Math.trunc(e.age) - (e.aiSkipped || 0), age - skipped, "the derived task count is where the last live tick left it");
  const h = world([{ ...horse(), growingAge: 0 }]), he = h.entities[0];
  tick(h, 2); corpse(he);
  const seen = [];
  const think = h.ai.think.bind(h.ai); h.ai.think = (m) => { think(m); seen.push(h.ai.brain(m).tasks.tickCount); };
  tick(h, 3);
  assert.deepEqual(seen.map((c) => c - seen[0]), [0, 1, 2], "the horse corpse's AI task counter advances each tick");
});

test("a zombie corpse in daylight still rolls for the sun and catches fire (yq.e); a pigman corpse's angry sound still counts down (yh.h)", () => {
  const w = world([{ type: "zombie", growingAge: 0 }]), z = corpse(w.entities[0]);
  w.ai.brightness = () => 0.9; w.ai.deps.canSeeSky = () => true;
  setEntityRandom(z, { nextFloat: () => 0, nextInt: () => 0, nextGaussian: () => 0, nextDouble: () => 0, nextBoolean: () => false });
  tick(w);
  assert.ok(z.fire > 0, "set on fire for 8 s");
  const p = world([{ type: "pigman", growingAge: 0 }]), pm = corpse(p.entities[0]);
  pm.randomSoundDelay = 1;
  tick(p);
  assert.ok(p.events.some((ev) => ev.sound === "mob.zombiepig.zpigangry"), "the angry sound played");
});

test("a dying zombie whose conversion ends as its deathTime reaches 20 still drops its experience, after the villager", () => {
  const run = (death) => {
    const w = world([{ type: "zombie", villager: true, growingAge: 0 }]), z = corpse(w.entities[0], death);
    z.conversionTime = 1; z.recentlyHit = 60;
    const loot = []; w.spawnLoot = (evs) => { for (const ev of evs) loot.push({ ev, after: w.entities.map((x) => x.type) }); };
    tick(w);
    return { w, loot };
  };
  const at19 = run(19);
  assert.ok(at19.w.entities.some((x) => x.type === "villager"), "converted");
  const xp = at19.loot.filter((l) => l.ev.xp > 0);
  assert.equal(xp.length, 1, "the corpse's experience");
  assert.ok(xp[0].after.includes("villager"), "the villager joined the list first");
  assert.equal(run(10).loot.filter((l) => l.ev.xp > 0).length, 0, "below 19 the death update drops nothing");
});

test("horse herd (wi.e tail): a Bred, not-eating foal picks the closest Bred horse beyond 2 blocks; nothing moves it and no Entity.rand is drawn", () => {
  const make = (bred) => {
    const w = world([{ ...horse({ bred }), growingAge: -24000, x: 64, z: 66 }, { ...horse({ bred: true }), growingAge: 0, x: 70, z: 66 }, { ...horse({ bred: true }), growingAge: 0, x: 74, z: 66 }]);
    w.entities.forEach((e, i) => setEntityRandom(e, new JavaRandom(11 + i)));
    return w;
  };
  const a = make(true), b = make(false);
  tick(a, 5); tick(b, 5);
  assert.equal(herdTargetOf(a.entities[0]), a.entities[1], "the nearer Bred horse");
  assert.equal(herdTargetOf(b.entities[0]), null, "an unbred foal looks for none");
  assert.equal(herdTargetOf(a.entities[1]), null, "an adult looks for none");
  for (let i = 0; i < 3; i++) {
    const p = a.entities[i], q = b.entities[i];
    assert.deepEqual([p.x, p.y, p.z], [q.x, q.y, q.z], `horse ${i} moved the same`);
    assert.equal(entityRandom(p).nextInt(1 << 30), entityRandom(q).nextInt(1 << 30), `horse ${i} drew the same`);
  }
  const c = make(true), foal = c.entities[0];
  assert.equal(closestBredHorse(c, foal, 16), c.entities[1]);
  c.entities[1].x = 90; c.entities[2].x = 95;
  assert.equal(closestBredHorse(c, foal, 16), null, "beyond the grown box");
});
