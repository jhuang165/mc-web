// Batch 75 mpusesweep75: right clicks on mobs that the dedicated server's animal-use.js did not cover. A sweep of every item id (damages 0-5, 8, 15, spawn egg damages)
// against every mob kind (tools/sweep-use75.mjs, ServerMobs.interact against applyPlayerEdit on identical fixtures) found four gaps; each calls the single-player module:
//   * a name tag with a display name (EntityWorld.nameTagUse = ItemNameTag.itemInteractionForEntity), on every living mob;
//   * a spawn egg on an ageable mob (EntityWorld.spawnEggBaby = EntityAgeable.interact: the click is consumed, the baby spawns, a villager does not open its trade window);
//   * flint and steel on a creeper (creeper.js creeperIgnite, EntityCreeper.interact: the fuse is lit, the tool is worn, fire.ignite sounds);
//   * horses, donkeys and mules (EntityWorld.horseInteract = EntityHorse.interact: feeding, the chest on a donkey or mule, saddle and armour, rearing of a wild horse).
// Not done (too large, see the track note): mounting a horse (steering, the jump wire), the horse inventory window.
import { ITEMS } from '../survival.js';
import { ITEM_SPAWN_EGG, eggOf } from '../spawn-eggs.js';
import { isAgeable, entityRandom } from '../entities.js';
import { creeperIgnite } from '../creeper.js';

// `host`: the DedicatedSimulation, `p`: the clicking player. `mobs`: this dimension's EntityWorld. Each hook returns true when it handled the click.
export function entityUseHooks(host, mobs, p) {
  const s = p.survival;
  const at = (name, volume, pitch, pos) => host.soundsOut.push({ name, ...pos, volume, pitch, except: null, dim: p.dimension | 0 });
  return {
    // Before the lead and the mob's own interact: the two item cases that precede or replace them.
    first(e) {
      const id = s.held?.id ?? 0;
      // EntityCreeper.interact (flint and steel): single-player applyPlayerEdit ignite-creeper
      if (e.type === 'creeper' && e.health > 0 && ITEMS[id]?.kind === 'flint_and_steel') {
        const ignite = creeperIgnite(e, entityRandom(e));
        at(ignite.name, ignite.volume, ignite.pitch, ignite.position);
        if (!s.creative) s.wear(id);
        return true;
      }
      // EntityAgeable.interact: a spawn egg never reaches the mob's own interact (no trade, no feeding)
      if (id === ITEM_SPAWN_EGG && isAgeable(e.type)) {
        const baby = mobs.spawnEggBaby?.(e, s, eggOf(s.held?.damage));
        if (baby && typeof baby === 'object') baby.summonKeep = true; // the tick's cull keeps it (native ItemMonsterPlacer ignores the natural cap)
        return true;
      }
      return false;
    },
    // After the mob's own species interact and before shears / feeding / dyes: EntityHorse.interact, then ItemNameTag.
    later(e) {
      if (e.type === 'horse' && mobs.horseInteract(e, s, { sneak: !!p.input?.sneak })) return true;
      return !!mobs.nameTagUse?.(e, s);
    },
  };
}
