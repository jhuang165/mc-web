// Batch 43: the tracker's S1C metadata and the entities batch 42 left out (eyes of ender, firework rockets, fishing hooks, witch potions),
// replayed against the executed 1.7.10 classes (tools/probes/TrackerExtrasProbe.java, public/research/tracker-extras-reference.json): the
// unchanged EntityTrackerEntry tracking a real server entity, and the real client entity made from its packets and ticked with onUpdate.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker, OBJECT_KINDS, objectView, nativeStack, fallingData } from "./object-tracker.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { itemFromOriginal } from "./region-import.js";
import { FallingBlocks, spawnFalling } from "./falling.js";
import { TrackerEntry } from "./entity-tracker.js";
import { moveEntity } from "./entities.js";

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-extras-reference.json", import.meta.url), "utf8"));
const f = Math.fround;
const KIND = { eyeFlight: "eyeOfEnder", fireworkRocket: "firework", potionThrow: "potion", fishHook: "fishHook", itemMeta: "item", arrowCrit: "arrow", fallingMeta: "falling", tntFuse: "tnt", fallingStep: "falling" };
const TYPE = { 0: 0, 16: 0, 1: 1, 10: 5, 8: 5 }; // DataWatcher object type by index
const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0, brightnessLevel: 15 };

const fmtValue = (v) => { if (v && typeof v === "object") { const n = nativeStack(v); return `I:${n.id}:${n.count}:${n.damage}${v.fireworks ? ":tag" : ""}`; } return v; };
function expectedPackets(list) {
  const out = [];
  for (const p of list) {
    if (p[0] === "S0E") out.push(["spawn", p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10]]);
    else if (p[0] === "S1C") out.push(["meta", p[1], p[2]]);
    else if (p[0] === "S12") out.push(["velocity", p[1], p[2], p[3]]);
    else if (p[0] === "S15") out.push(["move", p[1], p[2], p[3]]);
    else if (p[0] === "S17") out.push(["moveLook", p[1], p[2], p[3], p[4], p[5]]);
    else if (p[0] === "S16") out.push(["look", p[1], p[2]]);
    else if (p[0] === "S18") out.push(["teleport", p[1], p[2], p[3], p[4], p[5]]);
  }
  return out;
}
const flat = (p) => p.type === "spawn" ? ["spawn", p.x, p.y, p.z, p.vx, p.vy, p.vz, p.pitch, p.yaw, OBJECT_KINDS[p.kind].type, p.data]
  : p.type === "meta" ? ["meta", p.id, p.list.map(([t, i, v]) => [t, i, fmtValue(v)])]
  : p.type === "velocity" ? ["velocity", p.vx, p.vy, p.vz] : p.type === "move" ? ["move", p.dx, p.dy, p.dz] : p.type === "moveLook" ? ["moveLook", p.dx, p.dy, p.dz, p.yaw, p.pitch]
  : p.type === "look" ? ["look", p.yaw, p.pitch] : p.type === "teleport" ? ["teleport", p.x, p.y, p.z, p.yaw, p.pitch] : null;

// "I:288:3:0" (the probe's stack) as a browser stack
const stackOf = (s) => { const [, id, count, damage] = s.split(":").map(Number); return { ...itemFromOriginal(id, damage), count }; };
// The live entity as the game's hosts keep it, from the probe's server entity state
function host(name, kind, r, id) {
  const [x, posY, z, vx, vy, vz, yaw, pitch] = r, spec = OBJECT_KINDS[kind];
  if (kind === "item") return { x, y: posY - spec.yOff, z, mx: vx, my: vy, mz: vz, rotationYaw: yaw, stack: stackOf(r[11].find((o) => o[1] === 10)[2]) };
  if (kind === "arrow") return { x, y: posY, z, mx: vx, my: vy, mz: vz, yaw, pitch, id, crit: r[12] === true };
  if (kind === "eyeOfEnder" || kind === "fishHook") return { x, y: posY, z, vx, vy, vz, yaw, pitch, id };
  if (kind === "firework") return { x, y: posY, z, mx: vx, my: vy, mz: vz, yaw, pitch, id, stack: null };
  if (kind === "potion") return { kind, x, y: posY, z, mx: vx, my: vy, mz: vz, yaw, pitch, id, damage: 16421 };
  if (kind === "tnt") return { x, y: posY - spec.yOff, z, vx, vy, vz, id, fuse: r[11] };
  const native = name === "fallingMeta" ? [r[11], r[12]] : [12, 0]; // falling
  const b = fromOriginal(native[0], native[1]);
  return { x, y: posY - spec.yOff, z, vx, vy, vz, block: b.id, meta: b.meta, id };
}
const set = (h, name, kind, r) => { const n = host(name, kind, r, h.id); for (const k of Object.keys(n)) h[k] = n[k]; };
const clientList = (c) => [...c.meta].map(([idx, v]) => [TYPE[idx], idx, fmtValue(v)]);

// Replays one case: returns the mismatching ticks. `tweak(tracker)` mutates the tracker (the mutation checks).
function replay(name, tweak = null) {
  const rec = ref[name], kind = KIND[name], spec = OBJECT_KINDS[kind];
  assert.equal(spec.range, rec.range, name + " range");
  assert.equal(spec.frequency, rec.freq, name + " frequency");
  assert.equal(spec.velocity, rec.vel, name + " velocity flag");
  const tracker = new ObjectTracker(10);
  tweak?.(tracker);
  const player = { x: rec.player[0], y: 0, z: rec.player[1] };
  tracker.ctx.world = grass; tracker.ctx.player = null;
  const rows = new Map(rec.rows.map((r) => [r[0], expectedPackets(r[1])]));
  let log = [];
  tracker.view.log = (p) => { const x = flat(p); if (x) log.push(x); };
  const bad = [];
  const h = { id: rec.id };
  let gone = false;
  for (let t = 0; t < rec.inputs.length; t++) {
    const inp = rec.inputs[t];
    if (inp[10] === 1) gone = true;
    set(h, name, kind, inp);
    log = [];
    tracker.serverTick(gone ? {} : { [kind]: [h] }, player);
    const sent = log;
    tracker.clientTick();
    const en = tracker.entries.get(h) ?? tracker.dying[0];
    const c = en?.client;
    const want = rec.client[t];
    try {
      assert.deepEqual(sent, rows.get(t) ?? [], "packets");
      assert.equal(!!c?.present, want[0] === 1, "present");
      if (want[0] === 1) {
        const got = [c.x, c.y, c.z, c.vx, c.vy, c.vz, c.px, c.py, c.pz];
        // The probe's client hook lands at tick 14: the release of a landed hook draws the client's unseeded Entity.rand (vx *= rand * 0.2), so
        // from there its x motion is random and only close; everything before is exact.
        const loose = name === "fishHook" && t >= 14, tol = loose ? 0.5 : 1e-9;
        want.slice(1, 10).forEach((v, i) => assert.ok(Math.abs(got[i] - v) < tol, `field ${i}: ${got[i]} vs ${v}`));
        assert.equal(c.onGround ? 1 : 0, want[10], "onGround");
        if (loose) { assert.ok(Math.abs(c.yaw - want[11]) < 30 && Math.abs(c.pitch - want[12]) < 30, "yaw/pitch"); } else {
          assert.equal(f(c.yaw), f(want[11]), "yaw");
          assert.equal(f(c.pitch), f(want[12]), "pitch");
        }
        if (kind === "item") assert.deepEqual(clientList(c), want[13], "client data watcher");
        if (kind === "arrow") { assert.deepEqual(clientList(c), want[13], "client data watcher"); assert.equal(objectView(tracker, h, kind).crit, want[14], "client crit flag"); }
        if (kind === "tnt") assert.equal(objectView(tracker, h, kind).fuse, want[13], "client fuse");
        if (kind === "falling") {
          const v = objectView(tracker, h, kind);
          assert.deepEqual(toOriginal(v.block, v.meta), name === "fallingMeta" ? [want[13], want[14]] : [12, 0], "client block");
        }
      }
    } catch (e) { if (process.env.DBG) console.log(name, t, JSON.stringify(sent), JSON.stringify(rows.get(t)), c && [c.yaw, c.pitch, c.y], JSON.stringify(want)); bad.push([t, e.message.split("\n")[0]]); if (bad.length > 3) break; }
  }
  return bad;
}

for (const name of Object.keys(KIND)) test(`${name}: every packet (S1C included) and the client entity each tick match the executed classes`, () => {
  assert.deepEqual(replay(name), []);
});

test("the type table of the new kinds matches EntityTracker.addEntityToTracker (bytecode-read)", () => {
  const rows = new Map(ref.bytecodeRead.table.map(([cls, range, freq, vel]) => [cls, [range, freq, vel]]));
  for (const [cls, k] of [["EntityEnderEye", "eyeOfEnder"], ["EntityFireworkRocket", "firework"], ["EntityFishHook", "fishHook"], ["EntityPotion", "potion"]])
    assert.deepEqual(rows.get(cls), [OBJECT_KINDS[k].range, OBJECT_KINDS[k].frequency, OBJECT_KINDS[k].velocity], cls);
});

test("falling block data is the native block id and metadata, not the browser's block id", () => {
  const sand = fromOriginal(12, 1);
  assert.equal(fallingData({ block: sand.id, meta: sand.meta }), 12 | (1 << 16));
  assert.notEqual(sand.id, 12);
});

test("mutation check: an entry that never sends the changed S1C (the base sendLocation) is caught by the item and arrow replays", () => {
  const tweak = (tr) => { const create = tr.create.bind(tr); tr.create = (e) => { const en = create(e); en.entry.sendLocation = TrackerEntry.prototype.sendLocation; return en; }; };
  assert.ok(replay("itemMeta", tweak).length > 0);
  assert.ok(replay("arrowCrit", tweak).length > 0);
});
test("mutation check: a client rocket without the S12 heading (Entity.setVelocity only) is caught", () => {
  const bad = replay("fireworkRocket", (tr) => { const orig = tr.newSim.bind(tr); tr.newSim = (c) => { const s = orig(c); s.prevYaw = 1; return s; }; });
  assert.ok(bad.length > 0);
});

// Entity.stepHeight of EntityFallingBlock is 0: pushed at a half block step the block stops against it (the server's falling.js and the client's copy)
test("fallingStep: the falling block does not climb a half block step (Java stepHeight 0)", () => {
  const rec = ref.fallingStep;
  const slab = { cleared: false, get(x, y, z) { if (y < 0) return 1; if (x === 4 && y === 0 && z === 1 && !this.cleared) return 6; return y === 0 && z >= 2 ? 103 : 0; }, getMeta: () => 0, solid: (x, y, z) => y < 0 || (y === 0 && z >= 2), set() { this.cleared = true; return true; }, brightnessLevel: 15 };
  const run = () => {
    slab.cleared = false;
    const blocks = new FallingBlocks(slab), e = spawnFalling(6, 0, 4, 0, 1);
    const [x, posY, z, vx, vy, vz] = rec.inputs[0];
    Object.assign(e, { x, y: f(posY - 0.49), z, vx, vy, vz });
    const out = [];
    for (let t = 1; t < 3; t++) { blocks.tickEntity(e); out.push([e.x, e.y + f(0.49), e.z]); }
    return out;
  };
  const climbs = { x: 4.5, y: 0.04, z: 1.5, vx: 0, vy: -0.05, vz: 0.9, onGround: false };
  moveEntity(slab, climbs, 0.98, 0.98, 0, -0.05, 0.9, 0.5); // the old step height: the block would climb the slab
  assert.ok(climbs.z > 2, "with step height 0.5 the block climbs (the record forbids it)");
  const got = run();
  for (let t = 1; t < 3; t++) got[t - 1].forEach((v, i) => assert.ok(Math.abs(v - rec.inputs[t][i]) < 1e-6, `tick ${t} field ${i}: ${v} vs ${rec.inputs[t][i]}`));
});

// Entity.setBeenAttacked: an item or orb that is hurt (or pushed by an explosion) sends S12 at once, after the update block's packets
test("velocityChanged: a hurt item and orb flag the tracker, which sends S12 after the changed S1C and clears the flag", async () => {
  const { ItemEntities } = await import("./item-entities.js");
  const { ExperienceOrbs } = await import("./experience.js");
  const items = new ItemEntities(() => 0.5), it = { stack: { id: 317, count: 1, damage: 0 }, x: 5, y: 1, z: 5, mx: 0, my: 0, mz: 0, health: 5, fire: 0, hover: 0, age: 0, ticks: 0, delay: 0, onGround: true };
  items.hurt(it, 1);
  assert.equal(it.velocityChanged, true);
  const orbs = new ExperienceOrbs([], () => 0.5), orb = { health: 5, dead: false };
  orbs.hurt(orb, "explosion", 1);
  assert.equal(orb.velocityChanged, true);
  const tracker = new ObjectTracker(10), player = { x: 5, y: 0, z: 5 }, log = [];
  tracker.view.log = (p) => log.push(p.type);
  tracker.ctx.world = grass;
  const h = { x: 5, y: 0.875, z: 5, mx: 0, my: 0, mz: 0, rotationYaw: 0, stack: { id: 317, count: 3, damage: 0 }, id: 1 };
  tracker.serverTick({ item: [h] }, player);
  tracker.clientTick();
  log.length = 0;
  h.velocityChanged = true; h.stack.count = 4; // (the motion is unchanged, so the update block sends no S12 of its own)
  tracker.serverTick({ item: [h] }, player);
  assert.deepEqual(log, ["meta", "velocity"]); // the count changed (S1C), then the knockback velocity
  assert.equal(h.velocityChanged, false);
});
