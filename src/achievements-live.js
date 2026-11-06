// Where the game triggers achievements (EntityPlayer.triggerAchievement call sites of 1.7.10), as small observers that
// main.js wires in: container slots, pickups, mob deaths and attacks, breeding, biomes, minecart rides, beacons and
// dimension changes. The unlock rules live in achievements.js; this file only maps game events to trigger ids.
import { ITEMS } from "./survival.js";
import { heldAttackDamage } from "./entities.js";
import { criticalDamage } from "./player-movement.js";
import { weaponEnchantments } from "./enchantment-effects.js";
import { OVERKILL_DAMAGE, SNIPE_DISTANCE_SQUARED, FLY_PIG_DISTANCE } from "./achievements.js";

// Ids of this build (original-items.js maps the 1.7.10 ones).
export const ITEM = Object.freeze({ craftingTable: 13, furnace: 14, bread: 201, bookshelf: 21, enchantingTable: 86, woodenPickaxe: 100, iron: 302, diamond: 303, leather: 315, blazeRod: 387, cake: 1930, cookedFish: 705, potion: 385 });
const LOGS = new Set([4, 70]);
// IMob (EntityMob, EntitySlime, EntityGhast, EntityDragon...) in this build's mob names.
export const IMOB = new Set(["zombie", "pigman", "skeleton", "wither_skeleton", "spider", "cave_spider", "creeper", "enderman", "silverfish", "witch", "blaze", "wither", "slime", "magma_cube", "ghast", "ender_dragon"]);
const COWS = new Set(["cow", "mooshroom"]);

// SlotCrafting.onCrafting (aax).
export function craftedAchievement(id) {
  const kind = ITEMS[id]?.kind;
  if (kind === "pickaxe") return id === ITEM.woodenPickaxe ? "buildPickaxe" : "buildBetterPickaxe";
  if (kind === "hoe") return "buildHoe";
  if (kind === "sword") return "buildSword";
  switch (id) {
    case ITEM.craftingTable: return "buildWorkBench";
    case ITEM.furnace: return "buildFurnace";
    case ITEM.bread: return "makeBread";
    case ITEM.cake: return "bakeCake";
    case ITEM.enchantingTable: return "enchantments";
    case ITEM.bookshelf: return "bookcase";
    default: return null;
  }
}
// SlotFurnace.onCrafting (aak).
export function smeltedAchievement(id) { return id === ITEM.iron ? "acquireIron" : id === ITEM.cookedFish ? "cookFish" : null; }
// EntityPlayer.onItemPickup (EntityItem.onCollideWithPlayer).
export function pickedAchievement(id) {
  if (LOGS.has(id)) return "mineWood";
  return id === ITEM.leather ? "killCow" : id === ITEM.diamond ? "diamonds" : id === ITEM.blazeRod ? "blazeRod" : null;
}

// Wraps mob events on an EntityWorld instance. `ctx`: { achievements, player() -> {x, z}, survival() }.
export function watchMobs(mobs, ctx) {
  const { achievements } = ctx;
  const death = mobs.onDeath, attack = mobs.attack, baby = mobs.spawnBaby;
  mobs.onDeath = function (e, source = {}) {
    const result = death.call(this, e, source);
    if (source.player) {
      if (IMOB.has(e.type)) achievements.trigger("killEnemy");
      if (e.type === "wither") achievements.trigger("killWither");
      if (e.type === "ghast" && source.name === "fireball") achievements.trigger("ghast");
      if ((e.type === "skeleton" || e.type === "wither_skeleton") && source.projectile) {
        const p = ctx.player();
        if ((p.x - e.x) ** 2 + (p.z - e.z) ** 2 >= SNIPE_DISTANCE_SQUARED) achievements.trigger("snipeSkeleton");
      }
    }
    return result;
  };
  mobs.attack = function (e, tool, survival, player, extraKnockback, critical, info) {
    const damage = overkillDamage(e, tool, survival, critical);
    const landed = attack.call(this, e, tool, survival, player, extraKnockback, critical, info);
    if (landed && damage >= OVERKILL_DAMAGE) achievements.trigger("overkill");
    return landed;
  };
  mobs.spawnBaby = function (a, b) {
    const born = baby.call(this, a, b);
    if (born && COWS.has(a.type)) achievements.trigger("breedCow");
    return born;
  };
}
// EntityPlayer.attackTargetEntityWithCurrentItem's damage after the critical multiplier and enchantments.
export function overkillDamage(e, tool, survival, critical) {
  const owned = survival.creative || survival.count(tool) > 0, held = owned && survival.held?.id === tool ? survival.held : null;
  let damage = heldAttackDamage(tool, survival);
  if (critical) damage = criticalDamage(damage);
  return Math.fround(damage + weaponEnchantments(held, e.type).damage);
}
// EntityPig.fall: more than five blocks with a player riding.
export const pigFall = (distance, ridden) => ridden && distance > FLY_PIG_DISTANCE;
