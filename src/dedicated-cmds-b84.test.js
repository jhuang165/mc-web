import { isDeepStrictEqual } from "node:util";
// Batch 84 dedicated84: replays dedicated-cmds-reference.json (tools/probes/Dedicated84Probe.java, executed on the unchanged 1.7.10 ServerCommandManager and the dedicated
// command classes with a real ServerConfigurationManager, UserLists and PlayerProfileCache) through the port's server chat path (ServerSocial.command -> ServerAdmin).
// Rows the port cannot reach: the console sender (the port has no server console command line), offline-mode profile lookup (the port resolves accounts only) and the
// partly-off world saving states (one saving flag; the commands only ever switch all worlds together).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { langReady } from "./chat-component.js";

await langReady;
const ref = JSON.parse(await readFile(new URL("../public/research/dedicated-cmds-reference.json", import.meta.url)));
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const IPS = { Alex: "10.0.0.1", Steve: "10.0.0.2", Eve: "10.0.0.2", Ivy: "10.0.0.5", Kay: "10.0.0.6", Lou: "10.0.0.7" };
const NAMES = ["Alex", "Steve", "Eve", "Ivy", "Kay", "Lou"];
const DATE = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d [+-]\d{4}$/;
const mask = (rows) => rows.map((r) => ({ ...r, ...(r.created !== undefined ? { created: DATE.test(r.created) ? "<date>" : r.created } : {}) }));

function build(setup, sender) {
  const world = new World("b84dedicated");
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world }), inbox = {}, ids = {};
  const social = new ServerSocial({ simulation: sim, ops: [], deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const log = { kicks: [], stops: 0, saves: 0 };
  // "levels" (b85 dedtab85): Ivy op 1, Eve op 2, Kay op 3, Lou op 4 watch every command (uuids 5, 3, 6, 7 as the probe)
  const roster = setup === "levels" ? [["Alex", 1], ["Steve", 2], ["Eve", 3], ["Ivy", 5], ["Kay", 6], ["Lou", 7]] : [["Alex", 1], ["Steve", 2], ["Eve", 3]];
  roster.forEach(([n, u], i) => { ids[n] = `p${i}`; sim.addPlayer(`p${i}`, n, uuid(u)); });
  const admin = sim.admin;
  admin.host = { kick: (id, r) => log.kicks.push(`${Object.keys(ids).find((k) => ids[k] === id)}:${r}`), ipOf: (id) => IPS[Object.keys(ids).find((k) => ids[k] === id)], stop: () => log.stops++, save: () => { log.saves++; sim.save(); return Promise.resolve(); } };
  admin.directory = (name) => (name.toLowerCase() === "herobrine" ? { uuid: uuid(4), name: "Herobrine" } : null);
  admin.ops.set(uuid(1), { uuid: uuid(1), name: "Alex", level: 4 });
  if (sender === "eve" || setup === "levels") admin.ops.set(uuid(3), { uuid: uuid(3), name: "Eve", level: 2 });
  if (setup === "levels") for (const [n, u, level] of [["Ivy", 5, 1], ["Kay", 6, 3], ["Lou", 7, 4]]) admin.ops.set(uuid(u), { uuid: uuid(u), name: n, level });
  if (setup === "lists" || setup === "levels") {
    const entry = (extra) => ({ created: "2026-01-01 00:00:00 +0000", expires: "forever", ...extra });
    admin.bans.set(uuid(2), { uuid: uuid(2), name: "Steve", ...entry({ source: "Console", reason: "griefing" }) });
    admin.bans.set(uuid(9), { uuid: uuid(9), name: "Notch", ...entry({ source: "Alex", reason: "Banned by an operator." }) });
    admin.ipBans.set("10.0.0.9", { ip: "10.0.0.9", ...entry({ source: "Console", reason: "spam" }) });
    admin.ipBans.set("192.168.1.20", { ip: "192.168.1.20", ...entry({ source: "Alex", reason: "Banned by an operator." }) });
    admin.allow.set(uuid(2), { uuid: uuid(2), name: "Steve" });
    admin.allow.set(uuid(4), { uuid: uuid(4), name: "Herobrine" });
    admin.ops.set(uuid(9), { uuid: uuid(9), name: "Notch", level: 3 });
    admin.seen(uuid(9), "Notch");
  }
  if (setup === "lists" || setup === "levels") { sim.savedPlayers.set(uuid(2), {}); sim.savedPlayers.set(uuid(9), {}); }
  if (setup === "saveoff") admin.autosave = false;
  const who = NAMES.find((n) => n.toLowerCase() === sender) ?? "Alex";
  for (const k of Object.keys(inbox)) delete inbox[k];
  return { sim, social, admin, inbox, ids, who, log };
}
const plain = (m) => { const d = chatDisplay(m); return typeof d === "string" ? d : d.unformatted(); };
const styled = (m) => { const d = chatDisplay(m); return typeof d === "string" ? d : d.formatted(); };

/** The port's record for a row, in the probe's shape: chat per player [formatted, unformatted] and the state. */
async function observe([line, setup, sender]) {
  const f = build(setup, sender);
  f.social.command(f.ids[f.who], line);
  await f.admin.pending; // /save-all's completion line
  await new Promise((r) => setImmediate(r)); // /stop defers host.stop() one tick
  const chat = {};
  for (const n of Object.keys(f.ids)) chat[n] = (f.inbox[f.ids[n]] ?? []).filter((m) => m.type === "chat").map((m) => [styled(m), plain(m)]);
  const s = f.admin.save();
  return { chat, state: { ops: mask(s.ops), banned: mask(s.banned), ips: mask(s.bannedIps), whitelist: s.whitelist, whitelistOn: f.admin.whitelistOn, idle: s.idleMinutes, saving: f.admin.autosave, saveCalls: f.log.saves, dat: f.sim.savedPlayers.size, kicks: f.log.kicks, stops: f.log.stops, profiles: f.admin.profileNames() } };
}
const expected = ([, , , o]) => {
  const st = o.state, chat = {};
  for (const [n, list] of Object.entries(o.chat)) chat[n] = list.map((c) => [c[1], c[2]]);
  const mapRows = (text) => mask(text);
  return { chat, state: { ops: mapRows(st.ops), banned: mapRows(st.banned), ips: mapRows(st.ips), whitelist: st.whitelist, whitelistOn: st.whitelistOn, idle: st.idle, saving: st.saving[0], saveCalls: st.saves.filter((x) => x.startsWith("save0")).length, dat: st.dat, kicks: st.kicks, stops: st.stops, profiles: st.profiles } };
};
// A save row of the native saves each world; the port has one save call (host.save).
const reachable = (row) => row[2] !== "console" && row[1] !== "offline" && row[1] !== "partial";

const rows = ref.run.filter(reachable);
const byGroup = new Map();
for (const row of rows) { const word = row[0].replace(/^[\s/]+/, "").split(" ")[0].toLowerCase(); (byGroup.get(word) ?? byGroup.set(word, []).get(word)).push(row); }

for (const [word, group] of byGroup) {
  test(`dedicated command ${word}: ${group.length} executed rows`, async () => {
    const bad = [];
    if (process.env.COMPACT) { // COMPACT=1: one line per differing row (developer aid)
      for (const row of group) { const got = await observe(row), want = expected(row); const d = [];
        for (const n of Object.keys(want.chat)) if (!isDeepStrictEqual(got.chat[n], want.chat[n])) d.push(`chat ${n}: port ${JSON.stringify(got.chat[n]?.map((c) => c[1]))} native ${JSON.stringify(want.chat[n].map((c) => c[1]))}`);
        for (const k of Object.keys(want.state)) if (!isDeepStrictEqual(got.state[k], want.state[k])) d.push(`${k}: port ${JSON.stringify(got.state[k])} native ${JSON.stringify(want.state[k])}`);
        if (d.length) console.log(`${JSON.stringify(row.slice(0, 3))}\n   ${d.join("\n   ")}`); }
    }
    for (const row of group) {
      const got = await observe(row), want = expected(row);
      try { assert.deepEqual(got, want); } catch (e) { bad.push(`${JSON.stringify(row.slice(0, 3))}\n${e.message}`); }
    }
    assert.equal(bad.length, 0, `${bad.length} of ${group.length} rows differ:\n${bad.slice(0, Number(process.env.SHOW ?? 3)).join("\n---\n")}`);
  });
}

// Batch 85 dedtab85: the 64 recorded tab rows (CommandHandler.getPossibleCommands on the real command classes) replayed through the port's socialTabComplete (Alex, op 4).
test(`dedicated tab completion: ${ref.tab.length} executed rows`, async () => {
  const { socialTabComplete } = await import("./multiplayer/server-tabcomplete.js");
  const bad = [];
  for (const [text, setup, want] of ref.tab) {
    const f = build(setup, "alex");
    const got = socialTabComplete(f.social, f.ids.Alex, "/" + text);
    if (!isDeepStrictEqual(got, want ?? [])) bad.push(`${JSON.stringify([text, setup])} port ${JSON.stringify(got)} native ${JSON.stringify(want)}`);
  }
  assert.equal(bad.length, 0, bad.join("\n"));
});
