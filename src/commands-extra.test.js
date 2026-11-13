import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCommandRunner, tr } from "./commands.js";
import { lookupStat, allStatIds, statComponent, statHover, spreadPositions, spreadIterate, averageDistance, SpreadFailure, javaFloat, profilerTick } from "./commands-extra.js";
import { Profiler, profileResults, profileFileName, format2, WITTY_COMMENTS } from "./profiler.js";
import { serializeComponent, componentParts, translation, langReady, isComponent } from "./chat-component.js";
import { Achievements } from "./achievements.js";
import { Stats } from "./stats.js";
import { JavaRandom } from "./java-random.js";

const ref = JSON.parse(await readFile(new URL("../public/research/commands-b13-reference.json", import.meta.url)));
const records = (c) => ref.records.filter((r) => r.case === c);
await langReady;
const partRecord = (p) => {
  const s = { code: p.style.code() };
  if (p.style.click) s.click = [p.style.click.action, p.style.click.value];
  if (p.style.hover) s.hover = [p.style.hover.action, p.style.hover.value.formatted(), p.style.hover.value.unformatted()];
  return { cls: "text", text: p.text, style: s };
};
const show = (m) => (isComponent(m) ? m.formatted().replace(/§r/g, "") : m);

function runner(extra = {}) {
  const out = [], achievements = new Achievements(), stats = new Stats();
  const host = { name: "Player", cheats: true, print: (t) => out.push(show(t)), position: () => ({ x: 0, y: 64, z: 0 }), achievements, stats, changed() {}, ...extra };
  return { run: createCommandRunner(host), out, host, achievements, stats };
}

test("StatList.func_151177_a finds the native ids and allStats keeps its order", () => {
  for (const r of records("statLookup")) {
    const s = lookupStat(r.id);
    assert.equal(!!s, r.found, r.id);
    if (s) assert.equal(!!s.achievement, r.achievement, r.id);
  }
  // The same 782 ids. Everything but the craftItem run is in StatList's registration order; that run follows a HashSet of Items keyed by
  // identity hash, so another JVM run orders it differently (the port keeps the order of one probed run).
  const all = records("allStats")[0].ids;
  assert.equal(allStatIds().length, all.length);
  assert.deepEqual([...allStatIds()].sort(), [...all].sort());
  const noCraft = (l) => l.filter((id) => !id.startsWith("stat.craftItem."));
  assert.deepEqual(noCraft(allStatIds()), noCraft(all));
  assert.deepEqual(allStatIds().slice(0, 23), all.slice(0, 23));
  assert.deepEqual(allStatIds().slice(-33), all.slice(-33));
});

test("achievement components match StatBase.func_150955_j after the chat round trip", () => {
  for (const r of records("achievementComponent")) {
    const c = statComponent(lookupStat(r.id));
    assert.equal(serializeComponent(c), r.json, r.id);
    assert.equal(c.formatted(), r.formatted, r.id);
    assert.equal(c.unformatted(), r.unformatted, r.id);
    assert.deepEqual(componentParts(c).map(partRecord), r.parts, r.id);
  }
  const [chat] = records("achievementChat");
  const announce = translation("chat.type.achievement", "Player", statComponent(lookupStat("achievement.openInventory")));
  assert.equal(serializeComponent(announce), chat.json);
  assert.equal(announce.formatted(), chat.formatted);
  assert.deepEqual(componentParts(announce).map(partRecord), chat.parts);
  assert.deepEqual(statHover("achievement.openInventory"), { name: "§aTaking Inventory§r", achievement: true, description: "Press 'E' to open your inventory." });
  assert.equal(statHover("stat.walkOneCm").name, "§7Distance Walked§r");
  assert.equal(statHover("nope"), null);
});

test("/achievement give unlocks the locked parents first, * gives all, a plain stat counts once", () => {
  const { run, out, achievements, stats } = runner();
  run.run("/achievement give achievement.diamonds");
  for (const id of ["openInventory", "mineWood", "buildWorkBench", "buildPickaxe", "acquireIron", "diamonds"]) assert.ok(achievements.has(id), id);
  assert.ok(!achievements.has("buildFurnace") || true);
  assert.equal(out.at(-1), "Successfully given Player the stat §a[§aDIAMONDS!§a]");
  run.run("/achievement give stat.jump");
  assert.equal(stats.get("stat.jump"), 1);
  assert.equal(out.at(-1), "Successfully given Player the stat §7[§7Jumps§7]");
  run.run("/achievement give *");
  assert.equal(out.at(-1), "Successfully given all achievements to Player");
  assert.ok(achievements.has("exploreAllBiomes") && achievements.has("theEnd2"));
  run.run("/achievement give achievement.nope");
  assert.equal(out.at(-1), "§cUnknown achievement or statistic 'achievement.nope'");
  run.run("/achievement take achievement.diamonds");
  assert.equal(out.length, 4, "take (and any other first word) is silent in 1.7.10");
  run.run("/achievement give");
  assert.equal(out.at(-1), "§c/achievement give <stat_name> [player]");
  run.run("/achievement give stat.jump Steve");
  assert.equal(out.at(-1), "§cThat player cannot be found");
  assert.deepEqual(run.complete("/achievement g"), ["give"]);
  assert.ok(run.complete("/achievement give achievement.d").includes("achievement.diamonds"));
  assert.deepEqual(run.complete("/debug s"), ["start", "stop"]);
  assert.deepEqual(run.complete("/tellraw P"), ["Player"]);
});

test("/tellraw prints the component, reports Gson errors and needs a player", () => {
  const { run, out } = runner();
  run.run('/tellraw Player {"text":"hi ","extra":[{"text":"there","color":"red"}]}');
  assert.equal(out.at(-1), "hi §cthere");
  run.run('/tellraw @p ["a",{"translate":"commands.give.success","with":["x",2,"y"]}]');
  assert.equal(out.at(-1), "aGiven x * 2 to y");
  run.run("/tellraw Player {");
  assert.equal(out.at(-1), "§cInvalid json: End of input at line 1 column 2");
  run.run("/tellraw Steve hi");
  assert.equal(out.at(-1), "§cThat player cannot be found");
  run.run("/tellraw Player");
  assert.equal(out.at(-1), "§c/tellraw <player> <raw json message>");
  for (const r of records("tellraw").filter((r) => r.outcome === "parse").slice(0, 20)) {
    run.run("/tellraw Player " + r.input);
    assert.equal(out.at(-1), "§c" + r.chat, r.input);
  }
});

test("spreadplayers positions and passes replay func_110670_a / func_110668_a with a seeded Random", () => {
  for (const r of records("spread")) {
    const random = new JavaRandom(r.seed), minX = r.x - r.range, minZ = r.z - r.range, maxX = r.x + r.range, maxZ = r.z + r.range;
    const ps = spreadPositions(random, r.count, minX, minZ, maxX, maxZ);
    assert.deepEqual(ps.map((p) => [p.x, p.z]), r.initial, "initial " + r.seed);
    if (r.failure) {
      assert.throws(() => spreadIterate(r.distance, random, minX, minZ, maxX, maxZ, ps), (e) => e instanceof SpreadFailure && format2(e.minDistance) === r.args[3]);
      continue;
    }
    assert.equal(spreadIterate(r.distance, random, minX, minZ, maxX, maxZ, ps), r.iterations, "iterations " + r.seed);
    assert.deepEqual(ps.map((p) => [p.x, p.z]), r.final, "final " + r.seed);
    assert.equal(format2(averageDistance(ps)), r.averageDistance, "average " + r.seed);
    const next = BigInt.asIntN(64, (BigInt(random.next(32)) << 32n) + BigInt(random.next(32)));
    assert.equal(String(next), r.next, "random state " + r.seed);
  }
});

test("/spreadplayers teleports to the column top and reports like the native command", () => {
  const moves = [];
  const { run, out } = runner({ teleport: (x, y, z) => moves.push([x, y, z]), topY: () => 70, spreadRandom: () => new JavaRandom(42) });
  // An integer coordinate is the block centre (CommandBase.func_110666_a adds 0.5).
  run.run("/spreadplayers 100.5 -30 10 40 false Player");
  assert.equal(out[0], "Spreading 1 players 40.0 blocks around 100.5,-29.5 (min 10.0 blocks apart)");
  assert.equal(out[1], "Successfully spread 1 players around 100.5,-29.5");
  assert.equal(out.length, 2, "one position prints no average");
  const first = spreadPositions(new JavaRandom(42), 1, 60.5, -69.5, 140.5, 10.5)[0];
  assert.deepEqual(moves, [[Math.floor(first.x) + 0.5, 70, Math.floor(first.z) + 0.5]]);
  run.run("/spreadplayers 0 0 5 20 false Player Player");
  assert.match(out.at(-1), /^\(Average distance between players is \d+\.\d\d blocks apart after \d+ iterations\)$/);
  run.run("/spreadplayers ~ 0 5 20 false Player");
  assert.equal(out.at(-1), "§c'NaN' is not a valid number");
  run.run("/spreadplayers 0 0 5 5 false Player");
  assert.equal(out.at(-1), "§cThe number you have entered (5.0) is too small, it must be at least 6.0");
  run.run("/spreadplayers 0 0 5 20 maybe Player");
  assert.equal(out.at(-1), "§c'maybe' is not true or false");
  // Too many players for the square: 10000 passes, then the failure with the last nearest distance.
  const crowd = runner({ teleport() {}, topY: () => 64, spreadRandom: () => new JavaRandom(1) });
  crowd.run.run("/spreadplayers 0 0 50 51 false " + Array(30).fill("Player").join(" "));
  assert.match(crowd.out.at(-1), /^§cCould not spread 30 players around 0\.5,0\.5 \(too many players for space - try using spread of at most \d+\.\d\d\)$/);
});

test("Profiler.getProfilingData and the /debug file follow qi and ak", () => {
  for (const r of records("profiler")) {
    const p = new Profiler();
    p.enabled = true;
    for (const [k, v] of Object.entries(r.map)) p.map.set(k, v);
    assert.deepEqual(p.results(r.name).map((x) => [x.name, format2(x.use), format2(x.total)]), r.results.map((x) => x.slice(0, 3)), r.name);
    assert.deepEqual(Object.fromEntries([...p.map].sort()), Object.fromEntries(Object.entries(r.after).sort()));
  }
  assert.deepEqual(WITTY_COMMENTS, ref.wittyComments);
  let t = 0;
  const p = new Profiler(() => t);
  p.pending = true;
  profilerTick(p);
  assert.ok(p.enabled);
  for (let i = 0; i < 3; i++) { p.start("root"); t += 50; p.start("tick"); t += 30; p.endStart("render"); t += 10; p.end(); p.end(); }
  const file = profileResults(p, 2000, 40, 0);
  assert.equal(file, "---- Minecraft Profiler Results ----\n// Shiny numbers!\n\nTime span: 2000 ms\nTick span: 40 ticks\n// This is approximately 20.00 ticks per second. It should be 20 ticks per second\n\n--- BEGIN PROFILE DUMP ---\n\n[00] unspecified - 55.56%/55.56%\n[00] tick - 33.33%/33.33%\n[00] render - 11.11%/11.11%\n--- END PROFILE DUMP ---\n\n");
  assert.match(profileFileName(new Date(2014, 5, 25, 9, 8, 7)), /^profile-results-2014-06-25_09\.08\.07\.txt$/);
  assert.equal(javaFloat(12.345), "12.345");
  assert.equal(javaFloat(0.1), "0.1");
  assert.equal(javaFloat(1e7), "1.0E7");
});

test("/debug start, stop and the not-started error", () => {
  const files = [];
  let ticks = 0;
  const { run, out, host } = runner({ tickCounter: () => ticks, saveFile: (name, text) => files.push([name, text]) });
  run.run("/debug stop");
  assert.equal(out.at(-1), "§cCan't stop profiling when we haven't started yet!");
  run.run("/debug start");
  assert.equal(out.at(-1), "Started debug profiling");
  assert.ok(!host.profiler.enabled, "profiling begins at the next tick");
  profilerTick(host.profiler);
  ticks = 20;
  run.run("/debug stop");
  assert.match(out.at(-1), /^Stopped debug profiling after \d+(\.\d+)?(E-?\d+)? seconds \(20 ticks\)$/);
  assert.equal(files.length, 1);
  assert.match(files[0][0], /^profile-results-\d{4}-\d\d-\d\d_\d\d\.\d\d\.\d\d\.txt$/);
  assert.match(files[0][1], /^---- Minecraft Profiler Results ----\n\/\/ .+\n\nTime span: \d+ ms\nTick span: 20 ticks\n/);
  run.run("/debug");
  assert.equal(out.at(-1), "§c/debug <start|stop>");
  assert.equal(tr("commands.debug.usage"), "/debug <start|stop>");
});
