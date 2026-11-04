import { readCommandBlock, writeCommandBlock } from "./command-block.js";
// Connects the command engine (commands.js) to the running game. main.js passes accessors for its live state (`env`), so
// everything here works on the real World, Survival, Weather and Experience objects and the tests can drive it without a browser.
import { printChat } from "./chat-ui.js";
import { CommandException, cheatsAllowed } from "./commands.js";
import { ENCHANTMENT_NAMES } from "./command-data.js";
import { readItemTag, readContainerTile, itemStackFromNbt, itemFromOriginal } from "./region-import.js";
import { writeContainerTile } from "./region-export.js";
import { summonedMobRecord } from "./java-mobs.js";
import { nbtGet } from "./nbt-get.js";
import { NBT } from "./nbt.js";
import { SUMMONABLE } from "./commands.js";
import { newChest, settleFacing } from "./chest.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { makeStack } from "./inventory.js";
import { canApply, canApplyTogether, addEnchantment, ENCHANTMENTS_BY_ID } from "./enchantments.js";
import { liveStackToNative } from "./anvil-container.js";
import { PLAYER_NAME } from "./death-messages.js";
import { LAN_NOTICE } from "./lan.js";

const unsupported = (text) => new CommandException("commands.generic.exception", [text], "unsupported");
const enchantName = new Map(ENCHANTMENT_NAMES.map(([id, name]) => [id, name]));
import { DEFAULT_RULES, ruleOn } from "./game-rules.js";
export { DEFAULT_RULES, ruleOn };

export function createCommandHost(env) {
  const survival = () => env.survival();
  return {
    name: PLAYER_NAME,
    // ServerConfigurationManager.func_152596_g (canSendCommands) for the singleplayer owner: the world's allowCommands, or
    // commandsAllowedForAll, which shareToLAN sets from the LAN screen's Allow Cheats.
    get cheats() { return cheatsAllowed(env.active()) || !!env.lan?.()?.cheats; },
    shareToLan: (mode, cheats) => env.shareToLan(mode, cheats),
    lanNotice: LAN_NOTICE,
    get rules() { const a = env.active(); return (a.gameRules ??= { ...DEFAULT_RULES }); },
    print: (text) => printChat(text),
    position: () => env.position(),
    seed: () => env.seed(),
    playerPosition: () => env.position(),
    playerLevel: () => env.experience?.()?.level ?? 0,
    playerMode: () => survival().mode === "creative" ? 1 : survival().mode === "adventure" ? 2 : 0,
    inWorld: (x, y, z) => { const w = env.world(); return y >= 0 && y < 256 && w.inside(Math.floor(x), Math.floor(y), Math.floor(z)) && (!w.streaming || w.isLoaded(Math.floor(x), Math.floor(z))); },
    kill() { survival().damage(1000, "void"); env.changed(); },
    setGameMode(mode) { env.setMode(mode); },
    setDefaultGameMode(mode) {
      env.active().defaultGameMode = mode; // singleplayer: only the mode a new joiner gets
    },
    setGameRule(name, value) { env.active().gameRules = { ...this.rules, [name]: String(value) }; env.changed(); },
    give(original, count, damage, tag) {
      const item = itemFromOriginal(original, damage);
      if (!item) throw unsupported("This item is not in this build");
      const stack = makeStack(item.id, count, item.damage);
      const ignored = tag ? readItemTag(stack, tag) : [];
      const name = env.stackName(stack);
      survival().inventory.add(stack);
      if (stack.count > 0) env.dropStack(stack); // what does not fit lands at the player's feet
      env.refreshInventory();
      return { name: "[" + name + "]", ignored };
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
    summon(type, x, y, z, tag) {
      const mobs = env.mobs();
      if (!mobs) return false;
      if (!tag) { mobs.spawnNatural(type, x, y, z); env.changed(); return true; }
      const ignored = [];
      const spawn = (type, nbt) => {
        const parsed = summonedMobRecord(type, nbt, { convertItem: t => itemStackFromNbt(t, { ignored }) });
        if (!parsed) return false;
        const mob = mobs.restore({ ...parsed.record, x, y, z }, { summoned: true });
        if (!mob) return false;
        mobs.entities.push(mob); mobs.nextId++;
        mob.fire = nbtGet(nbt, 'Fire', NBT.SHORT, 0);
        const motion = nbtGet(nbt, 'Motion', NBT.LIST);
        const velocity = motion?.elementType === NBT.DOUBLE ? motion.items : [];
        for (const [i, key] of ['vx', 'vy', 'vz'].entries()) mob[key] = Number.isFinite(velocity[i]) && Math.abs(velocity[i]) <= 10 ? velocity[i] : 0;
        ignored.push(...parsed.ignored.filter(k => k !== 'Riding'));
        return true;
      };
      if (!spawn(type, tag)) return false;
      for (let rider = nbtGet(tag, 'Riding', NBT.COMPOUND); rider; rider = nbtGet(rider, 'Riding', NBT.COMPOUND)) {
        ignored.push('Riding (riders spawn unmounted)');
        if (!spawn(SUMMONABLE[nbtGet(rider, 'id', NBT.STRING, '')], rider)) break;
      }
      env.changed();
      return { ignored };
    },
    // CommandSetBlock: replace / destroy / keep; destroy drops the old block like a break.
    setBlock(x, y, z, original, meta, mode, tag) {
      this.ignoredTagKeys = [];
      const w = env.world(), cell = fromOriginal(original, meta);
      if (!cell) return "unsupported";
      const old = w.get(x, y, z);
      if (mode === "keep" && old !== 0) return false;
      if (mode === "destroy" && old !== 0) env.destroyBlock(x, y, z);
      if (w.get(x, y, z) === cell.id && w.getMeta(x, y, z) === cell.meta) return false;
      w.set(x, y, z, cell.id, true, cell.meta ?? 0);
      const key = `${x},${y},${z}`, stores = survival();
      for (const name of ['chests', 'furnaces', 'dispensers', 'hoppers', 'brewing']) delete stores[name]?.[key];
      const id = { 54: 'Chest', 61: 'Furnace', 62: 'Furnace', 23: 'Trap', 158: 'Dropper', 154: 'Hopper', 117: 'Cauldron' }[original];
      if (original === 137 && env.commandTile) {
        Object.assign(env.commandTile(x, y, z), readCommandBlock(tag ?? new Map()));
        this.ignoredTagKeys = tag ? [...tag.keys()].filter(k => !['Command', 'SuccessCount', 'CustomName', 'TrackOutput', 'LastOutput', 'x', 'y', 'z', 'id'].includes(k)) : [];
      } else if (id) {
        const loaded = readContainerTile(id, tag ?? new Map());
        stores[loaded.name] ??= {};
        stores[loaded.name][key] = { ...(id === 'Chest' ? newChest() : {}), ...loaded.record };
        if (id === 'Chest') settleFacing(w, stores.chests, x, y, z);
        this.ignoredTagKeys = loaded.ignored;
      } else if (tag) this.ignoredTagKeys = [...tag.keys()];
      env.updateBlock(x, y, z);
      env.changed();
      return true;
    },
    tileAt(x, y, z) {
      const id = this.blockAt(x, y, z).id, name = { 54: 'chests', 61: 'furnaces', 62: 'furnaces', 23: 'dispensers', 158: 'dispensers', 154: 'hoppers', 117: 'brewing' }[id];
      if (id === 137 && env.commandTile) return writeCommandBlock(env.commandTile(x, y, z), x, y, z);
      if (!name) return null;
      const record = survival()[name]?.[`${x},${y},${z}`] ?? readContainerTile({ chests: 'Chest', furnaces: 'Furnace', dispensers: 'Trap', hoppers: 'Hopper', brewing: 'Cauldron' }[name], new Map()).record;
      return writeContainerTile(name, record, x, y, z, { dropper: id === 158 });
    },
    blockAt(x, y, z) {
      const w = env.world(), b = w.get(x, y, z), key = `${x},${y},${z}`, o = toOriginal(b, w.getMeta(x, y, z), { facing: survival().chests?.[key]?.facing, lit: (survival().furnaces?.[key]?.burn ?? 0) > 0 });
      return { id: o?.[0] ?? 0, meta: o?.[1] ?? 0 };
    },
    playSound(name, x, y, z, volume, pitch) { env.playSound?.(name, x, y, z, volume, pitch); },
  };
}
