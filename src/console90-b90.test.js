// Batch 90 console90: /netstat on the dedicated server. The chat-spam, illegal-character and duplicate-login kicks count an S40; the cached chunk length follows light and
// side-state changes; chunk data carries the real metadata of side-state blocks (flowing water, facing, lit); S23 writes the native block id; mob packets use their own ids
// and the executed S0F / S1C sizes (public/research/console90-reference.json, tools/probes/Console90Probe.java).
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { langReady } from "./chat-component.js";
import { PLAY_FRAME, writePackets, kickPacket, MOB_WATCHER } from "./multiplayer/net-packet-ids.js";
import { columnData, columnsDeflated, chunkSourceFor, STATEFUL } from "./multiplayer/net-native-bytes.js";
import { WATER } from "./world.js";
import { PROTOCOL } from "./multiplayer/protocol.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { KICK } from "./server-handlers.js";

await langReady;
const ref = JSON.parse(await readFile(new URL("../public/research/console90-reference.json", import.meta.url)));
const C = PLAY_FRAME.clientbound;

test("executed: every living class's DataWatcher bytes are the table the packets use", () => {
  assert.equal(ref.spawns.length, 29);
  for (const r of ref.spawns) { assert.equal(typeof r.s0f, "number", r.id); assert.equal(MOB_WATCHER[r.id], r.s0f - (C[15] - 1), r.id); assert.equal(r.entries.reduce((n, e) => n + e[2], 1), MOB_WATCHER[r.id], r.id); }
});

test("mob packets: each under its own id; S0F and the first S1C carry the class's DataWatcher", () => {
  const r = writePackets({ type: "mobs", packets: [{ type: "spawn", mob: "pig" }, { type: "meta", mob: "x" }, { type: "move" }, { type: "look" }, { type: "moveLook" }, { type: "teleport" }, { type: "head" }, { type: "velocity" }] });
  assert.deepEqual(r, [[15, 24 + 31], [28, 5 + 31], [21, 8], [22, 7], [23, 10], [24, 19], [25, 6], [18, 11]]);
  assert.deepEqual(writePackets({ type: "mobs", packets: [{ type: "spawn" }] }), [[15, C[15]]], "an unknown class is the empty watcher");
  assert.equal(writePackets({ type: "mobs", packets: [{ type: "spawn", mob: "wolf" }] })[0][1], ref.spawns.find((x) => x.id === "Wolf").s0f);
  assert.equal(writePackets({ type: "mobs", packets: [{ type: "spawn", mob: "zombie" }] })[0][1], ref.spawns.find((x) => x.id === "Zombie").s0f);
  // a later S1C writes only the changed entries: the potion colour (header + int), the air (header + short), the flags byte once, then the end byte
  assert.deepEqual(writePackets({ type: "mobs", packets: [{ type: "move" }, { type: "meta", potion: 3, air: 10, invisible: true, burning: true }] })[1], [28, 5 + 1 + 5 + 3 + 2]);
  assert.deepEqual(writePackets({ type: "mobs", packets: [{ type: "spawn", mob: "pig" }, { type: "move" }, { type: "meta", air: 5 }] })[2], [28, 5 + 1 + 3], "only the meta right after the spawn is whole");
  assert.deepEqual(writePackets({ type: "mobs", packets: [{ type: "equipment", slot: 0 }] })[0], [4, 9], "an empty slot: short -1");
  assert.equal(writePackets({ type: "mobs", packets: [{ type: "equipment", slot: 0, item: { id: 1, count: 1, damage: 0 } }] })[0][1], 9 - 2 + 7);
  assert.deepEqual(writePackets({ type: "mobs", packets: [{ type: "attributes", list: [{ name: "generic.maxHealth", mods: [] }, { name: "generic.movementSpeed", mods: [[0.3, 2]] }] }] })[0],
    [32, 9 + (1 + 17 + 10) + (1 + 21 + 10 + 25)]);
});

test("S23 writes the native block id's VarInt (the port id differs)", () => {
  // port 58 is the stained clay (native 159, a two-byte VarInt)
  assert.deepEqual(writePackets({ type: "blocks", changes: [[1, 2, 3, 58]] }), [[35, 13]]);
  assert.deepEqual(writePackets({ type: "blocks", changes: [[1, 2, 3, 1]] }), [[35, 12]], "stone stays one byte");
});

const height = 32, cells = 256 * height;
const waterColumn = () => ({ x: 0, z: 0, runs: [WATER, cells] });
const nativeMeta = (data, count, cell) => { const at = count * 4096 + (cell >> 1); return (data[at] >> ((cell & 1) * 4)) & 15; };
test("chunk data: side state decides the metadata and the id of flowing water, a lit furnace, chest facing", () => {
  assert.ok(STATEFUL.has(WATER) && STATEFUL.has(14) && STATEFUL.has(41));
  const still = columnData(waterColumn(), { height }), flowing = columnData(waterColumn(), { height, stateAt: () => ({ flowing: true }) });
  assert.equal(still[0], 9); assert.equal(flowing[0], 8, "flowing_water is 8, still_water 9");
  const chest = { x: 0, z: 0, runs: [41, cells] }; // internal 41: the chest
  const plain = columnData(chest, { height }), faced = columnData(chest, { height, stateAt: () => ({ facing: 5 }) });
  assert.equal(nativeMeta(plain, 2, 0), 3, "default facing 3");
  assert.equal(nativeMeta(faced, 2, 0), 5, "the chest's own facing");
  const furnace = { x: 0, z: 0, runs: [14, cells] };
  const lit = columnData(furnace, { height, stateAt: () => ({ lit: true, facing: 4 }) });
  assert.equal(lit[0], 62, "lit_furnace"); assert.equal(nativeMeta(lit, 2, 0), 4);
  assert.equal(columnData(furnace, { height })[0], 61);
});

test("the cached chunk length follows light-only and state-only changes", () => {
  const col = () => ({ x: 0, z: 0, runs: [1, cells] });
  const light = { size: 16, height, sky: new Uint8Array(cells), block: new Uint8Array(cells) };
  const source = { height, light };
  const a = columnsDeflated([col()], source, {});
  assert.equal(columnsDeflated([col()], source, {}), a, "the same column and light hit the cache");
  let s = 12345; for (let i = 0; i < cells; i++) { s = (s * 1103515245 + 12345) >>> 0; light.sky[i] = (s >>> 16) & 15; }
  const b = columnsDeflated([col()], source, {});
  assert.notEqual(b, a, "a light change with the same cells deflates again");
  const wsrc = { height, stateAt: () => undefined };
  const w0 = columnsDeflated([waterColumn()], wsrc, {});
  let r = 777; wsrc.stateAt = () => { r = (r * 1103515245 + 12345) >>> 0; return (r >>> 16) & 1 ? { flowing: true } : undefined; };
  assert.notEqual(columnsDeflated([waterColumn()], wsrc, {}), w0, "a flow change with the same cells deflates again");
});

test("chunkSourceFor reads the dimension's side state", () => {
  const sim = new DedicatedSimulation({ seed: "console90", biome: "java", generationVersion: 9 }, { mobs: false });
  const src = chunkSourceFor(sim, 0);
  assert.equal(typeof src.stateAt, "function");
  assert.equal(src.stateAt(0, 70, 0, WATER), undefined, "no pending tick: still");
  const key = sim.fluids.key(0, 70, 0, WATER);
  sim.fluids.pending.set(key, {});
  assert.deepEqual(src.stateAt(0, 70, 0, WATER), { flowing: true });
  sim.fluids.pending.delete(key);
  sim.tiles.chests["1,70,1"] = { facing: 4 };
  assert.deepEqual(src.stateAt(1, 70, 1, 41), { facing: 4 });
  sim.redstone.lit.add("2,70,2");
  assert.deepEqual(src.stateAt(2, 70, 2, 112), { powered: true });
});

// ---- the live server ----
const token = "test-only-not-a-deployed-server-key", origin = "http://localhost:5179", password = "correct horse battery";
function inbox(ws) {
  const seen = [], waiting = [];
  ws.on("message", (data) => { const m = JSON.parse(data), i = waiting.findIndex((w) => w.predicate(m)); if (i < 0) seen.push(m); else { const [w] = waiting.splice(i, 1); clearTimeout(w.timer); w.resolve(m); } });
  return (predicate) => { const i = seen.findIndex(predicate); if (i >= 0) return Promise.resolve(seen.splice(i, 1)[0]);
    return new Promise((resolve, reject) => waiting.push({ predicate, resolve, timer: setTimeout(() => reject(new Error("Timed out waiting for server packet")), 5000) })); };
}
async function start(t) {
  const { createDedicatedServer } = await import("../server/server.js");
  const dir = await mkdtemp(path.join(os.tmpdir(), "mc-web-console90-"));
  const simulation = new DedicatedSimulation({ seed: "console90", biome: "java", generationVersion: 9 }, { mobs: false });
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, "world.json"), simulation, tickMs: 20, saveMs: 600000, log: () => {} });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const connect = async (name, session) => {
    session ??= (await app.accounts.register({ invite: token, name, password }, token)).session;
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin }), next = inbox(ws);
    await once(ws, "open");
    const closed = new Promise((resolve) => ws.on("close", (code, reason) => resolve([code, String(reason)])));
    ws.send(JSON.stringify({ type: "join", protocol: PROTOCOL, session }));
    return { ws, next, session, welcome: await next((m) => m.type === "welcome"), closed };
  };
  return { app, simulation, connect };
}

test("live: the illegal-character kick and the duplicate login count an S40; the spam kick writes the key", async (t) => {
  const s = await start(t);
  const w = s.simulation.admin.netStats.writes;
  const a = await s.connect("Alex");
  assert.equal(w.counts[64], 0);
  a.ws.send(JSON.stringify({ type: "chat", text: "bad § text" }));
  assert.deepEqual(await a.closed, [1008, KICK.illegal]);
  assert.deepEqual([w.counts[64], w.bytes[64]], [1, kickPacket(KICK.illegal)[1]], "nh.c(String): an S40 with the reason");
  const b = await s.connect("Bob");
  const b2 = await s.connect("Bob", b.session);
  assert.deepEqual(await b.closed, [1008, "You logged in from another location"]);
  assert.deepEqual([w.counts[64], w.bytes[64]], [2, kickPacket(KICK.illegal)[1] + kickPacket("You logged in from another location")[1]]);
  const c = await s.connect("Cara");
  for (let i = 0; i < 40; i++) c.ws.send(JSON.stringify({ type: "chat", text: `spam ${i}` }));
  assert.deepEqual(await c.closed, [1008, KICK.spam]);
  assert.equal(w.counts[64], 3);
  assert.equal(w.bytes[64], kickPacket(KICK.illegal)[1] + kickPacket("You logged in from another location")[1] + 19, 'S40 "disconnect.spam": 1 + VarInt + 17 JSON bytes');
  b2.ws.close();
});
