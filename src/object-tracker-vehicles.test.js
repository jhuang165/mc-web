// Batch 47: the client copies of boats, minecarts, paintings, item frames and leash knots, replayed against the executed 1.7.10 classes
// (tools/probes/TrackerVehiclesProbe.java, public/research/tracker-vehicles-reference.json): the unchanged EntityTrackerEntry tracking a real server EntityBoat, EntityMinecart,
// EntityPainting, EntityItemFrame or EntityLeashKnot, the packets it sends, and the real client class built from them (NetHandlerPlayClient's S0E / S10 handlers) ticked with
// its own onUpdate. The client's box and, for the frame, its data watcher come from the same rows. The dragon's part-hit retargeting (three Entity.rand draws) is the executed `dragonPartHit` rows.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ObjectTracker, OBJECT_KINDS, nativeStack } from "./object-tracker.js";
import { itemFromOriginal } from "./region-import.js";
import { ARTS } from "./hanging.js";
import { JavaRandom } from "./java-random.js";
import { recordBirth } from "./tracker-birth.js";

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-vehicles-reference.json", import.meta.url), "utf8"));
const f = Math.fround;
const KIND = { boatGlide: "boat", boatSplash: "boat", boatTeleport: "boat", boatFar: "boat", cart0: "minecart", cart1: "minecart", cart3: "minecart", cartTeleport: "minecart", boatPush: "boat", cartPush: "minecart", cartFurnace: "minecart", cartCommand: "minecart", paintingBig: "painting", frameNegative: "itemFrame", knot: "leashKnot", frameItem: "itemFrame" };
for (let d = 0; d < 4; d++) { KIND["painting" + d] = "painting"; KIND["frame" + d] = "itemFrame"; }
// the scenario's wall tile and facing (the probe's constructors)
const TILE = (name) => name === "frameNegative" ? [[-3, 2, -5], 2] : name === "paintingBig" ? [[4, 2, 6], 1] : name === "frameItem" ? [[4, 2, 6], 1] : [[4, 2, 6], Number(name.slice(-1)) || 0];
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);
const fmtValue = (v) => { if (v && typeof v === "object") { const n = nativeStack(v); return `I:${n.id}:${n.count}:${n.damage}`; } return v; };
const expected = (list) => list.map((p) => p[0] === "S10" ? ["S10", p[1], p[2], p[3], p[4], p[5], p[6]] : p[0] === "S0E" ? ["spawn", ...p.slice(1)] : p[0] === "S1C" ? ["meta", p[1], p[2]] : p[0] === "S12" ? ["velocity", p[1], p[2], p[3]]
  : p[0] === "S15" ? ["move", p[1], p[2], p[3]] : p[0] === "S17" ? ["moveLook", ...p.slice(1)] : p[0] === "S16" ? ["look", p[1], p[2]] : p[0] === "S18" ? ["teleport", ...p.slice(1)] : p[0] === "S13" ? ["destroy"] : p);
const flat = (p) => p.type === "spawn" ? (p.kind === "painting" ? ["S10", p.id, p.x / 32, p.y / 32, p.z / 32, p.data, p.title] : ["spawn", p.x, p.y, p.z, p.vx, p.vy, p.vz, p.pitch, p.yaw, OBJECT_KINDS[p.kind].type, p.data])
  : p.type === "meta" ? ["meta", p.id, p.list.map(([t, i, v]) => [t, i, fmtValue(v)])] : p.type === "velocity" ? ["velocity", p.vx, p.vy, p.vz] : p.type === "move" ? ["move", p.dx, p.dy, p.dz]
  : p.type === "moveLook" ? ["moveLook", p.dx, p.dy, p.dz, p.yaw, p.pitch] : p.type === "look" ? ["look", p.yaw, p.pitch] : p.type === "teleport" ? ["teleport", p.x, p.y, p.z, p.yaw, p.pitch] : null;
const FEATHER = itemFromOriginal(288, 0);

// The live entity the port would list for this tick of the scenario
function live(name, kind, r, t, h) {
  const [x, y, z, vx, vy, vz, yaw, pitch] = r;
  // the push scenarios: Entity.addVelocity at tick 4 sets isAirBorne, setBeenAttacked at tick 8 sets velocityChanged (the probe's column 9)
  const flags = { airBorne: name.endsWith("Push") && t === 4, velocityChanged: r[9] === 1 };
  if (kind === "boat") return Object.assign(h, { x, posY: y, z, vx, vy, vz, yaw, pitch, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, ...flags });
  if (kind === "minecart") {
    // the furnace cart is lit by its fuel from tick 3 to 11; the command cart's command is set at tick 3 and its last output at 6 and 9 (the probe's hooks)
    const extra = name === "cartFurnace" ? { type: 2, lit: t >= 3 && t < 12 } : name === "cartCommand" ? { type: 6, command: { command: t >= 3 ? "say hi" : "", watch24: t >= 9 ? JSON.stringify('a "q" b') : t >= 6 ? JSON.stringify("done") : t >= 3 ? "null" : "" } } : { type: Number(name.slice(4, 5)) || 0 };
    return Object.assign(h, { x, posY: y, z, vx, vy, vz, yaw, pitch, rolling: 0, rollingDir: 1, damage: 0, dead: false, ...flags }, extra);
  }
  const [[tx, ty, tz], dir] = TILE(name);
  if (kind === "leashKnot") return Object.assign(h, { x: tx, y: ty, z: tz, dead: false });
  return Object.assign(h, { x, y, z, yaw, tx, ty, tz, dir, art: name === "paintingBig" ? ARTS.findIndex((a) => a[0] === "BurningSkull") : 0, item: name === "frameItem" && t >= 3 ? { id: FEATHER.id, count: 1, damage: 0 } : null, rotation: name === "frameItem" && t >= 3 ? 3 : 0, dead: false });
}

function replay(name, tweak = null) {
  const rec = ref[name], kind = KIND[name];
  assert.equal(OBJECT_KINDS[kind].range, rec.range, name + " range");
  assert.equal(OBJECT_KINDS[kind].frequency, rec.freq, name + " frequency");
  const tracker = new ObjectTracker(10, () => 0.5);
  tweak?.(tracker);
  const player = { x: rec.player[0], y: 0, z: rec.player[1] };
  tracker.ctx.world = null; tracker.ctx.player = null;
  const rows = new Map(rec.rows.map((r) => [r[0], expected(r[1])]));
  let sentLog = [];
  tracker.view.log = (p) => { const x = p.type === "destroy" ? ["destroy"] : flat(p); if (x) sentLog.push(x); };
  const bad = [], h = { id: rec.id }, destroyed = [];
  // The probe adds the entity to the tracker when it is created (EntityTracker.addEntityToTracker: updatePlayerList at once, before the scenario's first push), so the spawn
  // packets carry the entity's creation state (no motion). The port's spawn sites record that state (tracker-birth.js recordBirth, what Boats.place and placeHeldMinecart do)
  // and the tracker starts the entry from it when it first lists the entity.
  const first = rec.inputs[0];
  live(name, kind, [first[0], first[1], first[2], 0, 0, 0, first[6], first[7]], 0, h);
  tracker.view.player = player;
  if (kind === "boat" || kind === "minecart") recordBirth(h);
  const end = rec.inputs.length;
  for (let t = 0; t < end; t++) {
    live(name, kind, rec.inputs[t], t, h);
    if (t > 0) sentLog = []; // (the creation's packets belong to tick 0)
    tracker.serverTick(rec.inputs[t][10] === 1 ? {} : { [kind]: [h] }, player);
    // the probe's player double only logs the destroy (EntityPlayerMP.func_152339_d is not queued), so the executed rows never list it: the executed client entity is gone the tick after
    if (sentLog.some((p) => p[0] === "destroy")) { destroyed.push(t); sentLog = sentLog.filter((p) => p[0] !== "destroy"); }
    const sent = sentLog;
    tracker.clientTick();
    const en = tracker.entries.get(h) ?? tracker.dying[0], c = en?.client, want = rec.client[t];
    try {
      if (process.env.DBG === "2" && JSON.stringify(sent) !== JSON.stringify(rows.get(t) ?? [])) console.log(name, t, JSON.stringify(sent), JSON.stringify(rows.get(t) ?? []));
      assert.deepEqual(sent, rows.get(t) ?? [], "packets");
      assert.equal(!!c?.present, want[0] === 1, "present");
      if (want[0] === 1) {
        const got = [c.x, c.y, c.z, c.vx, c.vy, c.vz, c.px, c.py, c.pz];
        want.slice(1, 10).forEach((v, i) => near(got[i], v, `field ${i}`));
        assert.equal(c.onGround ? 1 : 0, want[10], "onGround");
        assert.equal(f(c.yaw), f(want[11]), "yaw");
        assert.equal(f(c.pitch), f(want[12]), "pitch");
        c.box().forEach((v, i) => near(v, want[13 + i], `box ${i}`));
        for (const [, idx, v] of want[19] ?? []) if (idx >= 2) assert.deepEqual(fmtValue(c.meta.get(idx)), v, "watcher " + idx);
      }
    } catch (e) { if (process.env.DBG) console.log(name, t, e.message.split("\n").slice(0, 3).join(" | ")); bad.push([t, e.message.split("\n")[0]]); if (bad.length > 3) break; }
  }
  const gone = rec.client.findIndex((c) => c[0] === 0 && rec.client[0][0] === 1);
  if (name === "boatFar") { if (!(gone > 0 && destroyed.length === 1 && destroyed[0] === gone - 1)) bad.push(["destroy tick", destroyed, gone]); }
  else if (destroyed.length) bad.push(["unexpected destroy", destroyed]);
  return bad;
}

for (const name of Object.keys(KIND)) test(`${name}: packets, the client copy's position, motion, rotation, box and watcher each tick match the executed classes`, () => {
  assert.deepEqual(replay(name), []);
});

test("boats and carts differ as executed: the boat's spawn adds its yOffset and it coasts on the S12 (0.99F / 0.95F / 0.99F); the cart only interpolates over 3 + 2 ticks", () => {
  assert.equal(ref.boatGlide.client[0][2], 0.581250011920929); // 9 / 32 + 0.3f
  assert.ok(ref.cart0.client[0][2] < 0.35 && ref.cart0.client[0][2] === 0.34375); // 11 / 32, no lift
  assert.equal(OBJECT_KINDS.boat.extra + 3, 8); assert.equal(OBJECT_KINDS.minecart.extra + 3, 5);
  assert.equal(f(ref.boatGlide.client[0][4] * 100), f(29.700000286102295)); // 0.3 * 0.99
});
test("mutation check: a client boat that does not coast, a cart that coasts, or a copy that keeps the live position are caught", () => {
  assert.ok(replay("boatGlide", (tr) => { const orig = tr.create.bind(tr); tr.create = (e) => { const en = orig(e); en.client.stepVehicle = function () { this.vt = null; }; return en; }; }).length > 0);
  assert.ok(replay("cart1", (tr) => { const orig = tr.create.bind(tr); tr.create = (e) => { const en = orig(e); en.client.cv = [0.1, 0, 0]; const place = en.client.place.bind(en.client); en.client.place = (...a) => { place(...a); en.client.x += 0.5; }; return en; }; }).length > 0);
  assert.ok(replay("painting0", (tr) => { const orig = tr.create.bind(tr); tr.create = (e) => { const en = orig(e); en.entry.e.tile = null; return en; }; }).length > 0);
});

test("hanging copies: the client box is the one the executed classes built, the leash knot's is a 0.5 cube on its tile", () => {
  for (const name of ["painting0", "painting3", "frame1", "paintingBig", "frameNegative", "knot"]) assert.deepEqual(replay(name), [], name);
});

test("targets: only copies the client spawned are hit targets; the ridden boat is its copy too (batch 56)", () => {
  const tracker = new ObjectTracker(10, () => 0.5);
  const boat = { id: 1, x: 5.5, posY: 0.3, z: 5.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [4.75, 0, 4.75, 6.25, 0.6, 6.25] };
  tracker.ctx.world = null;
  tracker.serverTick({ boat: [boat] }, { x: 0.5, y: 0, z: 0.5 }); tracker.clientTick();
  const copy = tracker.vehicleTargets()[0];
  assert.equal(copy.kind, "boat"); assert.equal(copy.answers, true); assert.notDeepEqual(copy.box, boat.bb); near(copy.box[1], 9 / 32, "copy y"); // 9 / 32 + 0.3 - 0.3
  assert.deepEqual(tracker.vehicleTargets((l) => l === boat)[0].box, copy.box); // batch 56: the ridden boat's copy runs its own physics, so its box is the copy's
  const far = { ...boat, id: 2, x: 400.5, bb: [399, 0, 4.75, 402, 0.6, 6.25] };
  tracker.serverTick({ boat: [far] }, { x: 0.5, y: 0, z: 0.5 }); tracker.clientTick();
  assert.equal(tracker.vehicleTargets().length, 1); // batch 50: the first boat left the world, but its S13 is flushed one tick later, so its copy is still hittable
  tracker.serverTick({ boat: [far] }, { x: 0.5, y: 0, z: 0.5 }); tracker.clientTick();
  assert.equal(tracker.vehicleTargets().length, 0);
});

// EntityDragon.attackEntityFromPart (executed, dragonPartHit): the target 5 blocks ahead of the yaw plus three draws of the dragon's own Entity.rand
test("a client dragon part hit retargets with three Entity.rand draws (executed)", () => {
  const rows = ref.dragonPartHit.rows;
  assert.equal(rows.length, 8);
  for (const yaw of [0, 90, 33.5, -120]) {
    const tracker = new ObjectTracker(10, () => 0.5);
    const dragon = { type: "ender_dragon", x: 6.5, y: 0.5, z: 2.5, rotationYaw: yaw, rand: new JavaRandom(12345) };
    for (let hit = 0; hit < 2; hit++) {
      tracker.attack(dragon, 4, { kind: "dragonPart", answers: true });
      const w = rows.find((r) => r[0] === yaw && r[1] === hit);
      near(dragon.target.x, w[2], `${yaw} ${hit} x`); near(dragon.target.y, w[3], `${yaw} ${hit} y`); near(dragon.target.z, w[4], `${yaw} ${hit} z`);
    }
  }
  const tracker = new ObjectTracker(10, () => 0.5), rand = new JavaRandom(12345), d = { type: "ender_dragon", x: 0, y: 0, z: 0, rand };
  tracker.attack(d, 4, { kind: "dragonPart", answers: true });
  assert.notEqual(rand.nextFloat(), new JavaRandom(12345).nextFloat()); // three draws were consumed
});
