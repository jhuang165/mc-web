// Batch 85 mphook85: fishing hooks on the thrown-entity tracker lane, the join-state baseline of the S0E, and hit targets for arrow and hook copies.
import test from "node:test";
import assert from "node:assert/strict";
import { ThrownTracks } from "./multiplayer/thrown-tracks.js";
import { ThrownCopies } from "./multiplayer/thrown-copy.js";
import { Arrows } from "./bow.js";
import { Projectiles } from "./projectiles.js";
import { FishHook } from "./fishing.js";
import { GaussianRandom } from "./projectiles.js";
import { fromOriginal } from "./block-registry.js";

const STONE = fromOriginal(1, 0).id;
const world = () => ({ numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? STONE : 0), getMeta: () => 0, surface: () => 0, brightnessLevel: 15 });
const player = { position: { x: 0, y: 0, z: 0 } };
const wire = (rows) => JSON.parse(JSON.stringify(rows ?? []));
let nextId = 500;
const ids = new WeakMap(); const idOf = (e) => ids.get(e) ?? (ids.set(e, nextId++), ids.get(e));
const rnd = () => new GaussianRandom(7);

test("a fishing hook is tracked 64 / 5 / velocity, its S0E (type 90) carries the angler's id, and the copy draws from its own update", () => {
  const hook = FishHook.cast(rnd(), { x: 0.5, y: 5, z: 0.5, yaw: 0, pitch: 0 }); hook.entityId = 42; hook.anglerId = "angler";
  const tracks = new ThrownTracks({ idOf }), copies = new ThrownCopies({ hasAngler: (id) => id === "angler", refOf: () => ({}) });
  let rows = null, spawn = null;
  for (let t = 0; t < 12; t++) {
    hook.px = hook.x; hook.py = hook.y; hook.pz = hook.z; hook.x += hook.vx; hook.y += hook.vy; hook.z += hook.vz; hook.vy -= 0.03;
    const out = tracks.update([{ e: hook, kind: "fishHook" }], new Map([[1, player]]));
    const sent = wire(out.get(1));
    spawn ??= sent.flatMap((r) => r.p).find((p) => p.type === "spawn");
    rows = copies.tick(sent, world(), null).hooks;
  }
  assert.equal(spawn.type, "spawn"); assert.equal(spawn.data, "angler"); assert.equal(spawn.id, 42);
  assert.equal(rows.length, 1); assert.equal(rows[0].angler, "angler"); assert.ok(Number.isFinite(rows[0].px) && rows[0].x !== rows[0].px);
  // reeled in: the destroy goes out one tick later and the copy leaves
  for (let t = 0; t < 4; t++) rows = copies.tick(wire(tracks.update([], new Map([[1, player]])).get(1)), world(), null).hooks;
  assert.equal(rows.length, 0); assert.equal(copies.size, 0);
});

test("no angler found: handleSpawnObject builds no hook", () => {
  const hook = FishHook.cast(rnd(), { x: 0.5, y: 5, z: 0.5, yaw: 0, pitch: 0 }); hook.entityId = 43; hook.anglerId = "ghost";
  const tracks = new ThrownTracks({ idOf }), copies = new ThrownCopies({ hasAngler: () => false });
  const out = tracks.update([{ e: hook, kind: "fishHook" }], new Map([[1, player]]));
  assert.equal(copies.tick(wire(out.get(1)), world(), null).hooks.length, 0); assert.equal(copies.size, 0);
});

test("an arrow's entry starts from its join state: the S0E is the flush state, the first move is the delta from the join", () => {
  const arrows = new Arrows(() => 0.5), a = arrows.make({ x: 0.5, y: 5, z: 0.5, mx: 0, my: 0, mz: 0.1, yaw: 0, pitch: 0 }, arrows.rng(), {});
  a.entityId = undefined;
  const tracks = new ThrownTracks({ idOf }), list = [{ e: a, kind: "arrow" }];
  tracks.birth(list);
  a.z += 3; // the join tick's own update
  const rows = wire(tracks.update(list, new Map([[1, player]])).get(1));
  const spawn = rows[0].p.find((p) => p.type === "spawn"), move = rows[0].p.find((p) => p.type === "move" || p.type === "moveLook");
  assert.equal(spawn.z, Math.floor(3.5 * 32)); // flush state
  assert.equal(move.dz, 96); // from the join's scaled position (0.5 * 32 = 16): 112 - 16
});

test("an arrow copy searches the client world's entities: a living copy ricochets it, another player's copy ends it, its own shooter is skipped", () => {
  const arrows = new Arrows(() => 0.5);
  const run = (target, sh) => {
    const a = arrows.make({ x: 0.5, y: 5, z: 0.5, mx: 0, my: 0, mz: 0.6, yaw: 0, pitch: 0 }, arrows.rng(), {});
    const tracks = new ThrownTracks({ idOf, shooterOf: () => sh }), tx = { ref: {}, box: [0, 4.5, 1.3, 1, 6.5, 2.3], ...target };
    const copies = new ThrownCopies({ targets: () => [tx], refOf: (s) => (s ? tx.ref : null) });
    const w = world(); let bounced = false, ended = -1;
    for (let t = 0; t < 14; t++) {
      if (!a.dead && t < 12) { a.z += a.mz; }
      const out = tracks.update([{ e: a, kind: "arrow" }], new Map([[1, player]]));
      const l = copies.tick(wire(out.get(1)), w, null);
      const c = [...copies.copies.values()][0];
      if (c && c.vz < 0) bounced = true;
      if (!c && ended < 0 && t > 2) ended = t;
      if (t === 11) tracks.update([], new Map([[1, player]]));
    }
    return { bounced, ended };
  };
  assert.equal(run({}, null).bounced, true, "living entity: attackEntityFrom false on a client world, the arrow ricochets");
  const other = run({ answers: true }, null);
  assert.equal(other.bounced, false); assert.ok(other.ended > 0, "EntityOtherPlayerMP answers true: the arrow ends");
  assert.equal(run({}, { p: "me" }).bounced, false, "its shooter is skipped for the first 5 ticks");
});

test("a snowball copy does not search entities (EntityThrowable.onUpdate does it under !isRemote only)", () => {
  const balls = new Projectiles(() => 0.5), w = world();
  const ball = balls.throwSnowball({ x: 0.5, y: 5, z: 0.5 }, 0, 0, "snowball");
  const tracks = new ThrownTracks({ idOf }), copies = new ThrownCopies({ targets: () => [{ ref: {}, answers: true, box: [-5, 0, -5, 5, 10, 5] }] });
  let n = 0;
  for (let t = 0; t < 6; t++) { ball.x += 0.1; const l = copies.tick(wire(tracks.update([{ e: ball, kind: "snowball" }], new Map([[1, player]])).get(1)), w, null); n += l.balls.length; }
  assert.ok(n >= 5, "still flying inside the box");
});
