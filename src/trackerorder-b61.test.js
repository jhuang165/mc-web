// Batch 61 (trackerorder): the away run's moving tracker ticks (away-trace.js) and the entities of unloaded chunks (saved-order.js).
// Evidence: the silent tick is `idleUpdate` (executed b58 dimAge cases, trackerphase-b58.test.js); here the per-tick states fed to it come from the worker's samples.
// Entity ids of a reloaded entity: executed SavedOrderLoginProbe `ids` (saved-order8-reference.json): every entity of a reloaded chunk has a new id, consecutive in loaded-list order.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { ObjectTracker } from "./object-tracker.js";
import { EntityIds } from "./entity-ids.js";
import { awayCatchUp, keptIn } from "./away-track.js";
import { AwayTrace } from "./away-trace.js";
import { MobTracker } from "./entity-tracker.js";
import { trackChunkLoads, unloadQueued, liveOrder, liveLists, nearSpawn } from "./saved-order.js";
import { awayEntities } from "./away-entities.js";
import { plain } from "./legacy-ai-replay.js";
import { Weather } from "./weather.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 };
const spawn = [0, 64, 0];
const chicken = (id, x, z) => ({ type: "chicken", id: "mob-" + id, uuid: "u" + id, x, y: 0, z, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true });
const item = (id, x, z) => ({ entityId: id, x, y: 0, z, mx: 0, my: 0, mz: 0, rotationYaw: 10, stack: { id: 1, count: 1, damage: 0 }, onGround: true });
const arrow = (id, x, z) => ({ entityId: id, x, y: 1, z, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0, shooterId: 0 });

// The scripted trip: the chicken walks 12 ticks and turns, the item slides 7 ticks, a born item appears at tick 9 and an arrow flies 5 ticks from tick 3 (born then). `n` ticks are run.
const MOVES = 20, TOTAL = 45;
function stateAt(s, i) {
  const t = Math.min(i, MOVES - 1);
  s.chicken.x = 10 + 0.23 * Math.min(t, 12); s.chicken.rotationYaw = 7 * Math.min(t, 12); s.chicken.rotationYawHead = 5 * Math.min(t, 12);
  s.item.x = 5 + 0.4 * Math.min(t, 7); s.item.mx = t < 7 ? 0.4 : 0;
  if (s.born) { s.born.x = 30 + 0.5 * Math.max(0, Math.min(t, 15) - 9); s.born.mx = 0.5; }
  if (s.arrow) { s.arrow.x = 12 + 1.5 * Math.min(Math.max(t - 3, 0), 5); s.arrow.mx = 1.5; s.arrow.yaw = 30; }
}
function build() {
  const w = new EntityWorld({ size: 1024, height: 256 }, [chicken(1, 10, 10)], () => 0.5);
  const o = new ObjectTracker(10, () => 0.5, new EntityIds(100));
  const s = { chicken: w.entities[0], item: item(101, 5, 5), born: null, arrow: null, lists: { item: [], arrow: [], orb: [] }, w, o };
  s.lists.item.push(s.item);
  return s;
}
const born = (s, i) => { if (i === 9 && !s.born) { s.born = item(102, 30, 5); s.lists.item.push(s.born); } if (i === 3 && !s.arrow) { s.arrow = arrow(103, 12, 3); s.lists.arrow.push(s.arrow); } };
const entryState = (s) => [...s.w.tracker.entries.values(), ...s.o.entries.values()].map((en) => { const e = en.entry; return JSON.stringify([e.e.id, e.ticks, e.sinceTeleport, e.lastX, e.lastY, e.lastZ, e.lastYaw, e.lastPitch, e.lastHead, e.lastVX, e.lastVY, e.lastVZ]); }).sort();

// What the worker does: the entities exist on the main thread with their final state; the trace is what the run sampled
function trip() {
  const run = build();
  const trace = new AwayTrace(() => [run.chicken, ...run.lists.item, ...run.lists.arrow]);
  for (let i = 0; i < MOVES; i++) { born(run, i); stateAt(run, i); trace.sample(); }
  const ords = new Map([[run.chicken, 0], [run.item, 1], [run.born, 2], [run.arrow, 3]]);
  return { run, trace: trace.finish([...ords].map(([e, ord]) => [e, { ord }])), ords };
}
// The main thread after the return: every entity restored in its final state, stamped with its record's ord
function returned(t) {
  const s = build();
  s.born = item(102, 30, 5); s.arrow = arrow(103, 12, 3);
  s.lists.item.push(s.born); s.lists.arrow.push(s.arrow);
  stateAt(s, MOVES - 1);
  s.w.orderSeqs = new WeakMap([[s.chicken, 1], [s.item, 2], [s.born, 3], [s.arrow, 4]]);
  return s;
}

test("the replay equals the tracker run tick by tick (the entry's last sent state and the entity's own age), and differs from the final-state run", () => {
  const t = trip(), a = returned(t);
  awayCatchUp(a.w, a.o, a.lists, grass, { ticks: TOTAL, spawn, trace: t.trace });
  // reference: the per-tick states handed to the same silent tick by hand (nothing born before its tick)
  const b = build();
  b.w.tracker = new MobTracker(10);
  for (let i = 0; i < TOTAL; i++) {
    born(b, i); stateAt(b, i);
    b.w.tracker.idleUpdate(b.w.entities, (e) => b.w.size(e), { tracker: b.o, lists: { item: [...b.lists.item], arrow: [...b.lists.arrow], orb: [] }, world: grass });
  }
  assert.deepEqual(entryState(a), entryState(b));
  assert.equal(a.w.tracker.tick, TOTAL);
  const ages = Object.fromEntries([...a.o.entries].map(([e, en]) => [e.entityId, en.entry.ticks]));
  assert.deepEqual(ages, { 101: TOTAL, 102: TOTAL - 9, 103: TOTAL - 3 }, "an entity spawned during the trip has its own age");
  // the old behaviour: every entity at its final state from tick 0
  const c = returned(t);
  awayCatchUp(c.w, c.o, c.lists, grass, { ticks: TOTAL, spawn });
  assert.notDeepEqual(entryState(c), entryState(a), "without the trace the last sent state and the ages differ");
  assert.deepEqual(Object.values(Object.fromEntries([...c.o.entries].map(([e, en]) => [e.entityId, en.entry.ticks]))), [TOTAL, TOTAL, TOTAL]);
});

test("the entities are back at their final state afterwards, and a trace that names no loaded entity changes nothing", () => {
  const t = trip(), a = returned(t), final = [a.chicken.x, a.item.x, a.born.x, a.arrow.x];
  awayCatchUp(a.w, a.o, a.lists, grass, { ticks: TOTAL, spawn, trace: t.trace });
  assert.deepEqual([a.chicken.x, a.item.x, a.born.x, a.arrow.x], final);
  assert.equal(a.born.mx, 0.5);
  const b = returned(t), c = returned(t);
  b.w.orderSeqs = new WeakMap(); // no stamps: nothing binds
  awayCatchUp(b.w, b.o, b.lists, grass, { ticks: TOTAL, spawn, trace: t.trace });
  awayCatchUp(c.w, c.o, c.lists, grass, { ticks: TOTAL, spawn });
  assert.deepEqual(entryState(b), entryState(c));
});

test("a long trip runs the trace first and then the reduced remainder (same phase as the plain reduction)", () => {
  const t = trip(), a = returned(t);
  awayCatchUp(a.w, a.o, a.lists, grass, { ticks: 500000, spawn, trace: t.trace });
  assert.equal(a.w.tracker.tick, 1200 + ((500000 - 1200) % 481200));
  const ages = [...a.o.entries].map(([, en]) => en.entry.ticks);
  assert.ok(ages.every((n) => n > 0));
});

test("the worker's trace comes out of a real away run, keyed by the saved records' ord", () => {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  const ents = awayEntities({ entities: { drops: [{ stack: { id: 3, count: 1, damage: 0 }, x: 4.5, y: 10, z: 4.5, age: 0, delay: 10 }] }, editSequence: 0, ticks: 50, idBase: 1 },
    { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64, sound() {} });
  for (let i = 0; i < 12; i++) ents.tick();
  const out = ents.finish();
  assert.equal(out.trace.n, 12);
  assert.equal(out.trace.rows.length, 1, "the falling item changed state after tick 0");
  const row = out.trace.rows[0];
  assert.equal(row.ord, out.drops[0].ord);
  assert.ok(row.fields.includes("y") && row.data instanceof Float64Array && row.data.length > row.fields.length + 1);
});

// ---- saved order: frozen entities -------------------------------------------------------------------
const reference = JSON.parse(readFileSync(new URL("../public/research/saved-order8-reference.json", import.meta.url))).cases;

test("executed ids (SavedOrderLoginProbe): a reloaded entity takes a new id, consecutive in the reloaded list's order; an unloaded-and-cancelled chunk keeps them", () => {
  for (const c of reference) {
    const before = c.ids.before.map(([, id]) => id), after = c.ids.after.map(([, id]) => id);
    if (c.name.endsWith("cancel")) assert.deepEqual(after, before);
    else {
      assert.ok(Math.min(...after) > Math.max(...before), c.name + ": all ids are new");
      after.forEach((id, i) => { if (i) assert.equal(id, after[i - 1] + 1, c.name + ": consecutive in list order"); });
    }
  }
});

const STONE = 3;
function worldWithFrozen() {
  const world = plain([]), tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} }, rt = { redstone: { collide() {} }, flush() {}, fluidChanges() {} };
  const ents = awayEntities({ entities: {}, editSequence: 0, ticks: 0, idBase: 1 }, { world, ticking: () => true, entityTicks: () => true, rt, fire: { ignite() {} }, weather: new Weather(), tiles, readStack: (s) => s, maxStack: () => 64, sound() {} });
  const { mobs, items } = ents;
  const cows = [0, 1].map((k) => { const e = mobs.create("cow", 16 + 2 + k * 0.5, 70, 8.5); Object.assign(e, { x: 16 + 2 + k * 0.5, y: 70, z: 8.5 }); mobs.entities.push(e); return e; }); // chunk 1
  const stay = mobs.create("cow", 5 * 16 + 4, 70, 8.5); Object.assign(stay, { x: 5 * 16 + 4, y: 70, z: 8.5 }); mobs.entities.push(stay);
  const drop = items.spawn({ id: STONE, count: 3, damage: 0 }, 16 + 3, 70, 8.5, { motion: [0, 0, 0] });
  return { ents, mobs, items, cows, stay, drop };
}
const far = { spawn: [1000, 0], keeps: nearSpawn({ x: 1000, z: 0 }) };

test("frozen entities are out of the mob tracker, the object lists, AI searches and pushes; they return with new ids and a new entry", () => {
  const { mobs, cows, stay, drop, items } = worldWithFrozen();
  mobs.withBalls(mobs.entities.slice());
  const ids = cows.map((c) => c.id), dropId = drop.entityId ?? drop.id, next = mobs.ids.next;
  trackChunkLoads(mobs, { x: 2 * 16 + 4.5, z: 8.5 }, 2, far.keeps, false);
  trackChunkLoads(mobs, { x: 6 * 16 + 4.5, z: 8.5 }, 2, far.keeps, false); // chunks 0 to 3 leave the square (queued)
  assert.ok(liveOrder(mobs, mobs.entities).includes(cows[0]), "queued, not yet unloaded");
  unloadQueued(mobs);
  assert.ok(!mobs.ai.entities().includes(cows[0]) && mobs.ai.entities().includes(stay), "AI searches do not see them");
  assert.deepEqual(liveLists(mobs, { item: items.items }).item, [], "the object trackers do not get them");
  // push: the live cow standing in the frozen cow's place is not pushed by it
  const probe = mobs.create("cow", cows[0].x, 70, 8.5); Object.assign(probe, { x: cows[0].x, y: 70, z: 8.5 });
  probe.vx = 0; probe.vz = 0; stay.x = cows[0].x; stay.z = cows[0].z; // overlaps the frozen cow
  mobs.push(stay, { width: 0.9, height: 1.4 });
  assert.equal(stay.vx, 0, "a frozen cow pushes nothing");
  assert.equal(stay.vz, 0);
  const held = new Set(mobs.frozen.set); mobs.frozen.set.clear(); // control: were the cow in the loaded list, the same push would move the mob
  mobs.push(stay, { width: 0.9, height: 1.4 });
  assert.ok(stay.vx !== 0 || stay.vz !== 0, "control: a loaded overlapping cow pushes");
  stay.vx = stay.vz = 0; for (const e of held) mobs.frozen.set.add(e);
  // the mob tracker is given the unloaded list too
  mobs.tracker ??= new MobTracker(10);
  trackChunkLoads(mobs, { x: 2 * 16 + 4.5, z: 8.5 }, 2, far.keeps, false); // back: the chunk loads again at the end
  assert.ok(mobs.ai.entities().includes(cows[0]), "back in the loaded list");
  assert.notEqual(cows[0].id, ids[0], "a new id");
  assert.match(cows[0].id, /^mob-\d+$/);
  const got = cows.map((c) => Number(c.id.slice(4)));
  assert.ok(got[0] >= next - 1 && got[1] === got[0] + 1 || got[0] === got[1] + 1, "consecutive new numbers");
  assert.notEqual(drop.entityId ?? drop.id, dropId, "an item gets a new id too (when it had one)");
  assert.equal(stay.id.startsWith("mob-"), true);
});

test("the mob tracker drops an unloaded chunk's mobs (a destroy) and makes a new entry with the new id when it loads again", async () => {
  const { Survival } = await import("./survival.js");
  const { mobs, cows, stay } = worldWithFrozen(), sv = new Survival({}, "survival");
  sv.health = 0;
  mobs.ai.player.absent = true;
  const at = (x) => ({ x, y: 70, z: 8.5 });
  mobs.viewChunks = 2; mobs.spawnPoint = () => ({ x: 1000, z: 0 }); // nothing is near the spawn
  mobs.tick(at(2 * 16 + 4.5), sv, 0);
  assert.ok(cows.every((c) => mobs.tracker.entries.has(c)), "tracked while loaded");
  const entry = mobs.tracker.entries.get(cows[0]), oldId = cows[0].id;
  mobs.tick(at(6 * 16 + 4.5), sv, 0); // the square leaves chunk 1: queued, then unloaded after the spawner pass
  mobs.tick(at(6 * 16 + 4.5), sv, 0); // the tracker pass of the next tick sees the entities gone
  assert.ok(!mobs.tracker.entries.has(cows[0]) && !mobs.tracker.entries.has(cows[1]), "no entry for a frozen mob");
  assert.ok(mobs.tracker.entries.has(stay));
  mobs.tick(at(2 * 16 + 4.5), sv, 0); // back: the chunk reloads, the mobs rejoin the list
  mobs.tick(at(2 * 16 + 4.5), sv, 0);
  assert.ok(mobs.tracker.entries.has(cows[0]), "a new entry");
  assert.notEqual(mobs.tracker.entries.get(cows[0]), entry);
  assert.notEqual(cows[0].id, oldId);
});
