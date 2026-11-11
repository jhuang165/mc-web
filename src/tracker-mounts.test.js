// Batch 43: mounts, riders and leash holders on the client (entity-tracker.js), replayed against the executed 1.7.10 classes
// (tools/probes/TrackerMountsProbe.java -> public/research/tracker-mounts-reference.json). The client entities there are real EntityPig,
// EntityChicken, EntitySpider, EntityZombie and EntitySkeleton objects on a client world double that receive the packets the executed
// EntityTrackerEntry sends; the browser port replays the recorded server inputs and must reproduce the attach packets and every client
// value (position, previous position, riding link, motion, leash holder, yaw, pitch, body yaw, head yaw) each tick.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { MobTracker, TrackerEntry, ClientEntity } from "./entity-tracker.js";
import { moveEntityWithHeading, clientBodyTurn } from "./entities.js";
import { mountEntity } from "./mob-riding.js";

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-mounts-reference.json", import.meta.url), "utf8"));
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0 };
const SIZES = { pig: [0.9, 0.9], chicken: [0.3, 0.7], spider: [1.4, 0.9], zombie: [0.6, 1.8], skeleton: [0.6, 1.8] };
const CASES = {
  ridePig: { mount: "pig", rider: "zombie" },
  rideChicken: { mount: "chicken", rider: "zombie" },
  rideSpider: { mount: "spider", rider: "skeleton" },
  riderFirst: { mount: "pig", rider: "zombie", riderFirst: true },
  leash: { mount: "pig", rider: "zombie", leash: true },
};
const KINDS = { hg: "move", hh: "moveLook", hi: "look", ik: "teleport", ht: "head", fz: "spawn", hy: "velocity" };
// the probe's packet of a tick as [index, kind, ...fields]; the metadata and property packets (hw, il) are not modelled
function expected(packets) {
  const out = [];
  for (const p of packets) {
    const k = KINDS[p[0]];
    if (p[0] === "attach") out.push(["attach", p[1], p[2], p[3]]);
    else if (p[0] === "spawn") out.push([p[1], "spawn", p[2], p[3], p[4], p[5], p[6], p[7]]);
    else if (k === "move") out.push([p[1], "move", p[2], p[3], p[4]]);
    else if (k === "moveLook") out.push([p[1], "moveLook", p[2], p[3], p[4], p[5], p[6]]);
    else if (k === "look") out.push([p[1], "look", p[5], p[6]]);
    else if (k === "teleport") out.push([p[1], "teleport", p[2], p[3], p[4], p[5], p[6]]);
    else if (k === "head") out.push([p[1], "head", p[2]]);
    else if (k === "velocity") out.push([p[1], "velocity", p[2], p[3], p[4]]);
  }
  return out;
}

function replay(name) {
  const record = ref.cases[name], spec = CASES[name];
  const live = [spec.mount, spec.rider].map((type, i) => ({ type, uuid: `u${i}`, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, renderYawOffset: 0, health: 10, onGround: true }));
  const [mount, rider] = live;
  const index = (e) => live.indexOf(e);
  const tracker = new MobTracker(10);
  const events = new Map(record.events);
  let log = [];
  const emit = TrackerEntry.prototype.emit;
  TrackerEntry.prototype.emit = function (p) {
    log.push(p.type === "attach" ? ["attach", p.mode, index(p.entity), p.mode === 0 ? (p.vehicle ? index(p.vehicle) : -1) : p.holder ? index(live.find((m) => m.uuid === p.holder.uuid)) : -1] : p.type === "destroy" ? ["destroy"]
      : p.type === "spawn" ? [index(this.e), "spawn", p.x, p.y, p.z, p.vx, p.vy, p.vz] : p.type === "move" ? [index(this.e), "move", p.dx, p.dy, p.dz]
      : p.type === "moveLook" ? [index(this.e), "moveLook", p.dx, p.dy, p.dz, p.yaw, p.pitch] : p.type === "look" ? [index(this.e), "look", p.yaw, p.pitch]
      : p.type === "teleport" ? [index(this.e), "teleport", p.x, p.y, p.z, p.yaw, p.pitch] : p.type === "head" ? [index(this.e), "head", p.head] : [index(this.e), "velocity", p.vx, p.vy, p.vz]);
    return emit.call(this, p);
  };
  const player = { x: 0.5, y: 0, z: 0.5 };
  const size = (e) => SIZES[e.type];
  const physics = Object.assign((c, e) => { c.clientUnloaded = false; moveEntityWithHeading(grass, c, SIZES[e.type][0], SIZES[e.type][1], 0); }, { turn: clientBodyTurn });
  let bad = 0, worst = 0;
  try {
    record.inputs.forEach((inp, t) => {
      const [mx, my, mz, yaw, vx, vy, vz, mounted] = inp, [rx, ry, rz] = inp.slice(-3);
      Object.assign(mount, { x: mx, y: my, z: mz, vx, vy, vz, rotationYaw: yaw, rotationYawHead: yaw, renderYawOffset: yaw });
      Object.assign(rider, { x: rx, y: ry, z: rz });
      if (mounted) { if (rider.ridingEntity !== mount) mountEntity(rider, mount, (m) => SIZES[m.type][1]); } else if (rider.ridingEntity) mountEntity(rider, null, (m) => SIZES[m.type][1]);
      if (spec.leash) mount.leash = inp[9] ? { holder: "mob", holderUuid: rider.uuid } : undefined;
      // the entries run in list order: riderFirst puts the rider ahead of its mount
      const order = spec.riderFirst ? [rider, mount] : [mount, rider];
      log = [];
      tracker.serverTick(order, player, size);
      const want = events.has(t) ? expected(events.get(t)) : [];
      assert.deepEqual(log, want, `${name} packets at tick ${t}`);
      tracker.clientTick(physics);
      const row = record.client[t];
      row.forEach((w, i) => {
        const c = tracker.clientIfTracked(live[i]);
        if (!w[0]) { assert.equal(c, null, `${name} tick ${t}: client entity ${i} not there yet`); return; }
        assert.ok(c, `${name} tick ${t}: client entity ${i}`);
        const got = [c.x, c.y, c.z, c.px, c.py, c.pz, c.vx, c.vy, c.vz, c.rotationYaw, c.rotationPitch, c.renderYawOffset, c.rotationYawHead];
        const exp = [w[1], w[2], w[3], w[4], w[5], w[6], w[9], w[10], w[11], w[13], w[14], w[15], w[16]];
        got.forEach((v, k) => { const d = Math.abs(v - exp[k]); worst = Math.max(worst, d); if (d > 1e-9) { bad++; if (bad < 6) console.log(`${name} t${t} entity ${i} field ${k}: got ${v} want ${exp[k]}`); } });
        assert.equal(c.onGround, w[8], `${name} tick ${t}: onGround ${i}`);
        const riding = c.ridingEntity ? index(tracker.liveOf(c.ridingEntity)) : -1;
        assert.equal(riding, w[7], `${name} tick ${t}: riding ${i}`);
        const holder = c.leash?.type ? index(tracker.liveOf(c.leash)) : -1;
        assert.equal(holder, w[12], `${name} tick ${t}: leash holder ${i}`);
      });
    });
  } finally { TrackerEntry.prototype.emit = emit; }
  assert.equal(bad, 0, `${name}: ${bad} client values differ (worst ${worst})`);
  return record.inputs.length;
}
for (const name of Object.keys(CASES)) {
  test(`client replay ${name} matches the executed client entities`, () => {
    assert.ok(replay(name) >= 100);
  });
}

// ---- EntityWorld wiring: the drawn positions, the rope and the player's own mount ----
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { seatPosition } from "./mob-riding.js";

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
function pair() {
  const { mobs } = setup();
  const pig = mobs.create("pig", 100.5, 70, 40.5), zombie = mobs.create("zombie", 100.5, 70, 40.5);
  mobs.entities.push(pig, zombie);
  mountEntity(zombie, pig, (m) => mobs.size(m)[1]);
  const player = { x: 100, y: 80, z: 40 };
  mobs.watching = player;
  mobs.tracker = new MobTracker(10);
  const size = (m) => mobs.size(m);
  return { mobs, pig, zombie, player, size, tick: () => mobs.tracker.update(mobs.entities, player, size, mobs.clientPhysics ??= Object.assign((c, m) => mobs.moveClient(c, m), { pre: (c, m) => mobs.clientEnvironment(c, m) })) };
}

test("a mob riding a mob is drawn where the client's updateRiderPosition put it, not at the live rider", () => {
  const { mobs, pig, zombie, tick } = pair();
  for (let t = 0; t < 12; t++) { pig.x += 0.13; zombie.x = pig.x; tick(); }
  const cp = mobs.clientPosition(pig), cz = mobs.clientPosition(zombie);
  assert.ok(cp && cz, "both have client entities");
  const seat = seatPosition(cp, zombie, mobs.size(pig)[1]);
  assert.equal(cz.x, seat.x); assert.equal(cz.y, seat.y); assert.equal(cz.z, seat.z);
  assert.ok(pig.x - cp.x > 0.1, "the mount trails its live position");
  assert.equal(zombie.x, pig.x, "the live rider stays on the live mount");
});

test("a mount the player rides keeps its live position (the camera follows it)", () => {
  const { mobs, pig, tick } = pair();
  tick();
  pig.rider = { vehicle: { entity: pig } };
  assert.equal(mobs.clientPosition(pig), null);
});

test("the lead rope runs between client positions: a holder mob is drawn at its client entity", () => {
  const { mobs, pig, zombie, tick } = pair();
  mountEntity(zombie, null, (m) => mobs.size(m)[1]); // free them
  zombie.uuid = "holder-1";
  tick(); // both are tracked; the leash then goes out at once (S1B(1) at setLeashedToEntity)
  pig.leash = { holder: "mob", holderUuid: "holder-1" };
  for (let t = 0; t < 12; t++) { pig.x += 0.13; zombie.x += 0.13; tick(); }
  const views = mobs.gearViews();
  const vp = views[mobs.entities.indexOf(pig)], vz = views[mobs.entities.indexOf(zombie)];
  const cp = mobs.clientPosition(pig), cz = mobs.clientPosition(zombie);
  assert.deepEqual([vp.x, vp.z, vz.x, vz.z], [cp.x, cp.z, cz.x, cz.z]);
  assert.ok(vp.leash, "the client has the holder, so the rope is drawn");
  assert.notEqual(vz, zombie, "a holder gets a view");
});

test("the client entity's water check runs before its motion and uses the client entity's own box", () => {
  const order = [];
  const c = new ClientEntity("pig"); c.present = true; c.x = 5; c.vy = 0.1;
  c.step((cl) => order.push(["move", cl.inWater]), null, (cl) => { cl.inWater = true; order.push(["pre"]); });
  assert.deepEqual(order, [["pre"], ["move", true]]);
});
