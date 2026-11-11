// Batch 43: mounts, riders and leash holders on the client (entity-tracker.js), replayed against the executed 1.7.10 classes
// (tools/probes/TrackerMountsProbe.java -> public/research/tracker-mounts-reference.json). The client entities there are real EntityPig,
// EntityChicken, EntitySpider, EntityZombie and EntitySkeleton objects on a client world double that receive the packets the executed
// EntityTrackerEntry sends; the browser port replays the recorded server inputs and must reproduce the attach packets and every client
// value (position, previous position, riding link, motion, leash holder, yaw, pitch, body yaw, head yaw) each tick.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { MobTracker, TrackerEntry, ClientEntity } from "./entity-tracker.js";
import { mountEntity } from "./mob-riding.js";
import { movementOffsets } from "./dragon.js";
import { WATER } from "./world.js";
import { EntityWorld } from "./entities.js";

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-mounts-reference.json", import.meta.url), "utf8"));
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0 };
const SIZES = { pig: [0.9, 0.9], chicken: [0.3, 0.7], spider: [1.4, 0.9], zombie: [0.6, 1.8], skeleton: [0.6, 1.8], ghast: [4, 4], blaze: [0.6, 1.8], wither: [0.9, 4], bat: [0.5, 0.9], squid: [0.95, 0.95], ender_dragon: [16, 8] };
const CASES = {
  ridePig: { mount: "pig", rider: "zombie" },
  rideChicken: { mount: "chicken", rider: "zombie" },
  rideSpider: { mount: "spider", rider: "skeleton" },
  riderFirst: { mount: "pig", rider: "zombie", riderFirst: true },
  leash: { mount: "pig", rider: "zombie", leash: true },
  // the flyers: their own client onUpdate (EntityFlying, EntitySquid, EntityBat, EntityWither, EntityBlaze), a zombie stands beside them
  flyGhast: { mount: "ghast", rider: "zombie" },
  flyBlaze: { mount: "blaze", rider: "zombie" },
  flyWither: { mount: "wither", rider: "zombie", velocity: false },
  flyBat: { mount: "bat", rider: "zombie", velocity: false },
  flySquid: { mount: "squid", rider: "zombie" },
  // batch 44: a squid through a still water slab (the client's own rotation, tentacles and flow push) and the Ender Dragon's client branch
  swimSquid: { mount: "squid", rider: "zombie", water: true },
  flyDragon: { mount: "ender_dragon", rider: "zombie" },
  // batch 45: the dragon's death (health 0 through S1C at tick 60: the client's own death branch) and a squid out of the water (its air, S1C every tick)
  dragonDeath: { mount: "ender_dragon", rider: "zombie" },
  squidAir: { mount: "squid", rider: "zombie" },
};
// the probe's water slab for swimSquid (MW.slab): x >= 11, y 0..9, still water (metadata 0)
const slab = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : x >= 11 && y < 10 ? WATER : 0), getMeta: () => 0, surface: () => 0 };
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

// The boss and squid fields of the client copy (TrackerMountsProbe.extraOf): squid bp..bC; dragon prevAnimTime, animTime, ring index and the
// getMovementOffsets samples
function checkExtra(name, t, c, want) {
  if (!want?.length) return;
  assert.ok(c, `${name} tick ${t}: client mount`);
  const near = (got, exp, what) => got.forEach((v, k) => assert.ok(Math.abs(v - exp[k]) <= 1e-9, `${name} tick ${t} ${what}[${k}]: got ${v} want ${exp[k]}`));
  if (c.squid) {
    const s = c.squid;
    near([s.pitch, s.prevPitch, s.yaw, s.prevYaw, s.rotation, s.prevRotation, s.tentacle, s.prevTentacle, s.motionSpeed, s.rotationVelocity, s.rotateSpeed, s.vecX, s.vecY, s.vecZ], want, "squid");
  } else if (c.dragon) {
    const d = c.dragon, health = { health: c.health ?? 200, dragon: d };
    near([d.prevAnim, d.anim, d.ri], want.slice(0, 3), "dragon");
    const got = [];
    for (let n = 0; n <= 24; n++) got.push(...movementOffsets(health, n, 1));
    for (const n of [0, 6, 13]) got.push(...movementOffsets(health, n, Math.fround(0.37)));
    if (want.length > got.length + 3) for (let n = 0; n < 64; n++) got.push(...movementOffsets(health, n, 1));
    near(got, want.slice(3), "offsets");
  }
}
// batch 45: what the client copy keeps beyond the packets (TrackerMountsProbe.moreOf): the dragon's client health, deathTicks and its seven parts
// (x, y, z, box), or the squid's air
function checkMore(name, t, c, want) {
  if (!want?.length) return;
  const near = (got, exp, what) => got.forEach((v, k) => assert.ok(Math.abs(v - exp[k]) <= 1e-9, `${name} tick ${t} ${what}[${k}]: got ${v} want ${exp[k]}`));
  if (c.dragon) {
    near([c.health, c.dragon.deathTicks], want.slice(0, 2), "dragon health/deathTicks");
    const got = [];
    for (const part of c.dragon.parts) got.push(part.x, part.y, part.z, ...part.box);
    near(got, want.slice(2), "dragon parts");
  } else if (c.squid) assert.equal(c.air, want[0], `${name} tick ${t}: squid air`);
}
// the client's sounds and particles of a tick as the probe's MW logs them ([at | snd | fx, name, ...]); the pitch is a float
function fxOf(list) {
  return list.map((x) => x.particle ? ["fx", x.particle, x.x, x.y, x.z] : x.silent ? ["at", x.sound, x.x ?? x.entity.x, x.y ?? x.entity.y, x.z ?? x.entity.z, x.volume, Math.fround(x.pitch)]
    : ["snd", x.sound, x.x, x.y, x.z, x.volume, Math.fround(x.pitch)]);
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
    if (p.type !== "meta") log.push(p.type === "attach" ? ["attach", p.mode, index(p.entity), p.mode === 0 ? (p.vehicle ? index(p.vehicle) : -1) : p.holder ? index(live.find((m) => m.uuid === p.holder.uuid)) : -1] : p.type === "destroy" ? ["destroy"]
      : p.type === "spawn" ? [index(this.e), "spawn", p.x, p.y, p.z, p.vx, p.vy, p.vz] : p.type === "move" ? [index(this.e), "move", p.dx, p.dy, p.dz]
      : p.type === "moveLook" ? [index(this.e), "moveLook", p.dx, p.dy, p.dz, p.yaw, p.pitch] : p.type === "look" ? [index(this.e), "look", p.yaw, p.pitch]
      : p.type === "teleport" ? [index(this.e), "teleport", p.x, p.y, p.z, p.yaw, p.pitch] : p.type === "head" ? [index(this.e), "head", p.head] : [index(this.e), "velocity", p.vx, p.vy, p.vz]);
    return emit.call(this, p);
  };
  const player = { x: 0.5, y: 0, z: 0.5 };
  const size = (e) => SIZES[e.type];
  // EntityWorld's own client hooks on the probe's flat world
  const host = { world: spec.water ? slab : grass, size: (m) => SIZES[m.type] }, P = EntityWorld.prototype;
  host.clientSquidWet = P.clientSquidWet;
  const physics = Object.assign((c, e) => P.moveClient.call(host, c, e), { turn: (c, e) => P.clientAfterMove.call(host, c, e), pre: (c, e) => P.clientEnvironment.call(host, c, e) });
  let bad = 0, worst = 0;
  try {
    record.inputs.forEach((inp, t) => {
      const [mx, my, mz, yaw, vx, vy, vz, mounted] = inp, [rx, ry, rz] = inp.slice(-3);
      Object.assign(mount, { x: mx, y: my, z: mz, vx, vy, vz, rotationYaw: yaw, rotationYawHead: yaw, renderYawOffset: yaw, batHanging: inp.length > 16 && inp[13] === 1 });
      Object.assign(rider, { x: rx, y: ry, z: rz });
      if (mounted) { if (rider.ridingEntity !== mount) mountEntity(rider, mount, (m) => SIZES[m.type][1]); } else if (rider.ridingEntity) mountEntity(rider, null, (m) => SIZES[m.type][1]);
      // the server's own values the metadata packets carry: the dragon's health (row field 14) and the squid's air (EntityWaterMob counts it down
      // out of the water: -20 is reset to 0, the damage of that tick is not part of the packets)
      if (mount.type === "ender_dragon") mount.health = inp.length > 16 ? inp[14] : 200;
      if (mount.type === "squid" && name === "squidAir") { mount.air = (mount.air ?? 300) - 1; if (mount.air === -20) mount.air = 0; }
      if (spec.leash) mount.leash = inp[9] ? { holder: "mob", holderUuid: rider.uuid } : undefined;
      // the entries run in list order: riderFirst puts the rider ahead of its mount
      const order = spec.riderFirst ? [rider, mount] : [mount, rider];
      log = [];
      tracker.serverTick(order, player, size);
      const want = events.has(t) ? expected(events.get(t)) : [];
      assert.deepEqual(log, want, `${name} packets at tick ${t}`);
      // the probe seeds the client's Entity.rand after the constructor rolled rotationVelocity: the same two values here
      const cm = tracker.clientIfTracked(mount);
      if (cm?.squid && !cm.seeded) { cm.seeded = true; cm.squid.rotationVelocity = record.squidInit; cm.rand = new JavaRandom(77); }
      if (cm?.dragon && !cm.seeded) { cm.seeded = true; cm.rand = new JavaRandom(77); }
      tracker.clientTick(physics);
      checkExtra(name, t, cm, record.extra[t]);
      if (cm) checkMore(name, t, cm, record.more?.[t]);
      const gotFx = fxOf(tracker.takeFx().filter((x) => x.entity === mount)), wantFx = record.fx.find((f) => f[0] === t)?.[1] ?? [];
      assert.equal(gotFx.length, wantFx.length, `${name} tick ${t}: client effects ${JSON.stringify(gotFx)} vs ${JSON.stringify(wantFx)}`);
      gotFx.forEach((g, k) => g.forEach((v, i) => typeof v === "number" ? assert.ok(Math.abs(v - wantFx[k][i]) <= 1e-9 || v === Math.fround(wantFx[k][i]), `${name} tick ${t} effect ${k}[${i}]: got ${v} want ${wantFx[k][i]}`) : assert.equal(v, wantFx[k][i], `${name} tick ${t} effect ${k}[${i}]`)));
      const row = record.client[t];
      row.forEach((w, i) => {
        const c = tracker.clientIfTracked(live[i]);
        if (!w[0]) { assert.equal(c, null, `${name} tick ${t}: client entity ${i} not there yet`); return; }
        assert.ok(c, `${name} tick ${t}: client entity ${i}`);
        const got = [c.x, c.y, c.z, c.px, c.py, c.pz, c.vx, c.vy, c.vz, c.rotationYaw, c.rotationPitch, c.renderYawOffset, c.rotationYawHead];
        const exp = [w[1], w[2], w[3], w[4], w[5], w[6], w[9], w[10], w[11], w[13], w[14], w[15], w[16]];
        got.forEach((v, k) => { const d = Math.abs(v - exp[k]); worst = Math.max(worst, d); if (d > 1e-9) { bad++; if (bad < 6) console.log(`${name} t${t} entity ${i} field ${k}: got ${v} want ${exp[k]}`); } });
        assert.equal(c.onGround, w[8], `${name} tick ${t}: onGround ${i}`);
        if (w.length > 17) assert.equal(c.batHanging ? 1 : 0, w[17], `${name} tick ${t}: bat hanging ${i}`);
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

test("a pig the player rides is moved by the packets alone (no client code reads its rider); a ridden horse still follows the live one", () => {
  // Bytecode scan (batch 45): no class on the pig's client path reads riddenByEntity, and isClientWorld is true only for EntityPlayerSP, so the
  // client pig interpolates S14 / S18 like any mob (the executed ridePig record). The horse steers from its rider (wi.e(FF)); that is not ported.
  const { mobs, pig, tick } = pair();
  tick();
  pig.rider = { vehicle: { entity: pig } };
  for (let t = 0; t < 10; t++) { pig.x += 0.2; pig.z -= 0.1; pig.rotationYaw = 10 * t; pig.renderYawOffset = 10 * t; tick(); }
  const c = mobs.clientPosition(pig);
  assert.ok(c, "drawn from the client entity");
  assert.ok(pig.x - c.x > 0.1, "the ridden pig trails its live position like an unridden one");
  assert.ok(c.rotationYaw !== pig.rotationYaw, "and keeps the packets' angles");
  assert.ok(Math.abs(pig.x - 102.5) < 1e-9, "the live mount is untouched by the client entity");
  const { mobs: m2, tick: tick2, pig: horse } = pair();
  horse.type = "horse";
  tick2();
  horse.rider = { vehicle: { entity: horse } };
  for (let t = 0; t < 10; t++) { horse.x += 0.2; horse.z -= 0.1; horse.rotationYaw = 10 * t; horse.renderYawOffset = 10 * t; tick2(); }
  const h = m2.clientPosition(horse);
  assert.deepEqual([h.x, h.y, h.z, h.rotationYaw, h.renderYawOffset], [horse.x, horse.y, horse.z, horse.rotationYaw, horse.renderYawOffset]);
  assert.ok(Math.abs((h.x - h.px) - 0.2) < 1e-9, "the previous client position is last tick's");
  horse.rider = null;
  const before = h.x;
  tick2();
  assert.ok(Math.abs(h.x - before) < 0.25, "no snap on dismount");
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

import { clientAngles } from "./mob-renderer.js";
import { mobPose } from "./entities.js";

test("the drawn body yaw, head yaw and pitch are the client copy's, the rest of the pose stays live", () => {
  const live = { type: "pig", px: 1, py: 2, pz: 3, x: 1, y: 2, z: 3, prevRenderYawOffset: 10, renderYawOffset: 20, prevRotationYawHead: 10, rotationYawHead: 20, prevRotationPitch: 0, rotationPitch: 0, limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, age: 7, health: 10 };
  const c = { prevRenderYawOffset: 40, renderYawOffset: 50, prevRotationYawHead: 60, rotationYawHead: 80, prevRotationPitch: 4, rotationPitch: 8 };
  const pose = mobPose(clientAngles(live, c), 0.5);
  assert.equal(pose.bodyYaw, 45); assert.equal(pose.headYaw, 70 - 45); assert.equal(pose.headPitch, 6);
  assert.equal(pose.age, 7.5);
  assert.equal(live.renderYawOffset, 20, "the live mob is not modified");
  assert.equal(mobPose(live, 0.5).bodyYaw, 15);
});

// batch 45: NetHandlerPlayClient.handleSpawnMob (bytecode-read, then executed in the probe): the client dragon's seven parts take the ids dragonId + 1 .. + 7
test("the client dragon's seven parts are numbered right after the dragon (spawn packet id)", () => {
  const ids = ref.cases.dragonDeath.partIds;
  assert.equal(ids.length, 7);
  ids.forEach((id, i) => assert.equal(id, ids[0] + i));
  assert.equal(new Set(ref.cases.dragonDeath.events[0][1].filter((p) => p[0] === "spawn").map((p) => p[1])).size, 2);
});
