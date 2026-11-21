// Batch 89 console89: the dedicated server's autosave on MinecraftServer.u()'s tick counter (900 ticks, silent), /netstat's real deflated chunk sizes (S21 / S26),
// ItemStack NBT tags, one record per native packet a bundled message stands for, and the kicks (/kick, /ban, the stop) counted as S40.
// Native evidence: public/research/console89-reference.json (tools/probes/Console89Probe.java, executed on the unchanged 1.7.10 classes: chunks built from the formula
// below written as S21 / S26, a tagged ItemStack in S2F, S40 for each kick text); the tick and kick orders are bytecode-read (.shared-memory/notes/console89-b89-track.md).
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { langReady } from "./chat-component.js";
import { PLAY_FRAME, writePackets, readPackets, writePacketBytes, readPacketBytes, kickPacket } from "./multiplayer/net-packet-ids.js";
import { chunkData, columnData, columnsDeflated, deflatedLength, stackTag, tagGzipLength, itemTagBytes, chunkSourceFor } from "./multiplayer/net-native-bytes.js";
import { AUTOSAVE_TICKS, AUTOSAVE_LOG, autosaveClock, autosaveTicksOf, STOP_KICK } from "./multiplayer/server-save.js";
import { KICK_DEFAULT_REASON, KICK_BAN, KICK_IP_BAN } from "./multiplayer/server-admin.js";
import { fromOriginal } from "./block-registry.js";
import { encodeColumn, PROTOCOL } from "./multiplayer/protocol.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { chatDisplay } from "./server-broadcast.js";

await langReady;
const ref = JSON.parse(await readFile(new URL("../public/research/console89-reference.json", import.meta.url)));
const row = (name) => { const r = ref.chunks.find((x) => x.name === name); assert.ok(r, name); return r; };
const C = PLAY_FRAME.clientbound;

// The probe's formula (Console89Probe.id / meta / sky / block / biome), native ids; x, z local to the chunk.
const id = (x, y, z, cx) => (y === 0 ? 7 : y < 40 ? ((x * 7 + y * 13 + z * 3 + cx) % 17 === 0 ? 16 : 1) : y < 44 ? 3 : y === 44 ? 2 : x === 8 && z === 8 && y < 50 ? 17 : y === 45 && x === 0 ? 35 : 0);
const meta = (x, y, z, cx) => { const b = id(x, y, z, cx); return b === 35 ? z & 15 : b === 17 ? 1 : 0; };
const sky = (x, y, z) => (y >= 45 ? 15 : y > 40 ? 15 - (45 - y) * 3 : 0);
const block = (x, y, z) => Math.max(0, 14 - Math.abs(x - 4) - Math.abs(y - 20) - Math.abs(z - 11));
const biome = (x, z) => ((x + z) % 3 === 0 ? 4 : 1);
const HEIGHT = 80; // sections 0-3 hold the formula (y < 64); section 4 exists with light only
const biomes = () => { const b = new Uint8Array(256); for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) b[z << 4 | x] = biome(x, z); return b; };
function nativeChunk(cx) {
  const n = 256 * HEIGHT, out = { height: HEIGHT, ids: new Uint16Array(n), metas: new Uint8Array(n), sky: new Uint8Array(n), block: new Uint8Array(n), biomes: biomes() };
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < HEIGHT; y++) {
    const c = (x * 16 + z) * HEIGHT + y;
    if (y < 64) { out.ids[c] = id(x, y, z, cx); out.metas[c] = meta(x, y, z, cx); }
    out.sky[c] = sky(x, y, z); out.block[c] = block(x, y, z);
  }
  return out;
}
// The same chunk as the port sends it: port cells (fromOriginal of the native ones) run-length encoded (encodeColumn), and a source with the light and biomes.
function portColumn(cx, cz) {
  const n = 256 * HEIGHT, blocks = new Uint8Array(n), metas = new Uint8Array(n);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 64; y++) {
    const b = id(x, y, z, cx); if (!b) continue;
    const p = fromOriginal(b, meta(x, y, z, cx)); assert.ok(p?.exact, `${b}:${meta(x, y, z, cx)}`);
    const c = (x * 16 + z) * HEIGHT + y; blocks[c] = p.id; metas[c] = p.meta;
  }
  return encodeColumn({ x: cx, z: cz, blocks, meta: metas });
}
const source = (hasSky = true) => ({ height: HEIGHT, hasSky, light: { skyAt: (x, y, z) => sky(x & 15, y, z & 15), blockAt: (x, y, z) => block(x & 15, y, z & 15) }, biomes: () => biomes() });
const sha = (d) => createHash("sha256").update(d).digest("hex");

test("the gx.a layout and Deflater(-1) reproduce the executed S21 / S26 samples byte for byte", () => {
  const a = nativeChunk(2), b = nativeChunk(3);
  const check = (name, data, head) => { const r = row(name); assert.equal(data.length, r.dataLength, name); assert.equal(sha(data), r.dataSha256, name); assert.equal(head + deflatedLength(data), r.bytes, name); };
  check("S21 full", chunkData(a), 18); // id VarInt, int x, int z, bool, short, short, int length
  check("S21 partial 0b10010", chunkData(a, { full: false, mask: 0x12 }), 18);
  check("S21 full, no sky", chunkData(a, { hasSky: false }), 18);
  check("S21 unload", chunkData(a, { mask: 0 }), 18);
  const da = chunkData(a), both = new Uint8Array(da.length * 2); both.set(da); both.set(chunkData(b), da.length);
  check("S26 two chunks", both, 8 + 12 * 2); // id, short count, int length, bool sky, then 12 bytes a chunk
});

test("the port's columns (run-length cells, a light source) give the same data and the same record sizes", () => {
  const a = portColumn(2, 3), b = portColumn(3, 3), ctx = { chunks: source() };
  assert.equal(sha(columnData(a, ctx.chunks)), row("S21 full").dataSha256);
  assert.equal(sha(columnData(a, ctx.chunks, { full: false, mask: 0x12 })), row("S21 partial 0b10010").dataSha256);
  assert.equal(sha(columnData(a, source(false))), row("S21 full, no sky").dataSha256);
  assert.deepEqual(writePackets({ type: "chunkBulk", columns: [a, b] }, ctx), [[38, row("S26 two chunks").bytes]], "one S26, deflated once");
  assert.deepEqual(writePackets({ type: "tick", tick: 1, players: [], changes: [], chunks: [{ ...a, mask: 0x12 }] }, ctx), [[33, row("S21 partial 0b10010").bytes]], "a resent chunk: S21 with the changed sections");
  assert.deepEqual(writePackets({ type: "chunkUnload", columns: [[2, 3]] }, ctx), [[33, row("S21 unload").bytes]], "an unload: mask 0, the biome bytes only");
  assert.deepEqual(writePackets({ type: "chunkUnload", columns: [{ x: 0, z: 0 }] }), [[33, 30]], "one biome (the b88 sample)");
  assert.equal(columnsDeflated([a], ctx.chunks), row("S21 full").bytes - 18, "cached by the cells: the same answer again");
  assert.equal(columnsDeflated([{ ...a, runs: [...a.runs] }], ctx.chunks), row("S21 full").bytes - 18, "a fresh copy of the same column");
  // with no light source the light is estimated (sky 15 above the column's top block): the data has the native layout and length, not the native light
  const est = columnData(a, { height: HEIGHT, biomes: () => biomes() });
  assert.equal(est.length, row("S21 full").dataLength);
  // a welcome / dimension change of more than five columns is several S26 (gz.c(): five columns a packet)
  const cols = Array.from({ length: 7 }, (_, i) => portColumn(2, i));
  const w = writePackets({ type: "welcome", world: { columns: cols } }, ctx);
  assert.deepEqual(w.map((r) => r[0]), [1, 38, 38]); assert.equal(w[0][1], C[1]);
  assert.deepEqual(writePackets({ type: "dimRespawn", world: { columns: cols.slice(0, 5) } }, ctx).map((r) => r[0]), [7, 38]);
});

test("chunkSourceFor reads the simulation's world, light and biomes without creating a dimension", () => {
  const sim = new DedicatedSimulation({ seed: "console89", biome: "java", generationVersion: 9 }, { mobs: false });
  const s = chunkSourceFor(sim, 0);
  assert.equal(s.height, sim.world.height); assert.equal(s.light, sim.light); assert.equal(s.hasSky, true);
  assert.equal(chunkSourceFor(sim, 0), s, "one source per world (the cache key)");
  assert.equal(s.biomes(0, 0)[0], sim.world.biomeAt(0, 0).id);
  assert.equal(chunkSourceFor(sim, -1), undefined, "no Nether yet: the estimate, and no Nether is built");
  assert.equal(sim.dimensions.nether ?? null, null);
  const col = encodeColumn([...sim.world.chunks.values()][0]), n = writePacketBytes({ type: "chunkBulk", columns: [col] }, { chunks: s });
  assert.ok(n > 12 + C[38] && n < JSON.stringify(col).length, `${n}`);
});

test("an ItemStack's NBT tag counts its gzip bytes (et.a(add), du.a)", () => {
  const sword = { id: 276, count: 1, damage: 0, enchantments: [{ id: 16, lvl: 5 }], displayName: "Hi" };
  assert.equal(tagGzipLength(stackTag(sword)), ref.items[0].gzip);
  assert.deepEqual(writePackets({ type: "setSlot", windowId: 0, slot: 36, item: sword }), [[47, ref.items[0].bytes]]);
  assert.deepEqual(writePackets({ type: "setSlot", windowId: 0, slot: 36, item: { id: 276, count: 1, damage: 0 } }), [[47, ref.items[1].bytes]], "no tag: short -1");
  assert.equal(itemTagBytes(null), 2); assert.equal(itemTagBytes({ id: 1, count: 1 }), 2); assert.equal(itemTagBytes(sword), 2 + ref.items[0].gzip);
  assert.deepEqual(writePackets({ type: "windowItems", slots: [sword, null], cursor: null }), [[48, C[48] + 5 + 2 + ref.items[0].gzip + 2], [47, C[47]]], "S30 with the tag, then the cursor's S2F");
});

test("kicks are S40 with the full reason: the executed sizes", () => {
  const texts = ref.kicks.map((k) => k.text);
  assert.deepEqual(texts.slice(0, 3), [KICK_DEFAULT_REASON, KICK_BAN, KICK_IP_BAN], "the port's texts are the native ones");
  assert.equal(texts[4], STOP_KICK);
  for (const k of ref.kicks) assert.deepEqual(kickPacket(k.text), [64, k.bytes], k.text);
  assert.equal(writePacketBytes({ type: "error", text: "go <away> & don't" }), ref.kicks[5].bytes, "Gson's HTML escapes");
});

test("a bundled message is one record per native packet", () => {
  const tick = { type: "tick", players: [{ id: "a" }, { id: "b" }, { id: "c" }], changes: [[0, 1, 0, 1, 0], [1, 1, 0, 1, 0], [20, 1, 0, 1, 0], [0, 1, 40, 152, 0]] };
  assert.deepEqual(writePackets({ ...tick, tick: 40 }, { self: "a" }), [[3, C[3]], [24, C[24]], [24, C[24]], [34, C[34] + 8], [35, 12], [35, 13]], "S03, an S18 per other player, S22 / S23 per chunk");
  assert.deepEqual(writePackets({ ...tick, tick: 41 }, { self: "a" }).map((r) => r[0]), [24, 24, 34, 35, 35], "S03 only every 20 ticks");
  assert.deepEqual(writePackets({ ...tick, tick: 41 }, { self: "a", tick: 60 }).map((r) => r[0]), [3, 24, 24, 34, 35, 35], "the server's own counter decides");
  assert.deepEqual(writePackets({ type: "mobs", packets: [{ type: "spawn" }, { type: "destroy", i: 1 }, { type: "destroy", i: 2 }] }).map((r) => r[0]), [15, 19]);
  assert.deepEqual(writePackets({ type: "vehicles", set: [{}, {}], del: [1] }), [[24, C[24]], [24, C[24]], [19, C[19] + 4]]);
  assert.deepEqual(writePackets({ type: "sound", sounds: [{ name: "random.click" }, { name: "random.click" }] }).map((r) => r[0]), [41, 41]);
  assert.deepEqual(writePackets({ type: "beaconWindow" }).map((r) => r[0]), [45, 49, 49, 49]);
  assert.deepEqual(writePackets({ type: "pingList", items: [{ name: "Alex" }, { name: "Bob" }] }).map((r) => r[0]), [56, 56]);
  assert.deepEqual(writePackets({ type: "blocks", changes: [] }), [], "nothing sent, nothing counted");
  assert.deepEqual(readPackets({ type: "join", name: "Alex" }), [[0, 6], [0, 6]], "C00 handshake, C00 login start");
  assert.deepEqual(readPackets({ type: "pingStatus" }), [[0, 6], [0, 1]], "the status handshake, C00 query");
  assert.deepEqual(writePackets({ type: "chat", text: "hello" }), [[2, writePacketBytes({ type: "chat", text: "hello" })]], "a single packet is one record");
  assert.equal(readPacketBytes({ type: "pickup" }), null); assert.equal(writePackets({ type: "toString" }), null);
});

test("the autosave clock: every 900 ticks from launch, silent", () => {
  assert.equal(AUTOSAVE_TICKS, 900); assert.deepEqual(AUTOSAVE_LOG, []);
  const c = autosaveClock(); let first = 0, saves = 0;
  for (let i = 1; i <= 2700; i++) if (c.step()) { saves++; first ||= i; }
  assert.equal(first, 900, "tickCounter++ then % 900: the first is the 900th tick"); assert.equal(saves, 3);
  assert.equal(autosaveTicksOf({}), 900);
  assert.equal(autosaveTicksOf({ autosaveTicks: 3 }), 3);
  assert.equal(autosaveTicksOf({ saveMs: 60000, tickMs: 10 }), 6000, "an old test's saveMs, in ticks");
  assert.equal(autosaveTicksOf({ saveMs: 10000 }), 200);
  assert.equal(autosaveClock(0).every, 900);
});

// ---- the live server ----
const token = "test-only-not-a-deployed-server-key", origin = "http://localhost:5179", password = "correct horse battery";
function inbox(ws) {
  const seen = [], waiting = [];
  ws.on("message", (data) => { const m = JSON.parse(data), i = waiting.findIndex((w) => w.predicate(m)); if (i < 0) seen.push(m); else { const [w] = waiting.splice(i, 1); clearTimeout(w.timer); w.resolve(m); } });
  return (predicate) => { const i = seen.findIndex(predicate); if (i >= 0) return Promise.resolve(seen.splice(i, 1)[0]);
    return new Promise((resolve, reject) => waiting.push({ predicate, resolve, timer: setTimeout(() => reject(new Error("Timed out waiting for server packet")), 5000) })); };
}
async function start(t, options = {}) {
  const { createDedicatedServer } = await import("../server/server.js");
  const dir = await mkdtemp(path.join(os.tmpdir(), "mc-web-console89-"));
  const dataFile = path.join(dir, "world.json");
  const simulation = new DedicatedSimulation({ seed: "console89", biome: "java", generationVersion: 9 }, { mobs: false });
  const lines = [];
  const app = await createDedicatedServer({ port: 0, token, dataFile, simulation, tickMs: 20, log: (m) => lines.push(m), ...options });
  const log = [];
  app.social.log = (m) => { const d = chatDisplay(m); log.push(typeof d === "string" ? d : d.unformatted()); };
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const connect = async (name) => {
    const session = (await app.accounts.register({ invite: token, name, password }, token)).session;
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin }), next = inbox(ws);
    await once(ws, "open");
    const closed = new Promise((resolve) => ws.on("close", (code, reason) => resolve([code, String(reason)])));
    ws.send(JSON.stringify({ type: "join", protocol: PROTOCOL, session }));
    return { ws, next, welcome: await next((m) => m.type === "welcome"), closed };
  };
  const console1 = async (line) => { const n = log.length; app.consoleCommand(line); for (let i = 0; i < 100 && log.length === n; i++) await new Promise((r) => setTimeout(r, 20)); return log.slice(n); };
  return { app, simulation, lines, log, dataFile, connect, console: console1 };
}

test("live: /kick and /ban kick with an S40 each, the stop kick too", async (t) => {
  const s = await start(t, { saveMs: 600000 });
  const w = s.simulation.admin.netStats.writes;
  const a = await s.connect("Alex"), b = await s.connect("Bob"), c = await s.connect("Cara");
  assert.equal(w.counts[64], 0);
  await s.console("kick Alex");
  assert.deepEqual(await a.closed, [1008, KICK_DEFAULT_REASON]);
  assert.deepEqual([w.counts[64], w.bytes[64]], [1, 26]);
  await s.console("ban Bob");
  assert.deepEqual(await b.closed, [1008, KICK_BAN]);
  assert.deepEqual([w.counts[64], w.bytes[64]], [2, 26 + 36]);
  await c.next((m) => m.type === "tick");
  await s.app.close();
  assert.deepEqual(await c.closed, [1008, STOP_KICK]);
  assert.deepEqual([w.counts[64], w.bytes[64]], [3, 26 + 36 + 17], "oi.u(): the stop kick is an S40");
  assert.ok(w.counts[38] >= 3, "the welcomes' chunk bulks"); assert.equal(w.counts[1], 3, "one S01 a join");
});

test("live: the autosave runs on the tick counter (the override) and logs nothing", async (t) => {
  const s = await start(t, { autosaveTicks: 3 });
  let saved = false;
  for (let i = 0; i < 100 && !saved; i++) { await new Promise((r) => setTimeout(r, 20)); saved = await stat(s.dataFile).then(() => true, () => false); }
  assert.ok(saved, "saved after 3 ticks");
  assert.deepEqual(s.lines, AUTOSAVE_LOG, "a(true) and oi.j() log no line");
  const ticks = JSON.parse(await readFile(s.dataFile, "utf8")).ticks;
  assert.ok(ticks >= 3, `${ticks}`);
});
