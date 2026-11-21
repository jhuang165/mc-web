import { applySetblockTag } from "./setblock-tags.js"; // b83 plants83
import { JUKEBOX_ID } from "./jukebox.js"; // b84 cmdfix84
import { itemComponent, originalStack } from "./item-component.js";
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
import { summonCart, cartTypeOfSummon, spawnerRecord } from "./cart-summon.js";
import { summonFireworkRocket, FIREWORK_SUMMON } from "./firework-summon.js";
import { summonEntity, entityIdOfSummon } from "./entity-summon.js";
import { liftSummonedCrystal } from "./ender-crystal.js"; // b89 mpobjects89
import { mountEntity } from "./mob-riding.js";
import { mountMobOnVehicle } from "./vehicle-riders.js";
import { newChest, settleFacing } from "./chest.js";
import { furnaceAddedFacing } from "./container-tiles.js"; // b89 tiles89
// b89 tiles89: chest, trapped chest, furnace, lit furnace: the original metadata (facing) or id (lit) the port keeps outside the cell.
const FACED_ORIGINALS = new Set([54, 146, 61, 62]), FURNACE_CELL = 14, DISPENSER_CELL = fromOriginal(23, 0)?.id, DROPPER_CELL = fromOriginal(158, 0)?.id;
import { newEnderTile } from "./chest-blocks.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { makeStack } from "./inventory.js";
import { FLOWER_POT, potBreakDrop, potEntryStack, potKey } from "./stone-utility.js";
import { SKULLS } from "./skull.js";
import { canApply, canApplyTogether, addEnchantment, ENCHANTMENTS_BY_ID } from "./enchantments.js";
import { liveStackToNative } from "./anvil-container.js";
import { beaconToNbt } from "./pyramid.js";
import { PLAYER_NAME } from "./death-messages.js";
import { LAN_NOTICE } from "./lan.js";
import { profileOfSkullTile } from "./skull-profile.js";

const unsupported = (text) => new CommandException("commands.generic.exception", [text], "unsupported");
const enchantName = new Map(ENCHANTMENT_NAMES.map(([id, name]) => [id, name]));
import { DEFAULT_RULES, ruleOn } from "./game-rules.js";
export { DEFAULT_RULES, ruleOn };

// The /clear test of one port stack: original Item id (-1: any) and getItemDamage (-1: any). A variant item's damage is the original's (originalStack);
// a stack carrying rawDamage (a Data the catalogue has no variant for) compares that.
export function clearMatcher(original, damage) {
  return (s) => {
    if (!s) return false;
    if (original === -1) return true;
    const o = originalStack(s);
    return o.id === original && (damage <= -1 || (Number.isInteger(s.rawDamage) ? s.rawDamage : o.damage) === damage);
  };
}
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
    // GuiNewChat.printChatMessage takes the IChatComponent and draws its getFormattedText: the component beside the sender text is what the chat window shows.
    print: (text, component) => printChat(component ?? text),
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
      // CommandGive (bytecode-read, neg-stacks3-reference.json give): EntityPlayer.func_146097_a(stack, false, false) drops the whole
      // stack along the view, then sets the pickup delay to 0 and the owner (func_145797_a) to the player. It never touches the inventory.
      (this.giveDrop ?? env.giveDrop)(stack, this.name); // a replay (away-commands.js replayPlayerCommands) puts the stack straight in the inventory
      env.refreshInventory();
      return { name: "[" + name + "]", component: itemComponent(stack, name), ignored }; // ItemStack.func_151000_E
    },
    // InventoryPlayer.clearInventory(Item, int) (b83 cmdexec83, executed: cmd-exec-reference.json): the main slots, the armour and the cursor stack, matched by the
    // original Item (so coal takes charcoal, stone every stone damage) and, given a data value, by getItemDamage.
    clear(original, damage) {
      const inv = survival().inventory, match = clearMatcher(original, damage);
      let removed = 0;
      for (const list of [inv.main, inv.armor]) {
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (!s || !match(s)) continue;
          removed += s.count;
          list[i] = null;
        }
      }
      if (inv.cursor && match(inv.cursor)) { removed += inv.cursor.count; inv.cursor = null; }
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
    teleport(x, y, z, look) { env.teleport(x, y, z, look); }, // look: the target player's { yaw, pitch } (game radians) for /tp <player> <target>
    // /tellraw output goes to the player even when a command block runs it (EntityPlayerMP.addChatComponentMessage).
    printPlayer: (component) => printChat(component),
    get achievements() { return env.achievements?.(); },
    get stats() { return env.stats?.(); },
    // The world scoreboard (scoreboard.js): /scoreboard, @p[team=,score_...] selectors and /spreadplayers respectTeams.
    get scoreboard() { return env.scoreboard?.(); },
    teamOf: (name) => env.scoreboard?.()?.teamOf(name) ?? null,
    profiler: env.profiler,
    tickCounter: () => env.tickCounter?.() ?? 0,
    saveFile: (name, text) => env.saveFile?.(name, text),
    // ItemStack.getDisplayName of an original item id (the [name] inside an item statistic's name).
    statItemName(n) {
      const item = itemFromOriginal(n, 0);
      return item ? env.stackName(makeStack(item.id, 1, item.damage)) : null;
    },
    // CommandSpreadPlayers.Position.func_111092_a: the first non-air block below y 256, plus one; 257 over an empty column. A
    // streamed column outside the resident window is read from its generated terrain and the saved edits.
    topY(x, z) {
      const w = env.world(), xi = Math.floor(x), zi = Math.floor(z);
      if (!w.inside(xi, 0, zi)) return 257;
      let col = w.columnBlocks?.(xi, zi) ?? null;
      // A stored column of an imported save that is not resident reads its import-time top (stored-peek.js; edits made after the import to an evicted column are not seen).
      if (!col && w.streaming && !w.baseColumns?.has?.(`${xi >> 4},${zi >> 4}`) && !w.chunkEdits?.has?.(`${xi >> 4},${zi >> 4}`)) { const t = env.storedTop?.(xi, zi); if (t !== undefined) return t; }
      if (!col && w.streaming && w.generateTerrainChunk) {
        const cx = xi >> 4, cz = zi >> 4, h = w.height, start = ((xi & 15) * 16 + (zi & 15)) * h;
        const c = w.baseColumns?.get?.(`${cx},${cz}`) ?? w.peekChunk?.(cx, cz) ?? w.generateTerrainChunk(cx, cz);
        col = Uint8Array.from(c.blocks.subarray(start, start + h));
        for (const [cell, stored] of w.chunkEdits?.get(`${cx},${cz}`) ?? []) if (cell >= start && cell < start + h) col[cell - start] = (stored % 4096) & 255;
      }
      if (!col) return 257;
      for (let y = Math.min(255, col.length - 1); y > 0; y--) if (col[y]) return y + 1;
      return 257;
    },
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
    // b82 commands82: enchantCheck answers the held-item tests CommandEnchant makes before it parses the level (bytecode-read order).
    enchantCheck(id) {
      const held = survival().inventory.held;
      if (!held) return "noItem";
      const e = ENCHANTMENTS_BY_ID[id], native = liveStackToNative(held); // enchantments.js reads the original item ids
      return !e || !native || !canApply(e, native) ? "cantEnchant" : null;
    },
    enchant(id, level) {
      const held = survival().inventory.held, e = ENCHANTMENTS_BY_ID[id];
      if (!held) return "noItem";
      const native = liveStackToNative(held);
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
    // CommandSummon (bu.b): the entity from the tag (EntityList.createEntityFromNBT) at x, y, z, then each Riding compound is created at
    // the same point, spawned and ridden (current.mountEntity(mount)) until one cannot be created. Mounts are kept between mobs
    // (mob-riding.js); a vehicle, projectile or item on either end is spawned but not linked, and the command says so.
    summon(type, x, y, z, tag) {
      // b87 summon87 (executed, summon87-reference.json head rows, 300 summons each of eight mobs and five tags): Entity.readFromNBT's setRotation (sa.b(FF)) sets
      // rotationYaw = Rotation[0] % 360 and rotationPitch = Rotation[1] % 360 while prevRotationYaw/Pitch keep the raw floats (0 for an id-only tag). Nothing touches
      // rotationYawHead: it keeps EntityLivingBase's constructor roll (float)(Math.random() * PI * 2), degrees in [0, 6.28), and renderYawOffset, prevRenderYawOffset
      // and prevRotationYawHead stay 0, with or without a Rotation tag. The tracker's head byte (S0F, then S19 on a change of 4 or more) follows from those fields.
      const facing = (mob, nbt) => {
        if (!mob || typeof mob !== "object") return;
        const rot = nbt ? nbtGet(nbt, 'Rotation', NBT.LIST) : null, items = rot?.elementType === NBT.FLOAT ? rot.items : [];
        const rawYaw = Number.isFinite(items[0]) ? Math.fround(items[0]) : 0, rawPitch = Number.isFinite(items[1]) ? Math.fround(items[1]) : 0, yaw = Math.fround(rawYaw % 360) + 0;
        Object.assign(mob, { rotationYaw: yaw, prevRotationYaw: rawYaw, rotationPitch: Math.fround(rawPitch % 360) + 0, prevRotationPitch: rawPitch });
        if (mob.type !== 'ender_crystal') Object.assign(mob, { rotationYawHead: Math.fround(Math.random() * 3.1415927410125732 * 2.0), prevRotationYawHead: 0, renderYawOffset: 0, prevRenderYawOffset: 0, bodyHeadYaw: 0 });
        mob.yaw = (-yaw * Math.PI) / 180;
      };
      const ignored = [], convertItem = (t, o) => itemStackFromNbt(t, { ...o, ignored });
      const mobs = env.mobs();
      const spawnOne = (type, nbt) => {
        if (env.summonRefuses?.(type)) return null; // b67 mpsummon: a kind the dedicated server cannot keep is a failed creation (createEntityFromNBT null), also as a Riding mount
        if (type === FIREWORK_SUMMON) { const r = env.rockets?.() && summonFireworkRocket(env.rockets(), x, y, z, nbt); if (r) ignored.push(...r.ignored); return r ? { other: true } : null; }
        if (cartTypeOfSummon(type) !== null) { const r = summonCart(env.minecarts?.(), cartTypeOfSummon(type), x, y, z, nbt); if (r) ignored.push(...r.ignored); return r ? { other: true, vehicle: r.cart } : null; }
        const id = entityIdOfSummon(type);
        if (id) {
          const hosts = env.entityHosts?.();
          if (!hosts) return null;
          const r = summonEntity(hosts, id, x, y, z, nbt, { convertItem });
          ignored.push(...r.ignored);
          return { other: true, vehicle: r.vehicle };
        }
        if (!mobs) return null;
        if (!nbt) { // CommandSummon builds an empty compound with the id and runs Entity.readFromNBT on it, so the untagged mob also has Air 0 (b84 cmdfix84, bytecode-read bu.b; EntityLivingBase.onEntityUpdate restores 300 out of water)
          // b86 summon86 (executed, summon86-reference.json; bytecode-read bu.b 274-301): onSpawnWithEgg(null) runs BEFORE spawnEntityInWorld, so the extras it spawns (an ocelot's
          // two kittens, a spider jockey's skeleton, a chicken jockey's chicken) join the world list ahead of the summoned mob; their ids still follow its own (constructed first).
          // SpawnerAnimals and the spawn egg spawn first (spawnNatural, spawn-egg-use.js), so this path has its own order.
          let born;
          if (typeof mobs.create === "function" && typeof mobs.onSpawnWithEgg === "function") {
            born = mobs.create(type, x, y, z);
            mobs.entitySeed?.(born, "spawn"); // replay hook, as spawnNatural
            mobs.onSpawnWithEgg(born);
            mobs.entities.push(born);
          } else born = mobs.spawnNatural(type, x, y, z);
          if (born && typeof born === "object") { born.air = 0; facing(born, null); }
          if (born && typeof born === "object") liftSummonedCrystal(born); // b89 mpobjects89: setLocationAndAngles adds the crystal's yOffset 1 (executed, summon87-reference.json)
          if (born && typeof born === "object") born.nbtDimension = 0; // b88 entnbt88 (executed, entnbt88-reference.json): readFromNBT's Dimension, 0 for the empty compound, in the Nether too
          return { other: true };
        }
        const parsed = summonedMobRecord(type, nbt, { convertItem });
        if (!parsed) return null;
        const mob = mobs.restore({ ...parsed.record, x, y, z }, { summoned: true });
        if (!mob) return null;
        mobs.entities.push(mob); mobs.nextId++;
        liftSummonedCrystal(mob); // b89 mpobjects89: posY = y + yOffset (sa.b(DDDFF), bytecode-read)
        facing(mob, nbt);
        mob.fire = nbtGet(nbt, 'Fire', NBT.SHORT, 0);
        if (nbtGet(nbt, 'Invulnerable', NBT.BYTE, 0) !== 0) mob.invulnerable = true; // b85 fire85: Entity.readFromNBT's flag (sa.i); attackEntityFrom refuses it
        // b83 cmdexec83 (executed, cmd-exec-reference.json): Entity.readFromNBT also sets OnGround, FallDistance (landing damage counts it) and the air supply (Air, 0 when absent;
        // EntityLivingBase.onEntityUpdate puts it back to 300 out of water).
        mob.onGround = nbtGet(nbt, 'OnGround', NBT.BYTE, 0) !== 0;
        mob.fallDistance = Math.fround(nbtGet(nbt, 'FallDistance', NBT.FLOAT, 0));
        mob.air = nbtGet(nbt, 'Air', NBT.SHORT, 0);
        const motion = nbtGet(nbt, 'Motion', NBT.LIST);
        const velocity = motion?.elementType === NBT.DOUBLE ? motion.items : [];
        for (const [i, key] of ['vx', 'vy', 'vz'].entries()) mob[key] = Number.isFinite(velocity[i]) && Math.abs(velocity[i]) <= 10 ? velocity[i] : 0;
        ignored.push(...parsed.ignored.filter(k => k !== 'Riding'));
        return { mob };
      };
      let current = spawnOne(type, tag);
      if (!current) return false;
      for (let nbt = tag; nbt && current && nbtGet(nbt, 'Riding', NBT.COMPOUND); ) {
        const ridingTag = nbtGet(nbt, 'Riding', NBT.COMPOUND), mount = spawnOne(SUMMONABLE[nbtGet(ridingTag, 'id', NBT.STRING, '')], ridingTag);
        if (!mount) break; // createEntityFromNBT returned null: the loop ends (bu.b: current = null)
        if (current.mob && mount.mob) mountEntity(current.mob, mount.mob, m => mobs.size(m)[1]);
        else if (current.mob && mount.vehicle) { if (!mountMobOnVehicle(mount.vehicle, current.mob, m => mobs.size(m)[1])) ignored.push('Riding (the boat or minecart could not take the mob)'); }
        else ignored.push('Riding (only a mob on a mob, boat or minecart is kept; the mount spawned separately)');
        current = mount; nbt = ridingTag;
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
      // b89 tiles89: a chest's facing lives in its record and a furnace's lit state in its burn time, so for those the native test (func_150807_a returns
      // early only when the block and the metadata are both unchanged) compares the original id and metadata blockAt reports: /setblock chest over a chest
      // of another facing, or lit_furnace over an unlit furnace, runs breakBlock (the spill below) instead of "no change".
      const faced = FACED_ORIGINALS.has(original), before = faced ? this.blockAt(x, y, z) : null;
      if (faced ? before.id === original && before.meta === ((meta | 0) & 15) : w.get(x, y, z) === cell.id && w.getMeta(x, y, z) === cell.meta) return false;
      // b82 pots82: World.setBlock runs the old block's breakBlock on the server even for the same block with another metadata (Chunk.func_150807_a, apx.a;
      // bytecode-read), so a replaced pot drops its stored stack (BlockFlowerPot.breakBlock, ald.a) and its tile entity goes (BlockContainer.breakBlock).
      // b84 cmdfix84: BlockJukebox.breakBlock (dropRecord, bytecode-read) also runs in this setBlock, so a loaded jukebox ejects its disc (item entity, stop-record) before the new block goes in.
      if (old !== 0 && old === fromOriginal(JUKEBOX_ID, 0)?.id) env.music?.()?.jukeboxes?.eject?.(x, y, z);
      const potHeld = w.get(x, y, z) === FLOWER_POT ? potBreakDrop(w, x, y, z) : null;
      w.set(x, y, z, cell.id, true, cell.id === FURNACE_CELL || cell.id === DISPENSER_CELL || cell.id === DROPPER_CELL ? furnaceAddedFacing(w, x, y, z) : cell.meta ?? 0); // b89 tiles89: BlockFurnace.onBlockAdded (ale.e) settles the facing whatever the command's metadata; b90 tiles90: so does BlockDispenser.onBlockAdded (akm.m, bytecode-read; the dropper inherits it), which also drops the trigger bit
      if (potHeld) { w.pots?.delete(potKey(x, y, z)); if (potHeld.id) env.dropStacks?.([potEntryStack(potHeld, makeStack)], x, y, z); }
      const key = `${x},${y},${z}`, stores = survival();
      // b75: tableNames, an enchanting table's CustomName goes with the old tile. b87 tiles87: CommandSetBlock (bm) clears no tile itself, it only calls World.setBlock (ahb.d(IIILaji;II)Z,
      // flags 3; bytecode-read), and Chunk.func_150807_a runs the old block's breakBlock: BlockChest (ajx), BlockFurnace, BlockDispenser, BlockHopper (aln) and BlockBrewingStand spill
      // the slots (EntityItem pieces of 10-30, no doTileDrops test) before the new block's tile. `env.spillTile` is the host's container spill (ItemEntities.spill).
      for (const name of ['chests', 'furnaces', 'dispensers', 'hoppers', 'brewing', 'tableNames']) {
        const gone = stores[name]?.[key];
        if (gone === undefined) continue;
        delete stores[name][key];
        if (name !== 'tableNames' && Array.isArray(gone?.items)) env.spillTile?.(gone.items.filter(Boolean), x, y, z, key);
      }
      if (original === 144) (env.skulls?.() ?? SKULLS).create(x, y, z, Number(nbtGet(tag ?? new Map(), 'SkullType', NBT.BYTE, 0)) | 0, Number(nbtGet(tag ?? new Map(), 'Rot', NBT.BYTE, 0)), '', profileOfSkullTile(tag)); // TileEntitySkull (skull.js)
      const id = { 54: 'Chest', 146: 'Chest', 61: 'Furnace', 62: 'Furnace', 23: 'Trap', 158: 'Dropper', 154: 'Hopper', 117: 'Cauldron' }[original];
      if (original === 138 && env.beaconTile) { // TileEntityBeacon.readFromNBT: Primary, Secondary, Levels (pyramid.js)
        const t = env.beaconTile(x, y, z);
        Object.assign(t, { primary: nbtGet(tag ?? new Map(), 'Primary', NBT.INT, 0), secondary: nbtGet(tag ?? new Map(), 'Secondary', NBT.INT, 0), levels: tag ? nbtGet(tag, 'Levels', NBT.INT, 0) : -1 });
        this.ignoredTagKeys = tag ? [...tag.keys()].filter(k => !['Primary', 'Secondary', 'Levels', 'x', 'y', 'z', 'id'].includes(k)) : [];
      } else if (original === 137 && env.commandTile) {
        Object.assign(env.commandTile(x, y, z), readCommandBlock(tag ?? new Map()));
        this.ignoredTagKeys = tag ? [...tag.keys()].filter(k => !['Command', 'SuccessCount', 'CustomName', 'TrackOutput', 'LastOutput', 'x', 'y', 'z', 'id'].includes(k)) : [];
      } else if (original === 52 && env.spawners?.()) {
        // TileEntityMobSpawner.readFromNBT (MobSpawnerBaseLogic.readFromNBT, the same reader as the spawner minecart): EntityId, Delay, the delay and range
        // keys, SpawnPotentials and SpawnData with its Riding chain. No tag leaves the constructor defaults (Pig, 20).
        env.spawners().add({ ...(tag ? spawnerRecord(tag) : {}), x, y, z });
        this.ignoredTagKeys = tag ? [...tag.keys()].filter(k => !['EntityId', 'Delay', 'MinSpawnDelay', 'MaxSpawnDelay', 'SpawnCount', 'MaxNearbyEntities', 'RequiredPlayerRange', 'SpawnRange', 'SpawnPotentials', 'SpawnData', 'x', 'y', 'z', 'id'].includes(k)) : [];
      } else if (original === 116) { // TileEntityEnchantmentTable.readFromNBT: CustomName (a string tag) names the new table
        const name = tag ? nbtGet(tag, 'CustomName', NBT.STRING, '') : '';
        if (name) (stores.tableNames ??= {})[key] = name;
        this.ignoredTagKeys = tag ? [...tag.keys()].filter(k => !['CustomName', 'x', 'y', 'z', 'id'].includes(k)) : [];
      } else if (id) {
        const loaded = readContainerTile(id, tag ?? new Map());
        stores[loaded.name] ??= {};
        stores[loaded.name][key] = { ...(id === 'Chest' ? newChest() : {}), ...loaded.record, ...(original === 62 ? { lit: true } : {}) }; // b90 tiles90: lit_furnace with an empty tile stays lit (TileEntityFurnace.updateEntity flips the block only when burnTime > 0 changes), as an imported one
        if (id === 'Chest') settleFacing(w, stores.chests, x, y, z);
        this.ignoredTagKeys = loaded.ignored;
      } else if (tag) this.ignoredTagKeys = applySetblockTag(original, x, y, z, tag, { world: w, signs: env.signs?.(), music: env.music?.(), comparators: env.comparators?.() }) ?? [...tag.keys()]; // b83 plants83: pot, sign, note, jukebox, comparator (setblock-tags.js)
      // b84 cmdfix84: the sign set over a sign with another metadata is a fresh tile (breakBlock removed the old one): empty lines, editable again, unless the tag above read it.
      if (!tag && (original === 63 || original === 68) && old === cell.id) env.signs?.()?.create(x, y, z);
      // TileEntityEnderChest holds no items (they live with the player); it only needs the lid state the renderer draws.
      if (original === 130) { if (stores.enderTiles?.[key]) env.closeTile?.(key); (stores.enderTiles ??= {})[key] = newEnderTile(); } else if (stores.enderTiles) delete stores.enderTiles[key]; // b88 tiles88: over an ender chest too, BlockContainer.breakBlock removed the old tile (Chunk.func_150807_a on a meta-only change), so the lid restarts and a window on it closes (its isUseableByPlayer, ape.a, tests getTileEntity == this)
      env.updateBlock(x, y, z);
      env.changed();
      return true;
    },
    tileAt(x, y, z) {
      const id = this.blockAt(x, y, z).id, name = { 54: 'chests', 146: 'chests', 61: 'furnaces', 62: 'furnaces', 23: 'dispensers', 158: 'dispensers', 154: 'hoppers', 117: 'brewing' }[id];
      if (id === 138 && env.beaconTile) return new Map(Object.entries(beaconToNbt(env.beaconTile(x, y, z))).map(([k, v]) => [k, { type: typeof v === 'string' ? NBT.STRING : NBT.INT, value: v }]));
      if (id === 137 && env.commandTile) return writeCommandBlock(env.commandTile(x, y, z), x, y, z);
      if (!name) return null;
      const record = survival()[name]?.[`${x},${y},${z}`] ?? readContainerTile({ chests: 'Chest', furnaces: 'Furnace', dispensers: 'Trap', hoppers: 'Hopper', brewing: 'Cauldron' }[name], new Map()).record;
      return writeContainerTile(name, record, x, y, z, { dropper: id === 158 });
    },
    blockAt(x, y, z) {
      const w = env.world(), b = w.get(x, y, z), key = `${x},${y},${z}`, o = toOriginal(b, w.getMeta(x, y, z), { facing: survival().chests?.[key]?.facing ?? (b === FURNACE_CELL ? w.getMeta(x, y, z) : undefined) /* b89 tiles89: the furnace's facing is its cell metadata */, lit: survival().furnaces?.[key]?.lit ?? (survival().furnaces?.[key]?.burn ?? 0) > 0 }); // b90 tiles90: the record's lit flag (lit_furnace, imported) rules until the burning flag flips
      return { id: o?.[0] ?? 0, meta: o?.[1] ?? 0 };
    },
    setLook(yaw, pitch) { env.setLook?.(yaw, pitch); }, // a dedicated server's S08 rotation (player-op.js)
    playSound(name, x, y, z, volume, pitch) { env.playSound?.(name, x, y, z, volume, pitch); },
  };
}
