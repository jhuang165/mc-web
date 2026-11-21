// Batch 94 console94: the dedicated server's /netstat sends every kind's S13 ids of a tick in ONE packet per connection (EntityPlayerMP.destroyedItemsNetCache, drained by onUpdate in
// packets of at most 127 ids: mw.d queues, mw.h drains, bytecode-read; S13 = byte count + 4 bytes an id, executed in console93-reference.json), a dead cart's or boat's S13 waits for the
// next drain, and the End's tracker lookup (mobsOf(1)) is run on a live server.
import test from "node:test";
import assert from "node:assert/strict";
import { PLAY_FRAME, writePackets, drainDestroyed } from "./multiplayer/net-packet-ids.js";
import { setRowInfo } from "./multiplayer/net-row-info.js";

const C = PLAY_FRAME.clientbound;
const row = (i) => setRowInfo({ k: "t", i, x: 0, y: 0, z: 0, fuse: 40 }, { data: 0, velocity: true, watch: 11, kinds: [] });
const mobGone = (...ids) => ({ type: "mobs", packets: ids.map((i) => ({ type: "destroy", i })) });

test("one S13 carries a tick's mob, item, thrown-row, cart and TNT ids together", () => {
  const q = { n: 0, next: 0 }, ctx = { objs: new Map(), destroyed: q };
  writePackets({ type: "dispEnts", ents: [row(1), row(2)] }, ctx);
  drainDestroyed(q);
  // tick N: the TNT rows vanish (immediate), two mobs and an item (already held a tick), one cart that left the re-check (held), one dead boat (immediate)
  assert.deepEqual(writePackets({ type: "dispEnts", ents: [] }, ctx), []);
  assert.deepEqual(writePackets(mobGone(5, 6), ctx), []);
  assert.deepEqual(writePackets({ type: "tick", changes: [], itrack: [{ i: 9, k: "item", p: [{ type: "destroy" }] }] }, ctx).filter((r) => r[0] === 19), []);
  assert.deepEqual(writePackets({ type: "vehicles", del: ["c1", "b2"], delLate: 1 }, ctx), []);
  assert.deepEqual([q.n, q.next], [4, 3]);
  assert.deepEqual(drainDestroyed(q), [[19, C[19] + 4 * 4]], "the tick's drain: one packet for the four held ids");
  assert.deepEqual(drainDestroyed(q), [[19, C[19] + 4 * 3]], "the next drain: the three immediate ones, again one packet");
  assert.deepEqual(drainDestroyed(q), []);
});

test("a dead cart's or boat's S13 waits one drain; without a queue it still counts at once", () => {
  const q = { n: 0, next: 0 };
  assert.deepEqual(writePackets({ type: "vehicles", del: ["c1"] }, { destroyed: q }), []);
  assert.deepEqual(drainDestroyed(q), []);
  assert.deepEqual(drainDestroyed(q), [[19, 6]]);
  assert.deepEqual(writePackets({ type: "vehicles", del: ["c1", "c2"] }, {}), [[19, 10]]);
});

test("the unified queue still sends at most 127 ids a packet", () => {
  const q = { n: 100, next: 0 };
  writePackets(mobGone(...Array.from({ length: 60 }, (_, i) => i)), { destroyed: q });
  assert.deepEqual(drainDestroyed(q), [[19, C[19] + 4 * 127], [19, C[19] + 4 * 33]]);
});

// ---- live: an End player's mob watcher changes are counted through mobsOf(1) (the tracker lookup the Nether test of batch 93 covered for dimension -1) ----
const token = "test-only-not-a-deployed-server-key", origin = "http://localhost:5179";
test("live: an End mob's watcher change (a baby pig's age) is an S1C on that player's connection", { timeout: 120000 }, async (t) => {
  const { once } = await import("node:events");
  const { WebSocket } = await import("ws");
  const { createDedicatedServer } = await import("../server/server.js");
  const { DedicatedSimulation } = await import("./multiplayer/simulation.js");
  const { World } = await import("./world.js");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const os = await import("node:os"), path = await import("node:path");
  const { PROTOCOL } = await import("./multiplayer/protocol.js");
  const w0 = new World("mp-console94"); w0.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world: w0, gameMode: "survival", mobs: true });
  s.rules.chunkStream = false; s.gameRules.doMobSpawning = "false";
  const dir = await mkdtemp(path.join(os.tmpdir(), "mc-web-console94-"));
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, "world.json"), simulation: s, tickMs: 10, saveMs: 600000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const session = (await app.accounts.register({ invite: token, name: "Alice", password: "correct horse" }, token)).session;
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin }), log = [];
  ws.on("message", (d) => log.push(JSON.parse(d)));
  await once(ws, "open"); ws.send(JSON.stringify({ type: "join", protocol: PROTOCOL, chunks: true, session }));
  const until = async (f) => { for (let i = 0; i < 6000; i++) { const m = log.find(f); if (m) return m; await new Promise((r) => setTimeout(r, 5)); } throw new Error("timed out"); };
  const welcome = await until((m) => m.type === "welcome");
  const a = s.players.get(welcome.id), stats = s.admin.netStats.writes;
  s.dimensions.arrive(a, 1);
  await until((m) => m.type === "dimRespawn");
  const mobs = s.dimensions.end.n.mobs.mobs;
  const pig = mobs.create("pig", a.position.x + 2, a.position.y, a.position.z); pig.health = 10; pig.growingAge = -24000; mobs.entities.push(pig);
  const spawned = () => log.some((m) => m.type === "mobs" && m.packets.some((p) => p.type === "spawn" && p.mob === "pig"));
  for (let i = 0; i < 300 && !spawned(); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(spawned(), "the End player was sent the baby pig");
  const before = stats.counts[28];
  for (let i = 0; i < 200 && stats.counts[28] < before + 5; i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(stats.counts[28] >= before + 5, `S1C count ${before} -> ${stats.counts[28]}`);
  ws.close();
});
