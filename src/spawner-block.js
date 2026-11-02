// BlockMobSpawner (ama, original id 52 "mob_spawner"), Minecraft Java 1.7.10: the block side of a
// monster spawner. Checked against the unchanged class by tools/verify-fence-rail.mjs
// (public/research/fence-rail-reference.json). The spawning logic (MobSpawnerBaseLogic,
// TileEntityMobSpawner) and its tile records live in mob-spawner.js; this file only places and
// clears the block together with such a record.
import { MOB_SPAWNER } from "./world.js";

// Block facts: Material.rock (a pickaxe is required), hardness 5, light opacity 0, render type 0
// with an alpha-tested cage texture, not an opaque cube; no item (getItemDropped null, quantity 0,
// and no creative tab or pick-block item).
export const SPAWNER_HARDNESS = 5;

// BlockMobSpawner.dropBlockAsItemWithChance: dropXpOnBlockBreak(15 + rand.nextInt(15) +
// rand.nextInt(15)) from World.rand, only when the block is harvested (Survival, pickaxe).
// `random` is a java.util.Random-like object with nextInt, or a Math.random-style function.
export function spawnerXp(random = Math.random) {
  const next = typeof random === "function" ? (n) => Math.floor(random() * n) : (n) => random.nextInt(n);
  const a = next(15);
  return 15 + a + next(15);
}

// A generator's spawner tile record (StructureMineshaftPieces / WorldGenDungeons set the block,
// then TileEntityMobSpawner.func_145881_a().setEntityName). Extra fields are kept as given.
export const spawnerRecord = (x, y, z, entityId = "Pig", extra = {}) => ({ ...extra, x, y, z, entityId });

// Put a spawner block and register its record with `spawners` (a MobSpawners from mob-spawner.js,
// or anything with add(record)). Returns whether the block was written.
export function placeSpawner(world, record, spawners, track = true) {
  const { x, y, z } = record;
  if (!world.set(x, y, z, MOB_SPAWNER, track, 0)) return false;
  spawners?.add?.(record);
  return true;
}

// BlockContainer.breakBlock removes the tile entity: when a spawner cell turns into anything
// else, its record is dropped from `spawners` (remove(x, y, z)). Chains world.onChange.
export function watchSpawnerBlocks(world, spawners) {
  const next = world.onChange;
  world.onChange = (x, y, z, old, now) => {
    next?.(x, y, z, old, now);
    if (old === MOB_SPAWNER && now !== MOB_SPAWNER) spawners?.remove?.(x, y, z);
  };
  return world;
}
