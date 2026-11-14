// Batch 65 (trackertransient2): mobs and the away worker's entities that spawn and go inside one tick, the enderman copy's fall scream, and the burning copy in rain.
// Executed: tools/probes/TrackerDeadProbe.java (transient* cases: World.updateEntities removes any dead sa the same way, a mob included) and tools/probes/MobCopies2Probe.java
// (fallhigh, fallshort, fallnone, rainburn) -> public/research/mobcopies2-reference.json.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MobTracker, ClientEntity } from "./entity-tracker.js";
import { AwayTrace, transientsAt } from "./away-trace.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { noteGoneMobs, transientIds } from "./tracker-transient.js";
import { copyFallScream } from "./copy-talk.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/tracker-dead-reference.json", import.meta.url), "utf8"));
const ref2 = JSON.parse(readFileSync(new URL("../public/research/mobcopies2-reference.json", import.meta.url), "utf8"));

const mob = (id) => ({ type: "chicken", id: "mob-" + id, x: id, y: 1, z: 0, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true });
const lifetimes = (c) => { // [id, born tick (-1 = before), died tick]
  const out = c.initial.map(([id, life]) => [id, -1, life - 1]);
  (c.spawns ?? []).forEach((list) => { for (const [k, id, life] of list ?? []) out.push([id, k - 1, k - 1 + life - 1]); });
  return out;
};
const names = (tracker) => tracker.order.keys().map((k) => (k.ghost ? k.id : Number(String(k.id).replace("mob-", ""))));

// ---- 1: a mob spawned and removed inside one tick (live tracker) ----
test("noteGoneMobs: a removed mob that no tracker listed is reported once; a tracked one and a kept one are not", () => {
  const tracked = mob(1), fresh = mob(2), kept = mob(3);
  const w = { tracker: new MobTracker() };
  w.tracker.entries.set(tracked, {});
  noteGoneMobs(w, [tracked, fresh, kept], [kept]);
  assert.deepEqual(w.tracker.born, [fresh]);
  assert.equal(fresh.transientGone, true);
  noteGoneMobs(w, [tracked, fresh, kept], [kept]); // reported once
  assert.equal(w.tracker.born.length, 1);
  assert.deepEqual(transientIds(w.tracker.born, [w.tracker], [[kept]]), [2]);
  noteGoneMobs({}, [fresh], []); // no tracker and no trace: nothing to do, no throw
});

for (const name of ["transient12", "transientTwo", "transientMid"]) {
  test(`${name}: a transient MOB reported by noteGoneMobs gives the executed HashSet order after every tick`, () => {
    const c = ref.cases.find((x) => x.case === name), lt = lifetimes(c), all = new Map(lt.map(([id]) => [id, mob(id)]));
    const tracker = new MobTracker(), world = { tracker };
    let list = [];
    for (let t = 0; t < c.ticks; t++) {
      const next = lt.filter(([, b, d]) => b <= t && t < d).map(([id]) => all.get(id));
      noteGoneMobs(world, [...new Set([...list, ...next, ...lt.filter(([, b, d]) => b === t && d === t).map(([id]) => all.get(id))])], next); // the end-of-tick filter of EntityWorld.tick
      list = next;
      tracker.serverTick(list, { x: 0, y: 1, z: 0 }, () => [0.4, 0.7]);
      assert.deepEqual(names(tracker), c.orders[t + 1], `${name} after tick ${t}`);
    }
  });
}

// ---- 2: the away worker's transients ----
function awayReplay(c) {
  const lt = lifetimes(c), all = new Map(lt.map(([id]) => [id, mob(id)])), aliveAfter = (t) => lt.filter(([, b, d]) => b <= t && t < d).map(([id]) => all.get(id));
  let now = [];
  const trace = new AwayTrace(() => now);
  for (let t = 0; t < c.ticks; t++) {
    now = aliveAfter(t);
    for (const [id, b, d] of lt) if (b === t && id) { const e = all.get(id); if (d === t) e.dead = true; trace.born.push(e); } // EntityWorld.joined / noteGoneMobs in the worker
    trace.sample();
  }
  now = aliveAfter(c.ticks - 1);
  const t = trace.finish([]), survivors = new Set(now), tracker = new MobTracker(), walked = [];
  for (let k = 0; k < c.ticks; k++) {
    tracker.idleUpdate(aliveAfter(k).filter((e) => survivors.has(e)), () => [0.4, 0.7], null, (t.ghosts ?? []).filter(([, from, to]) => from <= k && k <= to).map(([id]) => id), transientsAt(t, k));
    walked.push(names(tracker));
  }
  return { walked, trace: t };
}
// transientMid is left out of the away replay: its probe ids are not in spawn order (the transient 33 spawns after the child 40), and the replay adds a tick's new entries in id order, which is
// the spawn order for real entities (Entity ids only rise). The live path adds the transient last, which is what that case needs (above).
for (const name of ["transient12", "transientTwo"]) {
  test(`${name}: the away worker's transient is carried in the trace and replayed; the order equals the executed one after every tick`, () => {
    const c = ref.cases.find((x) => x.case === name), { walked, trace } = awayReplay(c);
    assert.ok(trace.transients.length > 0);
    for (let t = 0; t < c.ticks; t++) assert.deepEqual(walked[t], c.orders[t + 1], `${name} after tick ${t}`);
  });
}
test("transient11 (10 live + 1 transient: the 13th entry never comes): the away replay is unchanged", () => {
  const c = ref.cases.find((x) => x.case === "transient11"), { walked } = awayReplay(c);
  for (let t = 0; t < c.ticks; t++) assert.deepEqual(walked[t], c.orders[t + 1]);
});
test("AwayTrace: a spawn that is alive at the sample, was sampled, or is not dead is not a transient; ids are read from entityId or id", () => {
  let now = [];
  const trace = new AwayTrace(() => now), live = { entityId: 5, x: 0 }, gone = { entityId: 6, dead: true }, mobGone = { id: "mob-7", transientGone: true }, noId = { dead: true }, unlisted = { entityId: 9 };
  now = [live]; trace.born.push(live, gone, mobGone, noId, unlisted); trace.sample();
  trace.born.push(live); trace.sample();
  assert.deepEqual(trace.transients, [[6, 0], [7, 0]]);
  assert.deepEqual(transientsAt(trace.finish([]), 0), [6, 7]);
  assert.deepEqual(transientsAt(trace.finish([]), 1), []);
});
test("EntityWorld.joined reports a spawn to the away trace (traceBorn) as well as to the tracker", () => {
  const sink = [], e = { dead: true }, w = { ids: { take: () => 3 }, traceBorn: sink, tracker: { born: [] }, takeId() {}, walks: null };
  EntityWorld.prototype.joined.call(w, e, "item");
  assert.deepEqual(sink, [e]);
  assert.deepEqual(w.tracker.born, [e]);
});

// ---- 3: fall damage on an enderman copy ----
class Log extends JavaRandom {
  constructor(seed) { super(BigInt(seed)); this.log = []; }
  nextDouble() { this.log.push("d"); return super.nextDouble(); }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextBoolean() { this.log.push("b"); return super.nextBoolean(); }
  nextInt(n) { const v = super.nextInt(n); if (n !== undefined) this.log.push(`${n}:${v}`); return v; }
}
const floor = { numericSeed: 1, solid: (x, y, z) => y < 0 || (z >= 2 && y < 2), get: (x, y, z) => (y < 0 || (z >= 2 && y < 2) ? 1 : 0), getMeta: () => 0, surface: () => 0 };
function runCopy(r, type, extra = {}) {
  const host = { world: floor, size: () => [r.width, r.height], clientRained: extra.rained }, P = EntityWorld.prototype, m = { type, size: 1 };
  const c = new ClientEntity(type); c.present = true; c.rand = new Log(r.seed); c.width = r.width; c.height = r.height;
  const hooks = [(e) => P.moveClient.call(host, e, m), (e) => P.clientAfterMove.call(host, e, m), (e) => P.clientEnvironment.call(host, e, m), (e) => P.clientLiving.call(host, e, m)];
  const screams = [];
  r.ticks.forEach((t, i) => {
    [c.x, c.y, c.z, c.vx, c.vy, c.vz] = t.pre; c.px = c.x; c.py = c.y; c.pz = c.z;
    c.rand.log.length = 0; c.dead = false;
    c.step(...hooks);
    assert.equal(c.rand.log.join(" "), t.row[0], `${r.case} ${r.seed} tick ${i}`);
    screams.push(!!c.screaming);
  });
  return screams;
}
for (const k of ["fallhigh", "fallshort", "fallnone"]) {
  for (const r of ref2.mobs.filter((x) => x.case === k)) {
    test(`${k}: a dry enderman copy dropped from y ${r.fromY} (seed ${r.seed}) draws like the executed ya.e for 60 ticks`, () => {
      const screams = runCopy(r, "enderman");
      assert.equal(screams.some(Boolean), k !== "fallnone", "the scream flag is set by the landing only after a fall above 3 blocks");
      if (k !== "fallnone") assert.ok(r.ticks.some((t) => t.row[0].includes(" 100:") || t.row[0].startsWith("1000:") && t.row[0].includes("100:")), "the executed copy rolls nextInt(100) after the landing");
    });
  }
}
test("copyFallScream: only an enderman, only above 3 blocks", () => {
  const c = {};
  copyFallScream(c, { type: "zombie" }, 9); assert.equal(c.screaming, undefined);
  copyFallScream(c, { type: "enderman" }, 3); assert.equal(c.screaming, undefined);
  copyFallScream(c, { type: "enderman" }, 3.5); assert.equal(c.screaming, true);
});

// ---- 4: a burning copy in the rain ----
for (const r of ref2.mobs.filter((x) => x.case === "rainburn")) {
  test(`rainburn: the executed burning zombie copy in the rain (seed ${r.seed}) never plays random.fizz and keeps its burning flag; the port draws the same 60 ticks`, () => {
    for (const t of r.ticks) assert.ok(!t.row[1].some((s) => s.startsWith("random.fizz")), "no fizz sound");
    assert.equal(r.error, null);
    const c = new ClientEntity("zombie"); c.present = true; c.rand = new Log(r.seed); c.width = r.width; c.height = r.height; c.burning = true;
    const host = { world: floor, size: () => [r.width, r.height], clientRained: () => true }, P = EntityWorld.prototype, m = { type: "zombie", size: 1 };
    const hooks = [(e) => P.moveClient.call(host, e, m), (e) => P.clientAfterMove.call(host, e, m), (e) => P.clientEnvironment.call(host, e, m), (e) => P.clientLiving.call(host, e, m)];
    r.ticks.forEach((t, i) => {
      [c.x, c.y, c.z, c.vx, c.vy, c.vz] = t.pre; c.px = c.x; c.py = c.y; c.pz = c.z;
      c.rand.log.length = 0; c.dead = false;
      c.step(...hooks);
      assert.equal(c.rand.log.join(" "), t.row[0], `rainburn ${r.seed} tick ${i}`);
    });
    assert.equal(c.burning, true, "rain does not clear the copy's burning flag");
  });
}
