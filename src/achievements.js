// Minecraft Java 1.7.10 achievements: AchievementList (pc) / Achievement (pb), StatFileWriter's unlock rules (pq) and the
// triggers' bookkeeping, ported from the unchanged classes. The table below is recorded by tools/verify-achievements.mjs
// (AchievementProbe.java) into public/research/achievements-reference.json, and src/achievements.test.js replays it.
// This module has no DOM: achievements-ui.js draws the toast and the screen, achievements-live.js observes the game.
//
// Rules ported from the bytecode:
//  * StatFileWriter.hasAchievementUnlocked (pq.a): the stat value is above 0.
//  * StatFileWriter.canUnlockAchievement (pq.b): no parent, or the parent is unlocked.
//  * StatFileWriter.countRequirementsUntilAvailable (pq.c): locked ancestors above (0 when unlocked).
//  * StatFileWriter.func_150871_b: an achievement whose parent is locked is silently ignored.
//  * Nothing checks the game mode: Creative awards achievements too.
//  * EntityPlayerMP.func_147098_j (exploreAllBiomes): every 20 ticks the biome name under the player joins a set, kept
//    even while the achievement cannot unlock yet; it awards when the set is as large as BiomeGenBase's explorable set
//    (ahu.n) and every name of that set was visited.

// [id, column, row, item, damage, parent, special]; `item` is the original (1.7.10) item or block id, mapped to this
// build's item id through original-items.js by the UI.
export const ACHIEVEMENT_TABLE = [
  ["openInventory", 0, 0, 340, 0, null, 0],
  ["mineWood", 2, 1, 17, 0, "openInventory", 0],
  ["buildWorkBench", 4, -1, 58, 0, "mineWood", 0],
  ["buildPickaxe", 4, 2, 270, 0, "buildWorkBench", 0],
  ["buildFurnace", 3, 4, 61, 0, "buildPickaxe", 0],
  ["acquireIron", 1, 4, 265, 0, "buildFurnace", 0],
  ["buildHoe", 2, -3, 290, 0, "buildWorkBench", 0],
  ["makeBread", -1, -3, 297, 0, "buildHoe", 0],
  ["bakeCake", 0, -5, 354, 0, "buildHoe", 0],
  ["buildBetterPickaxe", 6, 2, 274, 0, "buildPickaxe", 0],
  ["cookFish", 2, 6, 350, 0, "buildFurnace", 0],
  ["onARail", 2, 3, 66, 0, "acquireIron", 1],
  ["buildSword", 6, -1, 268, 0, "buildWorkBench", 0],
  ["killEnemy", 8, -1, 352, 0, "buildSword", 0],
  ["killCow", 7, -3, 334, 0, "buildSword", 0],
  ["flyPig", 9, -3, 329, 0, "killCow", 1],
  ["snipeSkeleton", 7, 0, 261, 0, "killEnemy", 1],
  ["diamonds", -1, 5, 56, 0, "acquireIron", 0],
  ["diamondsToYou", -1, 2, 264, 0, "diamonds", 0],
  ["portal", -1, 7, 49, 0, "diamonds", 0],
  ["ghast", -4, 8, 370, 0, "portal", 1],
  ["blazeRod", 0, 9, 369, 0, "portal", 0],
  ["potion", 2, 8, 373, 0, "blazeRod", 0],
  ["theEnd", 3, 10, 381, 0, "blazeRod", 1],
  ["theEnd2", 4, 13, 122, 0, "theEnd", 1],
  ["enchantments", -4, 4, 116, 0, "diamonds", 0],
  ["overkill", -4, 1, 276, 0, "enchantments", 1],
  ["bookcase", -3, 6, 47, 0, "enchantments", 0],
  ["breedCow", 7, -5, 296, 0, "killCow", 0],
  ["spawnWither", 7, 12, 397, 1, "theEnd2", 0],
  ["killWither", 7, 10, 399, 0, "spawnWither", 0],
  ["fullBeacon", 7, 8, 138, 0, "killWither", 1],
  ["exploreAllBiomes", 4, 8, 313, 0, "theEnd", 1]
];

// en_US.lang, and the GuiAchievement(s) strings.
export const STRINGS = {
  "openInventory": "Taking Inventory",
  "openInventory.desc": "Press '%1$s' to open your inventory.",
  "mineWood": "Getting Wood",
  "mineWood.desc": "Attack a tree until a block of wood pops out",
  "buildWorkBench": "Benchmarking",
  "buildWorkBench.desc": "Craft a workbench with four blocks of planks",
  "buildPickaxe": "Time to Mine!",
  "buildPickaxe.desc": "Use planks and sticks to make a pickaxe",
  "buildFurnace": "Hot Topic",
  "buildFurnace.desc": "Construct a furnace out of eight stone blocks",
  "acquireIron": "Acquire Hardware",
  "acquireIron.desc": "Smelt an iron ingot",
  "buildHoe": "Time to Farm!",
  "buildHoe.desc": "Use planks and sticks to make a hoe",
  "makeBread": "Bake Bread",
  "makeBread.desc": "Turn wheat into bread",
  "bakeCake": "The Lie",
  "bakeCake.desc": "Wheat, sugar, milk and eggs!",
  "buildBetterPickaxe": "Getting an Upgrade",
  "buildBetterPickaxe.desc": "Construct a better pickaxe",
  "cookFish": "Delicious Fish",
  "cookFish.desc": "Catch and cook fish!",
  "onARail": "On A Rail",
  "onARail.desc": "Travel by minecart at least 1 km from where you started",
  "buildSword": "Time to Strike!",
  "buildSword.desc": "Use planks and sticks to make a sword",
  "killEnemy": "Monster Hunter",
  "killEnemy.desc": "Attack and destroy a monster",
  "killCow": "Cow Tipper",
  "killCow.desc": "Harvest some leather",
  "breedCow": "Repopulation",
  "breedCow.desc": "Breed two cows with wheat",
  "flyPig": "When Pigs Fly",
  "flyPig.desc": "Fly a pig off a cliff",
  "snipeSkeleton": "Sniper Duel",
  "snipeSkeleton.desc": "Kill a skeleton with an arrow from more than 50 meters",
  "diamonds": "DIAMONDS!",
  "diamonds.desc": "Acquire diamonds with your iron tools",
  "diamondsToYou": "Diamonds to you!",
  "diamondsToYou.desc": "Throw diamonds at another player.",
  "portal": "We Need to Go Deeper",
  "portal.desc": "Build a portal to the Nether",
  "ghast": "Return to Sender",
  "ghast.desc": "Destroy a Ghast with a fireball",
  "blazeRod": "Into Fire",
  "blazeRod.desc": "Relieve a Blaze of its rod",
  "potion": "Local Brewery",
  "potion.desc": "Brew a potion",
  "theEnd": "The End?",
  "theEnd.desc": "Locate the End",
  "theEnd2": "The End.",
  "theEnd2.desc": "Defeat the Ender Dragon",
  "spawnWither": "The Beginning?",
  "spawnWither.desc": "Spawn the Wither",
  "killWither": "The Beginning.",
  "killWither.desc": "Kill the Wither",
  "fullBeacon": "Beaconator",
  "fullBeacon.desc": "Create a full beacon",
  "exploreAllBiomes": "Adventuring Time",
  "exploreAllBiomes.desc": "Discover all biomes",
  "enchantments": "Enchanter",
  "enchantments.desc": "Use a book, obsidian and diamonds to construct an enchantment table",
  "overkill": "Overkill",
  "overkill.desc": "Deal eight hearts of damage in a single hit",
  "bookcase": "Librarian",
  "bookcase.desc": "Build some bookshelves to improve your enchantment table",
  "get": "Achievement get!",
  "taken": "Taken!",
  "unknown": "???",
  "requires": "Requires '%1$s'",
};
export const CHAT_ACHIEVEMENT = "%s has just earned the achievement %s";

// The biomes exploreAllBiomes needs (ahu.n, 36 names; recorded by the probe).
export const EXPLORE_BIOMES = [
  "Beach", "Birch Forest", "Birch Forest Hills", "Cold Beach", "Cold Taiga", "Cold Taiga Hills", "Deep Ocean", "Desert",
  "DesertHills", "Extreme Hills", "Extreme Hills+", "Forest", "ForestHills", "FrozenRiver", "Ice Mountains", "Ice Plains",
  "Jungle", "JungleEdge", "JungleHills", "Mega Taiga", "Mega Taiga Hills", "Mesa", "Mesa Plateau", "Mesa Plateau F",
  "MushroomIsland", "MushroomIslandShore", "Ocean", "Plains", "River", "Roofed Forest", "Savanna", "Savanna Plateau",
  "Stone Beach", "Swampland", "Taiga", "TaigaHills",
];
// EntityPlayer.addMovementStat: riding a minecart, onARail at ChunkCoordinates.getDistanceSquared >= 1000000.0 (1000 blocks).
export const ON_A_RAIL_DISTANCE_SQUARED = 1000000;
// EntitySkeleton.onDeath: an arrow of a player at least 50 blocks away in x and z (>= 2500.0 squared).
export const SNIPE_DISTANCE_SQUARED = 2500;
// EntityPlayer.attackTargetEntityWithCurrentItem: a landed hit of at least 18.0 (nine hearts) damage.
export const OVERKILL_DAMAGE = 18;
// EntityPig.fall: a fall of more than 5.0 blocks with a player riding.
export const FLY_PIG_DISTANCE = 5;

export const ACHIEVEMENTS = ACHIEVEMENT_TABLE.map(([id, column, row, item, damage, parent, special]) =>
  Object.freeze({ id, column, row, item, damage, parent, special: !!special, get name() { return STRINGS[id]; }, get description() { return STRINGS[id + ".desc"]; } }));
export const BY_ID = Object.freeze(Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])));
// AchievementList.a..d: the extent of the tree (grows with every achievement constructed).
export const BOUNDS = Object.freeze({
  minColumn: Math.min(...ACHIEVEMENTS.map((a) => a.column)), minRow: Math.min(...ACHIEVEMENTS.map((a) => a.row)),
  maxColumn: Math.max(...ACHIEVEMENTS.map((a) => a.column)), maxRow: Math.max(...ACHIEVEMENTS.map((a) => a.row)),
});

export class Achievements {
  constructor({ onUnlock = () => {} } = {}) {
    this.onUnlock = onUnlock;
    this.reset();
  }
  reset() {
    this.unlocked = new Set();
    this.visited = new Set(); // the pr set of exploreAllBiomes
    this.cartStart = null; // EntityPlayer.startMinecartRidingCoordinate
    this.beaconLevels = new Map();
  }
  has(id) { return this.unlocked.has(id); }
  canUnlock(id) {
    const a = BY_ID[id];
    return !!a && (a.parent === null || this.has(a.parent));
  }
  depth(id) {
    if (this.has(id)) return 0;
    let n = 0;
    for (let p = BY_ID[id]?.parent; p && !this.has(p); p = BY_ID[p].parent) n++;
    return n;
  }
  // EntityPlayer.triggerAchievement: a locked-parent achievement is ignored; returns whether this one was newly unlocked.
  trigger(id) {
    if (!BY_ID[id]) throw new RangeError(`Unknown achievement ${id}`);
    this.onTrigger?.(id); // EntityPlayer.triggerAchievement -> addStat: the criteria counts every call, locked or already unlocked
    if (!this.canUnlock(id) || this.has(id)) return false;
    this.unlocked.add(id);
    this.onUnlock(BY_ID[id]);
    return true;
  }
  // EntityPlayerMP.func_147098_j, run every 20 ticks with the biome name at the player's block.
  visit(biomeName, tick = 0) {
    if (tick % 20 !== 0 || this.has("exploreAllBiomes") || typeof biomeName !== "string") return false;
    this.visited.add(biomeName);
    if (!this.canUnlock("exploreAllBiomes") || this.visited.size !== EXPLORE_BIOMES.length) return false;
    const missing = new Set(EXPLORE_BIOMES);
    for (const name of this.visited) missing.delete(name);
    return missing.size === 0 && this.trigger("exploreAllBiomes");
  }
  // EntityPlayer.addMovementStat for a minecart rider: the first cell is the start, onARail follows at 1000 blocks.
  rideMinecart(x, y, z) {
    const cell = [Math.floor(x), Math.floor(y), Math.floor(z)];
    if (!this.cartStart) { this.cartStart = cell; return false; }
    const d = cell.reduce((s, v, i) => s + (v - this.cartStart[i]) ** 2, 0);
    return d >= ON_A_RAIL_DISTANCE_SQUARED && this.trigger("onARail");
  }
  // EntityPlayer.onUpdate: the start is forgotten once the player is no longer riding.
  stopRiding() { this.cartStart = null; }
  // TileEntityBeacon.updateEntity: the player standing at a pyramid that just reached level 4.
  beacon(key, levels, near) {
    const before = this.beaconLevels.get(key) ?? 0;
    this.beaconLevels.set(key, levels);
    return levels === 4 && before < 4 && near && this.trigger("fullBeacon");
  }
  // Per-world storage: the unlocked ids (StatisticsFile writes achievements as ints) and the visited biome names.
  save() {
    return { unlocked: ACHIEVEMENTS.filter((a) => this.has(a.id)).map((a) => a.id), biomes: [...this.visited] };
  }
  load(data) {
    this.reset();
    for (const id of Array.isArray(data?.unlocked) ? data.unlocked : []) if (BY_ID[id]) this.unlocked.add(id);
    for (const name of Array.isArray(data?.biomes) ? data.biomes : []) if (typeof name === "string") this.visited.add(name);
    return this;
  }
}
