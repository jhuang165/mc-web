// Batch 84 dedicated84 / batch 86 console86: the replay harness of dedicated-cmds-reference.json (tools/probes/Dedicated84Probe.java, executed on the unchanged 1.7.10
// ServerCommandManager and the dedicated command classes with a real ServerConfigurationManager, UserLists and PlayerProfileCache). A row runs through the port's server
// chat path (ServerSocial.command -> ServerAdmin) for a player sender, or the console path (ServerSocial.consoleCommand, the DedicatedServer sender) for "console".
// Used by src/dedicated-cmds-b84.test.js (player rows) and src/console86-b86.test.js (console and offline-mode rows).
import { isDeepStrictEqual } from "node:util";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";

export const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const IPS = { Alex: "10.0.0.1", Steve: "10.0.0.2", Eve: "10.0.0.2", Ivy: "10.0.0.5", Kay: "10.0.0.6", Lou: "10.0.0.7" };
const NAMES = ["Alex", "Steve", "Eve", "Ivy", "Kay", "Lou"];
const DATE = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d [+-]\d{4}$/;
const mask = (rows) => rows.map((r) => ({ ...r, ...(r.created !== undefined ? { created: DATE.test(r.created) ? "<date>" : r.created } : {}) }));

// The probe's GameProfileRepository double knows these four accounts (the port's account directory).
const KNOWN = { alex: [1, "Alex"], steve: [2, "Steve"], eve: [3, "Eve"], herobrine: [4, "Herobrine"] };

export function build(setup, sender) {
  const world = new World("b84dedicated");
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, onlineMode: setup !== "offline" }), inbox = {}, ids = {}, log = [];
  const social = new ServerSocial({ simulation: sim, ops: [], deliver: (id, m) => (inbox[id] ??= []).push(m) });
  social.log = (m) => log.push(m); // b86 console86: the server log
  const calls = { kicks: [], stops: 0, saves: 0 };
  // "levels" (b85 dedtab85): Ivy op 1, Eve op 2, Kay op 3, Lou op 4 watch every command (uuids 5, 3, 6, 7 as the probe)
  const roster = setup === "levels" ? [["Alex", 1], ["Steve", 2], ["Eve", 3], ["Ivy", 5], ["Kay", 6], ["Lou", 7]] : [["Alex", 1], ["Steve", 2], ["Eve", 3]];
  roster.forEach(([n, u], i) => { ids[n] = `p${i}`; sim.addPlayer(`p${i}`, n, uuid(u)); });
  const admin = sim.admin;
  admin.host = { kick: (id, r) => calls.kicks.push(`${Object.keys(ids).find((k) => ids[k] === id)}:${r}`), ipOf: (id) => IPS[Object.keys(ids).find((k) => ids[k] === id)], stop: () => calls.stops++, save: () => { calls.saves++; sim.save(); return Promise.resolve(); } };
  admin.directory = (name) => { const k = KNOWN[name.toLowerCase()]; return k ? { uuid: uuid(k[0]), name: k[1] } : null; };
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
  if (setup === "partial") admin.levelSaving = [true, false, false]; // b87 offline87: the probe's world 0 saving off, worlds 1 and 2 on (mt.c per WorldServer)
  const who = sender === "console" ? null : NAMES.find((n) => n.toLowerCase() === sender) ?? "Alex";
  for (const k of Object.keys(inbox)) delete inbox[k];
  return { sim, social, admin, inbox, ids, who, log, calls };
}
const plain = (m) => { const d = chatDisplay(m); return typeof d === "string" ? d : d.unformatted(); };
const styled = (m) => { const d = chatDisplay(m); return typeof d === "string" ? d : d.formatted(); };

/** The port's record for a row, in the probe's shape: chat per player and the server log as [formatted, unformatted], and the state. */
export async function observe([line, setup, sender]) {
  const f = build(setup, sender);
  if (f.who === null) f.social.consoleCommand(line); else f.social.command(f.ids[f.who], line);
  await f.admin.pending; // /save-all's completion line
  await new Promise((r) => setImmediate(r)); // /stop defers host.stop() one tick
  const chat = {};
  for (const n of Object.keys(f.ids)) chat[n] = (f.inbox[f.ids[n]] ?? []).filter((m) => m.type === "chat").map((m) => [styled(m), plain(m)]);
  const s = f.admin.save();
  return { chat, console: f.log.map((m) => [styled(m), plain(m)]), state: { ops: mask(s.ops), banned: mask(s.banned), ips: mask(s.bannedIps), whitelist: s.whitelist, whitelistOn: f.admin.whitelistOn, idle: s.idleMinutes, saving: f.admin.levelSaving.map((off) => !off), saveCalls: f.calls.saves, dat: f.sim.savedPlayers.size, kicks: f.calls.kicks, stops: f.calls.stops, profiles: f.admin.profileNames() } };
}
/** The probe's record of a row in the same shape (the save calls of world 0: the port has one world save; b87 offline87: every world's saving flag). */
export function expected([, , , o]) {
  const st = o.state, chat = {};
  for (const [n, list] of Object.entries(o.chat)) chat[n] = list.map((c) => [c[1], c[2]]);
  return { chat, console: o.console.map((c) => [c[1], c[2]]), state: { ops: mask(st.ops), banned: mask(st.banned), ips: mask(st.ips), whitelist: st.whitelist, whitelistOn: st.whitelistOn, idle: st.idle, saving: st.saving, saveCalls: st.saves.filter((x) => x.startsWith("save0")).length, dat: st.dat, kicks: st.kicks, stops: st.stops, profiles: st.profiles } };
}
/** The first word of a row's line, lowercased: the replay groups. */
export const wordOf = (row) => row[0].replace(/^[\s/]+/, "").split(" ")[0].toLowerCase();
/** One line per differing field of a row (empty when it matches). */
export function differences(got, want) {
  const d = [];
  for (const n of Object.keys(want.chat)) if (!isDeepStrictEqual(got.chat[n], want.chat[n])) d.push(`chat ${n}: port ${JSON.stringify(got.chat[n]?.map((c) => c[1]))} native ${JSON.stringify(want.chat[n].map((c) => c[1]))}`);
  if (!isDeepStrictEqual(got.console, want.console)) d.push(`console: port ${JSON.stringify(got.console.map((c) => c[1]))} native ${JSON.stringify(want.console.map((c) => c[1]))}`);
  for (const k of Object.keys(want.state)) if (!isDeepStrictEqual(got.state[k], want.state[k])) d.push(`${k}: port ${JSON.stringify(got.state[k])} native ${JSON.stringify(want.state[k])}`);
  return d;
}
