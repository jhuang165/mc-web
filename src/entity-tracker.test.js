// Batch 40 tracker: EntityTrackerEntry, the tracking list and the client's view of a mob (entity-tracker.js), replayed against the
// executed 1.7.10 classes (tools/probes/TrackerProbe.java, public/research/tracker-reference.json).
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { MobTracker, TrackerEntry, PlayerWatch, ClientEntity, sizeClass, encodeAxis, TRACKER_LIMIT } from "./entity-tracker.js";
import { trackingRange } from "./ring-events.js";
import { moveEntityWithHeading } from "./entities.js";

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-reference.json", import.meta.url), "utf8"));
const cx = (v) => Math.floor(v / 16);
const row = (x, y, z, yaw, pitch, head, air, chg, px, py, pz) => ({ x, y, z, yaw, pitch, head, air, chg, px, py, pz });
// the scenario inputs of TrackerProbe.main, row by row
const SCENARIOS = {
  walkAway: { range: 80, view: 10, n: 1400, at: (t) => row(t < 700 ? 10.3 + 0.12 * t : 10.3 + 0.12 * 700 - 0.12 * (t - 700), 64, 5.7, 90, 0, 90, 0, 0, 0.5, 64, 0.5) },
  negative: { range: 80, view: 10, n: 1500, at: (t) => row(-10.3 - 0.07 * t, 64, -9.6 - 0.09 * t, 45, 0, 45, 0, 0, -0.5, 64, -0.5) },
  events: {
    range: 80, view: 10, n: 1000,
    at: (t) => {
      let x = 4.5, y = 64, yaw = 0, air = 0, chg = 0;
      if (t >= 100 && t < 110) { y = 64 + 0.4 * (t - 100) * (110 - t) / 25.0; air = t === 100 ? 1 : 0; }
      if (t === 150) chg = 1;
      if (t >= 200) yaw = 3;
      if (t >= 220) yaw = 40;
      if (t >= 300) x = 16.5;
      if (t >= 330 && t < 335) x = 16.5 + 0.9 * (t - 329);
      if (t >= 335) x = 21.0;
      return row(x, y, 4.5, yaw, 0, yaw, air, chg, 0.5, 64, 0.5);
    },
  },
  playerWalks: { range: 80, view: 10, n: 1600, at: (t) => row(0.5, 64, 0.5, 0, 0, 0, 0, 0, t < 800 ? -150 + 0.2 * t : -150 + 0.2 * 800 - 0.2 * (t - 800), 64, 0.5) },
  range144: { range: 144, view: 10, n: 1300, at: (t) => row(10.3 + 0.2 * t, 64, 5.7, 0, 0, 0, 0, 0, 0.5, 64, 0.5) },
  chunkGate: { range: 80, view: 2, n: 900, at: (t) => row(60.5, 64, 0.5, 0, 0, 0, 0, 0, 0.5 + 0.2 * t, 64, 0.5) },
};
const KINDS = { hg: "move", hh: "moveLook", hi: "look", ik: "teleport", ht: "head", fz: "spawn", hy: "velocity" };
// the probe's packet as [kind, ...fields] without the entity id
function expected(packets) {
  const out = [];
  for (const p of packets) {
    if (p[0] === "spawn") out.push(["spawn", p[1], p[2], p[3]]);
    else if (p[0] === "destroy") out.push(["destroy"]);
    else if (KINDS[p[0]] === "move") out.push(["move", p[2], p[3], p[4]]);
    else if (KINDS[p[0]] === "moveLook") out.push(["moveLook", p[2], p[3], p[4], p[5], p[6]]);
    else if (KINDS[p[0]] === "look") out.push(["look", p[5], p[6]]);
    else if (KINDS[p[0]] === "teleport") out.push(["teleport", p[2], p[3], p[4], p[5], p[6]]);
    else if (KINDS[p[0]] === "head") out.push(["head", p[2]]);
    else if (KINDS[p[0]] === "velocity") out.push(["velocity", p[2], p[3], p[4]]);
  }
  return out;
}
const flat = (p) => p.type === "velocity" ? ["velocity", p.vx, p.vy, p.vz] : p.type === "spawn" ? ["spawn", p.x, p.y, p.z] : p.type === "destroy" ? ["destroy"] : p.type === "move" ? ["move", p.dx, p.dy, p.dz] : p.type === "moveLook" ? ["moveLook", p.dx, p.dy, p.dz, p.yaw, p.pitch] : p.type === "look" ? ["look", p.yaw, p.pitch] : p.type === "teleport" ? ["teleport", p.x, p.y, p.z, p.yaw, p.pitch] : ["head", p.head];

// Replays one scenario through MobTracker.serverTick and compares every row the probe recorded: packets of the tick, the tracking
// flag, the entry's encoded position and the player's flag. Ticks without a record had no packet and no change.
function replay(name) {
  const sc = SCENARIOS[name], record = ref[name];
  const tracker = new MobTracker(sc.view);
  const mob = { type: name === "range144" ? "ender_dragon" : "chicken", x: 0, y: 0, z: 0, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true };
  const size = () => [0.3, 0.7];
  const player = { x: 0, y: 0, z: 0 };
  let log = [];
  tracker.view.log = (p) => log.push(flat(p));
  const rows = new Map(record.rows.map((r) => [r[0], r]));
  let lastTracking = false, mismatches = 0;
  const seenFlagTicks = [];
  for (let t = 0; t < sc.n; t++) {
    const r = sc.at(t);
    mob.x = r.x; mob.y = r.y; mob.z = r.z; mob.rotationYaw = r.yaw; mob.rotationPitch = r.pitch; mob.rotationYawHead = r.head;
    mob.airBorne = !!r.air; if (r.chg) mob.health++;
    player.x = r.px; player.y = r.py; player.z = r.pz;
    log = [];
    tracker.serverTick([mob], player, size);
    const en = tracker.entries.get(mob), sent = log;
    const playerFlag = tracker.lastFlagged ? 1 : 0;
    const want = rows.get(t);
    const tracking = en.entry.tracked;
    if (want) {
      const got = [t, tracking ? 1 : 0, en.entry.lastX, en.entry.lastY, en.entry.lastZ, playerFlag, sent];
      const exp = [want[0], want[1], want[2], want[3], want[4], want[5], expected(want[6])];
      try { assert.deepEqual(got, exp); } catch (e) { mismatches++; if (mismatches < 4) console.log(name, "tick", t, JSON.stringify(got), JSON.stringify(exp)); }
    } else {
      if (sent.length || tracking !== lastTracking || playerFlag) { mismatches++; if (mismatches < 4) console.log(name, "unrecorded tick", t, JSON.stringify(sent), tracking, playerFlag); }
    }
    lastTracking = tracking;
    tracker.clientTick();
  }
  return mismatches;
}

for (const name of Object.keys(SCENARIOS)) {
  test(`tracker replay ${name} matches the executed EntityTrackerEntry`, () => {
    assert.equal(replay(name), 0);
  });
}

test("entity size rounding is Entity$EnumEntitySize.getXPosition", () => {
  const { values, rows } = ref.sizes;
  rows.forEach((row, s) => values.forEach((v, i) => assert.equal(encodeAxis(s + 1, v), row[i], `size ${s + 1} value ${v}`)));
  assert.equal(sizeClass(0.3), 1);
  assert.equal(sizeClass(0.6), 2);
  assert.equal(sizeClass(0.9), 3);
  assert.equal(sizeClass(1.4), 5);
});

test("the integrated server clamps tracking ranges to 144", () => {
  assert.equal(TRACKER_LIMIT, ref.bytecodeRead.trackerLimitValue);
  const tracker = new MobTracker();
  const dragon = { type: "ender_dragon", x: 0, y: 64, z: 0, rotationYaw: 0 };
  tracker.update([dragon], { x: 0, y: 64, z: 0 }, () => [16, 8]);
  assert.equal(tracker.entries.get(dragon).entry.range, 144);
  assert.equal(trackingRange("ender_dragon"), 160);
  const zombie = { type: "zombie", x: 0, y: 64, z: 0 };
  tracker.update([zombie], { x: 0, y: 64, z: 0 }, () => [0.6, 1.8]);
  assert.equal(tracker.entries.get(zombie).entry.range, 80);
});

test("the client entity follows S14 and S18 with the three step interpolation", () => {
  const c = new ClientEntity();
  c.apply({ type: "spawn", x: 320, y: 2048, z: 640 });
  assert.deepEqual([c.x, c.y, c.z], [10, 64, 20]);
  c.apply({ type: "move", dx: 6, dy: 0, dz: -3 });
  assert.equal(c.sx, 326);
  c.step(); // pos += (target - pos) / 3
  assert.ok(Math.abs(c.x - (10 + (326 / 32 - 10) / 3)) < 1e-12);
  c.step(); c.step();
  assert.ok(Math.abs(c.x - 326 / 32) < 1e-12, "reached after three steps");
  c.apply({ type: "teleport", x: 0, y: 64, z: 0 });
  assert.equal(c.ty, 64 / 32 + 0.015625);
  c.apply({ type: "destroy" });
  assert.equal(c.present, false);
});

test("a destroy reaches the client entity one tick after the tracking list drops it", () => {
  const tracker = new MobTracker(10);
  const mob = { type: "zombie", x: 70.5, y: 64, z: 0.5, rotationYaw: 0, health: 20, onGround: true };
  const player = { x: 0.5, y: 64, z: 0.5 };
  tracker.update([mob], player, () => [0.6, 1.8]);
  assert.ok(tracker.clientOf(mob, 0.6), "inside 80 blocks: the client has it");
  // The list is re-evaluated only when the mob has moved more than 4 blocks from its last evaluation, and the test uses the encoded position
  // sent so far: a jump to 100 blocks is evaluated with the old position (still tracked), the next 5 blocks of walking evaluate the new one.
  mob.x = 100.5;
  for (let i = 0; i < 3; i++) tracker.update([mob], player, () => [0.6, 1.8]);
  assert.equal(tracker.entries.get(mob).entry.tracked, true, "the jump was evaluated against the old encoded position");
  mob.x = 105.5;
  let ticks = 0;
  while (tracker.entries.get(mob).entry.tracked && ticks++ < 6) { tracker.serverTick([mob], player, () => [0.6, 1.8]); if (tracker.entries.get(mob).entry.tracked) tracker.clientTick(); }
  assert.equal(tracker.entries.get(mob).entry.tracked, false);
  assert.ok(ticks <= 3, "within one update period (3 ticks)");
  tracker.clientTick();
  assert.ok(tracker.entries.get(mob).client.present, "the destroy is flushed by the player's next update");
  tracker.update([mob], player, () => [0.6, 1.8]);
  assert.equal(tracker.entries.get(mob).client.present, false);
});

test("PlayerWatch: the watched square moves with the managed position", () => {
  const w = new PlayerWatch(2);
  w.update({ x: 0.5, z: 0.5 });
  assert.ok(w.watches(2, 2) && !w.watches(3, 0));
  w.update({ x: 7, z: 0.5 }); // 6.5 blocks: below the 8 block threshold
  assert.equal(w.cx, 0);
  w.update({ x: 16.5, z: 0.5 }); // 16 blocks away and in chunk 1
  assert.equal(w.cx, 1);
  assert.ok(w.watches(3, 0));
  w.update({ x: -0.5, z: 0.5 }); // (int) -0.5 >> 4 is chunk 0: truncation toward zero, as the bytecode does
  assert.equal(w.cx, 0);
});

test("class hashes recorded for the executed and bytecode-read classes", () => {
  for (const c of ["my", "mn", "mq", "se", "bjb", "sv", "bsw"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
  assert.equal(ref.classes.my.name, "EntityTrackerEntry");
});

// ---- the sound filter in EntityWorld.drainClientSounds ----
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { Survival } from "./survival.js";

function setup() {
  const world = new World("17", "javaStreamed", 12);
  world.blockLight = () => 0;
  const ring = new HeadlessColumns(world, { generate: (a, b) => world.generateTerrainChunk(a, b), perTick: 1000, every: 1 });
  ring.update(4, 4);
  attachRing(world, ring);
  const r = new JavaRandom(5);
  const mobs = new EntityWorld(world, [], () => r.nextDouble());
  mobs.worldRandom = new JavaRandom(9);
  mobs.entitySeed = (q) => q.seed;
  mobs.ring = ring;
  mobs.lightAt = () => 0; mobs.thunderLightAt = () => 0; mobs.fullLightAt = () => 0; mobs.skyLightAt = () => 0;
  mobs.lightSubtracted = () => 11; mobs.isThundering = () => false; mobs.isDaytime = () => true;
  mobs.naturalSpawning = false;
  mobs.difficulty = 2;
  return { world, ring, mobs };
}

test("the dragon's wing sound is client-only: it needs the client's entity, whose range the integrated server clamps to 144", () => {
  const { mobs } = setup();
  const near = mobs.create("ender_dragon", 100, 100, 40), far = mobs.create("ender_dragon", 100 + 150, 100, 40);
  const player = { x: 100, y: 80, z: 40 };
  mobs.watching = player;
  mobs.clientSounds = [near, far].map((e) => ({ sound: "mob.enderdragon.wings", volume: 5, pitch: 0.9, position: e, clientOnly: true }));
  const kept = mobs.drainClientSounds();
  assert.equal(kept.length, 1, "150 blocks out is past the 144 clamp (the table says 160)");
  assert.deepEqual([kept[0].position.x, kept[0].position.z], [100, 40]);
});

test("a status sound plays where the client's entity is, not where the live mob is", () => {
  const { ring, mobs } = setup();
  const player = { x: 100, y: 80, z: 40 };
  const e = mobs.create("zombie", 110.3, 70, 40.2);
  mobs.entities.push(e);
  mobs.watching = player;
  const size = () => [0.6, 1.8];
  mobs.tracker = new MobTracker(10);
  mobs.tracker.update(mobs.entities, player, size); // the spawn packet: 110.3 * 32 = 3529.6 -> 3529 or 3530 by the size class
  // the zombie walks 1.3 blocks within the next ticks; the client entity trails by the update period and the interpolation
  let lag = 0;
  for (let t = 1; t <= 12; t++) {
    e.x = 110.3 + 0.13 * t;
    mobs.tracker.update(mobs.entities, player, size);
    mobs.clientSounds = [{ sound: "mob.zombie.hurt", volume: 1, pitch: 1, position: e }];
    const [s] = mobs.drainClientSounds();
    lag = Math.max(lag, e.x - s.position.x);
    assert.ok(s.position.x <= e.x + 1 / 32, "never ahead of the live mob");
  }
  assert.ok(lag > 0.05 && lag < 0.8, `the client position trails the live one by ${lag.toFixed(3)} blocks`);
  void ring;
});

test("a mob far from the player produces no client sound, and its tracking survives the walk across the range edge as the tracker decides", () => {
  const { mobs } = setup();
  const player = { x: 100, y: 80, z: 40 };
  const e = mobs.create("zombie", 100 + 79, 70, 40);
  mobs.entities.push(e);
  mobs.watching = player;
  const size = () => [0.6, 1.8];
  mobs.tracker = new MobTracker(10);
  const heard = [];
  for (let t = 0; t < 200; t++) {
    e.x = 100 + 79 + 0.15 * t; // leaves the 80 block square at tick 7 and walks on
    mobs.tracker.update(mobs.entities, player, size);
    mobs.clientSounds = [{ sound: "mob.zombie.hurt", volume: 1, pitch: 1, position: e }];
    heard.push(mobs.drainClientSounds().length);
  }
  const last = heard.lastIndexOf(1);
  assert.ok(last >= 7, "still tracked after it passed 80 blocks: the list is re-evaluated only after 4 more blocks of walking");
  assert.ok(last < 80, "but gone well before 30 blocks past the edge");
  void Survival;
});

// Client scenarios: the executed EntityChicken on a remote world double receives the packets the executed EntityTrackerEntry sends
// (TrackerProbe clientWalk, clientKnock, clientFall, clientTeleport, clientSpawn, clientUnloaded); the browser port replays the recorded
// server inputs (position and motion per tick) and must reproduce the packets and the client entity's position, motion and previous
// position every tick.
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0 };
const UNLOADED = { clientUnloaded: [35, 60] };
function replayClient(name) {
  const record = ref[name], rows = new Map(record.rows.map((r) => [r[0], r]));
  const tracker = new MobTracker(10);
  const mob = { type: "chicken", x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true };
  const player = { x: 0.5, y: 0, z: 0.5 };
  let unloaded = false, log = [], worst = 0, bad = 0;
  tracker.view.log = (p) => log.push(flat(p));
  const physics = (c) => { c.clientUnloaded = unloaded; moveEntityWithHeading(grass, c, 0.3, 0.7, 0); };
  record.inputs.forEach((inp, t) => {
    [mob.x, mob.y, mob.z, mob.vx, mob.vy, mob.vz] = inp;
    mob.airBorne = !!inp[6]; mob.velocityChanged = !!inp[7];
    const [from, to] = UNLOADED[name] ?? [-1, -1];
    unloaded = t >= from && t < to;
    log = [];
    tracker.serverTick([mob], player, () => [0.3, 0.7]);
    const want = rows.get(t);
    if (want) assert.deepEqual(log, expected(want[6]), `${name} packets at tick ${t}`);
    else assert.deepEqual(log, [], `${name} unrecorded packets at tick ${t}`);
    tracker.clientTick(physics);
    const c = tracker.clientIfTracked(mob), w = record.client[t];
    if (!w[0]) { assert.equal(c, null, `${name} tick ${t}: no client entity yet`); return; }
    assert.ok(c, `${name} tick ${t}: client entity`);
    const got = [c.x, c.y, c.z, c.vx, c.vy, c.vz, c.px, c.py, c.pz], exp = [w[1], w[2], w[3], w[4], w[5], w[6], w[8], w[9], w[10]];
    got.forEach((v, i) => { const d = Math.abs(v - exp[i]); worst = Math.max(worst, d); if (d > 1e-9) bad++; });
    assert.equal(c.onGround, w[7], `${name} tick ${t}: onGround`);
  });
  assert.equal(bad, 0, `${name}: ${bad} client values differ (worst ${worst})`);
  return record.inputs.length;
}
for (const name of ["clientWalk", "clientKnock", "clientFall", "clientTeleport", "clientSpawn", "clientUnloaded"]) {
  test(`client replay ${name} matches the executed client entity`, () => {
    assert.ok(replayClient(name) >= 80);
  });
}

test("a velocity packet comes before the position packet and carries (int)(m * 8000) clamped to 3.9", () => {
  const packets = [];
  const view = { player: { x: 0, z: 0 }, watches: () => true, log: (p) => packets.push(p) };
  const e = { x: 0.5, y: 64, z: 0.5, vx: 0, vy: 0, vz: 0, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0 };
  const entry = new TrackerEntry(e, { range: 80 }, view);
  entry.sendLocation(); // tick 0 starts tracking
  packets.length = 0;
  for (let i = 0; i < 3; i++) entry.sendLocation();
  assert.deepEqual(packets, []);
  e.x = 1.5; e.vx = 5; e.vy = -0.0001;
  entry.sendLocation(); entry.sendLocation(); entry.sendLocation();
  assert.deepEqual(packets.map((p) => p.type), ["velocity", "move"]);
  assert.deepEqual([packets[0].vx, packets[0].vy], [31200, 0]);
});

test("Entity.velocityChanged sends the motion at once and clears the flag", () => {
  const packets = [];
  const view = { player: { x: 0, z: 0 }, watches: () => true, log: (p) => packets.push(p) };
  const e = { x: 0.5, y: 64, z: 0.5, vx: 0.4, vy: 0.4, vz: 0, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, velocityChanged: true };
  const entry = new TrackerEntry(e, { range: 80 }, view);
  entry.sendLocation();
  packets.length = 0;
  e.velocityChanged = true;
  entry.sendLocation(); // tick 1: not a frequency tick
  assert.deepEqual(packets.map((p) => p.type), ["velocity"]);
  assert.equal(e.velocityChanged, false);
});

test("the crosshair picks a tracked mob where its client entity stands (EntityRenderer.getMouseOver on the client world)", () => {
  const { mobs } = setup();
  const player = { x: 100, y: 80, z: 40 };
  const e = mobs.create("zombie", 110.3, 70, 40.5);
  mobs.entities.push(e);
  mobs.watching = player;
  const size = () => [0.6, 1.8];
  mobs.tracker = new MobTracker(10);
  mobs.tracker.update(mobs.entities, player, size);
  for (let t = 1; t <= 6; t++) { e.x = 110.3 + 0.13 * t; mobs.tracker.update(mobs.entities, player, size); }
  const c = mobs.clientPosition(e);
  assert.ok(c && e.x - c.x > 0.2, `the client trails the live mob (${(e.x - (c?.x ?? 0)).toFixed(3)})`);
  const down = { x: 0, y: -1, z: 0 };
  assert.equal(mobs.pick({ x: c.x, y: 72.5, z: 40.5 }, down, 6)?.entity, e, "the client position is hit");
  assert.equal(mobs.pick({ x: e.x + 0.29, y: 72.5, z: 40.5 }, down, 6), null, "the live front edge is past the client box");
});
