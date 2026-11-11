// Batch 42 tracker for items, experience orbs, arrows, thrown projectiles, falling blocks and primed TNT (object-tracker.js), replayed against the
// executed 1.7.10 classes (tools/probes/TrackerItemsProbe.java, public/research/tracker-items-reference.json): the unchanged EntityTrackerEntry
// tracking a real server entity, and the real client entity made from its packets and ticked with its own onUpdate.
import { objectView } from "./object-tracker.js";
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker, OBJECT_KINDS, CLIENT_EYE } from "./object-tracker.js";

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-items-reference.json", import.meta.url), "utf8"));
const f = Math.fround;
const KIND = { itemDrop: "item", itemToss: "item", itemFar: "item", orbPull: "orb", orbDrop: "orb", arrowShot: "arrow", snowball: "snowball", fallingBlock: "falling", tntHop: "tnt" };
// the client's world: grass below y = 0 (the probe's CW2)
const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 };

// the probe's packet list of one tick as the tracker's flat form (S1C metadata and head packets are not modelled)
function expectedPackets(list) {
  const out = [];
  for (const p of list) {
    if (p[0] === "S0E") out.push(["spawn", p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10]]); // x y z vx vy vz pitch yaw type data
    else if (p[0] === "S11") out.push(["spawn", p[1], p[2], p[3], p[4]]);
    else if (p[0] === "S12") out.push(["velocity", p[1], p[2], p[3]]);
    else if (p[0] === "S15") out.push(["move", p[1], p[2], p[3]]);
    else if (p[0] === "S17") out.push(["moveLook", p[1], p[2], p[3], p[4], p[5]]);
    else if (p[0] === "S16") out.push(["look", p[1], p[2]]);
    else if (p[0] === "S18") out.push(["teleport", p[1], p[2], p[3], p[4], p[5]]);
  }
  return out;
}
const flat = (p) => p.type === "spawn" ? (p.orb ? ["spawn", p.x, p.y, p.z, p.value] : ["spawn", p.x, p.y, p.z, p.vx, p.vy, p.vz, p.pitch, p.yaw, OBJECT_KINDS[p.kind].type, p.data])
  : p.type === "velocity" ? ["velocity", p.vx, p.vy, p.vz] : p.type === "move" ? ["move", p.dx, p.dy, p.dz] : p.type === "moveLook" ? ["moveLook", p.dx, p.dy, p.dz, p.yaw, p.pitch]
  : p.type === "look" ? ["look", p.yaw, p.pitch] : p.type === "teleport" ? ["teleport", p.x, p.y, p.z, p.yaw, p.pitch] : null;

// The live entity as the game's hosts keep it, from the probe's server entity state (posX posY posZ motion yaw pitch onGround ...)
function host(kind, r, id) {
  const [x, posY, z, vx, vy, vz, yaw, pitch] = r;
  if (kind === "item") return { x, y: posY - OBJECT_KINDS.item.yOff, z, mx: vx, my: vy, mz: vz, rotationYaw: yaw, stack: { id: 1, count: 1 } };
  if (kind === "orb") return { x, posY, z, vx, vy, vz, y: posY - 0.25, value: id === 8 ? 3 : 5, id };
  if (kind === "arrow" || kind === "snowball") return { x, y: posY, z, mx: vx, my: vy, mz: vz, yaw, pitch, id };
  return { x, y: posY - OBJECT_KINDS[kind].yOff, z, vx, vy, vz, block: 12, meta: 0, id }; // falling, tnt
}
const set = (h, kind, r) => { const n = host(kind, r, h.id); for (const k of Object.keys(n)) h[k] = n[k]; };

// Replays one case: returns the mismatching ticks. `tweak(tracker)` mutates the tracker (the mutation check).
function replay(name, tweak = null) {
  const rec = ref[name], kind = KIND[name];
  assert.equal(OBJECT_KINDS[kind].range, rec.range, name + " range");
  assert.equal(OBJECT_KINDS[kind].frequency, rec.freq, name + " frequency");
  assert.equal(OBJECT_KINDS[kind].velocity, rec.vel, name + " velocity flag");
  const tracker = new ObjectTracker(10);
  tweak?.(tracker);
  const player = { x: rec.player[0], y: 0, z: rec.player[1] };
  tracker.ctx.world = grass; tracker.ctx.player = rec.pull ? player : null;
  const rows = new Map(rec.rows.map((r) => [r[0], expectedPackets(r[1])]));
  let log = [];
  tracker.view.log = (p) => { const x = flat(p); if (x) log.push(x); };
  const bad = [];
  const h = { id: rec.id };
  let gone = false;
  for (let t = 0; t < rec.inputs.length; t++) {
    const inp = rec.inputs[t];
    if (inp[10] === 1) gone = true;
    set(h, kind, inp);
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
        want.slice(1, 10).forEach((v, i) => assert.ok(Math.abs(got[i] - v) < 1e-9, `field ${i}: ${got[i]} vs ${v}`));
        assert.equal(c.onGround ? 1 : 0, want[10], "onGround");
        assert.equal(f(c.yaw), f(want[11]), "yaw");
        assert.equal(f(c.pitch), f(want[12]), "pitch");
      }
    } catch (e) { if (process.env.DBG) console.log(name, t, JSON.stringify(sent), JSON.stringify(rows.get(t)), c && [c.yaw, c.pitch, c.y], JSON.stringify(want)); bad.push([t, e.message.split("\n")[0]]); if (bad.length > 3) break; }
  }
  return bad;
}

for (const name of Object.keys(KIND)) test(`${name}: every packet and the client entity each tick match the executed classes`, () => {
  assert.deepEqual(replay(name), []);
});

test("the type table matches EntityTracker.addEntityToTracker (bytecode-read)", () => {
  const want = { item: [64, 20, true], orb: [160, 20, true], arrow: [64, 20, false], snowball: [64, 10, true], egg: [64, 10, true], enderPearl: [64, 10, true], potion: [64, 10, true], expBottle: [64, 10, true], tnt: [160, 10, true], falling: [160, 20, true] };
  for (const [k, v] of Object.entries(want)) assert.deepEqual([OBJECT_KINDS[k].range, OBJECT_KINDS[k].frequency, OBJECT_KINDS[k].velocity], v, k);
  const rows = new Map(ref.bytecodeRead.table.map(([cls, range, freq, vel]) => [cls, [range, freq, vel]]));
  for (const [cls, k] of [["EntityItem", "item"], ["EntityXPOrb", "orb"], ["EntityArrow", "arrow"], ["EntitySnowball", "snowball"], ["EntityEgg", "egg"], ["EntityEnderPearl", "enderPearl"], ["EntityPotion", "potion"], ["EntityExpBottle", "expBottle"], ["EntityTNTPrimed", "tnt"], ["EntityFallingBlock", "falling"]])
    assert.deepEqual(rows.get(cls), want[k], cls);
});

test("mutation check: an orb that homes with the server player's eye height (1.62) is caught by the replay", () => {
  assert.equal(CLIENT_EYE, f(0.12));
  const bad = replay("orbPull", (tr) => { const tick = tr.sims.orbs.tick.bind(tr.sims.orbs); tr.sims.orbs.tick = (w, p) => tick(w, p, f(1.62)); });
  assert.ok(bad.length > 0);
});
test("mutation check: a destroy applied in the tick it is sent (not one client tick later) is caught by the snowball replay", () => {
  const rec = ref.snowball, gone = rec.inputs.findIndex((r) => r[10] === 1);
  assert.equal(rec.client[gone][0], 1); // the client's snowball still flies on the tick its server twin dies
  assert.equal(rec.client[gone + 1][0], 0);
  const bad = replay("snowball", (tr) => { const flush = tr.flush.bind(tr); tr.flush = (en) => { for (const p of en.entry.packets) if (p.type === "destroy") p.after = 0; flush(en); }; });
  assert.ok(bad.length > 0);
});

test("objectView draws at the client position in the entity's own y convention and keeps its identity", () => {
  const e = { x: 9, y: 9, z: 9, px: 9, py: 9, pz: 9, stack: { id: 1 } };
  const c = { x: 1, y: 2.125, z: 3, px: 0.5, py: 2.125, pz: 2.5 };
  const tracker = { clientEntity: (x) => (x === e ? c : null) };
  const v = objectView(tracker, e, "item");
  assert.deepEqual([v.x, v.y, v.z, v.px, v.py, v.pz], [1, 2, 3, 0.5, 2, 2.5]);
  assert.equal(v.stack, e.stack);
  c.x = 4;
  assert.equal(objectView(tracker, e, "item"), v);
  assert.equal(v.x, 4);
  assert.equal(objectView({ clientEntity: () => null }, e, "item"), e);
});
