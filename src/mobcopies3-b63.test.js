// Batch 63 (mobcopies3): the dead entities' HashSet order, replayed against the executed probe (tools/probes/TrackerDeadProbe.java -> tracker-dead-reference.json),
// and the enderman copy's burning flag and entity boxes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MobTracker } from "./entity-tracker.js";
import { AwayTrace, ghostsAt } from "./away-trace.js";
import { ClientEntity } from "./entity-tracker.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { JavaHashSetOrder } from "./java-hashset-order.js";
import { copyMetaOf, copyMetaDiff, applyCopyMeta } from "./copy-meta.js";
import { copyTeleportEnv } from "./copy-teleport.js";
import { WATER } from "./world.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

const ref = JSON.parse(readFileSync(new URL("../public/research/tracker-dead-reference.json", import.meta.url), "utf8"));

// The lifetimes the probe ran: [id, born tick (-1 = before the run), died tick]. An entity is in the tracker after tick t when born <= t < died.
function lifetimes(c) {
  const out = c.initial.map(([id, life]) => [id, -1, life - 1]);
  (c.spawns ?? []).forEach((list, i) => { for (const [k, id, life] of list ?? []) out.push([id, k - 1, k - 1 + life - 1]); });
  return out;
}
const mob = (id) => ({ type: "chicken", id: "mob-" + id, x: id, y: 1, z: 0, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true });

function replay(c) {
  const lt = lifetimes(c), all = new Map(lt.map(([id]) => [id, mob(id)]));
  const aliveAfter = (t) => lt.filter(([, b, d]) => b <= t && t < d).map(([id]) => all.get(id));
  // the worker's trace: one sample after each tick of the run
  let now = [];
  const trace = new AwayTrace(() => now);
  for (let t = 0; t < c.ticks; t++) { now = aliveAfter(t); trace.sample(); }
  now = aliveAfter(c.ticks - 1);
  const { ghosts } = trace.finish([]), survivors = new Set(now);
  const tracker = new MobTracker();
  const walked = [];
  for (let t = 0; t < c.ticks; t++) {
    // the returned world holds the survivors only (a dead entity is not restored: it is a ghost)
    tracker.idleUpdate(aliveAfter(t).filter((e) => survivors.has(e)), () => [0.4, 0.7], null, ghostsAt({ ghosts }, t));
    walked.push(tracker.order.keys().map((k) => (k.ghost ? k.id : Number(String(k.id).replace("mob-", "")))));
  }
  return walked;
}

for (const c of ref.cases.filter((x) => !x.case.startsWith("transient"))) {
  test(`dead entities: ${c.case} keeps the executed HashSet order after every tick (World.updateEntities removes the dead entity before the tracker pass)`, () => {
    const walked = replay(c);
    const lt = lifetimes(c);
    for (let t = 0; t < c.ticks; t++) {
      const want = c.orders[t + 1];
      assert.deepEqual(walked[t], want, `${c.case} after tick ${t}`);
    }
    assert.ok(lt.length > 0);
  });
}

// A transient entity (spawned and dead inside one tick) is in no sample, so the worker's trace has no ghost for it. Natively its entry still doubled the table (13 > 12). Found, not fixed:
// the worker has no spawn hook per subsystem. The executed history is replayed through the set model to show that the native order needs that add and remove.
test("transient entity (spawned and removed in one tick): the executed order needs its add and remove; the AWAY ghost model cannot see it (the live tracker does since b64, trackertransient-b64.test.js)", () => {
  const c = ref.cases.find((x) => x.case === "transient12");
  const withIt = new JavaHashSetOrder("java8"), without = new JavaHashSetOrder("java8");
  for (const [id] of c.initial) { withIt.add(id, id); without.add(id, id); }
  withIt.add(33, 33); withIt.remove(33);
  assert.deepEqual(withIt.keys(), c.orders[1], "with the transient add/remove the model equals the executed order");
  assert.notDeepEqual(without.keys(), c.orders[1], "without it the order differs (the table never doubled)");
  assert.notDeepEqual(replay(c)[0], c.orders[1], "the port's replay has no ghost for it");
});

// ---- the enderman copy: burning flag, scream clear, boat boxes ----
class Log extends JavaRandom {
  constructor(seed) { super(BigInt(seed)); this.log = []; }
  nextDouble() { this.log.push("d"); return super.nextDouble(); }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextBoolean() { this.log.push("b"); return super.nextBoolean(); }
  nextInt(n) { const v = super.nextInt(n); if (n !== undefined) this.log.push(`${n}:${v}`); return v; }
}
const ref2 = JSON.parse(readFileSync(new URL("../public/research/mobcopies2-reference.json", import.meta.url), "utf8"));
const step2 = { numericSeed: 1, solid: (x, y, z) => y < 0 || (z >= 2 && y < 2), get: (x, y, z) => (y < 0 || (z >= 2 && y < 2) ? 1 : 0), getMeta: () => 0, surface: () => 0 };
const pool = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : x >= 7 && x <= 13 && z >= -9 && z <= -3 && y <= 4 ? WATER : 0), getMeta: () => 0, surface: () => 0 };
function runCopy(r, world, init) {
  const host = { world, size: () => [r.width, r.height] }, P = EntityWorld.prototype, m = { type: "enderman", size: 1 };
  const c = new ClientEntity("enderman"); c.present = true; c.rand = new Log(r.seed); c.width = r.width; c.height = r.height;
  init(c);
  const hooks = [(e) => P.moveClient.call(host, e, m), (e) => P.clientAfterMove.call(host, e, m), (e) => P.clientEnvironment.call(host, e, m), (e) => P.clientLiving.call(host, e, m)];
  const seen = [];
  r.ticks.forEach((t, i) => {
    [c.x, c.y, c.z, c.vx, c.vy, c.vz] = t.pre; c.px = c.x; c.py = c.y; c.pz = c.z;
    c.rand.log.length = 0; c.dead = false;
    c.step(...hooks);
    assert.equal(c.rand.log.join(" "), t.row[0], `${r.case} ${r.seed} tick ${i}`);
    seen.push(c.screaming);
  });
  return { c, seen };
}
for (const r of ref2.mobs.filter((x) => x.case === "burntp")) {
  test(`burning enderman copy (watcher 0 bit 0), seed ${r.seed}: a dry copy draws and teleports every tick like the executed ya.e (100 ticks)`, () => {
    const { c } = runCopy(r, step2, (c) => { c.burning = true; });
    assert.ok(r.ticks.every((t) => t.row[0].includes(" 64:")), "executed: teleportRandomly every tick");
    assert.ok(c.burning);
  });
}
for (const r of ref2.mobs.filter((x) => x.case === "wetscream")) {
  test(`screaming enderman copy falling into water, seed ${r.seed}: the wet branch clears the flag, so no nextInt(100) roll once wet (executed, 60 ticks)`, () => {
    const { seen } = runCopy(r, pool, (c) => { c.screaming = true; });
    const firstWet = r.ticks.findIndex((t) => t.row[0].includes(" 64:"));
    assert.ok(firstWet > 0);
    assert.ok(seen.slice(firstWet).every((v) => v === false));
    assert.ok(r.ticks.slice(firstWet).every((t) => !/\b100:/.test(t.row[0])));
  });
}
test("watcher 0 burning travels as copy meta: the live mob's fire > 0, one change per flip, applied to the copy", () => {
  const mob = { type: "enderman", health: 40, fire: 0, effects: [] };
  const last = copyMetaOf(mob);
  assert.equal(last.burning, false);
  assert.equal(copyMetaDiff(last, mob), null);
  mob.fire = 80;
  const d = copyMetaDiff(last, mob);
  assert.deepEqual(d, { burning: true });
  const c = new ClientEntity("enderman"); applyCopyMeta(c, d);
  assert.equal(c.burning, true);
  mob.fire = 0;
  assert.deepEqual(copyMetaDiff(last, mob), { burning: false });
});
test("the teleport destination test counts boat boxes (World.getCollidingBoundingBoxes adds EntityBoat.getBoundingBox), strict overlap only", () => {
  const w = { get: () => 0, isLoaded: () => true, solid: () => false };
  const box = { minX: 0.2, minY: 1, minZ: 0.2, maxX: 0.8, maxY: 3, maxZ: 0.8 };
  assert.equal(copyTeleportEnv(w).collides(box), false);
  assert.equal(copyTeleportEnv(w, () => [[-0.75, 0.7, -0.75, 0.75, 1.3, 0.75]]).collides(box), true);
  assert.equal(copyTeleportEnv(w, () => [[-0.75, 0.4, -0.75, 0.75, 1, 0.75]]).collides(box), false, "touching is not overlapping");
  assert.equal(copyTeleportEnv(w, () => [[5, 0, 5, 6, 2, 6]]).collides(box), false);
});
