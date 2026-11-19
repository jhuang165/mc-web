// Batch 84 mpthrown84: thrown entities on the wire at tracker cadence (multiplayer/thrown-tracks.js -> JSON -> multiplayer/thrown-copy.js).
// The copies are object-tracker.js's ObjectClient, so the reference is the single-player ObjectTracker (executed against the unchanged 1.7.10 classes) fed the same live entities.
import test from "node:test";
import assert from "node:assert/strict";
import { ObjectTracker, OBJECT_KINDS } from "./object-tracker.js";
import { ThrownTracks } from "./multiplayer/thrown-tracks.js";
import { ThrownCopies } from "./multiplayer/thrown-copy.js";
import { Projectiles } from "./projectiles.js";
import { FireworkRockets } from "./fireworks-live.js";
import { makeRocket } from "./fireworks.js";
import { fromOriginal } from "./block-registry.js";

const STONE = fromOriginal(1, 0).id;
const world = () => ({ numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? STONE : 0), getMeta: () => 0, surface: () => 0, brightnessLevel: 15 });
const player = { position: { x: 0, y: 0, z: 0 } };
const wire = (rows) => JSON.parse(JSON.stringify(rows ?? []));
let nextId = 100;
const ids = new WeakMap(); const idOf = (e) => ids.get(e) ?? (ids.set(e, nextId++), ids.get(e));

test("cadence table is the bytecode-read one (range / frequency / sendVelocityUpdates)", () => {
  const want = { arrow: [64, 20, false], snowball: [64, 10, true], egg: [64, 10, true], enderPearl: [64, 10, true], potion: [64, 10, true], expBottle: [64, 10, true], eyeOfEnder: [64, 4, true], firework: [64, 10, true] };
  for (const [k, [r, f, v]] of Object.entries(want)) { const s = OBJECT_KINDS[k]; assert.deepEqual([s.range, s.frequency, !!s.velocity], [r, f, v], k); }
});

test("a flying snowball: the copy follows the single-player tracker's copy tick for tick, and the destroy comes one tick after the entity", () => {
  const w = world(), balls = new Projectiles(() => 0.5), ref = new ObjectTracker(10, () => 0.5);
  const ball = balls.throwSnowball({ x: 0.5, y: 5, z: 0.5 }, 0, 0, "snowball"); ball.airBorne = false;
  // native order: update, then packets. The single-player tracker takes packets, then updates; so mine after the step of tick t+1 equals its copy after tick t.
  const tracks = new ThrownTracks({ idOf }); let afterStep = null;
  const copies = new ThrownCopies({ stepped: (m) => { afterStep = [...m.values()].map((c) => [c.x, c.y, c.z]); } });
  let got = 0, lastSeen = -1, gone = -1, prev = null, compared = 0;
  for (let t = 0; t < 40; t++) {
    if (!ball.dead) balls.step(w, ball, [], () => {});
    const list = ball.dead ? [] : [{ e: ball, kind: "snowball" }];
    const out = tracks.update(list, new Map([[1, player]]));
    ref.update(ball.dead ? {} : { snowball: [ball] }, { x: 0, y: 0, z: 0 }, w);
    afterStep = null;
    const lists = copies.tick(wire(out.get(1)), w, null);
    if (prev && afterStep?.length) { compared++; assert.ok(prev.every((v, i) => Math.abs(v - afterStep[0][i]) < 1e-6), `t${t} ${JSON.stringify([prev, afterStep[0]])}`); }
    const c = ref.clientEntity(ball);
    prev = c ? [c.x, c.y, c.z] : null;
    if (lists.balls.length) { got++; lastSeen = t; }
    if (ball.dead && gone < 0) gone = t;
  }
  assert.ok(got > 3 && compared > 3, `compared ${compared}`);
  assert.ok(gone >= 0 && lastSeen >= gone, "the copy outlives the entity by the held destroy");
  assert.equal(copies.size, 0);
  assert.equal(tracks.active, false);
});

test("the S0E of a potion carries its damage; an arrow's first row is a spawn with the shooter id", () => {
  const w = world(), balls = new Projectiles(() => 0.5);
  const pot = balls.spawnThrowable({ x: 0.5, y: 5, z: 0.5 }, 0, 0, "potion"); pot.damage = 16421;
  const tracks = new ThrownTracks({ idOf });
  const out = tracks.update([{ e: pot, kind: "potion" }], new Map([[1, player]]));
  const spawn = out.get(1)[0].p[0];
  assert.equal(spawn.type, "spawn"); assert.equal(spawn.data, 16421);
  assert.equal(out.get(1)[0].k, "potion");
  const copies = new ThrownCopies(); const lists = copies.tick(wire(out.get(1)), w, null);
  assert.equal(lists.balls[0].kind, "potion"); assert.equal(lists.balls[0].damage, 16421);
});

test("out of range: no rows; a copy of the player's far side never appears", () => {
  const balls = new Projectiles(() => 0.5), tracks = new ThrownTracks({ idOf });
  const b = balls.throwSnowball({ x: 500, y: 5, z: 500 }, 0, 0, "snowball");
  const out = tracks.update([{ e: b, kind: "snowball" }], new Map([[1, player]]));
  assert.equal(out.get(1), undefined); assert.equal(tracks.tracking(1), false);
});

test("a rocket's burst is the S1A 17 before the destroy; the copy hands the firework to the hook", () => {
  const w = world(), rockets = new FireworkRockets(), tracks = new ThrownTracks({ idOf }), bursts = [], seen = [];
  const copies = new ThrownCopies({ firework: (...a) => bursts.push(a) });
  const r = rockets.launch(0.5, 1, 0.5, makeRocket({ flight: 1, explosions: [{ type: 0, colors: [0xff0000], fade: [], flicker: false, trail: false }] }));
  const pending = [r];
  for (let t = 0; t < 120 && pending.length + copies.size + (tracks.active ? 1 : 0); t++) {
    rockets.tick(w, { clientCopies: true });
    const list = rockets.rockets.map((e) => ({ e, kind: "firework" }));
    const out = tracks.update(list, new Map([[1, player]]));
    if (!list.length) pending.length = 0;
    for (const row of wire(out.get(1))) for (const p of row.p) seen.push(p.type + (p.type === "status" ? p.status : ""));
    copies.tick(wire(out.get(1)), w, null);
  }
  assert.ok(r.exploded, "the rocket exploded");
  const i17 = seen.indexOf("status17"), iDestroy = seen.indexOf("destroy");
  assert.ok(i17 >= 0 && iDestroy > i17, JSON.stringify(seen.slice(-4)));
  assert.equal(bursts.length, 1);
});

test("old dispEnts rows without trk still apply", async () => {
  const { RemoteDispense } = await import("./multiplayer/client-dispense.js");
  const rd = new RemoteDispense({});
  rd.apply({ type: "dispEnts", ents: [{ k: "b", i: 1, kind: "snowball", x: 1, y: 2, z: 3 }] });
  assert.equal(rd.balls.length, 1);
  rd.apply({ type: "dispEnts", ents: [], trk: [] });
  assert.equal(rd.balls.length, 0);
});
