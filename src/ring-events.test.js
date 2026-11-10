// Batch 38 (natural-spawning.md "Batch 38"): events of ring mobs and ring entities reach the player under the native broadcast and
// tracking rules (ring-events.js), loot pickup and fireballs follow the 32-block update test.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { Survival } from "./survival.js";
import { reachesPlayer } from "./sound-origin.js";
import { trackingRange, trackedWithin, tracksMob, explosionReaches, ROCKET_TRACKING, EXPLOSION_PACKET_RANGE_SQ } from "./ring-events.js";
import { drainMobEvents } from "./living-simulation.js";
import { applyExplosion } from "./explosion-simulation.js";
import { FireworkRockets } from "./fireworks-live.js";
import { ringEntityActive } from "./streaming-ticks.js";
import { toLiveStack } from "./mob-equipment-live.js";

const silence = (w) => { w.blockLight = () => 0; return w; };
const seeded = (seed) => { const r = new JavaRandom(seed); return () => r.nextDouble(); };
const player = (x = 72.5, z = 72.5) => ({ x, y: 80, z, alive: true, width: 0.6, height: 1.8 });
function setup() {
  const world = silence(new World("17", "javaStreamed", 12));
  const ring = new HeadlessColumns(world, { generate: (cx, cz) => world.generateTerrainChunk(cx, cz), perTick: 1000, every: 1 });
  ring.update(4, 4);
  attachRing(world, ring);
  const mobs = new EntityWorld(world, [], seeded(5));
  mobs.worldRandom = new JavaRandom(9);
  mobs.entitySeed = (r) => r.seed;
  mobs.ring = ring;
  mobs.lightAt = () => 0; mobs.thunderLightAt = () => 0; mobs.fullLightAt = () => 0; mobs.skyLightAt = () => 0;
  mobs.lightSubtracted = () => 11; mobs.isThundering = () => false; mobs.isDaytime = () => true;
  mobs.naturalSpawning = false;
  mobs.difficulty = 2;
  return { world, ring, mobs };
}
const surface = (ring, x, z) => { let y = 200; while (y > 0 && !ring.get(x, y, z)) y--; return y + 1; };

test("tracking ranges are the bytecode-read ones and a client tracks inside the square", async () => {
  const ref = JSON.parse(await readFile(new URL("../public/research/ring-events-reference.json", import.meta.url), "utf8"));
  const t = ref.trackEntity;
  assert.deepEqual([trackingRange("zombie"), trackingRange("squid"), trackingRange("ender_dragon"), trackingRange("ender_crystal")], [t.IAnimals[0], t.EntitySquid[0], t.EntityDragon[0], t.EntityEnderCrystal[0]]);
  assert.equal(ROCKET_TRACKING, t.EntityFireworkRocket[0]);
  assert.equal(EXPLOSION_PACKET_RANGE_SQ, ref.explosionS27.rangeSquared);
  assert.equal(trackingRange("zombie"), 80);
  assert.equal(trackingRange("ghast"), 80);
  assert.equal(trackingRange("squid"), 64);
  assert.equal(trackingRange("ender_dragon"), 160);
  const p = { x: 0, z: 0 };
  assert.ok(trackedWithin(80, 80, 80, p), "the corner of the square is inside");
  assert.ok(!trackedWithin(80, 80.01, 0, p));
  assert.ok(tracksMob({ type: "zombie", x: -80, z: 79 }, p));
  assert.ok(!tracksMob({ type: "squid", x: 65, z: 0 }, p));
  assert.ok(explosionReaches(63.9, 0, 0, { x: 0, y: 0, z: 0 }));
  assert.ok(!explosionReaches(64, 0, 0, { x: 0, y: 0, z: 0 }), "strictly below 4096");
  assert.ok(!explosionReaches(0, 40, 50, { x: 0, y: 0, z: 0 }), "vertical distance counts");
});

// A ring mob's sounds go through drainMobEvents like a window mob's, then the S29 test (sound-origin.js, what SoundBank.play applies).
function ringSounds(type, x, z, ticks, feet) {
  const { ring, mobs } = setup();
  const y = surface(ring, x, z);
  const e = mobs.create(type, x + 0.5, y, z + 0.5);
  mobs.entities.push(e);
  assert.ok(!mobs.world.isTicking(e.x, e.z) && mobs.isActive(e), "the mob is outside the ticking window and updates in the ring");
  const heard = [], dropped = [];
  for (let t = 0; t < ticks; t++) {
    mobs.tick(player(), new Survival());
    drainMobEvents({ mobs, xpOrbs: { spawn() {} }, items: { dropMob() {} } }, { sound: (ev) => { (reachesPlayer(ev.sound, ev.position, ev.volume, feet) ? heard : dropped).push(ev); } });
  }
  return { heard, dropped, e };
}

test("ring ghast sounds (volume above 1) are heard within 16 * volume blocks and not beyond; quiet ring mobs only within 16", () => {
  const near = ringSounds("ghast", 150, 40, 1500, { x: 150, y: 90, z: 40 });
  const all = near.heard.length + near.dropped.length;
  assert.ok(all > 0, "a ring ghast makes positioned sounds (they are kept, not dropped)");
  assert.ok(near.heard.length > 0, "a listener at the ghast hears them");
  const ev = near.heard.find((s) => s.volume > 1);
  assert.ok(ev, "a sound above volume 1 (ghast scream or moan, volume 10)");
  const v = ev.volume, range = v > 1 ? 16 * v : 16;
  for (const [d, audible] of [[range - 1, true], [range + 1, false], [40, v > 2.5], [100, v > 6.25]]) {
    const feet = { x: ev.position.x + d, y: ev.position.y, z: ev.position.z };
    assert.equal(reachesPlayer(ev.sound, ev.position, v, feet), audible, `${ev.sound} volume ${v} at ${d} blocks`);
  }
  const zombie = ringSounds("zombie", 150, 40, 600, { x: 150 + 40, y: 80, z: 40 });
  assert.equal(zombie.heard.length, 0, "a ring zombie 40 blocks away is not audible (range 16)");
  assert.ok(zombie.dropped.length > 0, "its sounds were produced, then range-filtered (step sounds)");
});

test("hurt and death sounds a client plays for status 2 and 3 need the mob inside its tracking square", () => {
  const { ring, mobs } = setup();
  const y = surface(ring, 150, 40);
  const near = mobs.create("zombie", 100, y, 40), far = mobs.create("zombie", 200, y, 40), squid = mobs.create("squid", 170, y, 40);
  mobs.watching = { x: 100, y: 80, z: 40 };
  mobs.clientSounds = [near, far, squid].map((e) => ({ sound: "mob.zombie.hurt", volume: 1, pitch: 1, position: e }));
  const kept = mobs.drainClientSounds().map((s) => s.position);
  // the sound plays at the client's entity, the tracker's encoded position (1/32 block), not the live one
  assert.equal(kept.length, 1, "the far zombie is 100 blocks out; the squid is 70 out (past its 64) where a zombie would still be tracked (80)");
  assert.ok(Math.abs(kept[0].x - near.x) <= 1 / 32 && Math.abs(kept[0].z - near.z) <= 1 / 32 && Math.abs(kept[0].y - near.y) <= 1 / 32);
  assert.equal(mobs.clientSounds.length, 0);
  mobs.watching = null;
  mobs.clientSounds = [{ sound: "mob.zombie.hurt", volume: 1, pitch: 1, position: far }];
  assert.equal(mobs.drainClientSounds().length, 1, "no listener, no filter");
});

test("the explosion burst (huge explosion particle, exempt from the 16-block cull) needs the player within 64 blocks (S27)", () => {
  const run = (x) => {
    const world = new World("flat", "flat", 8);
    const bursts = [], sounds = []; let thrown = null;
    const state = { world, weather: { random: new JavaRandom(1) }, mobs: { entities: [] }, items: { explode() {}, spill() {} }, xpOrbs: { explode() {} }, arrows: { explode() {} }, projectiles: { explode() {} }, falling: { explode() {} }, primed: [], hanging: { explode() {} },
      survival: new Survival(), position: { x: 0, y: 70, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} } };
    try { applyExplosion(state, { x, y: 70, z: 0, size: 4 }, { burst: (...a) => bursts.push(a), sound: (n, o) => sounds.push([n, o]) }); } catch (e) { thrown = e; }
    return { bursts, sounds, thrown };
  };
  const near = run(63), far = run(65);
  for (const r of [near, far]) assert.equal(r.thrown, null, String(r.thrown?.stack));
  assert.equal(near.bursts.length, 1);
  assert.equal(far.bursts.length, 0, "no S27 beyond 64 blocks: no particle, no draws");
  assert.equal(far.sounds.length, 1, "the sound keeps its own S29 test (64 blocks at volume 4)");
});

test("a firework rocket waits outside the 32-block loaded test and its blast shows only to a client within 64 blocks", () => {
  const { world, ring } = setup();
  const rockets = new FireworkRockets();
  const frozen = rockets.launch(13 * 16 + 4, 120, 70, null), live = rockets.launch(12 * 16 + 4, 120, 70, null);
  const events = [];
  const hooks = { ringActive: (r) => ringEntityActive(world, r), tracked: (r) => Math.abs(r.x - 72) <= 64 && Math.abs(r.z - 72) <= 64, explode: (...a) => events.push(a) };
  const before = [frozen.life, live.life];
  for (let i = 0; i < 4; i++) rockets.tick(world, hooks);
  assert.equal(frozen.life, before[0], "chunk 13 fails the 5 x 5 test");
  assert.notEqual(live.life, before[1], "chunk 12 updates");
  void ring;
});

test("loot pickup runs only for mobs that update: a ring mob at the rim (no 32-block surroundings) keeps the item, one in the ring takes it", () => {
  const { ring, mobs } = setup();
  const make = (cx) => {
    const x = cx * 16 + 4.5, z = 70.5, y = surface(ring, Math.floor(x), 70);
    const e = mobs.create("zombie", x, y, z);
    e.canPickUpLoot = true; e.equipment = [null, null, null, null, null]; e.dropChances = Array(5).fill(0.085);
    const live = toLiveStack({ id: 267, count: 1, damage: 0 });
    const item = { stack: { id: live.id, count: 1, damage: 0 }, x, y, z, dead: false };
    mobs.entities.push(e);
    return { e, item };
  };
  const inRing = make(12), rim = make(13);
  assert.ok(mobs.isActive(inRing.e) && !mobs.isActive(rim.e), "chunk 12 passes the 5 x 5 test, chunk 13 does not");
  mobs.lootItems = { items: [inRing.item, rim.item], box: (i) => [i.x - 0.125, i.y, i.z - 0.125, i.x + 0.125, i.y + 0.25, i.z + 0.125] };
  for (let i = 0; i < 3; i++) mobs.tick(player(), new Survival());
  assert.equal(inRing.e.equipment[0]?.id, 267, "the ring zombie picked the sword up");
  assert.equal(inRing.item.dead, true);
  assert.equal(rim.e.equipment[0], null, "the frozen rim zombie did not");
  assert.equal(rim.item.dead, false);
});
