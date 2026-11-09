import { ENTITY_TYPES } from './entities.js';
import { powerCreeper } from './creeper.js';
import { entityBox, overlaps, strikeBox, struckByLightning } from './weather.js';

// The authoritative part of the existing weather step. Client rain particles
// and sound draining remain with the caller and must run after this function.
export function tickWeatherSimulation({ world, weather, mobs, survival }, player, width, height) {
  weather.tick(world, player);
  for (const bolt of weather.struck) strikeEntities(bolt, mobs, [{ survival, position: player, width, height }]);
}
// EntityLightningBolt.onUpdate's entity pass for one flashing bolt: the mobs and every player (`players`: { survival, position,
// width, height }) in its box are struck (Entity.onStruckByLightning).
export function strikeEntities(bolt, mobs, players) {
  const box = strikeBox(bolt);
  for (const e of [...(mobs?.entities || [])]) {
    const type = ENTITY_TYPES[e.type];
    if (!type || e.health <= 0 || !overlaps(entityBox(e, type.width, type.height), box)) continue;
    if (e.type === 'pig' && mobs.pigStruck) { mobs.pigStruck(e); continue; } // EntityPig.onStruckByLightning: a zombie pigman, no damage
    const hit = struckByLightning(e.fire || 0);
    mobs.hazard(e, hit.damage, 'inFire');
    e.fire = hit.fire;
    if (e.type === 'creeper') powerCreeper(e);
  }
  for (const { survival, position, width, height } of players) {
    if (!survival.creative && survival.health > 0 && overlaps(entityBox(position, width, height), box)) {
      const hit = struckByLightning(survival.fire || 0);
      survival.damage(hit.damage, 'lightning', true);
      survival.fire = hit.fire;
    }
  }
}
