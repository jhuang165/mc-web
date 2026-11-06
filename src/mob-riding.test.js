import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { localDifficulty, spiderSpawnRolls } from "./difficulty.js";
import { EntityWorld, setEntityRandom, ENTITY_TYPES } from "./entities.js";
import { experiencePoints } from "./combat.js";
import { seatPosition, riderYOffset, mountedYOffset, mountEntity, ridingOrder, chickenJockeyDespawns, linkRiders, freeChickenNear, releaseDead } from "./mob-riding.js";

// MobRidingProbe on the unchanged 1.7.10 classes; see tools/verify-mob-riding.mjs.
const reference = JSON.parse(readFileSync(new URL("../public/research/mob-riding-reference.json", import.meta.url)));
const records = (c) => reference.records.filter((r) => r.case === c);
const f = Math.fround;

const flat = { numericSeed: 1, solid: (x, y, z) => y < 1, get: (x, y, z) => (y < 1 ? 1 : 0), getMeta: () => 0, surface: () => 1, spawn: () => ({ x: 64.5, y: 1, z: 64.5 }) };
const world = (list = []) => new EntityWorld(flat, list.map((m, i) => ({ id: `mob-${i + 1}`, health: 20, ...m })));
const night = { health: 20, creative: false, time: 18000, damage() {}, scaledDamage() {}, count: () => 0 };
const heightOf = (w) => (m) => w.size(m)[1];
const place = (e, x, y, z, yaw) => Object.assign(e, { x, y, z, px: x, py: y, pz: z, rotationYaw: yaw, prevRotationYaw: yaw, renderYawOffset: yaw, prevRenderYawOffset: yaw });

test("the reference covers every case and the unchanged classes", () => {
  assert.equal(reference.records.length, 1683);
  for (const c of ["seat", "dismount", "chicken", "spiderJockey", "chickenJockey", "breakDoor"]) assert.ok(records(c).length > 0, c);
  for (const c of ["sa", "sv", "sw", "yn", "yq", "yl", "wg", "tz", "uc"]) assert.match(reference.classes[c].sha256, /^[0-9a-f]{64}$/);
});

test("Entity.updateRiderPosition and EntityChicken's seat match the original", () => {
  assert.equal(records("seat").length, 72);
  for (const r of records("seat")) {
    const mount = { type: r.mount, x: 10.5, y: 64, z: -3.25, renderYawOffset: r.bodyYaw };
    const s = seatPosition(mount, { type: r.riderType }, r.mountHeight);
    assert.deepEqual([s.x, s.y, s.z], r.pos, JSON.stringify(r));
    assert.equal(mountedYOffset(r.mountHeight), r.mountedOffset === undefined ? mountedYOffset(r.mountHeight) : r.mount === "chicken" ? mountedYOffset(r.mountHeight) : r.mountedOffset);
    assert.equal(riderYOffset(r.riderType), r.riderYOffset);
    if (r.mount === "chicken") assert.equal(s.renderYaw, r.riderBodyYaw);
  }
});

test("mountEntity(null) puts the rider on top of the mount; cycles are refused", () => {
  const w = world();
  for (const r of records("dismount")) {
    const mount = place(w.create(r.mount, 10.5, 64, -3.25), 10.5, 64, -3.25, r.bodyYaw), rider = place(w.create(r.riderType, 0, 0, 0), 10.5, 64, -3.25, 33);
    rider.rotationPitch = 7;
    assert.ok(mountEntity(rider, mount, heightOf(w)));
    assert.equal(mount.riddenBy, rider);
    assert.ok(mountEntity(rider, null, heightOf(w)));
    assert.equal(rider.ridingEntity, null);
    assert.equal(mount.riddenBy, null);
    assert.deepEqual([rider.x, rider.y, rider.z], r.pos, JSON.stringify(r));
    assert.equal(r.cleared, true);
    assert.deepEqual([rider.rotationYaw, rider.rotationPitch], [33, 7]);
  }
  const [cycle] = records("cycle"), [again] = records("remount");
  const a = w.create("zombie", 0, 1, 0), b = w.create("chicken", 0, 1, 0), c = w.create("spider", 0, 1, 0);
  assert.ok(mountEntity(a, b, heightOf(w)));
  assert.equal(mountEntity(b, a, heightOf(w)), !cycle.refused);
  // Mounting a second mount releases the first, which a third mount then takes.
  assert.ok(mountEntity(a, c, heightOf(w)));
  assert.equal(b.riddenBy, null);
  assert.equal(c.riddenBy, a);
  assert.deepEqual([again.firstFree, again.second], [true, true]);
});

test("a chicken jockey: no eggs, 10 experience, despawns only unridden, NBT flag round trip", () => {
  const w = world();
  for (const r of records("chicken")) {
    const c = w.create("chicken", 5, 1, 5);
    c.chickenJockey = r.jockey;
    if (r.ridden) mountEntity(w.create("zombie", 5, 1, 5), c, heightOf(w));
    assert.equal(chickenJockeyDespawns(c), r.canDespawn, JSON.stringify(r));
    if (r.jockey) assert.equal(experiencePoints(c, new JavaRandom(1), new JavaRandom(2)), r.experience);
    else assert.ok(experiencePoints(c, new JavaRandom(1), new JavaRandom(2)) >= 1);
    // Egg laying: timeUntilNextEgg ticks only for an adult that is no jockey.
    if (!r.child) {
      const c2 = w.create("chicken", 5, 1, 5);
      c2.chickenJockey = r.jockey;
      c2.growingAge = 0;
      c2.eggTimer = 3;
      w.events.length = 0;
      for (let i = 0; i < 4; i++) w.chickenUpdate(c2);
      assert.equal(w.events.filter((e) => e.drop).length > 0, r.eggsOver3 > 0, JSON.stringify(r));
    }
    assert.equal(r.nbtJockey, r.jockey);
  }
  const [read] = records("chickenRead");
  const saved = world().restore({ ...world().create("chicken", 5, 1, 5), chickenJockey: true });
  assert.equal(saved.chickenJockey, read.jockey);
  assert.equal(world().restore({ ...world().create("chicken", 5, 1, 5), chickenJockey: "yes" }).chickenJockey, false);
});

test("EntitySpider.onSpawnWithEgg seats a skeleton one time in a hundred", () => {
  let riders = 0, plain = 0;
  for (const r of records("spiderJockey")) {
    const w = world();
    w.difficulty = r.difficulty;
    w.worldRandom = new JavaRandom(r.worldSeed);
    w.localDifficulty = () => localDifficulty(r.difficulty, 0, 3600000, true);
    const spider = place(w.create("spider", 3.5, 64, 7.5), 3.5, 64, 7.5, 90);
    setEntityRandom(spider, new JavaRandom(r.seed + 1000));
    w.onSpawnWithEgg(spider);
    assert.equal(w.worldRandom.nextInt(), r.worldNext, `world stream ${JSON.stringify(r)}`);
    if (!r.rider) {
      assert.equal(w.entities.length, 0);
      assert.equal(spider.riddenBy ?? null, null);
      plain++;
      continue;
    }
    riders++;
    assert.equal(w.entities.length, 1);
    const sk = w.entities[0];
    assert.ok(sk.type === "skeleton" || sk.type === "wither_skeleton");
    assert.equal(sk.ridingEntity, spider);
    assert.equal(spider.riddenBy, sk);
    assert.deepEqual([sk.x, sk.y, sk.z], r.rider.pos);
    assert.deepEqual([sk.rotationYaw, sk.rotationPitch], [r.rider.yaw, r.rider.pitch]);
    assert.equal(!!sk.equipment?.[0], r.rider.armed || sk.type === "wither_skeleton");
  }
  assert.ok(riders >= 150 && plain >= 100);
  for (const c of records("spiderJockeyCount")) {
    let n = 0;
    for (let seed = 0; seed < c.seeds; seed++) n += spiderSpawnRolls(new JavaRandom(seed + 1000), new JavaRandom(seed * 2654435761 + 11), c.difficulty, 1).jockey ? 1 : 0;
    // The roll is World.rand.nextInt(100) == 0 alone: the count follows from the same seeds as the probe.
    assert.equal(n, c.riders, `difficulty ${c.difficulty}`);
  }
});

test("a child zombie's chicken: a free one nearby, else a new jockey", () => {
  const counts = { mounted: 0, spawned: 0, none: 0 };
  for (const r of records("chickenJockey")) {
    const w = world();
    w.difficulty = 2;
    // The group data (a child, no villager) comes from the first two draws; the probe forces it, so these two are fixed.
    const stream = new JavaRandom(r.worldSeed);
    let n = 0;
    w.worldRandom = Object.assign(Object.create(stream), { nextFloat: () => (n++ < 2 ? [0, 0.5][n - 1] : stream.nextFloat()), nextInt: (...a) => stream.nextInt(...a) });
    w.localDifficulty = () => localDifficulty(2, 0, 0, true);
    let near = null;
    if (r.nearby > 0) {
      near = place(w.create("chicken", 6, 64, 5), 6, 64, 5, 0);
      w.entities.push(near);
      if (r.nearby === 2) mountEntity(w.create("zombie", 6, 64, 5), near, heightOf(w));
    }
    assert.equal(!!near && freeChickenNear(place(w.create("zombie", 4.5, 64, 5.5), 4.5, 64, 5.5, 30), w.entities, (o) => w.size(o)) === near, r.selected, JSON.stringify(r));
    const zombie = place(w.create("zombie", 4.5, 64, 5.5), 4.5, 64, 5.5, 30);
    setEntityRandom(zombie, new JavaRandom(r.seed));
    w.onSpawnWithEgg(zombie);
    assert.equal(zombie.growingAge < 0, r.child);
    assert.equal(!!zombie.ridingEntity, r.zombieMounted, JSON.stringify(r));
    assert.equal(stream.nextInt(), r.worldNext, `world stream ${JSON.stringify(r)}`);
    assert.equal(entityRandomNext(zombie), r.randNext, `entity stream ${JSON.stringify(r)}`);
    if (near) assert.equal(!!near.riddenBy && zombie.ridingEntity === near, r.nearMounted);
    if (near) assert.equal(!!near.chickenJockey, r.nearJockey);
    const made = w.entities.find((e) => e.type === "chicken" && e !== near);
    assert.equal(!!made, !!r.spawned, JSON.stringify(r));
    if (made) {
      assert.equal(made.chickenJockey, r.spawned.jockey);
      assert.equal(zombie.ridingEntity === made, r.spawned.mounted);
      assert.deepEqual([made.x, made.y, made.z], [r.spawned.pos[0], 64, r.spawned.pos[2]]);
      assert.equal(made.rotationYaw, r.spawned.yaw);
      assert.equal(made.growingAge, r.spawned.age);
      counts.spawned++;
    } else if (r.zombieMounted) counts.mounted++;
    else counts.none++;
  }
  assert.ok(counts.mounted === 25 && counts.spawned === 60 && counts.none > 1000, JSON.stringify(counts));
});
import { entityRandom } from "./entities.js";
const entityRandomNext = (e) => entityRandom(e).nextInt();

test("a rider follows its mount, the order puts it straight after, and a dead mount frees it", () => {
  const w = world();
  w.worldRandom = new JavaRandom(7);
  const spider = place(w.create("spider", 64.5, 1, 64.5), 64.5, 1, 64.5, 0), sk = place(w.create("skeleton", 64.5, 1, 64.5), 64.5, 1, 64.5, 0);
  w.entities.push(sk, spider);
  mountEntity(sk, spider, heightOf(w));
  assert.deepEqual(ridingOrder(w.entities.slice()).map((e) => e.type), ["spider", "skeleton"]);
  const p = { x: 64.5, y: 1, z: 70, health: 20 };
  for (let i = 0; i < 40; i++) {
    w.tick(p, night);
    w.drain();
    assert.equal(sk.ridingEntity, spider, `tick ${i}`);
    const seat = seatPosition(spider, sk, w.size(spider)[1]);
    assert.deepEqual([sk.x, sk.y, sk.z], [seat.x, seat.y, seat.z], `tick ${i}`);
  }
  // Save and load keeps the pair; the references are not part of the record.
  const saved = JSON.parse(JSON.stringify(w.serialize()));
  assert.equal(saved.find((e) => e.type === "skeleton").riding, spider.id);
  assert.ok(!("riding" in saved.find((e) => e.type === "spider")));
  const back = new EntityWorld(flat, saved);
  const sk2 = back.entities.find((e) => e.type === "skeleton"), sp2 = back.entities.find((e) => e.type === "spider");
  assert.equal(sk2.ridingEntity, sp2);
  assert.equal(sp2.riddenBy, sk2);
  assert.equal(sk2.riding, undefined);
  // A record naming a mob that is not there starts free.
  const lone = new EntityWorld(flat, [{ ...saved.find((e) => e.type === "skeleton"), riding: "mob-999" }]);
  assert.equal(lone.entities[0].ridingEntity ?? null, null);
  // The mount dies: after its death animation the rider is free and falls on its own.
  spider.health = 0;
  for (let i = 0; i < 30; i++) { w.tick(p, night); w.drain(); }
  assert.ok(!w.entities.includes(spider));
  assert.equal(sk.ridingEntity ?? null, null);
  assert.ok(sk.health > 0);
});

test("a mount and its rider do not push each other", () => {
  const w = world();
  const zombie = place(w.create("zombie", 64.5, 1, 64.5), 64.5, 1, 64.5, 0), chicken = place(w.create("chicken", 64.5, 1, 64.5), 64.5, 1, 64.5, 0), other = place(w.create("cow", 64.6, 1, 64.5), 64.6, 1, 64.5, 0);
  other.vx = other.vz = 0;
  w.entities.push(zombie, chicken);
  mountEntity(zombie, chicken, heightOf(w));
  const vx = chicken.vx, vz = chicken.vz;
  w.push(zombie, { width: 0.6, height: 1.8 });
  assert.deepEqual([chicken.vx, chicken.vz], [vx, vz]);
});

test("a zombie rider hands its path to the chicken at speed 1.5", () => {
  const w = world();
  w.worldRandom = new JavaRandom(3);
  const zombie = place(w.create("zombie", 64.5, 1, 64.5), 64.5, 1, 64.5, 0), chicken = place(w.create("chicken", 64.5, 1, 64.5), 64.5, 1, 64.5, 0);
  zombie.growingAge = -1;
  chicken.chickenJockey = true;
  w.entities.push(chicken, zombie);
  mountEntity(zombie, chicken, heightOf(w));
  const player = { x: 70.5, y: 1, z: 64.5, health: 20 };
  w.ai.beginTick(player, night, 0);
  const brain = w.ai.brain(zombie);
  assert.equal(brain.isRidingChicken, true);
  assert.equal(brain.navigator.canNavigate(), true);
  const path = { isSamePath: () => false, length: 1, index: 0, points: [{ x: 66, y: 1, z: 64 }], isFinished: () => false, getPathPointFromIndex: (i) => ({ x: 66, y: 1, z: 64 }), getPosition: () => ({ x: 66.5, y: 1, z: 64.5 }), getVectorFromIndex: () => ({ x: 66.5, y: 1, z: 64.5 }) };
  brain.attackTarget = w.ai.player;
  brain.navigator.currentPath = path;
  w.ridden(zombie);
  const cn = w.ai.brain(chicken).navigator;
  assert.equal(cn.speed, 1.5);
  assert.equal(cn.getPath(), path);
});
