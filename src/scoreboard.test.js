import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCommandRunner } from "./commands.js";
import { Scoreboard, SLOT_NAMES, slotIndex, criteriaNames, criteriaOrder, isCriteria, isReadOnly, sidebarLayout, scoreboardToJSON, scoreboardFromJSON, scoreboardDocument, scoreboardJSONFromNbt } from "./scoreboard.js";
import { joinNiceString, formattingByName, COLOR_VALUES } from "./commands-scoreboard.js";
import { ScoreboardLive } from "./scoreboard-live.js";
import { JavaHashMap, JavaHashSet, javaStringHash } from "./java-hash.js";
import { javaHashMapOrder, javaStringHash as structureHash } from "./structure-nbt.js";
import { selectLocalPlayer } from "./command-selector.js";
import { scoreCell, playerListVisible } from "./player-list.js";
import { encodeNbt, decodeNbt } from "./nbt.js";
import { isComponent } from "./chat-component.js";
import { STAT } from "./stats.js";

const ref = JSON.parse(await readFile(new URL("../public/research/scoreboard-reference.json", import.meta.url)));
const records = (c) => ref.records.filter((r) => r.case === c);
const hex = (b) => Buffer.from(b).toString("hex");
const bytes = (h) => Uint8Array.from(Buffer.from(h, "hex"));
const text = (t) => (isComponent(t) ? t.formatted() : String(t));

// The probe's sender is a plain ICommandSender (a command block here: no implicit self-join); notifyAdmins goes to feedback.
function runScripts() {
  const boards = {}, outputs = [];
  let script = null, run, out;
  const host = { name: "Player", cheats: true, isCommandBlock: true, print: (t) => out.push(text(t)), feedback: (t) => out.push("N:" + text(t)), position: () => ({ x: 0, y: 64, z: 0 }), changed() {} };
  for (const r of records("command")) {
    if (r.script !== script) { script = r.script; host.scoreboard = boards[script] = new Scoreboard(); run = createCommandRunner(host); }
    out = [];
    run.run("/scoreboard" + (r.line === "" ? "" : " " + r.line));
    outputs.push({ record: r, got: out });
  }
  return { boards, outputs };
}
const expected = (out) => out.map((e) => (e.t === "notify" ? "N:" + e.text : e.t === "chat" ? e.color + e.text : "§c" + e.text));
const { boards, outputs } = runScripts();

test("the probe ran every scripted line without a Java exception", () => {
  assert.ok(records("command").length >= 150);
  for (const r of records("command")) assert.ok(!r.out.some((e) => e.t === "exception"), `${r.script}: ${r.line}`);
});

test("/scoreboard replays CommandScoreboard's chat, notifications and errors line by line", () => {
  for (const { record: r, got } of outputs) {
    const want = expected(r.out);
    // "players list <name>" iterates the player's HashMap<ScoreObjective, Score>, keyed by identity hash: natively random order.
    if (/^players list \S/.test(r.line) && want.length > 1) {
      assert.equal(got[0], want[0], r.line);
      assert.deepEqual([...got.slice(1)].sort(), [...want.slice(1)].sort(), `${r.script}: ${r.line}`);
    } else assert.deepEqual(got, want, `${r.script}: ${JSON.stringify(r.line)}`);
  }
});

test("the scoreboard state after each script matches objectives, holders, sorting, team formatting and slots", () => {
  assert.equal(records("state").length, 6);
  for (const st of records("state")) {
    const b = boards[st.script] ?? new Scoreboard();
    assert.deepEqual(b.objectiveList().map((o) => o.name), st.objectives, st.script);
    assert.deepEqual(b.objectiveList().map((o) => [o.name, o.criteria, o.displayName, String(isReadOnly(o.criteria))]), st.objectiveDetails, st.script);
    assert.deepEqual(b.playerNames(), st.holders, st.script);
    assert.deepEqual(Object.fromEntries(b.objectiveList().map((o) => [o.name, b.sortedScores(o).map((s) => s.player + "=" + s.value)])), st.sorted, st.script);
    assert.deepEqual(b.playerNames().map((p) => b.formatName(p)), st.formatted, st.script);
    assert.deepEqual(b.slots.map((o) => o?.name ?? null), st.slots, st.script);
    assert.deepEqual(b.teamList().map((t) => ({ name: t.name, display: t.displayName, prefix: t.prefix, suffix: t.suffix, friendlyFire: t.friendlyFire, seeFriendlyInvisibles: t.seeFriendlyInvisibles, members: [...t.members] })), st.teams, st.script);
  }
});

// PlayerScores lists each holder's scores in the per-player identity-hash order; regroup them for a comparison.
const normalised = (h) => { const j = scoreboardJSONFromNbt(decodeNbt(bytes(h)).tag); j.scores.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))); return j; };

test("data/scoreboard.dat bytes equal ScoreboardSaveData.writeToNBT, and read back through readFromNBT", () => {
  for (const st of records("state")) {
    const b = boards[st.script] ?? new Scoreboard();
    const mine = hex(encodeNbt(scoreboardDocument(b)));
    assert.equal(mine.length, st.nbt.length, st.script);
    if (st.script === "order") assert.deepEqual(normalised(mine), normalised(st.nbt), st.script);
    else assert.equal(mine, st.nbt, st.script);
    assert.equal(st.roundTrip.length, st.nbt.length, st.script);
    const back = scoreboardFromJSON(new Scoreboard(), scoreboardJSONFromNbt(decodeNbt(bytes(st.nbt)).tag));
    assert.deepEqual(normalised(hex(encodeNbt(scoreboardDocument(back)))), normalised(st.roundTrip), st.script);
  }
});

test("IScoreObjectiveCriteria.field_96643_a has the native key set and only health is read-only", () => {
  const r = records("criteria")[0];
  const mine = criteriaNames();
  assert.equal(mine.length, r.keys.length);
  assert.deepEqual([...mine].sort(), [...r.keys].sort());
  for (const k of r.keys) assert.ok(isCriteria(k), k);
  assert.ok(!isCriteria("stat.nonsense") && !isCriteria("Dummy"));
  assert.deepEqual(r.readOnly, ["health"]);
  assert.deepEqual(mine.filter(isReadOnly), r.readOnly);
});

test("criteria iteration order: every one of the 803 positions replays from the stat order of the same native run", () => {
  const r = records("criteria")[0], statOrder = records("statOrder")[0].ids;
  assert.equal(r.keys.length, 803);
  assert.deepEqual(criteriaOrder(statOrder), r.keys);
});

test("the shipped criteria order uses StatList's own registration order", () => {
  const mine = criteriaNames();
  assert.equal(mine.length, 803);
  assert.equal(new Set(mine).size, 803);
  // The one run-dependent part is the craftItem run (a HashSet of Items keyed by identity hash): every other stat sits where the native map puts it.
  const ref = records("criteria")[0].keys, craft = (k) => k.startsWith("stat.craftItem.");
  const same = mine.filter((k, i) => k === ref[i]).length;
  assert.ok(same > 700, String(same));
  assert.deepEqual(mine.filter((k) => !craft(k)).sort(), ref.filter((k) => !craft(k)).sort());
});

test("EnumChatFormatting.getValueByName, getValidValues and joinNiceString", () => {
  for (const r of records("formatting")) {
    const f = formattingByName(r.input);
    assert.deepEqual(f && { name: f.name, code: f.code, fancy: f.fancy }, r.name === null ? null : { name: r.name, code: r.code, fancy: r.fancy }, r.input);
  }
  assert.deepEqual(COLOR_VALUES, records("validValues")[0].values);
  for (const r of records("nice")) assert.equal(joinNiceString(r.items), r.text);
});

test("JavaHashMap iterates like java.util.HashMap and agrees with structure-nbt's order model", () => {
  const keys = Array.from({ length: 200 }, (_, i) => `k${i * 7919}`).concat(["Aa", "BB", "AaAa", "BBBB", "AaBB", "BBAa"]);
  const m = new JavaHashMap();
  for (const k of keys) m.set(k, 1);
  assert.deepEqual([...m.keys()], javaHashMapOrder(keys));
  assert.equal(m.size, keys.length);
  for (const k of keys) assert.equal(javaStringHash(k), structureHash(k));
  m.set("k0", 2);
  assert.deepEqual([...m.keys()], javaHashMapOrder(keys)); // an update keeps its place
  assert.ok(m.delete("Aa") && !m.has("Aa") && !m.delete("Aa"));
  const s = new JavaHashSet(["b", "a", "b"]);
  assert.deepEqual([...s], ["a", "b"]);
});

test("objectives, scores and teams follow the native data model", () => {
  const b = new Scoreboard();
  const kills = b.addObjective("kills", "totalKillCount"), hp = b.addObjective("hp", "health");
  assert.throws(() => b.addObjective("kills", "dummy"));
  b.setScore("Alex", kills, 3);
  b.setScore("Steve", kills, 3);
  b.setScore("Bob", kills, -1);
  assert.deepEqual(b.sortedScores(kills).map((s) => s.player), ["Bob", ...b.playerNames().filter((p) => p !== "Bob")]);
  assert.throws(() => b.addScore("Alex", hp, 1));
  b.setSlot(slotIndex("SideBar"), kills);
  assert.equal(SLOT_NAMES[slotIndex("belowname")], "belowName");
  b.removeObjective(kills);
  assert.equal(b.slot(1), null);
  assert.equal(b.peek("Alex", kills), null);
  const red = b.createTeam("red");
  b.setTeam(red, { prefix: "§c", suffix: "§r" });
  assert.ok(b.joinTeam("Alex", "red"));
  assert.equal(b.formatName("Alex"), "§cAlex§r");
  assert.equal(b.formatName("Steve"), "Steve");
  assert.ok(b.leaveTeam("Alex"));
  assert.equal(b.teamOf("Alex"), null);
});

test("the sidebar draws only 1..15 scores, laid out as GuiIngame.func_96136_a", () => {
  const w = (s) => s.replace(/§./g, "").length * 6, b = new Scoreboard(), o = b.addObjective("obj", "dummy");
  assert.equal(sidebarLayout(b, o, 320, 240, w), null);
  b.setScore("A", o, 5);
  b.setScore("Bee", o, 12);
  const l = sidebarLayout(b, o, 320, 240, w);
  const maxW = w("Bee: §c12");
  assert.equal(l.maxW, maxW);
  assert.deepEqual(l.rows.map((r) => [r.name, r.score, r.y]), [["A", "§c5", 120 + 6 - 9], ["Bee", "§c12", 120 + 6 - 18]]);
  assert.equal(l.rows[0].nameX, 320 - maxW - 3);
  assert.equal(l.rows[1].scoreX, 320 - 3 + 2 - w("§c12"));
  assert.deepEqual(l.rects.map((r) => r.color), [0x50000000, 0x50000000, 0x60000000, 0x50000000]);
  assert.equal(l.title.y, 120 + 6 - 27);
  for (let i = 0; i < 14; i++) b.setScore("p" + i, o, i);
  assert.equal(sidebarLayout(b, o, 320, 240, w), null); // 16 scores: nothing at all
});

test("the Tab list draws the list objective's score only with room after the name", () => {
  const w = (s) => s.replace(/§./g, "").length * 6;
  assert.deepEqual(scoreCell(10, 100, "Steve", 7, w), { text: "§e7", x: 10 + 100 - 17 - 6 });
  assert.equal(scoreCell(10, 50, "Steve", 7, w), null); // 43 - 45: no room
  assert.equal(scoreCell(10, 57, "Steve", 7, w), null); // exactly 5 is not enough
  assert.ok(scoreCell(10, 58, "Steve", 7, w));
  assert.ok(playerListVisible({ integrated: true, players: 1, hasObjective: true }));
});

test("selectors match team= and score_ arguments against the scoreboard", () => {
  const b = new Scoreboard(), o = b.addObjective("pts", "dummy");
  const host = { name: "Player", scoreboard: b, position: () => ({ x: 0, y: 64, z: 0 }) };
  assert.equal(selectLocalPlayer("@p[team=]", host), "Player");
  assert.equal(selectLocalPlayer("@p[team=blue]", host), null);
  b.createTeam("Blue");
  b.joinTeam("Player", "Blue");
  assert.equal(selectLocalPlayer("@p[team=blue]", host), "Player");
  assert.equal(selectLocalPlayer("@p[team=!blue]", host), null);
  assert.equal(selectLocalPlayer("@p[score_missing=5]", host), null);
  assert.equal(selectLocalPlayer("@p[score_pts=0]", host), "Player"); // reads (and creates) a 0 score
  assert.equal(b.peek("Player", o).value, 0);
  b.setScore("Player", o, 4);
  assert.equal(selectLocalPlayer("@p[score_pts_min=5]", host), null);
  assert.equal(selectLocalPlayer("@p[score_pts_min=4,score_pts=4]", host), "Player");
  assert.equal(selectLocalPlayer("@p[score_pts=x]", host), null); // parseIntWithDefault: 1
});

test("the world record keeps the scoreboard as JSON and loading it is not a change", () => {
  const b = boards.teams;
  const json = scoreboardToJSON(b);
  assert.equal(scoreboardToJSON(new Scoreboard()), undefined);
  let changes = 0;
  const c = new Scoreboard();
  c.onChange = () => changes++;
  scoreboardFromJSON(c, JSON.parse(JSON.stringify(json)));
  assert.equal(changes, 0);
  assert.deepEqual(scoreboardToJSON(c), json);
  assert.equal(hex(encodeNbt(scoreboardDocument(c))), hex(encodeNbt(scoreboardDocument(b))));
  scoreboardFromJSON(c, { objectives: [{ name: "x" }], scores: [{ name: "A", objective: "missing", score: 1 }], teams: "bad" });
  assert.deepEqual(c.objectiveList().map((o) => [o.name, o.criteria, o.displayName]), [["x", "dummy", "x"]]);
  assert.deepEqual(c.playerNames(), []);
});

test("tab completion follows CommandScoreboard.addTabCompletionOptions", () => {
  const host = { name: "Player", cheats: true, print() {}, position: () => ({ x: 0, y: 64, z: 0 }), changed() {}, scoreboard: new Scoreboard() };
  const run = createCommandRunner(host);
  assert.deepEqual(run.complete("/scoreboard "), ["objectives", "players", "teams"]);
  assert.deepEqual(run.complete("/scoreboard objectives setdisplay s"), ["sidebar"]);
  assert.ok(run.complete("/scoreboard objectives add x stat.mineBlock.").length > 100);
  host.scoreboard.addObjective("hp", "health");
  host.scoreboard.addObjective("pts", "dummy");
  assert.deepEqual(run.complete("/scoreboard players set Player "), ["pts"]);
  assert.deepEqual(run.complete("/scoreboard teams option t "), ["color", "friendlyfire", "seeFriendlyInvisibles"]); // any team name
  host.scoreboard.createTeam("t");
  assert.deepEqual(run.complete("/scoreboard teams option "), ["t"]);
  assert.deepEqual(run.complete("/scoreboard teams option t c"), ["color"]);
  assert.deepEqual(run.complete("/scoreboard teams option t color dark_r"), ["dark_red"]);
});

test("a player sender joins or leaves its own team without names", () => {
  const out = [], host = { name: "Player", cheats: true, print: (t) => out.push(text(t)), position: () => ({ x: 0, y: 64, z: 0 }), changed() {}, scoreboard: new Scoreboard() };
  const run = createCommandRunner(host);
  run.run("/scoreboard teams add red");
  run.run("/scoreboard teams join red");
  assert.equal(host.scoreboard.teamOf("Player")?.name, "red");
  run.run("/scoreboard teams leave");
  assert.equal(host.scoreboard.teamOf("Player"), null);
});

test("live criteria: stats, achievements, deaths, kills and health", () => {
  const b = new Scoreboard(), stats = {}, achievements = {};
  const live = new ScoreboardLive({ scoreboard: b, stats, achievements, name: () => "Player" });
  const o = (c) => b.addObjective(c.replace(/\W/g, "").slice(0, 16), c);
  const deaths = o("deathCount"), total = o("totalKillCount"), pk = o("playerKillCount"), hp = o("health"), jumps = o(STAT.jump ?? "stat.jump"), ach = o("achievement.openInventory");
  stats.onIncrement(STAT.deaths);
  stats.onIncrement(STAT.mobKills);
  stats.onIncrement(STAT.playerKills);
  stats.onIncrement(STAT.jump ?? "stat.jump");
  achievements.onTrigger("openInventory");
  achievements.onTrigger("openInventory"); // every trigger counts
  const v = (obj) => b.peek("Player", obj)?.value ?? null;
  assert.deepEqual([v(deaths), v(total), v(pk), v(jumps), v(ach)], [1, 2, 1, 1, 2]);
  assert.equal(v(hp), null);
  live.tick(19.5, 0);
  assert.equal(v(hp), 20);
  b.setScore("Player", hp, 3); // not resent until the health changes
  live.tick(19.5, 0);
  assert.equal(v(hp), 3);
  live.tick(10, 4);
  assert.equal(v(hp), 14);
  live.respawn();
  b.setScore("Player", hp, 3);
  live.tick(10, 4);
  assert.equal(v(hp), 14);
});

test("Anvil export writes data/scoreboard.dat and the region importer reads it back", async () => {
  const { World } = await import("./world.js");
  const { exportJavaSave } = await import("./region-export.js");
  const { importJavaRegionArea } = await import("./region-import.js");
  const { decodeCompressedNbt } = await import("./nbt-compression.js");
  const scoreboard = scoreboardToJSON(boards.teams);
  const w = new World("17", "javaStreamed", 12);
  const record = { id: "sb", name: "Scoreboard", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [], position: { x: 0.5, y: 80, z: 0.5, yaw: 0, pitch: 0 }, scoreboard };
  const { files, report } = await exportJavaSave(record, { world: w });
  const dat = files.get("data/scoreboard.dat");
  assert.ok(dat && report.notes.some((n) => n.startsWith("data/scoreboard.dat")));
  assert.equal(hex(encodeNbt((await decodeCompressedNbt(dat)))), hex(encodeNbt(scoreboardDocument(boards.teams))));
  const [filename, bytes] = [...files].find(([k]) => k.startsWith("region/"));
  const { record: imported, report: importReport } = await importJavaRegionArea([{ filename: filename.slice(7), bytes }], { seed: "17", area: { chunkX: w.originX / 16, chunkZ: w.originZ / 16, width: 1, depth: 1 }, structureData: [{ filename: "data/scoreboard.dat", bytes: dat }] });
  assert.deepEqual(imported.scoreboard, scoreboard);
  assert.deepEqual(importReport.scoreboard, { objectives: scoreboard.objectives.length, scores: scoreboard.scores.length, teams: scoreboard.teams.length });
  assert.equal(imported.structureData, undefined, "scoreboard.dat is not structure data");
});
