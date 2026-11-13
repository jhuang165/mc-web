// Replays the "trio" rows of public/research/cmd-chat-reference.json (tools/probes/CmdChatProbe.java): the unchanged 1.7.10 CommandMessage, CommandBroadcast and
// CommandEmote with PlayerSelector over three players (Alex, Steve, Bob) in one world, then the death/achievement broadcasts of chat-multi.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { serializeComponent, translation } from "./chat-component.js";
import { createCommandRunner } from "./commands.js";
import { Scoreboard } from "./scoreboard.js";
import { selectPlayers } from "./command-selector.js";
import { broadcastToAll, achievementComponent, serverChatCommand } from "./chat-multi.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/cmd-chat-reference.json", import.meta.url)));
const PLAYERS = [
  { name: "Alex", position: { x: 0.5, y: 64, z: 0.5 }, mode: 0, level: 5 },
  { name: "Steve", position: { x: 10.5, y: 64, z: 0.5 }, mode: 0, level: 20 },
  { name: "Bob", position: { x: 200.5, y: 64, z: 0.5 }, mode: 1, level: 0 },
];
function board() {
  const b = new Scoreboard(), t = b.createTeam("red");
  b.setTeam(t, { prefix: "§c", suffix: "§r" });
  b.joinTeam("Alex", "red"); b.joinTeam("Steve", "red");
  return b;
}
const ser = (c) => (typeof c === "string" ? c : serializeComponent(c));
// A trio world: every message lands in the recipient's log; a player sender's own feedback is its log, a console or command block sender has "sender".
function world(online = PLAYERS.map((p) => p.name)) {
  const log = { Alex: [], Steve: [], Bob: [], sender: [] };
  const records = PLAYERS.filter((p) => online.includes(p.name)).map((p) => ({ ...p, position: () => p.position }));
  const hostFor = (sender) => {
    const player = PLAYERS.find((p) => p.name === sender);
    const at = player ? player.position : { x: 0, y: 0, z: 0 };
    const to = (who, c) => log[who].push(c);
    return {
      name: sender, playerName: player ? sender : "Alex", isCommandBlock: !player, cheats: true, rules: {}, scoreboard: board(),
      position: () => ({ ...at }), players: () => records,
      print: (t, c) => to(player ? sender : "sender", c ?? t),
      broadcast: (t, c) => { for (const r of records) to(r.name, c ?? t); },
      deliver: (who, t, c) => to(who, c ?? t),
    };
  };
  return { log, run: (sender, line) => createCommandRunner(hostFor(sender)).run(line) };
}

test("trio records: tell, say and me over three players", () => {
  const rows = ref.records.filter((r) => r[0] === "trio");
  const bad = [];
  for (const [, cmd, sender, args, res] of rows) {
    const line = `/${cmd} ${args.join(" ")}`.trimEnd();
    const w = world();
    w.run(sender === "Server" ? "Server" : sender, line);
    for (const who of ["Alex", "Steve", "Bob", "sender"]) {
      const expect = res.out[who].map((c) => c[0]), got = w.log[who].map(ser);
      if (JSON.stringify(expect) !== JSON.stringify(got)) bad.push([line, sender, who, expect, got]);
    }
  }
  if (process.env.DBG) console.log(JSON.stringify(bad.slice(0, 3)));
  assert.deepEqual(bad.map((b) => `${b[0]} from ${b[1]} at ${b[2]}`), []);
  assert.ok(rows.length >= 300);
});

test("selectors choose among every player: nearest first, count, reverse, @r", () => {
  const host = { name: "@", position: () => ({ x: 0, y: 0, z: 0 }), players: () => PLAYERS.map((p) => ({ ...p, position: () => p.position })), scoreboard: board() };
  assert.deepEqual(selectPlayers("@a", host), ["Alex", "Steve", "Bob"]);
  assert.deepEqual(selectPlayers("@p", host), ["Alex"]);
  assert.deepEqual(selectPlayers("@a[c=-2]", host), ["Bob", "Steve"]);
  assert.deepEqual(selectPlayers("@a[x=190,y=64,z=0]", host), ["Bob", "Steve", "Alex"]);
  assert.deepEqual(selectPlayers("@p[x=190,y=64,z=0]", host), ["Bob"]);
  assert.deepEqual(selectPlayers("@a[r=70]", host), ["Alex", "Steve"]);
  assert.deepEqual(selectPlayers("@a[m=1]", host), ["Bob"]);
  assert.deepEqual(selectPlayers("@a[name=!Bob]", host), ["Alex", "Steve"]);
  host.random = () => 0;
  assert.equal(selectPlayers("@r", host).length, 1);
  assert.equal(selectPlayers("@r[c=5]", host).length, 3);
  assert.deepEqual(selectPlayers("@r[c=0]", host), []);
});

test("/tell by name reaches an online player, an absent one is not found", () => {
  const w = world(["Alex", "Bob"]);
  w.run("Alex", "/tell bob hello");
  assert.equal(w.log.Bob.length, 1);
  assert.equal(w.log.Alex.length, 1);
  w.run("Alex", "/tell Steve hello");
  assert.equal(w.log.Alex.length, 2);
  assert.match(ser(w.log.Alex[1]), /player.notFound/);
  assert.equal(w.log.Steve.length, 0);
});

test("/give style commands refuse another online player instead of acting on the local one", () => {
  const w = world();
  w.run("Alex", "/testfor Bob");
  assert.match(ser(w.log.Alex[0]), /another player/);
});

test("death and achievement broadcast to every player", () => {
  const w = world();
  const hosts = PLAYERS.map((p) => ({ name: p.name, got: [] }));
  const send = (who, c) => hosts.find((h) => h.name === who).got.push(c);
  broadcastToAll(PLAYERS.map((p) => p.name), send, translation("death.attack.fall", "Bob"));
  for (const h of hosts) assert.equal(ser(h.got[0]), '{"translate":"death.attack.fall","with":["Bob"]}');
  const a = achievementComponent("Steve", "openInventory");
  assert.equal(a.key, "chat.type.achievement");
  assert.equal(w.log.Alex.length, 0);
});

test("/effect keeps the Ambient flag off (CommandEffect builds new PotionEffect(id, ticks, amp))", () => {
  const added = [];
  const w = world();
  const host = { name: "Alex", playerName: "Alex", cheats: true, rules: {}, scoreboard: board(), position: () => ({ x: 0, y: 64, z: 0 }), print() {}, addEffect: (...a) => added.push(a) };
  createCommandRunner(host).run("/effect Alex 1 30 1");
  assert.deepEqual(added, [[1, 600, 1]]); // id, ticks, amplifier only: no ambient argument exists in the port, so every command effect is non-ambient
  assert.ok(w);
});

test("serverChatCommand: /tell whispers to the target only, /me goes to all, /say needs a permission level", () => {
  const players = [{ name: "Alex", position: { x: 0, y: 64, z: 0 } }, { name: "Bob", position: { x: 5, y: 64, z: 0 } }];
  const tell = serverChatCommand("Alex", "/tell Bob psst", players);
  assert.deepEqual(tell.map((d) => d.to), ["Bob", "Alex"]);
  assert.match(tell[0].text, /Alex whispers to you: psst/);
  assert.match(tell[1].text, /You whisper to Bob: psst/);
  assert.deepEqual(serverChatCommand("Alex", "/me waves", players).map((d) => d.to), ["Alex", "Bob"]);
  assert.match(serverChatCommand("Alex", "/say hi", players)[0].text, /permission/);
  assert.match(serverChatCommand("Alex", "/tell Nobody hi", players)[0].text, /cannot be found/);
});
