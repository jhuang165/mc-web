// Batch 82 commands82: replays cmd-args-reference.json (tools/probes/CmdArgsProbe.java, executed on the unchanged 1.7.10 integrated-server command classes):
// Tab completion of every argument position and the errors and feedback of processCommand for many argument forms.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCommandRunner, CommandException } from "./commands.js";
import { spTabComplete } from "./sp-tabcomplete.js";
import { serializeComponent, langReady } from "./chat-component.js";

await langReady; // the full en_US table (options.difficulty.*, gameMode.*, tile.*.name)
const ref = JSON.parse(await readFile(new URL("../public/research/cmd-args-reference.json", import.meta.url)));
const plain = (a) => (Array.isArray(a) ? a[2] : a); // a component argument compares by its unformatted text
const argText = (a) => (a && typeof a === "object" && typeof a.unformatted === "function" ? a.unformatted() : String(a));

// The double has no StatList/AchievementList bootstrap: its achievement and stat-criteria lists are not the game's.
const DOUBLE_ONLY_TAB = new Set(["achievement give ", "achievement give achievement.o", "achievement give achievement.openInventory ", "achievement give stat.j", "scoreboard objectives add x "]);

// Rows where the double is not the game: its World.blockExists answers true at any height (so the y range checks pass), it has no AchievementList bootstrap,
// and the probe classpath's newer Gson appends " path $..." to MalformedJsonException messages (1.7.10's Gson 2.2.4 does not).
const DOUBLE_ONLY_RUN = new Set([
  "summon Pig 0 300 0", "summon Pig 0 -1 0", "setblock 0 -1 0 stone", "setblock 0 256 0 stone", "testforblock 0 -1 0 stone",
  "achievement take achievement.openInventory", "achievement give achievement.openInventory Nobody", "tellraw Alex {bad", "tellraw Alex [",
]);

function host(log) {
  const h = {
    name: "Alex", playerName: "Alex", cheats: true, rules: undefined, seed: () => "0",
    position: () => ({ x: 0.5, y: 64, z: 0.5 }), playerNames: () => ["Alex"],
    print: (t, c) => log.sender.push(c ? serializeComponent(c) : t),
    targetPrint: () => {}, // the target's gameMode.changed line comes from S2BPacketChangeGameState on its client (the double logs the packets, filtered below)
    feedback: (t, c) => log.admin.push([0, c.key, (c.args ?? []).map(argText)]),
    inWorld: (x, y, z) => y >= 0 && y < 256, kill() {}, setGameMode() {}, setDefaultGameMode() {}, setGameRule(k, v) { h.rules = { ...h.rules, [k]: v }; },
    give: () => null, clear: () => 0, setTime() {}, addTime() {}, toggleDownfall() {}, setWeather() {}, teleport() {}, setSpawnpoint() {}, setWorldSpawn() {},
    setDifficulty() {}, clearEffects: () => false, removeEffect: () => false, addEffect() {}, enchant: () => "noItem", enchantCheck: () => "noItem", addLevels() {}, addExperience() {},
    summon: () => null, setBlock: () => false, blockAt: () => ({ id: 0, meta: 0 }), tileAt: () => null, playSound() {}, shareToLan: () => null,
  };
  return h;
}

test("Tab completion of every argument matches the executed integrated server", () => {
  const bad = [];
  for (const [text, options] of ref.tab) {
    if (DOUBLE_ONLY_TAB.has(text)) continue;
    const runner = createCommandRunner(host({ sender: [], admin: [] }));
    const got = spTabComplete("/" + text, { name: "Alex", cheats: true, complete: (t) => runner.complete(t, true) });
    if (JSON.stringify(got) !== JSON.stringify(options ?? [])) bad.push(`${text}: ${JSON.stringify(got).slice(0, 160)} != ${JSON.stringify(options ?? []).slice(0, 160)}`);
  }
  assert.deepEqual(bad, []);
});

test("processCommand errors and feedback match the executed command classes", () => {
  const bad = [];
  for (const [name, args, out] of ref.run) {
    if (out.crash !== null || DOUBLE_ONLY_RUN.has(`${name} ${args.join(" ")}`)) continue; // the double could not run it, or is not the game there
    const log = { sender: [], admin: [] };
    const runner = createCommandRunner(host(log));
    let thrown = null;
    try { runner.handlers[name](args.slice()); } catch (e) { if (!(e instanceof CommandException)) throw e; thrown = [e.key, e.args.map(argText)]; }
    const want = out.thrown && [out.thrown[1], out.thrown[2].map(plain)];
    const wantAdmin = out.admin.map(([f, k, a]) => [0, k, a.map(plain)]);
    const wantSender = out.sender.filter((c) => c[0] !== "packet").map((c) => c[0]);
    const diff = [];
    if (JSON.stringify(thrown) !== JSON.stringify(want)) diff.push(`thrown ${JSON.stringify(thrown)} != ${JSON.stringify(want)}`);
    if (JSON.stringify(log.admin) !== JSON.stringify(wantAdmin)) diff.push(`admin ${JSON.stringify(log.admin)} != ${JSON.stringify(wantAdmin)}`);
    if (JSON.stringify(log.sender) !== JSON.stringify(wantSender)) diff.push(`sender ${JSON.stringify(log.sender).slice(0, 200)} != ${JSON.stringify(wantSender).slice(0, 200)}`);
    if (diff.length) bad.push(`/${name} ${args.join(" ")}: ${diff.join("; ")}`);
  }
  assert.deepEqual(bad, []);
});

test("/tp between players in two dimensions notifies commands.tp.notSameDimension and moves nobody (bytecode-read bv.b)", () => {
  const log = { sender: [], admin: [] }, moved = [];
  const h = { ...host(log), playerNames: () => ["Alex", "Bo"], players: () => [{ name: "Alex", position: () => ({ x: 0, y: 64, z: 0 }) }, { name: "Bo", position: () => ({ x: 9, y: 64, z: 9 }) }],
    forPlayer: () => ({}), dimensionOf: (n) => (n === "Bo" ? -1 : 0), positionOf: () => ({ x: 9, y: 64, z: 9 }), teleport: (...p) => moved.push(p) };
  createCommandRunner(h).handlers.tp(["Bo"]);
  assert.deepEqual(log.admin, [[0, "commands.tp.notSameDimension", []]]);
  assert.deepEqual(moved, []);
});

test("/gamemode success lines carry flag 1 to the host's feedback; with no feedback host (single player) the owner sees only gameMode.changed", () => {
  const flags = [];
  const h = { ...host({ sender: [], admin: [] }), feedback: (t, c, f) => flags.push([t, f]) };
  createCommandRunner(h).handlers.gamemode(["c"]);
  assert.deepEqual(flags, [["Set own game mode to Creative Mode", 1]]);
  const lines = [];
  const sp = { ...host({ sender: [], admin: [] }), feedback: undefined, targetPrint: undefined, print: (t) => lines.push(t) };
  createCommandRunner(sp).handlers.gamemode(["c"]);
  assert.deepEqual(lines, ["Your game mode has been updated"]);
});
