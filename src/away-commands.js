// Command blocks and command minecarts in the away run (batch 33, public/research/dimensions.md "Batch 33").
//
// Native rules (bytecode-read with javap on the 1.7.10 jar, not executed):
//   - BlockCommandBlock.updateTick (akb.a) calls CommandBlockLogic.func_145755_a (agp.a) with no player test: it is a scheduled block tick, so a powered
//     command block runs for as long as the player is away, past the 1200-tick entity gate too. SuccessCount (agp.b) = CommandHandler.a's return.
//   - CommandHandler.a (z.a): when the command's username argument (ICommand.isUsernameIndex) is a selector token, the handler runs the command once per
//     player PlayerSelector.matchPlayers returns and counts the runs; no match means zero runs, no message, SuccessCount 0 and LastOutput untouched.
//     Username indices: give, clear, effect, enchant, spawnpoint, testfor, tell, tp, tellraw 0; gamemode, xp, playsound 1; achievement 2.
//   - PlayerSelector.c (ad.c) hands the sender's world to ServerConfigurationManager.findPlayers (oi.a) only when rm, r, x, y or z is given
//     (iload 15 is set by exactly those keys); without them the search covers players in every dimension. The player in the Nether or End is
//     therefore found by a plain @p or @a and is not found by @p[r=...] or @p[x=...], which compare mw.o (the player's world) with the sender's.
// What this host does with that: the world-only commands (setblock, summon, time, weather, gamerule, setworldspawn, say, me, testforblock, seed, help,
// defaultgamemode) run on the run's own world and entity systems through the same createCommandHost the live game uses. A selector the native
// code would resolve to no one (world-restricted) gives the silent zero. A command that would act on the player (the player is in another dimension
// with state the worker does not have: give, tp, xp, gamemode, effect, clear, kill, enchant, spawnpoint, difficulty, tellraw/tell to the player...)
// is SKIPPED: the block's SuccessCount and LastOutput stay as they were and the skip is counted in the run's stats. Skips are not native behaviour.
import { createCommandHost, DEFAULT_RULES } from "./command-host.js";
import { createCommandRunner, CommandException } from "./commands.js";
import { commandBlockSender } from "./command-block.js";
import { cartCommandPosition } from "./command-cart.js";
import { inSpawnArea } from "./away-plan.js";
import { selectLocalPlayer as selectLocal } from "./command-selector.js";

const USERNAME_INDEX = { give: 0, clear: 0, effect: 0, enchant: 0, spawnpoint: 0, testfor: 0, tell: 0, w: 0, msg: 0, tp: 0, tellraw: 0, gamemode: 1, xp: 1, playsound: 1, achievement: 2 };
// Commands that need the player's own state or the scoreboard/achievement stores, which a run does not have.
const NEEDS_PLAYER = new Set(["achievement", "scoreboard", "spreadplayers", "debug", "publish"]);
const SELECTOR = /^@([parf])(?:\[([\w=,!-]*)\])?$/;
const CHAT_CAP = 100;

export function awayCommands({ plan, world, rt, weather, tiles, entities, wanted, breakBlock }) {
  const spawn = plan.spawn ?? [0, 0, 0];
  const active = { allowCommands: true, gameRules: { ...DEFAULT_RULES, ...(plan.gameRules ?? {}) }, worldSpawn: [...spawn], defaultGameMode: plan.defaultGameMode };
  const initial = JSON.stringify(active), initialWeather = JSON.stringify(weather.save());
  const sv = { time: 0, mode: "survival", ...tiles };
  const state = { ran: 0, timeShift: 0, lastTime: 0 };
  const stats = { run: 0, silent: 0, skipped: 0, reasons: {} };
  const chat = [];
  const skip = (reason) => { host.skipped ??= reason; throw new CommandException("commands.generic.exception", [reason], "unsupported"); };

  // The world the commands see: a write also tells the redstone runtime what changed, as the dispenser host does.
  const seen = new Proxy(world, { get(t, k) {
    if (k === "set") return (x, y, z, b, track, meta = 0) => { const old = t.get(x, y, z), ok = t.set(x, y, z, b, track, meta); if (ok && old !== t.get(x, y, z)) rt.fluidChanges([[x, y, z, old, t.get(x, y, z)]]); return ok; };
    const v = t[k];
    return typeof v === "function" ? v.bind(t) : v;
  } });
  const now = () => (plan.time ?? 0) - (plan.ticks - state.ran) + state.timeShift; // the saved clock is the end of the trip
  const env = {
    active: () => active, world: () => seen, weather: () => weather, survival: () => sv,
    mobs: () => entities()?.mobs ?? null, minecarts: () => entities()?.minecarts, spawners: () => null, rockets: () => entities()?.rockets,
    entityHosts: () => { const e = entities(); return e && { items: e.items, xpOrbs: e.xp, primed: e.primed, falling: e.falling, boats: e.boats, projectiles: e.projectiles, arrows: e.arrows, mobs: e.mobs, hanging: e.hanging, dimension: 0 }; },
    position: () => ({ x: spawn[0], y: spawn[1], z: spawn[2] }), seed: () => plan.seed,
    commandTile: (x, y, z) => rt.commandBlocks.tile(x, y, z),
    stackName: () => "", changed() {}, refreshInventory() {},
    setTime: (t) => { const d = t - state.lastTime; state.lastTime = t; state.timeShift += d; entities()?.shiftTime(d); },
    updateBlock() {}, destroyBlock: (x, y, z) => breakBlock(x, y, z),
  };
  const host = createCommandHost(env);
  Object.assign(host, {
    playerElsewhere: true, skipped: null, awaySkip: () => skip("a selector filter that needs the scoreboard"),
    print: (text) => { if (chat.length < CHAT_CAP) chat.push(String(text?.text ?? text)); },
    printPlayer: (text) => { if (chat.length < CHAT_CAP) chat.push(typeof text === "string" ? text : JSON.stringify(text)); },
    playerMode: () => plan.player?.mode ?? 0, playerLevel: () => plan.player?.level ?? 0,
    playerPosition: () => ({ x: spawn[0], y: spawn[1], z: spawn[2] }),
    inWorld(x, y, z) {
      const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
      if (y < 0 || y >= 256 || !inSpawnArea(spawn, cx, cz)) return false; // an unloaded chunk: setblock/summon report out of world
      if (!wanted(cx, cz)) { host.skipped ??= "a spawn-area column the run did not load"; return false; }
      return true;
    },
  });
  for (const name of ["give", "clear", "kill", "setGameMode", "clearEffects", "removeEffect", "addEffect", "enchant", "addLevels", "addExperience", "teleport", "setSpawnpoint", "setDifficulty", "shareToLan", "saveFile"]) {
    host[name] = () => skip(`${name} acts on the player or needs state the run does not have`);
  }

  function execute(tile, position) {
    const before = { successCount: tile.successCount, lastOutput: tile.lastOutput };
    host.skipped = null;
    state.lastTime = sv.time = now();
    const parts = String(tile.command ?? "").trim().replace(/^\//, "").split(" "), word = parts.shift() ?? "";
    const reason = (why) => { stats.skipped++; stats.reasons[why] = (stats.reasons[why] ?? 0) + 1; tile.successCount = before.successCount; tile.lastOutput = before.lastOutput; return before.successCount; };
    if (NEEDS_PLAYER.has(word)) return reason(`/${word} needs the player or scoreboard`);
    const at = USERNAME_INDEX[word];
    if (at !== undefined && SELECTOR.test(parts[at] ?? "")) {
      let picked;
      try { picked = host.selectPlayerForAway(parts[at]); } catch (e) { if (host.skipped) return reason(host.skipped); picked = undefined; }
      if (picked === null) { tile.successCount = 0; stats.silent++; return 0; } // z.a: zero matches, zero runs, no message
      if (picked !== undefined && word !== "testfor") return reason(`/${word} would act on the player in another dimension`);
    }
    const sender = commandBlockSender(host, tile, position);
    const ok = createCommandRunner(sender).run(tile.command);
    if (host.skipped) return reason(host.skipped);
    tile.successCount = ok ? 1 : 0;
    stats.run++;
    return tile.successCount;
  }
  // The selector test the runner uses, on the run's host (null = nobody; a name = the player).
  host.selectPlayerForAway = (text) => selectLocal(text, host);

  return {
    host, stats, chat, state,
    execute,
    // The block: BlockCommandBlock.updateTick, then the comparator update.
    installBlock(live) {
      const b = live.behaviours[137];
      if (!b) return;
      live.behaviours[137] = { ...b, updateTick(w, x, y, z) { execute(rt.commandBlocks.tile(x, y, z), { x, y, z }); w.updateNeighbourForOutputSignal(x, y, z, 137); } };
    },
    cartRun: (cart) => { if (cart.command?.command) execute(cart.command, cartCommandPosition(cart)); else if (cart.command) cart.command.successCount = 0; },
    result() {
      const out = { commandBlocks: rt.commandBlocks.save(), commandStats: { ...stats, reasons: { ...stats.reasons } }, chat, timeShift: state.timeShift };
      if (JSON.stringify(weather.save()) !== initialWeather) out.weather = { ...weather.save(), rain: weather.rain, thunder: weather.thunder };
      if (JSON.stringify(active) !== initial) out.world = { gameRules: active.gameRules, worldSpawn: active.worldSpawn, ...(active.defaultGameMode !== undefined ? { defaultGameMode: active.defaultGameMode } : {}) };
      return out;
    },
  };
}
