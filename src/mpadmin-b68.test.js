// Batch 68 mpadmin: the dedicated-server administration commands, the lists and the join refusals (texts bytecode-read from the 1.7.10 jar).
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { ServerAdmin, normalizeIp, banDate } from "./multiplayer/server-admin.js";
import { langReady } from "./chat-component.js";

await langReady;
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function fixture({ ops = ["Alex"], names = ["Alex", "Steve"], adminOptions = {} } = {}) {
  const world = new World("b68admin");
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, ...adminOptions }), inbox = {}, ids = {};
  const social = new ServerSocial({ simulation: sim, ops, deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const kicked = [], stops = [], saves = [];
  const ipOf = { Alex: "10.0.0.1", Steve: "10.0.0.2" };
  names.forEach((n, i) => { ids[n] = `p${i}`; sim.addPlayer(`p${i}`, n, uuid(i + 1)); });
  sim.admin.host = { kick: (id, r) => kicked.push([id, r]), ipOf: (id) => ipOf[Object.keys(ids).find((k) => ids[k] === id)], stop: () => stops.push(1), save: () => { saves.push(1); return Promise.resolve(); } };
  const say = (who, line) => { inbox[ids[who]] = []; social.command(ids[who], line); return (inbox[ids[who]] ?? []).filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted()); };
  const last = (who) => chatDisplay(inbox[ids[who]].at(-1)).unformatted();
  return { sim, social, inbox, ids, say, last, kicked, stops, saves };
}

test("only operators may run them; a non-op gets the permission failure, a level-1 op cannot ban", () => {
  const f = fixture();
  assert.match(f.say("Steve", "/op Steve")[0], /permission/i);
  f.say("Alex", "/op Steve");
  assert.ok(f.sim.admin.ops.has(uuid(2)), "/op keys the entry by the player UUID");
  assert.deepEqual(f.sim.admin.ops.get(uuid(2)), { uuid: uuid(2), name: "Steve", level: 4 });
  assert.equal(f.social.isOp("Steve"), true, "/op feeds the repo's operator check");
  f.sim.admin.ops.get(uuid(2)).level = 1;
  assert.match(f.say("Steve", "/ban Alex")[0], /permission/i, "ban needs level 3");
  assert.match(f.say("Steve", "/give Steve 1")[0], /permission/i, "level 1 does not reach /give (level 2)");
  assert.equal(f.sim.admin.bans.size, 0);
});

test("/op and /deop: usage, failures and the op-permission-level", () => {
  const f = fixture({ adminOptions: { opLevel: 3 } });
  assert.match(f.say("Alex", "/op")[0], /Usage|op <player>/i);
  assert.match(f.say("Alex", "/op Nobody")[0], /Could not op Nobody/);
  assert.match(f.say("Alex", "/op Steve")[0], /Opped Steve/);
  assert.equal(f.sim.admin.ops.get(uuid(2)).level, 3);
  assert.match(f.say("Alex", "/deop Nobody")[0], /Could not de-op Nobody/);
  assert.match(f.say("Alex", "/deop steve")[0], /De-opped steve/);
  assert.equal(f.social.isOp("Steve"), false);
});

test("the other op sees chat.type.admin feedback, the config op list still works", () => {
  const f = fixture({ ops: ["Alex", "Steve"] });
  f.say("Alex", "/whitelist on");
  assert.match(f.last("Steve"), /Alex: Turned on the whitelist/);
  assert.equal(f.social.opLevel("Alex"), 4);
});

test("/kick: default and given reasons, the player must be online", () => {
  const f = fixture();
  assert.match(f.say("Alex", "/kick Nobody")[0], /player/i);
  assert.match(f.say("Alex", "/kick Steve")[0], /Kicked Steve from the game$/);
  assert.deepEqual(f.kicked.pop(), ["p1", "Kicked by an operator."]);
  assert.match(f.say("Alex", "/kick Steve griefing the spawn")[0], /Kicked Steve from the game: 'griefing the spawn'/);
  assert.deepEqual(f.kicked.pop(), ["p1", "griefing the spawn"]);
  assert.match(f.say("Alex", "/kick S")[0], /kick <player>/);
});

test("/ban kicks the online player, the list is in the native shape and a banned login is refused with the native text", () => {
  const f = fixture();
  assert.match(f.say("Alex", "/ban Ghost")[0], /Could not ban player Ghost/);
  assert.match(f.say("Alex", "/ban Steve cheating")[0], /Banned player Steve/);
  assert.deepEqual(f.kicked.pop(), ["p1", "You are banned from this server."]);
  const e = f.sim.admin.save().banned[0];
  assert.deepEqual(Object.keys(e), ["uuid", "name", "created", "source", "expires", "reason"]);
  assert.equal(e.source, "Alex"); assert.equal(e.expires, "forever"); assert.equal(e.reason, "cheating");
  assert.equal(f.sim.admin.refusal({ uuid: uuid(2), name: "Steve" }, "1.2.3.4"), "You are banned from this server!\nReason: cheating");
  f.say("Alex", "/ban Steve");
  assert.equal(f.sim.admin.bans.get(uuid(2)).reason, "Banned by an operator.");
  assert.match(f.say("Alex", "/banlist")[0], /1 total banned players/);
  assert.match(f.say("Alex", "/pardon Nobody")[0], /Could not unban|unban/i);
  assert.match(f.say("Alex", "/pardon Steve")[0], /Unbanned player Steve/);
  assert.equal(f.sim.admin.refusal({ uuid: uuid(2), name: "Steve" }, "1.2.3.4"), null);
});

test("an expired ban entry in the file is dropped on lookup; an unexpired one shows the removal date", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  const a = new ServerAdmin({ banned: [{ uuid: "u1", name: "A", created: banDate(new Date(0)), source: "x", expires: "2025-12-31 00:00:00 +0000", reason: "r" }, { uuid: "u2", name: "B", created: banDate(new Date(0)), source: "x", expires: "2026-02-03 04:05:06 +0000", reason: "r" }] }, { now: () => now });
  assert.equal(a.refusal({ uuid: "u1", name: "A" }, ""), null);
  assert.equal(a.refusal({ uuid: "u2", name: "B" }, ""), "You are banned from this server!\nReason: r\nYour ban will be removed on 2026-02-03 at 04:05:06 UTC");
});

test("/ban-ip by address and by online player name; IP-banned logins are refused; pardon-ip", () => {
  const f = fixture();
  assert.match(f.say("Alex", "/ban-ip nobody")[0], /invalid IP address or a player that is not online/);
  assert.match(f.say("Alex", "/ban-ip 10.0.0.2 spam")[0], /Banned IP address 10.0.0.2 belonging to Steve/);
  assert.deepEqual(f.kicked.pop(), ["p1", "You have been IP banned."]);
  assert.match(f.say("Alex", "/ban-ip 9.9.9.9")[0], /Banned IP address 9.9.9.9$/);
  assert.match(f.say("Alex", "/ban-ip Alex")[0], /Banned IP address 10.0.0.1 belonging to Alex/);
  assert.equal(f.sim.admin.refusal({ uuid: "z", name: "Z" }, "::ffff:9.9.9.9"), "Your IP address is banned from this server!\nReason: Banned by an operator.");
  assert.equal(f.sim.admin.refusal({ uuid: "z", name: "Z" }, "10.0.0.2:5555"), "Your IP address is banned from this server!\nReason: spam");
  assert.match(f.say("Alex", "/banlist ips")[0], /3 total banned IP addresses/);
  assert.match(f.say("Alex", "/pardon-ip abc")[0], /invalid IP address/);
  assert.match(f.say("Alex", "/pardon-ip 9.9.9.9")[0], /Unbanned IP address 9.9.9.9/);
  assert.equal(f.sim.admin.refusal({ uuid: "z", name: "Z" }, "9.9.9.9"), null);
  assert.equal(normalizeIp("::ffff:1.2.3.4"), "1.2.3.4");
});

test("/whitelist: on/off/list/add/remove/reload, ops pass, others get the native text", () => {
  const f = fixture();
  const a = f.sim.admin, steve = { uuid: uuid(2), name: "Steve" };
  assert.equal(a.refusal(steve, "1.1.1.1"), null, "off by default");
  assert.match(f.say("Alex", "/whitelist")[0], /whitelist <on\|off\|list\|add\|remove\|reload>/);
  assert.match(f.say("Alex", "/whitelist on")[0], /Turned on the whitelist/);
  assert.equal(a.refusal(steve, "1.1.1.1"), "You are not white-listed on this server!");
  assert.equal(a.refusal({ uuid: uuid(1), name: "Alex" }, "1.1.1.1", { op: true }), null, "config op passes");
  assert.match(f.say("Alex", "/whitelist add")[0], /whitelist add <player>/);
  assert.match(f.say("Alex", "/whitelist add Ghost")[0], /Could not add Ghost/);
  assert.match(f.say("Alex", "/whitelist add Steve")[0], /Added Steve to the whitelist/);
  assert.equal(a.refusal(steve, "1.1.1.1"), null);
  assert.deepEqual(f.say("Alex", "/whitelist list").slice(0, 2), ["There are 1 (out of 2 seen) whitelisted players:", "Steve"]);
  assert.match(f.say("Alex", "/whitelist remove Ghost")[0], /Could not remove Ghost/);
  assert.match(f.say("Alex", "/whitelist remove steve")[0], /Removed steve from the whitelist/);
  assert.match(f.say("Alex", "/whitelist reload")[0], /Reloaded the whitelist/);
  assert.match(f.say("Alex", "/whitelist off")[0], /Turned off the whitelist/);
  assert.equal(a.refusal(steve, "1.1.1.1"), null);
  f.say("Alex", "/op Steve"); f.say("Alex", "/whitelist on");
  assert.equal(a.refusal(steve, "1.1.1.1"), null, "an /op entry passes the whitelist");
});

test("the lists survive a save and load; legacy saves without them load empty", () => {
  const f = fixture();
  f.say("Alex", "/op Steve"); f.say("Alex", "/ban-ip 8.8.8.8"); f.say("Alex", "/whitelist on"); f.say("Alex", "/setidletimeout 5");
  const saved = JSON.parse(JSON.stringify(f.sim.save()));
  const g = new DedicatedSimulation(saved, { world: new World("b68admin") });
  assert.equal(g.admin.ops.get(uuid(2)).name, "Steve");
  assert.ok(g.admin.ipBans.has("8.8.8.8"));
  assert.equal(g.admin.whitelistOn, true); assert.equal(g.admin.idleMinutes, 5);
  const h = new DedicatedSimulation({}, { world: new World("x") });
  assert.equal(h.admin.ops.size, 0); assert.equal(h.admin.whitelistOn, false);
  assert.equal(new DedicatedSimulation({}, { world: new World("x"), whitelist: true }).admin.whitelistOn, true);
});

test("/stop, /save-all, /save-on, /save-off and /setidletimeout", async () => {
  const f = fixture();
  assert.match(f.say("Alex", "/stop")[0], /Stopping the server/);
  await new Promise((r) => setImmediate(r)); assert.equal(f.stops.length, 1);
  const lines = f.say("Alex", "/save-all");
  assert.equal(lines[0], "Saving..."); await f.sim.admin.pending; assert.equal(f.saves.length, 1);
  assert.match(f.last("Alex"), /Saved the world/);
  assert.match(f.say("Alex", "/save-on")[0], /already turned on/);
  assert.match(f.say("Alex", "/save-off")[0], /Turned off world auto-saving/);
  assert.equal(f.sim.admin.autosave, false);
  assert.match(f.say("Alex", "/save-off")[0], /already turned off/);
  assert.match(f.say("Alex", "/save-on")[0], /Turned on world auto-saving/);
  assert.match(f.say("Alex", "/setidletimeout x")[0], /not a valid number/i);
  assert.match(f.say("Alex", "/setidletimeout -1")[0], /too small|at least/i);
  assert.match(f.say("Alex", "/setidletimeout 2")[0], /idle timeout to 2 minutes/);
  const a = f.sim.admin; a.join("p0", 0); a.join("p1", 0);
  assert.deepEqual(a.idle(2400), []); assert.deepEqual(a.idle(2401).sort(), ["p0", "p1"]);
  a.activity("p0", { type: "chat" }, 2400); assert.deepEqual(a.idle(2401), ["p1"]);
  a.activity("p1", { type: "input", controls: { forward: 0 }, yaw: 1, pitch: 0 }, 2500); assert.deepEqual(a.idle(2501), ["p1"], "an idle input only records the view");
  a.activity("p1", { type: "input", controls: { forward: 1 }, yaw: 1, pitch: 0 }, 2500); assert.deepEqual(a.idle(2501), []);
});
