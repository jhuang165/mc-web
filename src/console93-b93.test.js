// Batch 93 console93: /netstat on the dedicated server counts the command block cart's watcher strings (join S1C and later changes), the tracker packets of a snow golem's snowball (64 / 10 /
// velocity, an S0E of type 61), and holds a vanished dispEnts row's S13 until the player's next onUpdate (EntityPlayerMP.destroyedItemsNetCache, at most 127 ids a packet).
// Evidence: tools/probes/Console93Probe.java -> public/research/console93-reference.json (executed on the unchanged 1.7.10 classes); the queue and tracker numbers are bytecode-read.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PLAY_FRAME, writePackets, drainDestroyed, kindRecords } from "./multiplayer/net-packet-ids.js";
import { setVehicleInfo, joinWatcher, stringChange } from "./multiplayer/server-cart-track.js";
import { setRowInfo } from "./multiplayer/net-row-info.js";
import { GolemTracks } from "./multiplayer/tnt-tracks.js";

const ref = JSON.parse(await readFile(new URL("../public/research/console93-reference.json", import.meta.url)));
const C = PLAY_FRAME.clientbound;

test("executed: the command cart's whole-watcher S1C holds its command and last output strings, a changed string is its own entry", () => {
  assert.equal(ref.cmdcart.length, 18);
  for (const r of ref.cmdcart) assert.equal(joinWatcher(false, 6, r.watch23, r.watch24), r.s1cWhole, `${r.commandUtf8} / ${r.watch24Utf8}`);
  assert.equal(joinWatcher(false, 6, "", ""), ref.cmdchange.fresh, "a cart just made: two empty strings");
  assert.equal(joinWatcher(false, 6), ref.cmdchange.fresh);
  assert.equal(joinWatcher(false, 1, "ignored", "ignored"), 38, "other carts have no strings");
  assert.equal(6 + stringChange(["", ""], ["say hi", ""]), ref.cmdchange.only23);
  assert.equal(6 + stringChange(["", ""], ["", "null"]), ref.cmdchange.only24);
  assert.equal(stringChange(["a", "b"], ["a", "b"]), 0, "te.b marks a value changed only when it differs");
  assert.equal(6 + stringChange(["", ""], ["say hi", "null"]), ref.cmdchange.only23 + ref.cmdchange.only24 - 6);
});

test("a command cart's join and its string changes are counted", () => {
  const rec = (info) => { const r = { v: "c1" }; setVehicleInfo(r, info); return writePackets({ type: "vehicles", set: [r] }); };
  const cart = ref.cmdcart.find((r) => r.commandUtf8 === 6 && r.watch24Utf8 === 18);
  assert.deepEqual(rec({ kinds: [], join: true, data: 6, velocity: true, watch: joinWatcher(false, 6, cart.watch23, cart.watch24) }), [[14, C[14] + 6], [28, cart.s1cWhole], [18, 11]]);
  assert.deepEqual(rec({ kinds: [], join: false, data: 6, velocity: true, strings: 8 }), [[28, ref.cmdchange.only23]], "a new command with no output change: one S1C, not the 5 byte int guess");
  assert.deepEqual(rec({ kinds: ["move"], join: false, strings: 6 }), [[28, ref.cmdchange.only24], [21, 8]]);
  assert.deepEqual(kindRecords([{ type: "strings", bytes: 6 }, "velocity"]), [[28, 12], [18, 11]], "a quiet cart's output change");
});

test("executed: S13 is 2 + 4 bytes an id; the queue sends 127 ids a packet", () => {
  for (const r of ref.s13) assert.equal(r.bytes, r.ids === 0 ? C[19] : C[19] + 4 * r.ids);
  const q = { n: 128 };
  assert.deepEqual(drainDestroyed(q), [[19, ref.s13.find((r) => r.ids === 127).bytes], [19, ref.s13.find((r) => r.ids === 1).bytes]]);
  assert.equal(q.n, 0);
  assert.deepEqual(drainDestroyed(q), []);
  assert.deepEqual(drainDestroyed(undefined), []);
});

test("a vanished dispEnts row's S13 waits for the next tick when the connection has a queue", () => {
  const objs = new Map(), destroyed = { n: 0 }, ctx = { objs, destroyed };
  const row = (i) => setRowInfo({ k: "t", i, x: 0, y: 0, z: 0, fuse: 40 }, { data: 0, velocity: true, watch: 11, kinds: [] });
  writePackets({ type: "dispEnts", ents: [row(1), row(2)] }, ctx);
  assert.deepEqual(writePackets({ type: "dispEnts", ents: [row(1)] }, ctx), [], "tick N: nothing counted, the id is queued");
  assert.equal(destroyed.next, 1);
  assert.deepEqual(drainDestroyed(destroyed), [], "tick N's own drain (b94: the removal's tick) sends nothing");
  assert.deepEqual(drainDestroyed(destroyed), [[19, 6]], "tick N + 1's onUpdate");
  assert.deepEqual(writePackets({ type: "dispEnts", ents: [] }, ctx), []);
  drainDestroyed(destroyed);
  assert.deepEqual(drainDestroyed(destroyed), [[19, 6]]);
  const old = { objs: new Map() };
  writePackets({ type: "dispEnts", ents: [row(1)] }, old);
  assert.deepEqual(writePackets({ type: "dispEnts", ents: [] }, old), [[19, 6]], "without a queue (the old callers) it still counts at once");
});

test("a golem snowball's entry sends position packets on the 64 / 10 / velocity cadence and stops with the ball", () => {
  const tracks = new GolemTracks(), ball = { kind: "snowball", x: 10, y: 70, z: 10, mx: 0.6, my: 0.1, mz: 0, yaw: 90, pitch: 0, dead: false };
  const seen = [];
  for (let t = 0; t < 31; t++) {
    ball.x += ball.mx; ball.y += ball.my; ball.my -= 0.03;
    tracks.update([ball]);
    seen.push(tracks.kinds(ball).map((p) => p.type));
  }
  const ticks = seen.map((k, i) => (k.length ? i : -1)).filter((i) => i >= 0);
  assert.ok(ticks.length >= 2, `${JSON.stringify(ticks)}`);
  for (const i of ticks) assert.ok(i % 10 === 0, `tick ${i}: packets only on the entry's 10 tick beat`);
  assert.ok(seen.flat().every((k) => ["move", "moveLook", "look", "teleport", "velocity"].includes(k)));
  ball.dead = true; tracks.update([ball]);
  assert.deepEqual(tracks.kinds(ball), []);
  assert.equal(tracks.map.size, 0);
  // the rows: one S0E (data 0, no motion shorts) + S1C 11 + S12 on the join, then only the entry's packets, then the S13 queued
  const objs = new Map(), destroyed = { n: 0 }, ctx = { objs, destroyed };
  const b = (kinds) => setRowInfo({ k: "b", i: 9, kind: "snowball", x: 0, y: 0, z: 0 }, { data: 0, velocity: true, watch: 11, kinds });
  assert.deepEqual(writePackets({ type: "dispEnts", ents: [b([])] }, ctx), [[14, C[14]], [28, 11], [18, 11]]);
  assert.deepEqual(writePackets({ type: "dispEnts", ents: [b([{ type: "move" }, { type: "velocity" }])] }, ctx), [[21, 8], [18, 11]]);
  assert.deepEqual(writePackets({ type: "dispEnts", ents: [] }, ctx), []);
  drainDestroyed(destroyed);
  assert.deepEqual(drainDestroyed(destroyed), [[19, 6]]);
});

// ---- live: a Nether player's mob watcher changes are counted (the per-dimension lookup in server/server.js), and a TNT's S13 is counted one tick after the row goes ----
const token = "test-only-not-a-deployed-server-key", origin = "http://localhost:5179";
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
test("live: a Nether mob's watcher change (a baby's age) is an S1C on that player's connection", { timeout: 120000 }, async (t) => {
  const { once } = await import("node:events");
  const { WebSocket } = await import("ws");
  const { createDedicatedServer } = await import("../server/server.js");
  const { DedicatedSimulation } = await import("./multiplayer/simulation.js");
  const { World } = await import("./world.js");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const os = await import("node:os"), path = await import("node:path");
  const { PROTOCOL } = await import("./multiplayer/protocol.js");
  const w0 = new World("mp-console93"); w0.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world: w0, gameMode: "survival", mobs: true });
  s.rules.chunkStream = false; s.gameRules.doMobSpawning = "false"; // no natural spawns: their S0F / S1C would count too
  const dir = await mkdtemp(path.join(os.tmpdir(), "mc-web-console93-"));
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, "world.json"), simulation: s, tickMs: 10, saveMs: 600000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const session = (await app.accounts.register({ invite: token, name: "Alice", password: "correct horse" }, token)).session;
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin }), log = [];
  ws.on("message", (d) => log.push(JSON.parse(d)));
  await once(ws, "open"); ws.send(JSON.stringify({ type: "join", protocol: PROTOCOL, chunks: true, session }));
  const until = async (f) => { for (let i = 0; i < 6000; i++) { const m = log.find(f); if (m) return m; await new Promise((r) => setTimeout(r, 5)); } throw new Error("timed out"); };
  const welcome = await until((m) => m.type === "welcome");
  const a = s.players.get(welcome.id), stats = s.admin.netStats.writes;
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether, w = n.world;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) w.put(x, y, z, y === 69 ? 87 : 0, 0, false);
  await until((m) => m.type === "dimRespawn");
  const pig = n.mobs.mobs.create("pig", 64.5, 70, 60.5); pig.health = 10; pig.growingAge = -24000; n.mobs.mobs.entities.push(pig);
  const spawned = () => log.some((m) => m.type === "mobs" && m.packets.some((p) => p.type === "spawn" && p.mob === "pig"));
  for (let i = 0; i < 300 && !spawned(); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(spawned(), "the Nether player was sent the baby pig");
  // a baby's age (watcher 12, an int) changes every tick and no port packet carries it: only the per-dimension watcher lookup can count it
  const before = stats.counts[28];
  for (let i = 0; i < 200 && stats.counts[28] < before + 5; i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(stats.counts[28] >= before + 5, `S1C count ${before} -> ${stats.counts[28]}`);
  ws.close();
});
