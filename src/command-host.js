// Connects the command engine (commands.js) to the running game. main.js passes accessors for its live state (`env`), so
// everything here works on the real World, Survival, Weather and Experience objects and the tests can drive it without a browser.
import { printChat } from "./chat-ui.js";
import { CommandException, cheatsAllowed } from "./commands.js";
import { ENCHANTMENT_NAMES } from "./command-data.js";
import { itemFromOriginal } from "./region-import.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { makeStack } from "./inventory.js";
import { canApply, canApplyTogether, addEnchantment, ENCHANTMENTS_BY_ID } from "./enchantments.js";
import { liveStackToNative } from "./anvil-container.js";
import { PLAYER_NAME } from "./death-messages.js";

const unsupported = (text) => new CommandException("commands.generic.exception", [text], "unsupported");
const enchantName = new Map(ENCHANTMENT_NAMES.map(([id, name]) => [id, name]));
import { DEFAULT_RULES, ruleOn } from "./game-rules.js";
export { DEFAULT_RULES, ruleOn };

export function createCommandHost(env) {
  const survival = () => env.survival();
  return {
    name: PLAYER_NAME,
    get cheats() { return cheatsAllowed(env.active()); },
    get rules() { const a = env.active(); return (a.gameRules ??= { ...DEFAULT_RULES }); },
    print: (text) => printChat(text),
    position: () => env.position(),
    seed: () => env.seed(),
    inWorld: (x, y, z) => { const w = env.world(); return y >= 0 && y < 256 && w.inside(Math.floor(x), Math.floor(y), Math.floor(z)) && (!w.streaming || w.isLoaded(Math.floor(x), Math.floor(z))); },
    kill() { survival().damage(1000, "void"); env.changed(); },
    setGameMode(mode) {
      if (mode === "adventure") throw unsupported("Adventure mode is not available in this build");
      env.setMode(mode);
    },
    setDefaultGameMode(mode) {
      if (mode === "adventure") throw unsupported("Adventure mode is not available in this build");
      env.active().defaultGameMode = mode; // singleplayer: only the mode a new joiner gets
    },
    setGameRule(name, value) { env.active().gameRules = { ...this.rules, [name]: String(value) }; env.changed(); },
    give(original, count, damage) {
      const item = itemFromOriginal(original, damage);
      if (!item) throw unsupported("This item is not in this build");
      const stack = makeStack(item.id, count, item.damage);
      const name = env.stackName(stack);
      survival().inventory.add(stack);
      if (stack.count > 0) env.dropStack(stack); // what does not fit lands at the player's feet
      env.refreshInventory();
      return { name: "[" + name + "]" };
    },
    clear(original, damage) {
      const inv = survival().inventory;
      let want = null;
      if (original !== -1) {
        want = itemFromOriginal(original, Math.max(damage, 0));
        if (!want) return 0;
      }
      let removed = 0;
      for (const list of [inv.main, inv.armor]) {
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (!s || (want && (s.id !== want.id || (damage !== -1 && (s.damage ?? 0) !== want.damage)))) continue;
          removed += s.count;
          list[i] = null;
        }
      }
      env.refreshInventory();
      return removed;
    },
    setTime(n) { survival().time = n; env.setTime(n); env.changed(); },
    addTime(n) { survival().time += n; env.setTime(survival().time); env.changed(); },
    // CommandToggleDownfall: WorldInfo.setRaining(!isRaining()), nothing else.
    toggleDownfall() { const w = env.weather(); w.raining = !w.raining; env.changed(); },
    // CommandWeather (javap of cb): clear zeroes both timers and both flags; rain sets the rain timer, raining, not thundering;
    // thunder sets both timers and both flags.
    setWeather(kind, ticks) {
      const w = env.weather();
      if (kind === "clear") { w.rainTime = 0; w.thunderTime = 0; w.raining = false; w.thundering = false; }
      else if (kind === "rain") { w.rainTime = ticks; w.raining = true; w.thundering = false; }
      else { w.rainTime = ticks; w.thunderTime = ticks; w.raining = true; w.thundering = true; }
      env.changed();
    },
    teleport(x, y, z) { env.teleport(x, y, z); },
    setSpawnpoint(x, y, z) { env.active().playerSpawn = [x, y, z]; env.changed(); },
    setWorldSpawn(x, y, z) { env.active().worldSpawn = [x, y, z]; env.changed(); },
    setDifficulty(d) { env.setDifficulty(d); },
    clearEffects() {
      const s = survival();
      if (!s.effects.active.size) return false;
      s.effects.clear();
      env.refreshInventory();
      return true;
    },
    removeEffect(id) {
      const s = survival();
      if (!s.effects.has(id)) return false;
      s.effects.remove(id);
      env.refreshInventory();
      return true;
    },
    addEffect(id, ticks, amplifier) {
      const s = survival();
      if (id === 6) { s.health = Math.min(s.maxHealth, s.health + 4 * 2 ** amplifier); env.refreshInventory(); return; } // instant health
      if (id === 7) { s.damage(6 * 2 ** amplifier, "magic"); env.refreshInventory(); return; } // instant damage
      if (!s.effects.add({ id, duration: ticks, amplifier })) throw unsupported("This effect is not available in this build");
      env.refreshInventory();
    },
    // CommandEnchant: the held stack; Enchantment.canApply, then canApplyTogether against each enchantment already on it.
    enchant(id, level) {
      const held = survival().inventory.held;
      if (!held) return "noItem";
      const e = ENCHANTMENTS_BY_ID[id];
      const native = liveStackToNative(held); // enchantments.js reads the original item ids
      if (!e || !native || !canApply(e, native)) return "cantEnchant";
      for (const have of held.enchantments ?? []) {
        if (have.id !== id && !canApplyTogether(e, have.id)) return { conflict: enchantName.get(have.id) };
      }
      addEnchantment(held, e, level);
      env.refreshInventory();
      return true;
    },
    addLevels(n) { env.experience().addLevels(n); env.refreshInventory(); },
    addExperience(n) { env.experience().add(n); env.refreshInventory(); },
    summon(type, x, y, z) {
      const mobs = env.mobs();
      if (!mobs) return false;
      mobs.spawnNatural(type, x, y, z);
      env.changed();
      return true;
    },
    // CommandSetBlock: replace / destroy / keep; destroy drops the old block like a break.
    setBlock(x, y, z, original, meta, mode) {
      const w = env.world(), cell = fromOriginal(original, meta);
      if (!cell) return "unsupported";
      const old = w.get(x, y, z);
      if (mode === "keep" && old !== 0) return false;
      if (old === cell.id && w.getMeta(x, y, z) === cell.meta) return false;
      if (mode === "destroy" && old !== 0) env.destroyBlock(x, y, z);
      w.set(x, y, z, cell.id, true, cell.meta ?? 0);
      env.updateBlock(x, y, z);
      env.changed();
      return true;
    },
    blockAt(x, y, z) {
      const w = env.world(), b = w.get(x, y, z), o = toOriginal(b, w.getMeta(x, y, z));
      return { id: o?.[0] ?? 0, meta: o?.[1] ?? 0 };
    },
    playSound(name, x, y, z, volume, pitch) { env.playSound?.(name, x, y, z, volume, pitch); },
  };
}
