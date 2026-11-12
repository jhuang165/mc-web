// Batch 54 (tag b54bc): the boat client copy in still and flowing water, replayed against the executed classes (tools/probes/BoatCopyProbe.java ->
// public/research/boat-copy-reference.json): the unchanged EntityBoat (xi) on a remote world, S12 and position packets applied before given ticks. The JS copy's whole
// stepVehicle (Entity.handleWaterMovement push, the splash sound call, bubbles and splashes, EntityBoat's own fast splash, then the interpolation / S12 coasting) must match
// the executed motion, sound arguments and particle rows tick by tick. ObjectClient.waterMovement was bytecode-read in batch 53; this is its executed record.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker } from "./object-tracker.js";
import { JavaRandom } from "./java-random.js";
import { WATER, solidBlock } from "./world.js";

const f = Math.fround;
const ref = JSON.parse(await readFile(new URL("../public/research/boat-copy-reference.json", import.meta.url), "utf8"));
const num = (v) => (v === "-0" ? -0 : v);
const internal = { 0: 0, 1: 3, 8: WATER, 9: WATER };
function probeWorld(cells) {
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x},${y},${z}`, [internal[id], meta]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], meta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)) };
}
const live = { id: 1, x: 5.5, posY: 0.3, z: 5.5, y: 0.3, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [4.75, 0, 4.75, 6.25, 0.6, 6.25] };

function replay(c, tweak = null) {
  const world = probeWorld(c.cells), t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player; t.ctx.world = world;
  t.serverTick({ boat: [{ ...live }] }, player); t.clientTick();
  const log = [];
  t.hooks.particle = (name, x, y, z, vx, vy, vz) => log.push(["p", name, x, y, z, vx, vy, vz]);
  t.hooks.sound = (name, x, y, z, vol, pitch) => log.push(["s", name, vol, pitch]);
  const e = [...t.entries.values()][0].client;
  // the executed entity: new EntityBoat(world, x, y, z) puts posY at y + yOffset (0.3), fresh (first update pending, not in water), Random(7), no motion
  Object.assign(e, { world, x: c.spawn[0], y: c.spawn[1] + f(0.3), z: c.spawn[2], vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, firstUpdate: true, inWater: false, vt: null, cv: [0, 0, 0], onGround: false });
  e.sim.rand = new JavaRandom(7);
  tweak?.(e);
  const bad = [];
  c.ticks.forEach(([st, sounds, particles], tick) => {
    for (const p of c.packets) if (p[0] === tick) { if (p[1] === 0) e.setVelocity(p[2], p[3], p[4]); else e.place(p[2], p[3], p[4], f(p[5]), f(p[6])); }
    log.length = 0;
    e.stepVehicle();
    const got = [e.x, e.y, e.z, e.vx, e.vy, e.vz, e.yaw, e.pitch];
    got.forEach((v, i) => { const w = num(st[i]); if (Math.abs(v - w) > 1e-9 * Math.max(1, Math.abs(w))) bad.push([c.name, tick, "state", i, v, w]); });
    const gs = log.filter((r) => r[0] === "s"), gp = log.filter((r) => r[0] === "p");
    if (gs.length !== sounds.length) bad.push([c.name, tick, "sound count", gs.length, sounds.length]);
    sounds.forEach(([name, vol, pitch], i) => { if (!gs[i] || gs[i][1] !== name || gs[i][2] !== f(vol) || gs[i][3] !== f(pitch)) bad.push([c.name, tick, "sound", i, gs[i], [name, vol, pitch]]); });
    if (gp.length !== particles.length) bad.push([c.name, tick, "particle count", gp.length, particles.length]);
    particles.forEach((q, i) => { const g = gp[i]; if (!g || g[1] !== q[0] || q.slice(1).some((w, k) => Math.abs(g[2 + k] - num(w)) > 1e-9 * Math.max(1, Math.abs(num(w))))) bad.push([c.name, tick, "particle", i, g, q]); });
  });
  return bad;
}

test("the reference is the executed boat client copy", () => {
  assert.equal(ref.tag, "b54bc");
  for (const k of ["xi", "abj", "sa"]) assert.match(ref.classes[k].sha256, /^[0-9a-f]{64}$/);
  assert.equal(ref.cases.length, 8);
  const sounds = ref.cases.reduce((a, c) => a + c.ticks.filter((t) => t[1].length).length, 0);
  assert.ok(sounds >= 2, "splash sounds recorded");
  assert.ok(ref.cases.some((c) => c.ticks.some((t) => t[2].length)), "particles recorded");
  for (const c of ref.cases) for (const t of c.ticks) assert.ok(t[1].every(([n]) => n === "game.neutral.swim.splash"));
});

for (const c of ref.cases) test(`boat copy ${c.name}: motion, splash sound and particles match the executed classes each tick`, () => {
  assert.deepEqual(replay(c).slice(0, 3), []);
});

test("flowing water moves the executed copy and the port copy the same way; a copy without the flow push would not", () => {
  const c = ref.cases.find((r) => r.name === "flow-drift");
  assert.ok(Math.abs(num(c.ticks.at(-1)[0][0]) - c.spawn[0]) > 3, "the executed copy was carried by the flow");
  assert.ok(replay(c, (e) => { e.waterMovement = function () { this.firstUpdate = false; }; }).length > 0);
});

test("mutation checks: no entry sound, or a wrong bubble count, is caught", () => {
  const c = ref.cases.find((r) => r.name === "fall-into-still");
  assert.ok(replay(c, (e) => { const w = e.waterMovement.bind(e); e.waterMovement = function () { this.firstUpdate = true; w(); }; }).length > 0);
});
