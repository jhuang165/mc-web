// Entity display names through the selected language. 1.7.10 getCommandSenderName is the custom name tag when one is set, else
// StatCollector.translateToLocal("entity." + EntityList name + ".name") (Entity.getCommandSenderName; EntityList names are the
// ones the spawn eggs use). A horse is "entity.horse.name" etc. by variant (horse-gear.js). Types without a lang key keep Title Case.
import { translate } from "./lang.js";

// Browser mob type -> EntityList string (the part between "entity." and ".name").
export const ENTITY_LANG = Object.freeze({
  pig: "Pig", cow: "Cow", mooshroom: "MushroomCow", snow_golem: "SnowMan", sheep: "Sheep", chicken: "Chicken", horse: "EntityHorse",
  wolf: "Wolf", ocelot: "Ozelot", zombie: "Zombie", spider: "Spider", cave_spider: "CaveSpider", skeleton: "Skeleton",
  wither_skeleton: "Skeleton", creeper: "Creeper", villager: "Villager", iron_golem: "VillagerGolem", enderman: "Enderman",
  silverfish: "Silverfish", giant: "Giant", witch: "Witch", slime: "Slime", magma_cube: "LavaSlime", pigman: "PigZombie",
  squid: "Squid", bat: "Bat", ender_dragon: "EnderDragon", blaze: "Blaze", ghast: "Ghast", wither: "WitherBoss",
});
const title = (type) => String(type).split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
/** English fallback while English is selected (and for keys the port's built-in table does not carry). */
const ENGLISH = Object.freeze({
  Pig: "Pig", Cow: "Cow", MushroomCow: "Mooshroom", SnowMan: "Snow Golem", Sheep: "Sheep", Chicken: "Chicken", EntityHorse: "Horse", Wolf: "Wolf",
  Ozelot: "Ocelot", Zombie: "Zombie", Spider: "Spider", CaveSpider: "Cave Spider", Skeleton: "Skeleton", Creeper: "Creeper", Villager: "Villager",
  VillagerGolem: "Iron Golem", Enderman: "Enderman", Silverfish: "Silverfish", Giant: "Giant", Witch: "Witch", Slime: "Slime", LavaSlime: "Magma Cube",
  PigZombie: "Zombie Pigman", Squid: "Squid", Bat: "Bat", EnderDragon: "Ender Dragon", Blaze: "Blaze", Ghast: "Ghast", WitherBoss: "Wither",
});
/** Entity.getCommandSenderName for a mob record or a bare type string: custom name first, then the translated entity name. */
export function entityDisplayName(entityOrType) {
  const e = typeof entityOrType === "object" && entityOrType ? entityOrType : null, type = e ? e.type : entityOrType;
  const custom = e && (e.customName ?? e.CustomName);
  if (typeof custom === "string" && custom) return custom;
  const key = ENTITY_LANG[type];
  return key ? translate(`entity.${key}.name`, ENGLISH[key]) : title(type ?? "");
}
