// Batch 86 console86: the dedicated commands run by the console sender (the DedicatedServer: name "Server", every permission level, its own lines in the server log) and
// in offline mode (online-mode=false), replayed from dedicated-cmds-reference.json (tools/probes/Dedicated84Probe.java, executed on the unchanged 1.7.10 classes), plus the
// port's console path (server/server.js: stdin lines queued and run after the tick), /netstat's console texts over real traffic and the online-mode property.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { langReady } from "./chat-component.js";
import { observe, expected, wordOf, differences } from "./dedicated-cmds-replay.js";
import { ServerAdmin, NetStats, CONSOLE_NAME } from "./multiplayer/server-admin.js";
import { offlineUuid } from "./stats.js";
import { ServerProperties, resolveSettings, HONOURED_KEYS } from "./multiplayer/server-properties.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { chatDisplay } from "./server-broadcast.js";

await langReady;
const ref = JSON.parse(await readFile(new URL("../public/research/dedicated-cmds-reference.json", import.meta.url)));
// The console rows of every setup but "partial" (the port has one world save), and every offline-mode row.
const rows = ref.run.filter((r) => r[1] !== "partial" && (r[2] === "console" || r[1] === "offline"));
const groups = new Map();
for (const row of rows) { const key = `${row[2] === "console" ? "console" : "offline player"} ${wordOf(row)}`; (groups.get(key) ?? groups.set(key, []).get(key)).push(row); }

test("the reference holds the console and offline rows", () => {
  const count = (f) => ref.run.filter(f).length;
  assert.equal(count((r) => r[2] === "console"), 540, "console: lists 144, base 135, levels 126, offline 135");
  assert.equal(count((r) => r[1] === "offline"), 270);
  assert.equal(count((r) => r[3].crash !== null), 0);
  assert.equal(rows.length, 675);
});

for (const [key, group] of groups) {
  test(`${key}: ${group.length} executed rows`, async () => {
    const bad = [];
    for (const row of group) { const d = differences(await observe(row), expected(row)); if (d.length) bad.push(`${JSON.stringify(row.slice(0, 3))}\n   ${d.join("\n   ")}`); }
    assert.equal(bad.length, 0, `${bad.length} of ${group.length} rows differ:\n${bad.slice(0, 3).join("\n---\n")}`);
  });
}

test("offline mode: an unknown name gets the offline profile of its lowercased name; a known account keeps its own", () => {
  const admin = new ServerAdmin({}, { onlineMode: false });
  admin.directory = (n) => (n === "herobrine" ? { uuid: "u-hero", name: "Herobrine" } : null);
  const out = [];
  const ctx = { sender: CONSOLE_NAME, console: true, level: 4, log: (c) => out.push(c.unformatted()), deliver: () => {}, ops: () => [], online: () => [] };
  admin.run("op NoBody", ctx);
  assert.equal(offlineUuid("nobody"), "88f1b505-b838-3837-93c0-4f2cfbb70cfb", "UUID.nameUUIDFromBytes(\"OfflinePlayer:nobody\")");
  assert.deepEqual(admin.ops.get(offlineUuid("nobody")), { uuid: offlineUuid("nobody"), name: "nobody", level: 4 });
  admin.run("ban Herobrine", ctx);
  assert.equal(admin.bans.get("u-hero").source, "Server");
  assert.deepEqual(out, ["Opped NoBody", "Banned player Herobrine"]);
  const online = new ServerAdmin({});
  online.run("op NoBody", { ...ctx, log: (c) => out.push(c.unformatted()) });
  assert.equal(online.ops.size, 0);
  assert.equal(out.at(-1), "Could not op NoBody");
});

test("the online-mode property reaches the admin lists (default true)", () => {
  assert.ok(HONOURED_KEYS.includes("online-mode"));
  assert.equal(resolveSettings(new ServerProperties("")).onlineMode, true);
  assert.equal(resolveSettings(new ServerProperties("online-mode=false\n")).onlineMode, false);
  assert.equal(new DedicatedSimulation({ seed: "c86" }, { onlineMode: false }).admin.onlineMode, false);
  assert.equal(new DedicatedSimulation({ seed: "c86" }).admin.onlineMode, true);
});

test("/netstat from the console reports the recorded traffic in the NetworkStatistics texts; a player gets one line", () => {
  const admin = new ServerAdmin({}), out = [];
  const run = (line, console = true) => { out.length = 0; admin.run(line, { sender: console ? CONSOLE_NAME : "Alex", console, level: 4, log: (c) => out.push(c.unformatted()), deliver: (n, c) => out.push(c.unformatted()), ops: () => [], online: () => [] }); return out.join("|"); };
  admin.netStats = new NetStats();
  admin.netStats.read(0, 10); admin.netStats.read(0, 5); admin.netStats.read(3, 40); admin.netStats.write(0, 7); admin.netStats.read(100, 999); admin.netStats.read(-1, 999);
  assert.equal(run("netstat"), "reads: 55, writes: 7");
  assert.equal(run("netstat read-count"), "total-read-count3");
  assert.equal(run("netstat hottest-read"), "PacketStat(3){totalBytes=40, count=1, averageBytes=40.0}");
  assert.equal(run("netstat most-read"), "PacketStat(0){totalBytes=15, count=2, averageBytes=7.5}");
  assert.equal(run("netstat most-write"), "PacketStat(0){totalBytes=7, count=1, averageBytes=7.0}");
  assert.equal(run("netstat packet-read 100"), "Packet 100 not found!");
  assert.equal(run("netstat", false), "Command is not available for players");
});

test("server.js: console lines are queued and run after the tick as the Server sender, its lines go to the server log", async (t) => {
  const { createDedicatedServer } = await import("../server/server.js");
  const dir = await mkdtemp(path.join(os.tmpdir(), "mc-web-console86-"));
  const simulation = new DedicatedSimulation({ seed: "console86", biome: "java", generationVersion: 9 });
  const app = await createDedicatedServer({ port: 0, token: "test-only-not-a-deployed-server-key", dataFile: path.join(dir, "world.json"), simulation, tickMs: 20, saveMs: 600000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const log = [];
  app.social.log = (m) => { const d = chatDisplay(m); log.push(typeof d === "string" ? d : d.unformatted()); };
  app.consoleCommand("setidletimeout 7"); app.consoleCommand("/save-off"); app.consoleCommand("   "); app.consoleCommand("OP x");
  assert.equal(simulation.admin.idleMinutes, 0, "nothing runs before the next tick");
  for (let i = 0; i < 100 && log.length < 3; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(simulation.admin.idleMinutes, 7);
  assert.equal(simulation.admin.autosave, false);
  assert.deepEqual(log, ["Successfully set the idle timeout to 7 minutes.", "Turned off world auto-saving", "Unknown command. Try /help for a list of commands"]);
});
