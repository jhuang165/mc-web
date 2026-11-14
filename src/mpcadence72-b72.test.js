// Batch 72 mpcadence72: dropped items and orbs go out at the EntityTrackerEntry cadence (frequency 20, S12 and movement thresholds) as `itrack` packets and the client moves
// them between packets with its own EntityItem / EntityXPOrb physics; the dimRespawn snapshot is cut by the item range; a look-only cart update keeps the position.
// Facts: .shared-memory/notes/mpcadence72-b72-track.md. No browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { ObjectTracker } from "./multiplayer/server-object-tracker.js";
import { ItemTrackClient } from "./multiplayer/client-itrack.js";
import { CartTracker } from "./multiplayer/server-cart-track.js";
import { OBJECT_KINDS } from "./object-tracker.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { makeStack } from "./inventory.js";

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-items-reference.json", import.meta.url), "utf8"));
const grass = { numericSeed: 1, floorBelow: true, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0 };
const KIND = { itemDrop: "item", itemToss: "item", itemFar: "item", orbPull: "orb", orbDrop: "orb" };
const kindOf = (t) => ({ S0E: "spawn", S11: "spawn", S12: "velocity", S15: "move", S17: "moveLook", S16: "look", S18: "teleport" })[t];
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

// Replays an executed case through the server tracker (cadence mode) and the client copies: the packet types of each tick, and the client entity's fields, must match the probe.
function replay(name, tweak) {
  const rec = ref[name], kind = KIND[name], spec = OBJECT_KINDS[kind];
  const player = { x: rec.player[0], y: 0, z: rec.player[1] };
  const host = { players: new Map([["a", { dimension: 0, position: player }]]), rules: { trackerLimit: 144 } };
  const tracker = new ObjectTracker(host, undefined, true);
  const client = new ItemTrackClient(() => 0.5);
  tweak?.(client);
  const bad = [];
  let sentTicks = 0;
  for (let t = 0; t < rec.inputs.length; t++) {
    const [x, posY, z, vx, vy, vz, , , , , gone] = rec.inputs[t];
    const row = kind === "item" ? { i: rec.id, x, y: posY - spec.yOff, z, stack: makeStack(3, 1, 0), mx: vx, my: vy, mz: vz }
      : { i: rec.id, x, y: posY - 0.25, z, v: rec.id === 8 ? 3 : 5, c: 0, vx, vy, vz };
    const message = gone === 1 ? {} : { [kind === "item" ? "items" : "xp"]: [row] };
    const out = tracker.messageFor("a", message, 0);
    assert.equal(out.items, undefined); assert.equal(out.xp, undefined, "the lists are replaced by packets");
    const types = (out.itrack ?? []).flatMap((r) => r.p.map((p) => p.type)).filter((x) => x !== "meta" && x !== "head");
    const want = (rec.rows.find((r) => r[0] === t)?.[1] ?? []).map((p) => kindOf(p[0])).filter(Boolean);
    if (types.length) sentTicks++;
    client.tick(out.itrack, grass, rec.pull ? player : null);
    const c = client.copies.get(`${kind}:${rec.id}`), cw = rec.client[t];
    try {
      if (process.env.DBG) console.log(t, types, want, JSON.stringify(out.itrack)?.slice(0, 200));
      assert.deepEqual(types, want, "packet types");
      assert.equal(!!c, cw[0] === 1, "present");
      if (cw[0] === 1) [c.x, c.y, c.z, c.vx, c.vy, c.vz].forEach((v, k) => assert.ok(Math.abs(v - cw[1 + k]) < 1e-9, `field ${k}: ${v} vs ${cw[1 + k]} (tick ${t})`));
    } catch (e) { bad.push([t, e.message.split("\n")[0]]); if (bad.length > 3) break; }
  }
  return { bad, sentTicks, total: rec.inputs.length };
}

for (const name of Object.keys(KIND)) test(`${name}: the server packets by tick and the client copy's motion between them match the executed classes`, () => {
  const r = replay(name);
  assert.deepEqual(r.bad, []);
  assert.ok(r.sentTicks < r.total / 2, "far fewer ticks carry a packet than ticks run");
});

test("mutation check: a client that does not run item physics between packets is caught", () => {
  const r = replay("itemDrop", (client) => { const step = client.tracker.sims.items.tick.bind(client.tracker.sims.items); client.tracker.sims.items.tick = () => {}; void step; });
  assert.ok(r.bad.length > 0);
});

function flatWorld() {
  const world = new World("b72-mpcadence");
  for (let x = 0; x <= 127; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 14; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 8.5, y: 10, z: 64.5 });
  return world;
}
function fixture() {
  const sim = new DedicatedSimulation({}, { world: flatWorld(), mobs: false, gameMode: "survival" });
  const a = sim.addPlayer("a", "Alice", key(1));
  a.position.copy({ x: 8.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  return { sim, a };
}

test("the Simulation tracker runs in cadence mode: a resting item sends spawn once, then only the beat packets, and the client copy rests where the server item does", () => {
  const { sim } = fixture();
  assert.equal(sim.objectTracker.cadence, true);
  const it = sim.items.spawn(makeStack(3, 1, 0), 20.5, 10.125, 64.5, { delay: 0, motion: [0, 0, 0] });
  const client = new ItemTrackClient();
  let rows = 0, spawns = 0;
  for (let t = 0; t < 70; t++) {
    const out = sim.objectTracker.messageFor("a", sim.tick(), 0);
    assert.equal(out.items, undefined);
    for (const r of out.itrack ?? []) { rows++; spawns += r.p.filter((p) => p.type === "spawn").length; }
    client.tick(out.itrack, sim.world, { x: 8.5, y: 10, z: 64.5 });
  }
  assert.equal(spawns, 1);
  assert.ok(rows < 10, `rows ${rows}`);
  const c = client.copies.get(`item:${it.eid}`);
  assert.ok(c && Math.abs(c.x - it.x) < 0.04 && Math.abs(c.z - it.z) < 0.04 && Math.abs(c.y - 0.125 - it.y) < 0.1, "client copy at the server item");
  const l = client.lists().items[0];
  assert.equal(l.i, it.eid); assert.equal(l.stack.id, 3);
});

test("a picked up item is destroyed on the client through the packets (S13), and an item out of range is never spawned", () => {
  const { sim, a } = fixture();
  const near = sim.items.spawn(makeStack(3, 1, 0), 10.5, 10.125, 64.5, { delay: 0, motion: [0, 0, 0] });
  const far = sim.items.spawn(makeStack(3, 1, 0), 100.5, 10.125, 64.5, { delay: 0, motion: [0, 0, 0] });
  const client = new ItemTrackClient();
  const run = () => { const out = sim.objectTracker.messageFor("a", sim.tick(), 0); client.tick(out.itrack, sim.world, a.position); };
  run(); run();
  assert.deepEqual([...client.copies.keys()], [`item:${near.eid}`]);
  near.dead = true; sim.items.items = sim.items.items.filter((e) => e !== near);
  run(); run();
  assert.equal(client.size, 0);
  assert.ok(far);
});

test("dimRespawn snapshot is cut by the item range (the server cuts it like the welcome snapshot)", () => {
  const { sim } = fixture();
  sim.items.spawn(makeStack(3, 1, 0), 20.5, 10.125, 64.5, { delay: 0, motion: [0, 0, 0] });
  sim.items.spawn(makeStack(3, 1, 0), 120.5, 10.125, 64.5, { delay: 0, motion: [0, 0, 0] });
  const cut = sim.objectTracker.snapshot("a", sim.snapshot("a"));
  assert.equal(sim.snapshot("a").items.length, 2);
  assert.equal(cut.items.length, 1);
  const src = readFileSync(new URL("./multiplayer/server-dimensions.js", import.meta.url), "utf8");
  assert.match(src, /type: 'dimRespawn'[^\n]*objectTracker\.snapshot\(p\.id, sim\.snapshot\(p\.id\)\)/);
});

// A cart whose only packet is a look (S16) releases the rotation only; the position the client holds stays (native S16 carries no position).
test("look-only cart update: rotation released, position kept; a move releases the position but keeps the rotation", () => {
  const tr = new CartTracker();
  const cart = { id: "c1", x: 10, posY: 5, z: 10, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0 };
  const st = () => ({ x: cart.x, y: cart.posY, z: cart.z, yaw: cart.yaw, pitch: cart.pitch });
  let sent = tr.tick(cart, st()); // tick 0
  cart.x = 10.05; cart.yaw = 40; // creeps 0.05 (under 4/32 block) while turning 40 degrees: only a look goes out
  let last;
  for (let t = 1; t <= 3; t++) last = tr.tick(cart, st());
  assert.equal(last.yaw, 40); assert.equal(last.x, 10, "position stays at the last released one");
  cart.x = 10.5; cart.yaw = 41; // a move of 0.45 block with a 1 degree turn (under 4/256 turn): S15 only
  for (let t = 4; t <= 6; t++) last = tr.tick(cart, st());
  assert.equal(last.x, 10.5); assert.equal(last.yaw, 40, "a move packet carries no rotation");
});
