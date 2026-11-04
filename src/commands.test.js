import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createCommandRunner, registeredCommands, canUse, cheatsAllowed, format, tr, parseInt32, parseIntBounded, parseIntMin, parseDouble,
  parseBoolean, parseCoordinate, startsWithIgnoreCase, matchLast, chatLine, CommandException,
} from "./commands.js";
import { COMMAND_LIST, LANG } from "./command-data.js";
import { createCommandHost } from "./command-host.js";
import { LanSession, LAN_NOTICE } from "./lan.js";
import { chat } from "./chat-ui.js";
import { World } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { Survival } from "./survival.js";
import { Weather } from "./weather.js";
import { Experience } from "./experience.js";

const ref = JSON.parse(await readFile(new URL("../public/research/commands-reference.json", import.meta.url)));

test("the command table is the 1.7.10 client's ServerCommandManager", () => {
  assert.deepEqual(COMMAND_LIST, ref.commands.map(({ class: _c, ...c }) => c));
  assert.equal(ref.commands.length, 48);
  const always = ref.commands.filter((c) => c.group === "always").map((c) => c.name);
  for (const n of ["help", "gamemode", "give", "time", "weather", "tp", "xp", "kill", "seed", "tell", "me", "say", "setblock", "summon", "effect", "enchant"]) assert.ok(always.includes(n), n);
  const byName = Object.fromEntries(ref.commands.map((c) => [c.name, c]));
  assert.deepEqual([byName.time.permission, byName.help.permission, byName.give.permission, byName.seed.permission], [2, 0, 2, 2]);
  assert.deepEqual(byName.tell.aliases, ["w", "msg"]);
});

test("every usage key and the command texts are in the reference strings", () => {
  for (const c of registeredCommands()) assert.ok(LANG[c.usage], c.usage);
  for (const k of ["commands.generic.permission", "commands.generic.notFound", "commands.generic.usage", "commands.generic.exception", "commands.give.success", "commands.time.set"]) assert.ok(ref.strings[k] === LANG[k], k);
});

test("number parsing replays the native CommandBase results", () => {
  const run = (fn, input) => {
    const m = /^(\w+)(?:\((.*)\))?$/.exec(fn), args = m[2] ? m[2].split(",").map((s) => s.split("=").at(-1)) : [];
    if (m[1] === "parseInt") return parseInt32(input);
    if (m[1] === "parseIntBounded") return parseIntBounded(input, +args[0], +args[1]);
    if (m[1] === "parseIntMin") return parseIntMin(input, +args[0]);
    if (m[1] === "parseDouble") return parseDouble(input);
    if (m[1] === "parseBoolean") return parseBoolean(input);
    if (m[1] === "relative") return parseCoordinate(+args[0], input, ...(args.length > 1 ? [+args[1], +args[2]] : []));
    return undefined;
  };
  let checked = 0;
  for (const p of ref.parse) {
    if (p.fn === "doesStringStartWith") {
      const [w, o] = p.input.split("|");
      assert.equal(startsWithIgnoreCase(w, o), p.result);
      checked++;
      continue;
    }
    if (p.fn === "getListOfStringsMatchingLastWord") {
      const [w, rest] = p.input.split("|");
      assert.deepEqual(matchLast([w], rest.split(",")), p.result);
      checked++;
      continue;
    }
    if (p.error) {
      let e;
      try { run(p.fn, p.input); } catch (x) { e = x; }
      assert.ok(e instanceof CommandException, `${p.fn} ${p.input} should fail`);
      assert.equal(e.key, p.error, `${p.fn} ${p.input}`);
      assert.deepEqual(e.args.map(String), p.args, `${p.fn} ${p.input}`);
    } else {
      const v = run(p.fn, p.input);
      if (/^(relative|parseDouble)/.test(p.fn)) assert.equal(v, Number(p.result), `${p.fn} ${p.input}`);
      else assert.equal(String(v), p.result, `${p.fn} ${p.input}`);
    }
    checked++;
  }
  assert.equal(checked, ref.parse.length);
});

test("format follows String.format for the lang patterns", () => {
  assert.equal(format("Set the time to %d", [13000]), "Set the time to 13000");
  assert.equal(format("%2$s then %1$s", ["a", "b"]), "b then a");
  assert.equal(tr("commands.time.set", 5), "Set the time to 5");
  assert.equal(tr("no.such.key"), "no.such.key");
  assert.equal(chatLine("Steve", "hi"), "<Steve> hi");
});

// ---- effects on real game objects ----
function game({ mode = "survival", allowCommands } = {}) {
  const world = new World("commands", "meadow", 1), survival = new Survival({}, mode), weather = new Weather(), experience = new Experience();
  const active = { mode, ...(allowCommands === undefined ? {} : { allowCommands }), seed: "commands" };
  const pos = { x: 10.5, y: 40, z: 10.5 };
  const log = [];
  const state = { time: null, mode: null, teleport: null, changed: 0 }, lan = new LanSession();
  const env = {
    active: () => active, world: () => world, weather: () => weather, mobs: () => null, survival: () => survival, experience: () => experience,
    position: () => ({ ...pos }), seed: () => active.seed, stackName: (s) => "Item" + s.id, dropStack: (s) => log.push(["drop", s.id, s.count]),
    refreshInventory() {}, changed: () => state.changed++, setTime: (t) => (state.time = t),
    teleport: (x, y, z) => (state.teleport = [x, y, z]), setDifficulty: (d) => (state.difficulty = d),
    setMode: (m) => { survival.mode = m; survival.inventory.creative = survival.creative; state.mode = m; },
    lan: () => lan.open, shareToLan: (m, c) => lan.share(m, c),
    updateBlock() {}, destroyBlock() {},
  };
  const host = createCommandHost(env);
  const runner = createCommandRunner(host);
  const out = () => chat.lines.map((l) => l.text).reverse();
  return { world, survival, weather, experience, active, host, runner, state, lan, run: (t) => { chat.clear(); runner.run(t); return out(); } };
}

test("cheats off refuses permission-level commands in red and keeps help, me, tell and seed", () => {
  const g = game({ allowCommands: false });
  assert.deepEqual(g.run("/give @p minecraft:diamond 5"), ["§cYou do not have permission to use this command"]);
  assert.equal(g.survival.count(303), 0);
  assert.deepEqual(g.run("/time set night"), ["§cYou do not have permission to use this command"]);
  assert.equal(g.run("/me waves")[0], "* Player waves");
  assert.match(g.run("/seed")[0], /^Seed: /);
  assert.equal(g.run("/help")[0].includes("Showing help page 1 of 1"), true);
  assert.deepEqual(g.run("/nonsense"), ["§cUnknown command. Try /help for a list of commands"]);
});

test("old saves read the flag as WorldInfo does: creative on, survival off", () => {
  assert.equal(cheatsAllowed({ mode: "creative" }), true);
  assert.equal(cheatsAllowed({ mode: "survival" }), false);
  assert.equal(cheatsAllowed({ mode: "survival", allowCommands: true }), true);
  assert.equal(cheatsAllowed({ mode: "creative", allowCommands: false }), false);
  assert.ok(canUse(registeredCommands().find((c) => c.name === "give"), true));
  assert.ok(!canUse(registeredCommands().find((c) => c.name === "give"), false));
});

test("time, weather and toggledownfall use the native semantics", () => {
  const g = game({ allowCommands: true });
  assert.deepEqual(g.run("/time set night"), ["Set the time to 13000"]);
  assert.equal(g.survival.time, 13000);
  assert.equal(g.state.time, 13000);
  g.run("/time set day");
  assert.equal(g.survival.time, 1000);
  assert.deepEqual(g.run("/time add 500"), ["Added 500 to the time"]);
  assert.equal(g.survival.time, 1500);
  assert.equal(g.run("/time")[0].startsWith("§cUsage: "), true);
  g.run("/weather thunder 100");
  assert.deepEqual([g.weather.raining, g.weather.thundering, g.weather.rainTime, g.weather.thunderTime], [true, true, 2000, 2000]);
  g.run("/weather rain 50");
  assert.deepEqual([g.weather.raining, g.weather.thundering, g.weather.rainTime], [true, false, 1000]);
  g.run("/weather clear");
  assert.deepEqual([g.weather.raining, g.weather.thundering, g.weather.rainTime, g.weather.thunderTime], [false, false, 0, 0]);
  assert.deepEqual(g.run("/toggledownfall"), ["Toggled downfall"]);
  assert.equal(g.weather.raining, true);
  assert.equal(g.weather.thundering, false);
});

test("give, clear, xp, effect and enchant change the real inventory, experience and effects", () => {
  const g = game({ allowCommands: true });
  assert.deepEqual(g.run("/give @p minecraft:diamond 5"), ["Given [Itemundefined] * 5 to Player"].map((s) => s.replace("undefined", String(g.survival.inventory.main.find(Boolean).id))));
  assert.equal(g.survival.count(g.survival.inventory.main.find(Boolean).id), 5);
  assert.match(g.run("/give @p minecraft:nonsense")[0], /^§c/);
  assert.match(g.run("/give @p minecraft:diamond 65")[0], /^§c/);
  assert.match(g.run("/clear @p minecraft:diamond")[0], /^Cleared the inventory of Player, removing 5 items$/);
  assert.equal(g.run("/clear @p minecraft:diamond")[0].startsWith("§c"), true);
  g.run("/xp 5L");
  assert.equal(g.experience.level, 5);
  g.run("/xp -2L");
  assert.equal(g.experience.level, 3);
  g.run("/xp 100");
  assert.ok(g.experience.total >= 100);
  assert.match(g.run("/effect @p 1 30 1")[0], /^Given Speed \(ID 1\) \* 1 to Player for 30 seconds$/);
  assert.equal(g.survival.effects.get(1).amplifier, 1);
  assert.equal(g.survival.effects.get(1).duration, 600);
  assert.match(g.run("/effect @p clear")[0], /^Took all effects from Player$/);
  assert.equal(g.survival.effects.active.size, 0);
  assert.match(g.run("/enchant @p 16")[0], /^§c/); // nothing in hand
  // /enchant works on the held stack: a diamond sword takes Sharpness; Sharpness and Smite do not combine.
  assert.match(g.run("/give @p minecraft:diamond_sword")[0], /^Given/);
  const sword = g.survival.inventory.main.find((s) => s && s.count === 1);
  g.survival.inventory.current = g.survival.inventory.main.indexOf(sword);
  assert.deepEqual(g.run("/enchant @p 16 3"), ["Enchanting succeeded"]);
  assert.deepEqual(sword.enchantments, [{ id: 16, lvl: 3 }]);
  assert.match(g.run("/enchant @p 17")[0], /^§c/);
  assert.match(g.run("/enchant @p 16 9")[0], /^§c/);
});

test("gamemode, teleport with ~, spawnpoint, difficulty and kill act on the player", () => {
  const g = game({ mode: "creative", allowCommands: true });
  assert.deepEqual(g.run("/gamemode 0"), ["Your game mode has been updated", "Set own game mode to Survival Mode"]);
  assert.equal(g.survival.mode, "survival");
  assert.equal(g.survival.inventory.creative, false);
  g.run("/gamemode c");
  assert.equal(g.survival.mode, "creative");
  assert.deepEqual(g.run("/gamemode 2"), ["Your game mode has been updated", "Set own game mode to Adventure Mode"]);
  assert.equal(g.survival.mode, "adventure");
  assert.equal(g.survival.inventory.creative, false);
  g.run("/gamemode c");
  assert.match(g.run("/gamemode 9")[0], /^§c/);
  g.run("/tp ~ ~10 ~");
  assert.deepEqual(g.state.teleport, [10.5, 50, 10.5]);
  g.run("/tp 100 64 -20");
  assert.deepEqual(g.state.teleport, [100.5, 64.5, -19.5]); // a bare number is the block centre, y included
  assert.match(g.run("/tp ~ ~ abc")[0], /^§c'abc' is not a valid number$/);
  assert.match(g.run("/tp Nobody ~ ~ ~")[0], /^§cThat player cannot be found$/);
  g.run("/spawnpoint");
  assert.deepEqual(g.active.playerSpawn, [10, 40, 10]);
  g.run("/difficulty hard");
  assert.equal(g.state.difficulty, 3);
  g.run("/gamerule keepInventory true");
  assert.equal(g.active.gameRules.keepInventory, "true");
  assert.equal(g.run("/gamerule keepInventory")[0], "keepInventory = true");
  g.run("/kill");
  assert.equal(g.survival.health, 0);
});

test("setblock replaces, keeps and refuses outside the world; testforblock compares", () => {
  const g = game({ mode: "creative", allowCommands: true });
  assert.deepEqual(g.run("/setblock 5 60 5 minecraft:stone"), ["Block placed"]);
  const stone = fromOriginal(1, 0).id, dirt = fromOriginal(3, 0).id;
  assert.equal(g.world.get(5, 60, 5), stone);
  assert.match(g.run("/setblock 5 60 5 minecraft:stone")[0], /^§cThe block couldn't be placed$/);
  assert.match(g.run("/setblock 5 60 5 minecraft:dirt 0 keep")[0], /^§c/);
  assert.equal(g.world.get(5, 60, 5), stone);
  assert.deepEqual(g.run("/setblock 5 60 5 minecraft:dirt 0 replace"), ["Block placed"]);
  assert.equal(g.world.get(5, 60, 5), dirt);
  assert.match(g.run("/setblock 5 300 5 minecraft:stone")[0], /^§c/);
  assert.match(g.run("/testforblock 5 60 5 minecraft:dirt")[0], /^Successfully found the block at 5,60,5/);
});

test("plain chat echoes as <Player> message and a bad usage is red", () => {
  const g = game({ allowCommands: true });
  assert.equal(chatLine("Player", "hello"), "<Player> hello");
  assert.deepEqual(g.run("/give"), ["§cUsage: /give <player> <item> [amount] [data] [dataTag]"]);
});

test("/publish shares to LAN as survival without cheats; the LAN screen's Allow Cheats lets a cheatless world use commands", () => {
  const g = game({ mode: "survival", allowCommands: false });
  assert.match(g.run("/gamemode 1")[0], /^§cYou do not have permission to use this command$/);
  assert.equal(g.lan.share("creative", true), "25564");
  assert.equal(g.host.cheats, true);
  assert.deepEqual(g.run("/publish"), ["Local game hosted on port 25564", "§7" + LAN_NOTICE]);
  assert.deepEqual(g.lan.open, { gameType: "survival", cheats: false, port: 25564 }, "shareToLAN overwrites both settings");
  assert.equal(g.host.cheats, false);
  assert.equal(g.lan.paused(true), false, "a public server never pauses");
  g.lan.close();
  assert.equal(g.lan.paused(true), true);
});


test("summon failures and tag errors are plain feedback; testfor finds the local player", () => {
  const g = game({ allowCommands: true });
  assert.deepEqual(g.run("/summon Pig ~ 300 ~ {bad"), [tr("commands.summon.outOfWorld")]);
  assert.deepEqual(g.run("/summon Dragon"), [tr("commands.summon.failed")]);
  assert.ok(!g.run("/give @p diamond 1 0 {bad")[0].startsWith("§c"));
  assert.deepEqual(g.run("/testfor @p"), [tr("commands.testfor.success", "Player")]);
});
