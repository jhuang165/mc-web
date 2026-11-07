// The world side of village.js: what VillageCollection and Village read from and do to the EntityWorld
// (wc.A on the original World). Created lazily by EntityWorld.villages.
import { VillageCollection } from "./village.js";
import { WOODEN_DOOR, normalCube } from "./world.js";
import { JavaRandom } from "./lighting.js";

export const PLAYER_NAME = "Player";

// EntityVillager.setRevengeTarget's attacker as the village keeps it (VillageAggressor.agressor): the attacking mob's brain (the view the golem's
// target tasks use), or null when the damage had no living attacker entity (a projectile of the player is the player's, handled by the caller).
export function villageAttacker(ew, victim, attacker) {
  if (!attacker || typeof attacker !== "object" || attacker === victim || !ew.entities.includes(attacker) || !(attacker.health > 0)) return null;
  return ew.ai.brain(attacker);
}

export function createVillageHost(ew) {
  const world = ew.world;
  return {
    // Entity.isEntityAlive for an aggressor: the player, or a mob still in the world with health left.
    isAlive: (a) => (a.isPlayer ? !!a.alive : !!a.alive && ew.entities.includes(a.e)),
    // World.rand (the same Random that rolls the golem spawn).
    get rand() {
      return (ew.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)));
    },
    isWoodenDoor: (x, y, z) => world.get(x, y, z) === WOODEN_DOOR,
    // BlockDoor.func_150013_e & 3 reads the lower half's metadata; either half may be asked.
    doorFacing: (x, y, z) => {
      const m = world.getMeta(x, y, z);
      return ((m & 8) !== 0 ? world.getMeta(x, y - 1, z) : m) & 3;
    },
    canSeeSky: (x, y, z) => !!ew.ai.deps.canSeeSky(x, y, z),
    hasSolidTop: (x, y, z) => !!world.solid(x, y, z),
    isNormalCube: (x, y, z) => normalCube(world.get(x, y, z)),
    // World.getEntitiesWithinAABB(EntityVillager / EntityIronGolem, box).size()
    countEntities(kind, x0, y0, z0, x1, y1, z1) {
      const type = kind === "golem" ? "iron_golem" : "villager";
      let n = 0;
      for (const e of ew.entities) {
        if (e.type !== type || !(e.health > 0)) continue;
        const [w, h] = ew.size(e);
        if (e.x + w / 2 > x0 && e.x - w / 2 < x1 && e.y + h > y0 && e.y < y1 && e.z + w / 2 > z0 && e.z - w / 2 < z1) n++;
      }
      return n;
    },
    spawnGolem: (x, y, z) => ew.spawnIronGolem(x, y, z, false),
    // The one local player, by its fixed name (merchant-ui / villagerInteract use "Player").
    playerEntity: (name) => (name === PLAYER_NAME && ew.ai.player?.alive ? ew.ai.player : null),
  };
}
export const createVillages = (ew) => new VillageCollection(createVillageHost(ew));
