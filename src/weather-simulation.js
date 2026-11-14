import { ENTITY_TYPES } from './entities.js';
import { powerCreeper } from './creeper.js';
import { entityBox, overlaps, strikeBox, struckByLightning } from './weather.js';

// Entity.onStruckByLightning for every mob in the bolt's box (also run by the dedicated server, server-lightning.js).
export function strikeMobs(mobs, bolt) {
  const box = strikeBox(bolt);
  for (const e of [...(mobs?.entities || [])]) {
    const type = ENTITY_TYPES[e.type];
    if (!type || e.health <= 0 || !overlaps(entityBox(e, type.width, type.height), box)) continue;
    if (e.type === 'pig' && mobs.pigStruck) { mobs.pigStruck(e); continue; } // EntityPig.onStruckByLightning: a zombie pigman, no damage
    const hit = struckByLightning(e.fire || 0, e.equipment ?? []);
    mobs.hazard(e, hit.damage, 'inFire');
    e.fire = hit.fire;
    if (e.type === 'creeper') powerCreeper(e);
  }
}

// The authoritative part of the existing weather step. Client rain particles
// and sound draining remain with the caller and must run after this function.
export function tickWeatherSimulation({ world, weather, mobs, survival }, player, width, height) {
  weather.tick(world, player);
  for (const bolt of weather.struck) {
    const box = strikeBox(bolt);
    strikeMobs(mobs, bolt);
    if (!survival.creative && survival.health > 0 && overlaps(entityBox(player, width, height), box)) {
      const hit = struckByLightning(survival.fire || 0, survival.inventory?.armor ?? []);
      survival.damage(hit.damage, 'lightning', true);
      survival.fire = hit.fire;
    }
  }
}
