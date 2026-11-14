// Batch 71 mptrackers71: dropped items (range 64) and experience orbs (range 160) are tracked per player on the dedicated server, both clamped by the
// view-distance tracker limit. Facts: .shared-memory/notes/mptrackers71-b71-track.md. No browser.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ObjectTracker, ITEM_RANGE, ORB_RANGE } from "./multiplayer/server-object-tracker.js";
import { makeStack } from "./inventory.js";

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function flat() {
  const world = new World("b71-mptrackers");
  for (let x = 0; x <= 127; x += 1) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 14; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 8.5, y: 10, z: 64.5 });
  return world;
}
function fixture(viewDistance) {
  const sim = new DedicatedSimulation({}, { world: flat(), mobs: false, gameMode: "survival" });
  if (viewDistance) sim.rules.viewDistance = viewDistance;
  const a = sim.addPlayer("a", "Alice", key(1)), b = sim.addPlayer("b", "Bob", key(2));
  a.position.copy({ x: 8.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  b.position.copy({ x: 120.5, y: 10, z: 64.5 }); b.previous.copy(b.position);
  return { sim, a, b };
}
const drop = (sim, x, id = 3) => sim.items.spawn(makeStack(id, 1, 0), x, 10.5, 64.5, { delay: 0, motion: [0, 0, 0] });
// One server tick as server.js's broadcast sends it: the shared message cut for each player.
const step = (sim, ...pids) => { const m = sim.tick(); return Object.fromEntries(pids.map((p) => [p, sim.objectTracker.messageFor(p, m, 0)])); };
const ids = (list) => (list ?? []).map((r) => r.i).sort((x, y) => x - y);

test("ranges: item 64, orb 160 (bytecode-read mn.a(sa)), square", () => {
  assert.deepEqual([ITEM_RANGE, ORB_RANGE], [64, 160]);
});

test("an item 20 blocks from Alice reaches only Alice, one 45 from Bob only Bob, and an orb 52 from Alice and 60 from Bob both", () => {
  const { sim } = fixture();
  const near = drop(sim, 28.5), farA = drop(sim, 75.5); // 20 from A / 92 from B; 67 from A / 45 from B
  sim.serverItems.xp.spawn(3, { x: 60.5, y: 10.5, z: 64.5 });
  const out = step(sim, "a", "b");
  assert.deepEqual(ids(out.a.items), [near.eid], "Alice: only the 20-block item (67 is outside 64)");
  assert.deepEqual(ids(out.b.items), [farA.eid], "Bob: only the item 45 away");
  assert.equal(out.a.xp.length, 1); assert.equal(out.b.xp.length, 1);
});

test("the square: x within 64 but z beyond it is not tracked (|dx| and |dz| both must be inside)", () => {
  const { sim, a } = fixture();
  a.position.copy({ x: 30.5, y: 10, z: 64.5 });
  sim.items.spawn(makeStack(3, 1, 0), 60.5, 10.5, 64.5, { delay: 0, motion: [0, 0, 0] });
  assert.equal(step(sim, "a").a.items.length, 1);
  const t = new ObjectTracker({ players: new Map([["a", { dimension: 0, position: { x: 0, y: 10, z: 0 } }]]), rules: { trackerLimit: 144 } });
  const m = { items: [{ i: 1, x: 40, y: 10, z: 70 }, { i: 2, x: 63, y: 10, z: 63 }, { i: 3, x: 63.9, y: 10, z: -65 }] };
  assert.deepEqual(ids(t.messageFor("a", m, 0).items), [2], "70 in z is out; 63,63 is in although its distance is 89");
});

test("the view-distance clamp: view-distance 5 (limit 64) cuts the orb range 160 to 64; with 10 (limit 144) a 150-block orb stays out and 140 is in", () => {
  const tight = fixture(5);
  tight.sim.serverItems.xp.spawn(3, { x: 78.5, y: 10.5, z: 64.5 }); // 70 from Alice
  assert.equal(tight.sim.rules.trackerLimit, 64);
  assert.equal(step(tight.sim, "a").a.xp, undefined, "70 > 64");
  const wide = fixture(10);
  assert.equal(wide.sim.objectTracker.limit, 144);
  const t = new ObjectTracker({ players: new Map([["a", { dimension: 0, position: { x: 0, y: 10, z: 0 } }]]), rules: wide.sim.rules });
  assert.deepEqual(ids(t.messageFor("a", { xp: [{ i: 1, x: 150, y: 10, z: 0 }, { i: 2, x: 140, y: 10, z: 0 }, { i: 3, x: 145, y: 10, z: 0 }] }, 0).xp), [2], "150 and 145 are past 144");
  const v5 = new ObjectTracker({ players: new Map([["a", { dimension: 0, position: { x: 0, y: 10, z: 0 } }]]), rules: tight.sim.rules });
  assert.deepEqual(ids(v5.messageFor("a", { items: [{ i: 1, x: 64, y: 10, z: 0 }, { i: 2, x: 65, y: 10, z: 0 }] }, 0).items), [1], "item range 64 = limit 64: 64 in, 65 out");
});

test("entering and leaving range: Bob walks toward an item, receives it once he is within 64 and loses it when he leaves", () => {
  const { sim, b } = fixture();
  const it = drop(sim, 20.5); // 100 from Bob
  assert.equal(step(sim, "b").b.items, undefined);
  b.position.copy({ x: 80.5, y: 10, z: 64.5 }); // 60 away
  assert.deepEqual(ids(step(sim, "b").b.items), [it.eid], "re-listed at once (moved over 4 blocks) and spawned on his client");
  b.position.copy({ x: 100.5, y: 10, z: 64.5 }); // 80 away
  assert.equal(step(sim, "b").b.items, undefined, "out of range: the client's list loses it (destroy)");
  b.position.copy({ x: 88.5, y: 10, z: 64.5 }); // 68 away, still out
  assert.equal(step(sim, "b").b.items, undefined);
  b.position.copy({ x: 82.5, y: 10, z: 64.5 }); // 62 away
  assert.deepEqual(ids(step(sim, "b").b.items), [it.eid]);
});

test("a small move of the player (under 4 blocks) does not re-list, so an entry at the edge keeps its decision until the 4-block threshold", () => {
  const me = { dimension: 0, position: { x: 0, y: 10, z: 0 } };
  const t = new ObjectTracker({ players: new Map([["a", me]]), rules: { trackerLimit: 144 } });
  const row = { items: [{ i: 7, x: 66, y: 10, z: 0 }] };
  assert.equal(t.messageFor("a", row, 0).items, undefined, "66 from the player: out");
  me.position.x = 3; // 63 from the item, but the player moved only 3 blocks: no re-list (EntityTracker.updateTrackedEntities)
  assert.equal(t.messageFor("a", { items: [{ i: 7, x: 66, y: 10, z: 0 }] }, 0).items, undefined);
  me.position.x = 4.5; // over 4: re-listed, 61.5 away
  assert.equal(t.messageFor("a", { items: [{ i: 7, x: 66, y: 10, z: 0 }] }, 0).items.length, 1);
});

test("S0D collect goes to the players that track the item; the pickup of an untracked item is not sent", () => {
  const t = new ObjectTracker({ players: new Map([["a", { dimension: 0, position: { x: 0, y: 10, z: 0 } }], ["b", { dimension: 0, position: { x: 100, y: 10, z: 0 } }], ["c", { dimension: 0, position: { x: 30, y: 10, z: 0 } }]]), rules: { trackerLimit: 144 } });
  const first = { items: [{ i: 5, x: 1, y: 10, z: 0 }] };
  t.messageFor("a", first, 0); t.messageFor("b", first, 0);
  // next tick the item is gone (picked up by a) and S0D is in the message
  const second = { taken: [{ i: 5, by: "a" }] };
  assert.equal(t.messageFor("a", second, 0).taken.length, 1, "the collector");
  assert.equal(t.messageFor("c", second, 0).taken.length, 1, "Carol tracked it (30 away)");
  assert.equal(t.messageFor("b", second, 0).taken, undefined, "Bob did not (100 away)");
});

test("a player in the Nether has his own set; changing dimension forgets the entries", () => {
  const { sim, a } = fixture();
  const it = drop(sim, 28.5);
  assert.equal(step(sim, "a").a.items.length, 1);
  const rows = { items: [{ i: it.eid, x: 28.5, y: 10, z: 64.5 }] };
  a.dimension = -1;
  assert.equal(sim.objectTracker.messageFor("a", { ...rows }, -1).items.length, 1, "listed afresh in the Nether (its own object set)");
  assert.equal(sim.objectTracker.state(0).views.has("a"), true, "dimension 0 still holds the old view until it ticks again");
  a.dimension = 0;
  sim.objectTracker.messageFor("a", { items: rows.items }, 0);
  assert.equal(sim.objectTracker.state(-1).views.has("a"), true);
  sim.objectTracker.messageFor("a", { items: [{ ...rows.items[0] }] }, -1); // the Nether pass: a is no longer there
  assert.equal(sim.objectTracker.state(-1).views.has("a"), false);
});

test("the welcome snapshot is cut by the item range at the joining player", () => {
  const { sim } = fixture();
  const near = drop(sim, 50.5); drop(sim, 120.5); // 42 / 112 from Alice
  const world = sim.objectTracker.snapshot("a", sim.snapshot("a"));
  assert.deepEqual(ids(world.items), [near.eid]);
});

test("real server, two WebSocket players: the item next to Alice is sent to her only, and she sees it vanish when she walks away", async (t) => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const os = await import("node:os"), path = await import("node:path"), { once } = await import("node:events");
  const { WebSocket } = await import("ws");
  const { createDedicatedServer } = await import("../server/server.js");
  const { PROTOCOL } = await import("./multiplayer/protocol.js");
  const token = "test-only-not-a-deployed-server-key", origin = "http://localhost:5179";
  const sim = new DedicatedSimulation({}, { world: flat(), mobs: false, gameMode: "survival" });
  const dir = await mkdtemp(path.join(os.tmpdir(), "mc-web-itrack-"));
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, "world.json"), simulation: sim, tickMs: 10, saveMs: 60000 });
  const sockets = [];
  t.after(async () => { for (const w of sockets) try { w.close(); } catch {} await app.close(); await rm(dir, { recursive: true, force: true }); });
  const join = async (name) => {
    const session = (await app.accounts.register({ invite: token, name, password: "correct horse" }, token)).session;
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin }), seen = [];
    sockets.push(ws); ws.on("message", (d) => seen.push(JSON.parse(d)));
    await once(ws, "open"); ws.send(JSON.stringify({ type: "join", protocol: PROTOCOL, session }));
    const until = async (pred) => { for (let i = 0; i < 800; i++) { const m = seen.find(pred); if (m) return m; await new Promise((r) => setTimeout(r, 10)); } throw new Error("timeout"); };
    const welcome = await until((m) => m.type === "welcome");
    return { seen, id: welcome.id, welcome };
  };
  const A = await join("Alice"), B = await join("Bob");
  const pa = sim.players.get(A.id), pb = sim.players.get(B.id);
  for (const [p, x] of [[pa, 8.5], [pb, 120.5]]) { p.position.copy({ x, y: 10, z: 64.5 }); p.previous.copy(p.position); }
  const item = sim.items.spawn(makeStack(3, 1, 0), 20.5, 10.5, 64.5, { delay: 0, motion: [0, 0, 0] });
  const wait = async (pred) => { for (let i = 0; i < 400 && !pred(); i++) await new Promise((r) => setTimeout(r, 10)); assert.ok(pred(), "condition"); };
  const has = (S) => S.seen.some((m) => m.type === "tick" && m.items?.some((r) => r.i === item.eid));
  await wait(() => has(A));
  const mark = B.seen.length; await new Promise((r) => setTimeout(r, 150));
  assert.equal(B.seen.slice(mark).filter((m) => m.type === "tick").length > 3, true, "Bob receives ticks");
  assert.equal(has(B), false, "Bob never got the item (100 blocks away)");
  pa.position.copy({ x: 100.5, y: 10, z: 64.5 }); // 80 from the item
  const markA = A.seen.length;
  await wait(() => A.seen.slice(markA).some((m) => m.type === "tick" && !m.items));
  assert.ok(sim.items.items.some((e) => e.eid === item.eid && !e.dead), "the item itself still exists on the server");
  assert.equal(has(B), false, "and Bob, still far away, never saw it");
});
