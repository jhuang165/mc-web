// Batch 59 servercommands: the world commands of the dedicated server (/time, /weather, /toggledownfall, /difficulty, /gamerule, /defaultgamemode,
// /list, /tellraw), per-player /spawnpoint and /enchant, and the achievement triggers the server sees. The native handlers are in commands.js; this file
// is the state they act on (a DedicatedSimulation), passed to the runner as host properties by ServerSocial.command.
// Bytecode-read (javap, 1.7.10 jar, see .shared-memory/notes/servercommands-b59-track.md):
//  * CommandTime (bz): set day 1000, night 13000, add; CommandListPlayers (ay): commands.players.list (online count, max), then the names line
//    (ServerConfigurationManager.func_152609_b(uuids)): "name, name", or "name (uuid), ..." when the first argument is "uuids".
//  * NetHandlerPlayServer.processClientStatus (nh.a(is)): the OPEN_INVENTORY_ACHIEVEMENT case triggers pc.f (openInventory) on the server player.
//  * EntityItem.onCollideWithPlayer (xk.b_): after a successful pickup, logs (ajn.r, ajn.s) trigger mineWood, leather killCow, a diamond diamonds
//    (and diamondsToYou when another player threw it), a blaze rod blazeRod.
//  * SlotCrafting (aax) and SlotFurnace (aak) trigger the crafting and smelting achievements; the crafting windows are client-side here, so they stay
//    client triggers. EntityPlayerMP (mw) holds exploreAllBiomes (L), theEnd (C), theEnd2 (D) and portal (y) triggers, which need dimensions and biomes
//    this server does not simulate.
import { DEFAULT_RULES, ruleOn } from "./game-rules.js";
import { setGameRuleSource } from "./game-rules.js";
import { canApply, canApplyTogether, addEnchantment, ENCHANTMENTS_BY_ID } from "./enchantments.js";
import { liveStackToNative } from "./anvil-container.js";
import { ENCHANTMENT_NAMES } from "./command-data.js";

export const SERVER_WORLD_COMMANDS = ["time", "weather", "toggledownfall", "difficulty", "gamerule", "defaultgamemode", "list", "tellraw", "spawnpoint", "enchant"];
export const MAX_PLAYERS = 20; // server.properties max-players default of the dedicated server

const enchantName = new Map(ENCHANTMENT_NAMES.map(([id, name]) => [id, name]));

/** Make GameRules readers (fire, mob griefing ...) in this process follow the simulation's /gamerule values (server.js only: the source is process-wide). */
export function installServerRules(simulation) { setGameRuleSource((name) => ruleOn(simulation, name)); }

/**
 * The inventory a command sees for one player. The server holds the hotbar the client sends with each input; when the player's record carries
 * the full inventory (`survival.inventory.main` with 36 slots, as inventory authority on the server fills it), that is what is returned.
 * `serverInventory(p).lists` are the slot arrays /clear walks.
 */
export function serverInventory(p) {
  const inv = p.survival.inventory;
  return { inventory: inv, lists: [inv.main, inv.armor].filter(Array.isArray) };
}

/** Host properties for the world commands, over `simulation`. */
export function worldHost(simulation) {
  const sim = simulation, w = () => sim.weather;
  return {
    get rules() { return Object.assign({ ...DEFAULT_RULES }, sim.gameRules); },
    setGameRule(name, value) { sim.gameRules = { ...sim.gameRules, [name]: String(value) }; }, // GameRules.setOrCreateGameRule keeps the text
    setTime(n) { sim.time = n; for (const p of sim.players.values()) p.survival.time = n; },
    addTime(n) { sim.time += n; for (const p of sim.players.values()) p.survival.time = sim.time; },
    // CommandToggleDownfall: WorldInfo.setRaining(!isRaining()), nothing else.
    toggleDownfall() { w().raining = !w().raining; },
    // CommandWeather (javap of cb): clear zeroes both timers and flags; rain sets the rain timer and raining; thunder sets both timers and flags.
    setWeather(kind, ticks) {
      const x = w();
      if (kind === "clear") { x.rainTime = 0; x.thunderTime = 0; x.raining = false; x.thundering = false; }
      else if (kind === "rain") { x.rainTime = ticks; x.raining = true; x.thundering = false; }
      else { x.rainTime = ticks; x.thunderTime = ticks; x.raining = true; x.thundering = true; }
    },
    // 1.7.10 sends no difficulty change to a connected client (the S41 packet is 1.8), so the value only reaches a player at join.
    setDifficulty(d) { sim.difficulty = d; },
    // MinecraftServer.setGameType without force-gamemode: only the mode a new player starts in.
    setDefaultGameMode(mode) { sim.newPlayerMode = mode; if (mode !== "adventure") sim.gameMode = mode; },
    maxPlayers: MAX_PLAYERS,
  };
}

/** The per-player part of /spawnpoint and /enchant over the record `p` of `simulation`; `op` sends a playerOp to that player. */
export function playerHost(simulation, p, op) {
  return {
    setSpawnpoint(x, y, z) { p.spawnpoint = [x, y, z]; p.spawnForced = true; /* b66 mpsleep: /spawnpoint is forced */ },
    // CommandEnchant: the held stack; Enchantment.canApply, then canApplyTogether against each enchantment already on it. The server knows the held id
    // and damage; the client holds the real stack (its enchantments), applies it and drops a conflict it alone can see.
    enchant(id, level) {
      const held = p.survival.inventory.held;
      if (!held) return "noItem";
      const e = ENCHANTMENTS_BY_ID[id], native = liveStackToNative(held);
      if (!e || !native || !canApply(e, native)) return "cantEnchant";
      for (const have of held.enchantments ?? []) if (have.id !== id && !canApplyTogether(e, have.id)) return { conflict: enchantName.get(have.id) };
      addEnchantment(held, e, level);
      op("enchant", id, level);
      return true;
    },
  };
}
