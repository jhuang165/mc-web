// Batch 88 console88: the dedicated server's saves under /save-off (MinecraftServer.u: oi.j then a(true); mt.a returns when levelSaving is set), /save-all,
// the stop sequence (MinecraftServer.o) and /netstat's native record sizes. Native evidence: public/research/console88-reference.json (tools/probes/Console88Probe.java,
// executed on the unchanged 1.7.10 classes: every packet written as the encoder fa counts it) and dedicated-cmds-reference.json (Dedicated84Probe: /save-all,
// /save-on and /save-off rows); the tick, save and stop orders are bytecode-read (.shared-memory/notes/console88-b88-track.md).
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { langReady } from "./chat-component.js";
import { SERVERBOUND, CLIENTBOUND, PLAY_FRAME, readPacketBytes, writePacketBytes, varIntSize, stringSize } from "./multiplayer/net-packet-ids.js";
import { composeSave, planSave, savePlayerData, STOP_LOG, STOP_KICK, worldSaveLine, DIMENSION_NAMES } from "./multiplayer/server-save.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { PROTOCOL } from "./multiplayer/protocol.js";
import { chatDisplay } from "./server-broadcast.js";

await langReady;
const ref = JSON.parse(await readFile(new URL("../public/research/console88-reference.json", import.meta.url)));
const dedicated = JSON.parse(await readFile(new URL("../public/research/dedicated-cmds-reference.json", import.meta.url)));
const sample = (name) => { const s = ref.samples.find((x) => x.name === name); assert.ok(s, name); return s.bytes; };

test("the reference: 99 packet classes written, the PLAY frame table is the executed base rows", () => {
  assert.equal(ref.base.length, 99);
  assert.deepEqual(ref.base.filter((r) => typeof r.bytes !== "number").map((r) => r.name), ["S01PacketEncryptionRequest"], "only the key request needs a real key");
  for (const dir of ["serverbound", "clientbound"]) {
    const rows = ref.base.filter((r) => r.state === "PLAY" && r.dir === dir);
    assert.equal(rows.length, Object.keys(PLAY_FRAME[dir]).length, dir);
    for (const r of rows) {
      if (dir === "clientbound" && r.id === 35) { assert.equal(r.bytes, 16); assert.equal(PLAY_FRAME[dir][35], 12, "S23: the base row's null block wrote VarInt -1 (5 bytes)"); continue; }
      assert.equal(PLAY_FRAME[dir][r.id], r.bytes, `${dir} ${r.id} ${r.name}`);
    }
  }
  assert.equal(varIntSize(0), 1); assert.equal(varIntSize(127), 1); assert.equal(varIntSize(128), 2); assert.equal(varIntSize(16383), 2); assert.equal(varIntSize(16384), 3); assert.equal(varIntSize(-1), 5);
  assert.equal(stringSize(""), 1); assert.equal(stringSize("é"), 3); assert.equal(stringSize("x".repeat(128)), 130);
});

test("the port's estimates equal the executed samples byte for byte", () => {
  assert.equal(writePacketBytes({ type: "chat", json: JSON.stringify({ translate: "chat.type.text", with: ["Alex", "hello"] }) }), sample("S02 chat.type.text Alex hello"));
  assert.equal(ref.samples.find((s) => s.name === "S02 chat.type.text Alex hello").note, '{"translate":"chat.type.text","with":["Alex","hello"]}', "the native serializer's JSON");
  assert.equal(writePacketBytes({ type: "chat", text: "hello" }), sample("S02 text hello"));
  assert.equal(writePacketBytes({ type: "error", text: STOP_KICK }), sample("S40 Server closed"));
  assert.equal(writePacketBytes({ type: "sound", sounds: [{ name: "random.click" }] }), sample("S29 random.click"));
  assert.equal(writePacketBytes({ type: "sound", sounds: [{ name: "random.click" }, { name: "random.click" }] }), 2 * sample("S29 random.click"), "a list counts one S29 each");
  assert.equal(writePacketBytes({ type: "fishFx", events: [{ n: "flame" }] }), sample("S2A flame"));
  assert.equal(writePacketBytes({ type: "mobs", packets: [{ type: "destroy", i: 1 }, { type: "destroy", i: 2 }, { type: "destroy", i: 3 }] }), sample("S13 three ids"), "one S13 for the tick's destroys");
  assert.equal(writePacketBytes({ type: "vehicles", del: [1, 2, 3] }), sample("S13 three ids"));
  assert.equal(writePacketBytes({ type: "tabReply", options: ["/help", "/home"] }), sample("S3A /help /home"));
  assert.equal(writePacketBytes({ type: "pingList", items: [{ name: "Alex", online: true, ping: 0 }] }), sample("S38 Alex"));
  assert.equal(writePacketBytes({ type: "stats", stats: { "stat.leaveGame": 7 } }), sample("S37 stat.leaveGame 7"));
  assert.equal(writePacketBytes({ type: "blocks", changes: [[1, 2, 3, 4, 0], [1, 2, 4, 4, 0], [1, 2, 5, 4, 0]] }), sample("S22 three records"));
  assert.equal(writePacketBytes({ type: "blocks", changes: [[1, 2, 3, 4, 0]] }), 12); assert.equal(writePacketBytes({ type: "blocks", changes: [[1, 2, 3, 152, 0]] }), 13, "a block id past 127 is a two-byte VarInt");
  assert.equal(writePacketBytes({ type: "openWindow", title: "container.chest", kind: "chest" }), sample("S2D container.chest"));
  assert.equal(writePacketBytes({ type: "chunkUnload", columns: [{ x: 0, z: 0 }] }), sample("S21 unload, one biome"));
  assert.equal(writePacketBytes({ type: "welcome" }), sample("S01 default"));
  assert.equal(writePacketBytes({ type: "dimRespawn" }), sample("S07 default"));
  assert.equal(writePacketBytes({ type: "fishHooks", hooks: [{}] }), sample("S0E data 1"), "a hook's data int is its angler, so the velocity shorts follow");
  assert.equal(writePacketBytes({ type: "mobs", packets: [{ type: "spawn" }] }), sample("S0F empty watcher"));
  const stone = { id: 1, count: 64 };
  assert.equal(writePacketBytes({ type: "setSlot", windowId: 0, slot: 36, item: stone }), sample("S2F stone x64"));
  assert.equal(sample("S30 three empty slots"), PLAY_FRAME.clientbound[48] + 3 * 2);
  assert.equal(sample("S30 one stone, one empty"), PLAY_FRAME.clientbound[48] + 7 + 2);
  assert.equal(writePacketBytes({ type: "windowItems", windowId: 1, slots: [stone, null], cursor: null }), sample("S30 one stone, one empty") + PLAY_FRAME.clientbound[47], "then the cursor's S2F");
  // the bundled tick: S03, an S18 per pose, the cells
  // b89 console89: the S03 in a tick is sent every 20 ticks (MinecraftServer.v), so the tick names its counter; before b89 every tick message counted an S03
  assert.equal(writePacketBytes({ type: "tick", tick: 20, players: [{}, {}], changes: [[0, 0, 0, 1, 0]] }), 17 + 2 * 19 + 12);
  assert.equal(writePacketBytes({ type: "tick", tick: 21, players: [{}, {}], changes: [[0, 0, 0, 1, 0]] }), 2 * 19 + 12);
  // serverbound
  assert.equal(readPacketBytes({ type: "chat", text: "hello" }), 7);
  assert.equal(readPacketBytes({ type: "input" }), PLAY_FRAME.serverbound[6], "the controls and the look: C06");
  assert.equal(readPacketBytes({ type: "tabReq", text: "/he" }), 5);
  assert.equal(readPacketBytes({ type: "sign", x: 0, y: 0, z: 0, text: ["", "", "", ""] }), PLAY_FRAME.serverbound[18]);
  assert.equal(readPacketBytes({ type: "settingsClient", language: "" }), PLAY_FRAME.serverbound[21]);
});

test("every counted kind has a size; uncounted kinds stay null", () => {
  for (const type of Object.keys(CLIENTBOUND)) { const n = writePacketBytes({ type }); assert.ok(Number.isInteger(n) && n >= 0, `${type}: ${n}`); }
  for (const type of Object.keys(SERVERBOUND)) { const n = readPacketBytes({ type }); assert.ok(Number.isInteger(n) && n > 0, `${type}: ${n}`); }
  for (const m of [{ type: "pickup" }, { type: "windowInventory" }, { type: "invBroke" }, { type: "toString" }, {}, null]) { assert.equal(readPacketBytes(m), null); assert.equal(writePacketBytes(m), null); }
});

// --- saves ---
const fakeSim = (levelSaving) => {
  const sim = new DedicatedSimulation({ seed: "console88", biome: "java", generationVersion: 9 });
  sim.admin.levelSaving = levelSaving; return sim;
};

test("composeSave: worlds with saving off keep the file's part; the players and the lists are current", () => {
  const before = { seed: "a", time: 1, edits: [[1]], admin: { ops: [] }, dimensions: { nether: { edits: ["n0"] }, end: { edits: ["e0"] } }, players: [["k", { yaw: 0 }]] };
  const now = { seed: "a", time: 9, edits: [[1], [2]], admin: { ops: [{ name: "x" }] }, dimensions: { nether: { edits: ["n1"] }, end: { edits: ["e1"] } }, players: [["k", { yaw: 1 }]] };
  const players = [["k", { yaw: 2 }]], admin = { ops: [{ name: "y" }] };
  assert.deepEqual(composeSave({ current: null, previous: before, levelSaving: [true, true, true], players, admin }), { seed: "a", time: 1, edits: [[1]], dimensions: before.dimensions, admin, players });
  assert.deepEqual(composeSave({ current: now, previous: before, levelSaving: [true, false, true], players, admin }), { seed: "a", time: 1, edits: [[1]], dimensions: { nether: { edits: ["n1"] }, end: { edits: ["e0"] } }, admin, players });
  assert.deepEqual(composeSave({ current: null, previous: null, levelSaving: [true, true, true], players, admin }), { admin, players }, "no earlier file: an unsaved world is absent");
});

test("planSave: saving on writes everything; /save-off still writes the player data; /save-all forces every world", () => {
  const on = fakeSim([false, false, false]);
  assert.ok(planSave(on).data.seed);
  const off = fakeSim([true, true, true]);
  off.savedPlayers.set("k", { yaw: 3 });
  const plan = planSave(off);
  assert.equal(plan.data, undefined);
  const out = plan.compose({ seed: "old", time: 5, players: [] });
  assert.deepEqual([out.seed, out.time], ["old", 5]);
  assert.deepEqual(out.players, [["k", { yaw: 3 }]]);
  assert.ok(planSave(off, { force: true }).data.seed === "console88", "bh clears each flag around its save");
  assert.deepEqual(off.admin.levelSaving, [true, true, true], "and restores them");
  assert.deepEqual(savePlayerData(off), [["k", { yaw: 3 }]]);
});

test("the executed /save-all rows: oi.j and every world saved with its flag cleared, then restored (also with saving partly off); flush exists", () => {
  const rows = dedicated.run.filter((r) => r[0].startsWith("save-all") && r[1] === "partial" && r[2] === "alex");
  assert.deepEqual(rows.map((r) => r[0]), ["save-all", "save-all flush"]);
  assert.deepEqual(rows[0][3].state.saves, ["save0:true:false", "save1:true:false", "save2:true:false"]);
  assert.deepEqual(rows[1][3].state.saves.slice(3), ["flush0", "flush1", "flush2"]);
  assert.deepEqual(rows[0][3].state.saving, [false, true, true], "the flags are put back");
  assert.equal(rows[0][3].state.savedPlayers, 1, "oi.j ran");
  assert.deepEqual(rows[1][3].chat.Alex.map((l) => l[2]), ["Saving...", "commands.save.flushStart", "commands.save.flushEnd", "Saved the world"]);
  const off = dedicated.run.find((r) => r[0] === "save-off" && r[1] === "lists" && r[2] === "alex")[3];
  assert.deepEqual(off.chat.Alex.map((l) => l[2]), ["Turned off world auto-saving"]);
  assert.deepEqual(off.console.map((l) => l[2]), ["[Alex: Turned off world auto-saving]"], "the admin notice reaches the log (and ops other than the sender)");
});

test("stop log lines and dimension names", () => {
  assert.deepEqual(Object.values(STOP_LOG), ["Stopping server", "Saving players", "Saving worlds"]);
  assert.deepEqual(DIMENSION_NAMES, ["Overworld", "Nether", "The End"]);
  assert.equal(worldSaveLine("world", 2), "Saving chunks for level 'world'/The End");
});

// --- the live server ---
const token = "test-only-not-a-deployed-server-key", origin = "http://localhost:5179", password = "correct horse battery";
function inbox(ws) {
  const seen = [], waiting = [];
  ws.on("message", (data) => { const m = JSON.parse(data), i = waiting.findIndex((w) => w.predicate(m)); if (i < 0) seen.push(m); else { const [w] = waiting.splice(i, 1); clearTimeout(w.timer); w.resolve(m); } });
  return (predicate) => { const i = seen.findIndex(predicate); if (i >= 0) return Promise.resolve(seen.splice(i, 1)[0]);
    return new Promise((resolve, reject) => waiting.push({ predicate, resolve, timer: setTimeout(() => reject(new Error("Timed out waiting for server packet")), 5000) })); };
}
async function start(t) {
  const { createDedicatedServer } = await import("../server/server.js");
  const dir = await mkdtemp(path.join(os.tmpdir(), "mc-web-console88-"));
  const dataFile = path.join(dir, "world.json");
  const simulation = new DedicatedSimulation({ seed: "console88", biome: "java", generationVersion: 9 });
  const lines = [];
  let stopped; const stoppedP = new Promise((r) => { stopped = r; });
  const app = await createDedicatedServer({ port: 0, token, dataFile, simulation, tickMs: 20, saveMs: 600000, log: (m) => lines.push(m), levelName: "world", onStop: () => stopped() });
  const log = [];
  app.social.log = (m) => { const d = chatDisplay(m); log.push(typeof d === "string" ? d : d.unformatted()); };
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const register = async (name) => (await app.accounts.register({ invite: token, name, password }, token)).session;
  const connect = async (session) => {
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin }), next = inbox(ws);
    await once(ws, "open");
    const closed = new Promise((resolve) => ws.on("close", (code, reason) => resolve([code, String(reason)])));
    ws.send(JSON.stringify({ type: "join", protocol: PROTOCOL, session }));
    return { ws, next, welcome: await next((m) => m.type === "welcome"), closed };
  };
  const console1 = async (line) => { const n = log.length; app.consoleCommand(line); for (let i = 0; i < 100 && log.length === n; i++) await new Promise((r) => setTimeout(r, 20)); return log.slice(n); };
  const file = async () => JSON.parse(await readFile(dataFile, "utf8"));
  return { app, simulation, lines, log, register, connect, console: console1, file, stopped: stoppedP };
}

test("live: /save-off keeps the world file but saves players; /save-all saves all; /stop saves players, kicks with Server closed, then saves the worlds", async (t) => {
  const s = await start(t);
  const a = await s.connect(await s.register("Alex"));
  const player = s.simulation.players.get(a.welcome.id);
  await s.app.save({ force: true });
  const t0 = (await s.file()).ticks;
  assert.deepEqual(await s.console("save-off"), ["Turned off world auto-saving"]);
  player.yaw = 1.25;
  await new Promise((r) => setTimeout(r, 120)); // the world ticks on
  await s.app.save(); // the timer's save
  let f = await s.file();
  assert.equal(f.ticks, t0, "the world part is the file's (mt.a returns: canSave is false)");
  assert.equal(new Map(f.players).get(player.resumeKey).yaw, 1.25, "oi.j still ran");

  const saved = await s.console("save-all");
  assert.equal(saved[0], "Saving...");
  await s.simulation.admin.pending;
  f = await s.file();
  assert.ok(f.ticks > t0, "/save-all saves the world under /save-off");
  const t1 = f.ticks;
  assert.equal(s.simulation.admin.autosave, false, "and the flag is unchanged");

  player.yaw = 2.5;
  await new Promise((r) => setTimeout(r, 60));
  s.lines.length = 0;
  s.app.consoleCommand("stop");
  const [code, reason] = await a.closed;
  assert.deepEqual([code, reason], [1008, "Server closed"], "oi.u: every player kicked with the reason");
  await s.stopped;
  assert.deepEqual(s.lines, ["Stopping server", "Saving players", "Saving worlds", "Saving chunks for level 'world'/Overworld", "Saving chunks for level 'world'/Nether", "Saving chunks for level 'world'/The End"]);
  f = await s.file();
  assert.equal(f.ticks, t1, "saving off: the shutdown save leaves the worlds");
  assert.equal(new Map(f.players).get(player.resumeKey).yaw, 2.5, "but writes the player data (b68 skipped the whole save)");
});

test("live: /netstat counts the native frame sizes", async (t) => {
  const s = await start(t);
  const a = await s.connect(await s.register("Alex"));
  await a.next((m) => m.type === "tick");
  a.ws.send(JSON.stringify({ type: "chat", text: "hello" }));
  await a.next((m) => m.type === "chat" && /hello/.test(m.text ?? ""));
  const [line] = await s.console("netstat packet-read 1");
  assert.equal(line, "PacketStat(1){totalBytes=7, count=1, averageBytes=7.0}", "C01: id, VarInt length, 5 bytes");
  const [welcome] = await s.console("netstat packet-write 1");
  const m = /^PacketStat\(1\)\{totalBytes=(\d+), count=1, /.exec(welcome);
  assert.ok(m, welcome);
  assert.ok(Number(m[1]) < JSON.stringify(a.welcome).length, "not the JSON length");
});
