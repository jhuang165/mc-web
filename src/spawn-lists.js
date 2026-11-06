// The 1.7.10 natural spawn tables: EnumCreatureType (sx), every BiomeGenBase's four spawnable lists (ahu.a(sx)) as
// [EntityList name, weight, min group, max group], EntityLiving.getMaxSpawnedInChunk and the two structure lists
// (MapGenNetherBridge.getSpawnList, MapGenScatteredFeature.getScatteredFeatureSpawnList). All of it is recorded from the
// unchanged classes in public/research/spawn-lists-reference.json (tools/verify-spawn-lists.mjs); spawner-animals.test.js
// checks every biome slot against it. population-tail.js (performWorldGenSpawning) reads the creature lists from here.

// EnumCreatureType.values() order, getMaxNumberOfCreature, getCreatureMaterial, getPeacefulCreature, getAnimal.
export const CREATURE_TYPES = Object.freeze([
  Object.freeze({ name: "monster", max: 70, material: "air", peaceful: false, animal: false }),
  Object.freeze({ name: "creature", max: 10, material: "air", peaceful: true, animal: true }),
  Object.freeze({ name: "ambient", max: 15, material: "air", peaceful: true, animal: false }),
  Object.freeze({ name: "waterCreature", max: 5, material: "water", peaceful: true, animal: false }),
]);

const MONSTERS = [["Spider", 100, 4, 4], ["Zombie", 100, 4, 4], ["Skeleton", 100, 4, 4], ["Creeper", 100, 4, 4], ["Slime", 100, 4, 4], ["Enderman", 10, 1, 4], ["Witch", 5, 1, 1]];
const FARM = [["Sheep", 12, 4, 4], ["Pig", 10, 4, 4], ["Chicken", 10, 4, 4], ["Cow", 8, 4, 4]];
const BATS = [["Bat", 10, 8, 8]], SQUID = [["Squid", 10, 4, 4]];
export const HELL_MONSTERS = Object.freeze([["Ghast", 50, 4, 4], ["PigZombie", 100, 4, 4], ["LavaSlime", 1, 4, 4]]);
export const SKY_MONSTERS = Object.freeze([["Enderman", 10, 4, 4]]);
// The registered slots of BiomeGenBase.getBiomeGenArray (slot 161 holds a biome whose own biomeID is 160).
export const BIOME_SLOTS = Object.freeze([...Array.from({ length: 40 }, (_, i) => i), 129, 130, 131, 132, 133, 134, 140, 149, 151, 155, 156, 157, 158, 160, 161, 162, 163, 164, 165, 166, 167]);
const CREATURE_ROWS = [
  [[0, 2, 7, 8, 9, 10, 11, 12, 13, 16, 17, 24, 25, 26, 37, 38, 39, 130, 140, 165, 166, 167], []],
  [[1, 129], [...FARM, ["EntityHorse", 5, 2, 6]]],
  [[3, 6, 20, 27, 28, 29, 34, 131, 132, 134, 155, 156, 157, 162], FARM],
  [[4, 18], [...FARM, ["Wolf", 5, 4, 4]]],
  [[5, 19, 30, 31, 32, 33, 133, 158, 160, 161], [...FARM, ["Wolf", 8, 4, 4]]],
  [[14, 15], [["MushroomCow", 8, 4, 8]]],
  // BiomeGenJungle adds a second chicken entry.
  [[21, 22, 23, 149, 151], [...FARM, ["Chicken", 10, 4, 4]]],
  [[35, 36, 163, 164], [...FARM, ["EntityHorse", 1, 2, 6]]],
];
const freeze = (list) => Object.freeze(list.map((e) => Object.freeze(e)));
const creatureOf = new Map(CREATURE_ROWS.flatMap(([slots, list]) => slots.map((s) => [s, freeze(list)])));
function monstersOf(slot) {
  if (slot === 8) return HELL_MONSTERS;
  if (slot === 9) return SKY_MONSTERS;
  if (slot === 14 || slot === 15) return []; // BiomeGenMushroomIsland clears it
  // BiomeGenSwamp: a second slime entry; BiomeGenJungle (not the edge variants): ocelots.
  if (slot === 6 || slot === 134) return [...MONSTERS, ["Slime", 1, 1, 1]];
  if (slot === 21 || slot === 22 || slot === 149) return [...MONSTERS, ["Ozelot", 2, 1, 1]];
  return MONSTERS;
}
const LISTS = new Map(BIOME_SLOTS.map((slot) => [slot, Object.freeze({
  monster: freeze(monstersOf(slot)),
  creature: creatureOf.get(slot),
  ambient: freeze(slot === 8 || slot === 9 ? [] : BATS),
  waterCreature: freeze(slot === 8 || slot === 9 || slot === 14 || slot === 15 ? [] : SQUID),
})]));
// BiomeGenBase.getSpawnableList(type) for a biome slot; null for an unregistered slot.
export const spawnList = (slot, type) => LISTS.get(slot)?.[type] ?? null;
// BiomeGenBase.getSpawningChance is 0.1 in every biome (population-tail.js SPAWN_CHANCE).

// MapGenNetherBridge.spawnList and MapGenScatteredFeature.scatteredFeatureSpawnList.
export const FORTRESS_MONSTERS = freeze([["Blaze", 10, 2, 3], ["PigZombie", 5, 4, 4], ["Skeleton", 10, 4, 4], ["LavaSlime", 3, 4, 4]]);
export const WITCH_HUT_MONSTERS = freeze([["Witch", 1, 1, 1]]);

// EntityList names in the lists to this build's mob types.
export const ENTITY_TYPE_OF = Object.freeze({
  Spider: "spider", Zombie: "zombie", Skeleton: "skeleton", Creeper: "creeper", Slime: "slime", Enderman: "enderman", Witch: "witch",
  Ozelot: "ocelot", Sheep: "sheep", Pig: "pig", Chicken: "chicken", Cow: "cow", Wolf: "wolf", MushroomCow: "mooshroom", EntityHorse: "horse",
  Bat: "bat", Squid: "squid", Ghast: "ghast", PigZombie: "pigman", LavaSlime: "magma_cube", Blaze: "blaze",
});
// EntityLiving.getMaxSpawnedInChunk overrides (EntityGhast 1, EntityHorse 6, EntityWolf 8); 4 otherwise.
const MAX_IN_CHUNK = { Ghast: 1, EntityHorse: 6, Wolf: 8 };
export const maxSpawnedInChunk = (name) => MAX_IN_CHUNK[name] ?? 4;

// The EnumCreatureType whose creature class (IMob, EntityAnimal, EntityAmbientCreature, EntityWaterMob) each mob type is
// assignable to, for World.countEntities. Villagers, golems and the snow golem count as none.
const KIND = new Map([
  ...["zombie", "skeleton", "wither_skeleton", "spider", "cave_spider", "creeper", "slime", "enderman", "witch", "ghast", "pigman", "magma_cube", "blaze", "silverfish", "giant", "ender_dragon", "wither"].map((t) => [t, "monster"]),
  ...["sheep", "pig", "chicken", "cow", "mooshroom", "wolf", "horse", "ocelot"].map((t) => [t, "creature"]),
  ["bat", "ambient"], ["squid", "waterCreature"],
]);
export const creatureTypeOf = (type) => KIND.get(type) ?? null;
