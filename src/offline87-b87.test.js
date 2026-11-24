// Batch 87 offline87: offline-mode logins (NetHandlerLoginServer.func_152506_a: the offline UUID of the typed name), /netstat under the native packet ids
// (EnumConnectionState), and the partly-off world saving rows of dedicated-cmds-reference.json. Native evidence: public/research/offline87-reference.json
// (tools/probes/Offline87Probe.java, executed on the unchanged 1.7.10 classes) and dedicated-cmds-reference.json (Dedicated84Probe).
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { langReady } from "./chat-component.js";
import { offlineUuid } from "./stats.js";
import { ServerAdmin } from "./multiplayer/server-admin.js";
import { SERVERBOUND, CLIENTBOUND, STATUS_IDS, readPacketId, writePacketId } from "./multiplayer/net-packet-ids.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { PROTOCOL, IDLE_INPUT } from "./multiplayer/protocol.js";
import { chatDisplay } from "./server-broadcast.js";
import { observe, expected } from "./dedicated-cmds-replay.js";

await langReady;
const ref = JSON.parse(await readFile(new URL("../public/research/offline87-reference.json", import.meta.url)));
const dedicated = JSON.parse(await readFile(new URL("../public/research/dedicated-cmds-reference.json", import.meta.url)));
const state = (name) => ref.states.find((s) => s.name === name);
const PLAY = state("PLAY"), LOGIN = state("LOGIN"), STATUS = state("STATUS"), HANDSHAKING = state("HANDSHAKING");
const idOf = (map, cls) => { const hit = Object.entries(map).find(([, c]) => c === cls || c.endsWith("$" + cls)); assert.ok(hit, cls); return Number(hit[0]); };

test("the reference: the four connection states and their packet maps", () => {
  assert.deepEqual(ref.states.map((s) => [s.name, s.id, Object.keys(s.serverbound).length, Object.keys(s.clientbound).length]), [["HANDSHAKING", -1, 1, 0], ["PLAY", 0, 24, 65], ["STATUS", 1, 2, 2], ["LOGIN", 2, 2, 3]]);
  for (const s of ref.states) { for (const c of Object.values(s.serverbound)) assert.match(c, /^C[0-9A-F]{2}/); for (const c of Object.values(s.clientbound)) assert.match(c, /(^|\$)S[0-9A-F]{2}/); }
});

test("offline login profiles: the executed func_152506_a and the port's loginProfile agree (typed-name case kept)", () => {
  const offline = new ServerAdmin({}, { onlineMode: false }), online = new ServerAdmin({});
  for (const [typed, uuid, name] of ref.offline) {
    assert.equal(offlineUuid(typed), uuid, typed);
    assert.deepEqual(offline.loginProfile({ id: "account-id", name: typed }), { uuid, name }, typed);
    assert.deepEqual(online.loginProfile({ id: "account-id", name: typed }), { uuid: "account-id", name: typed });
  }
  assert.notEqual(offlineUuid("Alex"), offlineUuid("alex"), "the UUID is case-sensitive");
  // EntityPlayer.func_146094_a: a name-only profile gets the offline UUID, a complete one keeps its id (the playerdata/<uuid>.dat key)
  assert.deepEqual(ref.entity, [["Alex", null, offlineUuid("Alex")], ["Alex", "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000001"]]);
});

// The native class each port message kind stands for (PLAY unless the state is given).
const SERVERBOUND_CLASS = {
  join: ["HANDSHAKING", "C00Handshake"], pingStatus: ["STATUS", "C00PacketServerQuery"], pingProbe: ["STATUS", "C01PacketPing"], pingKeepAliveAck: "C00PacketKeepAlive", chat: "C01PacketChatMessage",
  attack: "C02PacketUseEntity", attackPlayer: "C02PacketUseEntity", animUse: "C02PacketUseEntity", vehUse: "C02PacketUseEntity", vehHit: "C02PacketUseEntity", input: "C03PacketPlayer",
  dig: "C07PacketPlayerDigging", achDrop: "C07PacketPlayerDigging", sleepLeave: "C0BPacketEntityAction", horseJump: "C0BPacketEntityAction", horseInventory: "C0BPacketEntityAction",
  invClose: "C0DPacketCloseWindow", closeWindow: "C0DPacketCloseWindow", invClick: "C0EPacketClickWindow", clickWindow: "C0EPacketClickWindow", beaconPayment: "C0EPacketClickWindow",
  invAck: "C0FPacketConfirmTransaction", confirmTransaction: "C0FPacketConfirmTransaction", invCreative: "C10PacketCreativeInventoryAction", stationEnchant: "C11PacketEnchantItem",
  sign: "C12PacketUpdateSign", tabReq: "C14PacketTabComplete", settingsClient: "C15PacketClientSettings", capeSettings: "C15PacketClientSettings",
  respawn: "C16PacketClientStatus", requestStats: "C16PacketClientStatus", openInventory: "C16PacketClientStatus",
  vehCmd: "C17PacketCustomPayload", blockCmd: "C17PacketCustomPayload", bookEdit: "C17PacketCustomPayload", bookSign: "C17PacketCustomPayload", beacon: "C17PacketCustomPayload", tradeSelect: "C17PacketCustomPayload", stationItemName: "C17PacketCustomPayload",
};
const CLIENTBOUND_CLASS = {
  pingKeepAlive: "S00PacketKeepAlive", pingStatusReply: ["STATUS", "S00PacketServerInfo"], pingProbeReply: ["STATUS", "S01PacketPong"], welcome: "S01PacketJoinGame", chat: "S02PacketChat", sleepMsg: "S02PacketChat",
  health: "S06PacketUpdateHealth", dimRespawn: "S07PacketRespawn", sleepIn: "S0APacketUseBed", sleepWake: "S0BPacketAnimation", pfx73: "S0BPacketAnimation", collect: "S0DPacketCollectItem", projCollect: "S0DPacketCollectItem",
  dispEnts: "S0EPacketSpawnObject", fishHooks: "S0EPacketSpawnObject", tick: "S18PacketEntityTeleport", healthHurt: "S19PacketEntityStatus", useDone: "S19PacketEntityStatus", mobStatus: "S19PacketEntityStatus",
  attach: "S1BPacketEntityAttach", dismount: "S08PacketPlayerPosLook", effect: "S1DPacketEntityEffect", healthEffect: "S1DPacketEntityEffect", healthEffectEnd: "S1EPacketRemoveEntityEffect", playerOp: "S1FPacketSetExperience",
  chunkUnload: "S21PacketChunkData", pistonTiles: "S24PacketBlockAction", musicEvent: "S24PacketBlockAction", crack: "S25PacketBlockBreakAnim", chunkBulk: "S26PacketMapChunkBulk", aux: "S28PacketEffect",
  sound: "S29PacketSoundEffect", dispFx: "S2APacketParticles", fishFx: "S2APacketParticles", dragonCredits: "S2BPacketChangeGameState", abilities: "S39PacketPlayerAbilities", boltSpawn: "S2CPacketSpawnGlobalEntity",
  openWindow: "S2DPacketOpenWindow", beaconWindow: "S2DPacketOpenWindow", windowClose: "S2EPacketCloseWindow", slot: "S2FPacketSetSlot", setSlot: "S2FPacketSetSlot", invSet: "S2FPacketSetSlot",
  windowItems: "S30PacketWindowItems", invItems: "S30PacketWindowItems", windowProperty: "S31PacketWindowProperty", confirmTransaction: "S32PacketConfirmTransaction", invConfirm: "S32PacketConfirmTransaction",
  mapData: "S34PacketMaps", signEditor: "S36PacketSignEditorOpen", stats: "S37PacketStatistics", pingList: "S38PacketPlayerListItem", tabReply: "S3APacketTabComplete", tradeList: "S3FPacketCustomPayload", error: "S40PacketDisconnect",
};
const nativeId = (dir, entry) => { const [st, cls] = Array.isArray(entry) ? entry : ["PLAY", entry]; return idOf(state(st)[dir], cls); };

test("each plain message kind's id is the executed EnumConnectionState id of its native packet", () => {
  for (const [type, v] of Object.entries(SERVERBOUND)) if (typeof v === "number") assert.equal(v, nativeId("serverbound", SERVERBOUND_CLASS[type]), type);
  for (const [type, v] of Object.entries(CLIENTBOUND)) if (typeof v === "number") assert.equal(v, nativeId("clientbound", CLIENTBOUND_CLASS[type]), type);
  assert.equal(SERVERBOUND.join, idOf(LOGIN.serverbound, "C00PacketLoginStart"), "the login start shares id 0 with the handshake");
  assert.equal(idOf(HANDSHAKING.serverbound, "C00Handshake"), 0);
  for (const [type, id] of Object.entries(STATUS_IDS)) assert.equal(id, type.endsWith("Reply") ? nativeId("clientbound", CLIENTBOUND_CLASS[type]) : nativeId("serverbound", SERVERBOUND_CLASS[type]));
  assert.equal(idOf(STATUS.serverbound, "C01PacketPing"), idOf(PLAY.serverbound, "C01PacketChatMessage"), "a status ping and a chat line share slot 1 of the one NetworkStatistics");
});

test("message kinds that stand for several native packets pick the id from their contents", () => {
  const P = (cls) => idOf(PLAY.serverbound, cls), S = (cls) => idOf(PLAY.clientbound, cls);
  assert.equal(readPacketId({ type: "edit", place: true }), P("C08PacketPlayerBlockPlacement"));
  assert.equal(readPacketId({ type: "edit", place: false }), P("C07PacketPlayerDigging"));
  assert.equal(readPacketId({ type: "use", active: true }), P("C08PacketPlayerBlockPlacement"));
  assert.equal(readPacketId({ type: "use", active: false }), P("C07PacketPlayerDigging"));
  assert.equal(writePacketId({ type: "blocks", changes: [[1, 2, 3, 0, 0]] }), S("S23PacketBlockChange"));
  assert.equal(writePacketId({ type: "blocks", changes: [[1, 2, 3, 0, 0], [1, 3, 3, 0, 0]] }), S("S22PacketMultiBlockChange"));
  assert.equal(writePacketId({ type: "mobs", packets: [{ type: "spawn" }] }), S("S0FPacketSpawnMob"));
  assert.equal(writePacketId({ type: "mobs", packets: [{ type: "destroy" }, { type: "spawn" }] }), S("S13PacketDestroyEntities"));
  assert.equal(writePacketId({ type: "mobs", packets: [{ type: "attach" }] }), S("S1BPacketEntityAttach"));
  assert.equal(writePacketId({ type: "mobs", packets: [{ type: "mobStatus" }] }), S("S19PacketEntityStatus"));
  assert.equal(writePacketId({ type: "mobs", packets: [{ type: "state" }] }), S("S18PacketEntityTeleport"));
  assert.equal(writePacketId({ type: "mobs", packets: [] }), S("S14PacketEntity"));
  assert.equal(writePacketId({ type: "vehicles", set: [{}] }), S("S18PacketEntityTeleport"));
  assert.equal(writePacketId({ type: "vehicles", del: [1] }), S("S13PacketDestroyEntities"));
  for (const [k, cls] of [["obj", "S3BPacketScoreboardObjective"], ["score", "S3CPacketUpdateScore"], ["display", "S3DPacketDisplayScoreboard"], ["team", "S3EPacketTeams"]]) assert.equal(writePacketId({ type: "sb", packets: [{ k }] }), S(cls));
  for (const m of [{ type: "pickup" }, { type: "windowInventory" }, { type: "invBroke" }, { type: "nonsense" }, { type: "toString" }, {}, null]) { assert.equal(readPacketId(m), null); if (m?.type !== "pickup" && m?.type !== "windowInventory") assert.equal(writePacketId(m), null); }
});

test("every message type server.js reads is mapped or listed as port-only", async () => {
  const src = await readFile(new URL("../server/server.js", import.meta.url), "utf8");
  const read = new Set([...src.matchAll(/m\.type === '([A-Za-z0-9]+)'/g)].map((x) => x[1]));
  const PORT_ONLY = new Set(["pickup", "windowInventory"]);
  for (const t of read) assert.ok(Object.hasOwn(SERVERBOUND, t) || PORT_ONLY.has(t), t);
  for (const t of PORT_ONLY) assert.equal(Object.hasOwn(SERVERBOUND, t), false);
});

test("the partly-off world saving rows (world 0 off, worlds 1 and 2 on) replay at 0 differences", async () => {
  const rows = dedicated.run.filter((r) => r[1] === "partial");
  assert.deepEqual(rows.map((r) => r[0]), ["save-on", "save-off", "save-all", "save-all flush"]);
  for (const row of rows) assert.deepEqual(await observe(row), expected(row), row[0]);
  const off = rows.find((r) => r[0] === "save-off");
  assert.deepEqual(off[3].state.saving, [false, false, false]);
  assert.equal(off[3].chat.Alex[0][2], "Turned off world auto-saving", "a change in any world reports the change");
  const admin = new ServerAdmin({});
  assert.equal(admin.autosave, true); admin.autosave = false; assert.deepEqual(admin.levelSaving, [true, true, true]); admin.levelSaving[2] = false; assert.equal(admin.autosave, false, "the port's one save follows the Overworld");
});

// --- the live server ---
const token = "test-only-not-a-deployed-server-key", origin = "http://localhost:5179", password = "correct horse battery";
function inbox(ws) {
  const seen = [], waiting = [];
  ws.on("message", (data) => { const m = JSON.parse(data), i = waiting.findIndex((w) => w.predicate(m)); if (i < 0) seen.push(m); else { const [w] = waiting.splice(i, 1); clearTimeout(w.timer); w.resolve(m); } });
  return (predicate) => { const i = seen.findIndex(predicate); if (i >= 0) return Promise.resolve(seen.splice(i, 1)[0]);
    return new Promise((resolve, reject) => waiting.push({ predicate, resolve, timer: setTimeout(() => reject(new Error("Timed out waiting for server packet")), 5000) })); };
}
async function start(t, onlineMode) {
  const { createDedicatedServer } = await import("../server/server.js");
  const dir = await mkdtemp(path.join(os.tmpdir(), "mc-web-offline87-"));
  const simulation = new DedicatedSimulation({ seed: "offline87", biome: "java", generationVersion: 9 }, { onlineMode });
  const printed = [], original = { log: console.log, error: console.error, warn: console.warn };
  for (const k of Object.keys(original)) console[k] = (...a) => printed.push(a.join(" "));
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, "world.json"), simulation, tickMs: 20, saveMs: 600000 });
  const log = [];
  app.social.log = (m) => { const d = chatDisplay(m); log.push(typeof d === "string" ? d : d.unformatted()); };
  t.after(async () => { await app.close(); Object.assign(console, original); await rm(dir, { recursive: true, force: true }); });
  const sessions = {};
  const register = async (name) => { const r = await app.accounts.register({ invite: token, name, password }, token); sessions[name] = r.session; return r; };
  const connect = async (name) => {
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin }), next = inbox(ws);
    await once(ws, "open");
    const closed = new Promise((resolve) => ws.on("close", (code, reason) => resolve(String(reason))));
    ws.send(JSON.stringify({ type: "join", protocol: PROTOCOL, session: sessions[name] }));
    const first = await Promise.race([next((m) => m.type === "welcome"), closed]);
    return typeof first === "string" ? { refused: first } : { ws, next, welcome: first, closed };
  };
  const console1 = async (line) => { const n = log.length; app.consoleCommand(line); for (let i = 0; i < 100 && log.length === n; i++) await new Promise((r) => setTimeout(r, 20)); return log.slice(n); };
  return { app, simulation, log, printed, sessions, register, connect, console: console1 };
}
const secretsIn = (s, texts) => { const all = texts.join("\n"); for (const v of [...Object.values(s.sessions), password, ...[...s.app.accounts.accounts.values()].flatMap((a) => [a.hash, a.salt])]) assert.equal(all.includes(v), false, "a credential reached the server output"); };

test("offline mode: joins get the offline UUID of the name; console ops, bans and whitelist entries made before the first join match it", async (t) => {
  const s = await start(t, false);
  const alex = await s.register("Alex"), bob = await s.register("Bob"), carl = await s.register("Carl"), dana = await s.register("Dana");
  assert.deepEqual(await s.console("op Alex"), ["Opped Alex"]);
  assert.deepEqual(await s.console("ban Bob"), ["Banned player Bob"]);
  assert.deepEqual(await s.console("whitelist add Dana"), ["Added Dana to the whitelist"]);
  await s.console("whitelist on");
  const admin = s.simulation.admin;
  assert.deepEqual([...admin.ops.keys()], [offlineUuid("Alex")]);
  assert.deepEqual([...admin.bans.keys()], [offlineUuid("Bob")]);
  assert.deepEqual([...admin.allow.keys()], [offlineUuid("Dana")]);
  assert.equal(admin.ops.has(alex.account.id), false, "not the account id");

  const a = await s.connect("Alex");
  assert.ok(a.welcome, "an op passes the whitelist");
  assert.equal(s.simulation.players.get(a.welcome.id).resumeKey, offlineUuid("Alex"));
  assert.match((await s.connect("Bob")).refused, /^You are banned from this server!/);
  assert.equal((await s.connect("Carl")).refused, "You are not white-listed on this server!");
  const d = await s.connect("Dana");
  assert.equal(s.simulation.players.get(d.welcome.id).resumeKey, offlineUuid("Dana"));
  assert.ok(carl.account.id && bob.account.id && dana.account.id);

  // /list uuids shows the offline UUIDs; the saved player data is keyed by them
  assert.deepEqual(await s.console("list uuids"), ["There are 2/20 players online:", `Alex (${offlineUuid("Alex")}), Dana (${offlineUuid("Dana")})`]);
  a.ws.close(); await a.closed;
  for (let i = 0; i < 100 && !s.simulation.savedPlayers.has(offlineUuid("Alex")); i++) await new Promise((r) => setTimeout(r, 20));
  assert.ok(s.simulation.savedPlayers.has(offlineUuid("Alex")));
  assert.equal(s.simulation.savedPlayers.has(alex.account.id), false);
  const again = await s.connect("Alex");
  assert.ok(again.welcome, "a second login resumes the offline-keyed save");
  secretsIn(s, [...s.log, ...s.printed]);
});

test("online mode keeps the account ids", async (t) => {
  const s = await start(t, true);
  const alex = await s.register("Alex");
  assert.deepEqual(await s.console("op Alex"), ["Opped Alex"]);
  assert.deepEqual([...s.simulation.admin.ops.keys()], [alex.account.id]);
  const a = await s.connect("Alex");
  assert.equal(s.simulation.players.get(a.welcome.id).resumeKey, alex.account.id);
  a.ws.close(); await a.closed;
  for (let i = 0; i < 100 && !s.simulation.savedPlayers.has(alex.account.id); i++) await new Promise((r) => setTimeout(r, 20));
  assert.ok(s.simulation.savedPlayers.has(alex.account.id));
  secretsIn(s, [...s.log, ...s.printed]);
});

test("/netstat on the live server counts each message under its native packet id", async (t) => {
  const s = await start(t, true);
  await s.register("Alex");
  const a = await s.connect("Alex");
  await a.next((m) => m.type === "tick");
  a.ws.send(JSON.stringify({ type: "chat", text: "hello" }));
  a.ws.send(JSON.stringify({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0 }));
  await a.next((m) => m.type === "chat" && /hello/.test(m.text ?? JSON.stringify(m)));
  const stat = /^PacketStat\((\d+)\)\{totalBytes=(\d+), count=(\d+), averageBytes=[\d.]+\}$/;
  const count = async (line) => { const [out] = await s.console(line); const m = stat.exec(out); assert.ok(m, out); return Number(m[3]); };
  assert.equal(await count("netstat packet-read 0"), 2, "the join: C00 handshake and C00 login start (b89 console89: one record per native packet; b87 counted the join once)");
  assert.equal(await count("netstat packet-read 1"), 1, "the chat line (C01)");
  assert.ok(await count("netstat packet-read 3") >= 1, "input (C03)");
  assert.equal(await count("netstat packet-write 1"), 1, "the welcome (S01)");
  assert.ok((await count("netstat packet-write 21")) + (await count("netstat packet-write 22")) + (await count("netstat packet-write 23")) + (await count("netstat packet-write 24")) + (await count("netstat packet-write 25")) >= 1, "entity moves, looks and teleports (S15-S19; b90 console90: each under its own id, b89: a lone player's own pose is not counted)"); // "entity teleports (S18); b89 console89: a lone player's own pose is not counted (the tracker sends nobody their own)");
  assert.ok(await count("netstat packet-write 2") >= 2, "the join and chat lines (S02)");
  const [totals] = await s.console("netstat");
  const [, reads, writes] = /^reads: (\d+), writes: (\d+)$/.exec(totals).map(Number);
  assert.ok(reads > 0 && writes > reads);
  const [hottest] = await s.console("netstat hottest-write");
  assert.doesNotMatch(hottest, /^PacketStat\(0\)/, "not all traffic under id 0");
  secretsIn(s, [...s.log, ...s.printed]);
});
