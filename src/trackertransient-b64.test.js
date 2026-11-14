// Batch 64 (trackertransient): entities that spawn and die inside one tick still took a slot in the native HashSet. The executed history (tools/probes/TrackerDeadProbe.java ->
// public/research/tracker-dead-reference.json, cases transient*) is replayed through the port's MobTracker with the spawn hook (EntityWorld.joined -> tracker.born).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MobTracker } from "./entity-tracker.js";
import { transientIds } from "./tracker-transient.js";
import { JavaHashSetOrder } from "./java-hashset-order.js";
import { ClientEntity } from "./entity-tracker.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { copyRainWet } from "./copy-teleport.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/tracker-dead-reference.json", import.meta.url), "utf8"));

const mob = (id) => ({ type: "chicken", id: "mob-" + id, x: id, y: 1, z: 0, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true });
const life = (c) => { // [id, born tick, died tick]
  const out = c.initial.map(([id, l]) => [id, -1, l - 1]);
  (c.spawns ?? []).forEach((list) => { for (const [k, id, l] of list ?? []) out.push([id, k - 1, k - 1 + l - 1]); });
  return out;
};
const names = (tracker) => tracker.order.keys().map((k) => Number(String(k.id).replace("mob-", "")));

// `hook`: false = the port before this batch (a transient is never told to the tracker)
function replay(c, hook) {
  const lt = life(c), all = new Map(lt.map(([id]) => [id, mob(id)]));
  const tracker = new MobTracker(), out = [];
  for (let t = 0; t < c.ticks; t++) {
    if (hook) for (const [id, b, d] of lt) if (b === t && d === t) tracker.born.push({ entityId: id, dead: true }); // World.spawnEntityInWorld, then dead in the same pass
    const mobs = lt.filter(([, b, d]) => b <= t && t < d).map(([id]) => all.get(id));
    tracker.serverTick(mobs, { x: 0, y: 1, z: 0 }, () => [0.4, 0.7]);
    out.push(names(tracker));
  }
  return out;
}

for (const c of ref.cases.filter((x) => x.case.startsWith("transient"))) {
  test(`${c.case}: with the spawn hook the tracker's set equals the executed order after every tick`, () => {
    const walked = replay(c, true);
    for (let t = 0; t < c.ticks; t++) assert.deepEqual(walked[t], c.orders[t + 1], `${c.case} after tick ${t}`);
  });
}

test("transient12 and transientTwo and transientMid: without the hook the order differs (the gap this batch closes); transient11 does not need it", () => {
  for (const [name, differs] of [["transient12", true], ["transientTwo", true], ["transientMid", true], ["transient11", false]]) {
    const c = ref.cases.find((x) => x.case === name), a = replay(c, false), b = c.orders.slice(1);
    assert.equal(JSON.stringify(a) !== JSON.stringify(b), differs, name);
  }
});

test("the persistent cases are untouched by the hook (no transient entity, no change)", () => {
  for (const name of ["dying", "spawned", "wave"]) {
    const c = ref.cases.find((x) => x.case === name);
    assert.deepEqual(replay(c, true), replay(c, false));
  }
});

test("transientIds: only a dead, never-listed, numbered entity counts", () => {
  const live = { entityId: 5, dead: false }, listed = { entityId: 6, dead: true }, tracked = { entityId: 7, dead: true }, dead = { entityId: 8, dead: true }, noId = { dead: true }, str = { id: "mob-9", dead: true };
  const t = { entries: new Map([[tracked, 1]]) };
  assert.deepEqual(transientIds([live, listed, tracked, dead, noId, str], [t], [[listed]]), [8, 9]);
  assert.deepEqual(transientIds([], [t], [[]]), []);
});

test("the doubling is permanent: a table that grew for a transient keeps its order when the 13th real entry never comes", () => {
  const withIt = new JavaHashSetOrder(), without = new JavaHashSetOrder();
  for (const id of [1, 17, 2, 18, 3, 19, 4, 20, 5, 21, 6, 22]) { withIt.add({ id }, id); without.add({ id }, id); }
  const k = {}; withIt.add(k, 33); withIt.remove(k);
  assert.equal(withIt.capacity, 32);
  assert.equal(without.capacity, 16);
});

// ---- rain counts as wet for a client copy (Entity.isWet: inWater || canLightningStrikeAt at the feet or at floor(y + height)) ----
class Log extends JavaRandom {
  constructor(seed) { super(BigInt(seed)); this.log = []; }
  nextDouble() { this.log.push("d"); return super.nextDouble(); }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextBoolean() { this.log.push("b"); return super.nextBoolean(); }
  nextInt(n) { const v = super.nextInt(n); if (n !== undefined) this.log.push(`${n}:${v}`); return v; }
}
const ref2 = JSON.parse(readFileSync(new URL("../public/research/mobcopies2-reference.json", import.meta.url), "utf8"));
const floor2 = { numericSeed: 1, solid: (x, y, z) => y < 0 || (z >= 2 && y < 2), get: (x, y, z) => (y < 0 || (z >= 2 && y < 2) ? 1 : 0), getMeta: () => 0, surface: () => 0 };
function runRain(r) {
  const asked = [];
  const host = { world: floor2, size: () => [r.width, r.height], clientRained: (x, y, z) => { asked.push(`${x},${y},${z}`); return y >= r.rainMinY; } }, P = EntityWorld.prototype, m = { type: "enderman", size: 1 };
  const c = new ClientEntity("enderman"); c.present = true; c.rand = new Log(r.seed); c.width = r.width; c.height = r.height;
  const hooks = [(e) => P.moveClient.call(host, e, m), (e) => P.clientAfterMove.call(host, e, m), (e) => P.clientEnvironment.call(host, e, m), (e) => P.clientLiving.call(host, e, m)];
  const firstAsked = [];
  r.ticks.forEach((t, i) => {
    [c.x, c.y, c.z, c.vx, c.vy, c.vz] = t.pre; c.px = c.x; c.py = c.y; c.pz = c.z;
    c.rand.log.length = 0; c.dead = false; asked.length = 0;
    c.step(...hooks);
    assert.equal(c.rand.log.join(" "), t.row[0], `${r.case} ${r.seed} tick ${i}`);
    if (i === 0) firstAsked.push(...asked);
  });
  return firstAsked;
}
for (const k of ["rainfeet", "rainhead", "raindry"]) {
  for (const r of ref2.mobs.filter((x) => x.case === k)) {
    test(`${k}: a dry enderman copy in the rain (seed ${r.seed}) draws like the executed ya.e for 60 ticks, ${k === "raindry" ? "never teleporting" : "teleporting every tick"}`, () => {
      const asked = runRain(r);
      const teleports = r.ticks.filter((t) => t.row[0].includes(" 64:")).length;
      assert.equal(teleports, k === "raindry" ? 0 : r.ticks.length);
      assert.ok(asked.length > 0, "the port asked the world's strike test");
      // the cells the port asks first are the executed Entity.isWet cells: the feet cell, then (when that is dry) the head cell
      const want = k === "rainfeet" ? r.asked.slice(0, 1) : r.asked.slice(0, 2);
      assert.deepEqual(asked.slice(0, want.length), want);
    });
  }
}
test("copyRainWet asks the feet cell, then the cell at floor(y + height); each is floored", () => {
  const seen = [];
  const c = { x: -0.5, y: 3.2, z: 7.9, height: 2.9 };
  assert.equal(copyRainWet(c, (x, y, z) => { seen.push([x, y, z]); return false; }), false);
  assert.deepEqual(seen, [[-1, 3, 7], [-1, 6, 7]]);
  assert.equal(copyRainWet(c, (x, y) => y === 6), true);
  seen.length = 0; copyRainWet(c, (x, y, z) => { seen.push([x, y, z]); return true; }); assert.equal(seen.length, 1, "the head cell is not asked once the feet are wet");
});

// ---- the live joint walk (MobTracker.jointUpdate, the path main.js takes) ----
import { ObjectTracker } from "./object-tracker.js";
import { EntityIds } from "./entity-ids.js";
test("jointUpdate: a dead, never-listed spawn is added and removed among the tick's new entries (transient12 order)", () => {
  const c = ref.cases.find((x) => x.case === "transient12");
  const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 };
  const m = new MobTracker(10), o = new ObjectTracker(10, () => 0.5, new EntityIds(1));
  const mobs = c.initial.map(([id]) => mob(id));
  const run = (born) => {
    for (const e of born) m.born.push(e);
    m.update(mobs, { x: 0.5, y: 0, z: 0.5 }, () => [0.4, 0.7], null, { tracker: o, lists: {}, world: grass });
    return m.order.keys().map((k) => Number(String(k.id).replace("mob-", "")));
  };
  run([]); // tick 0: the 12 entries
  assert.deepEqual(run([{ entityId: 33, dead: true }]), c.orders[1], "the executed order after the transient tick");
  const o2 = new ObjectTracker(10, () => 0.5, new EntityIds(1)), m2 = new MobTracker(10);
  m2.update(mobs, { x: 0.5, y: 0, z: 0.5 }, () => [0.4, 0.7], null, { tracker: o2, lists: {}, world: grass });
  m2.update(mobs, { x: 0.5, y: 0, z: 0.5 }, () => [0.4, 0.7], null, { tracker: o2, lists: {}, world: grass });
  assert.notDeepEqual(m2.order.keys().map((k) => Number(String(k.id).replace("mob-", ""))), c.orders[1], "without the transient the old order stays");
});
