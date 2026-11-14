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

// Entity.onStruckByLightning for everything else in the bolt's box (also run by the dedicated server). Bytecode-read (javap over the 1.7.10 jar): the base method is dealFireDamage(5) (sa.f:
// attackEntityFrom(DamageSource.inFire, 5) unless fire-immune), then ++fire and setFire(8) at 0. A minecart (xl.a(ro, float)) and a boat (xi.a(ro, float)) add 10 x amount to their damage and
// break above 40, so one strike (50) breaks them; the source is inFire, so a TNT cart explodes (EntityMinecartTNT.killMinecart: isFireDamage) and nobody is Creative. A thrown ball
// (EntityThrowable zk) and a fireball (ze: returns false when the source has no entity) take no damage; an arrow has no override, so it only gets the fire counter. Paintings and frames
// (ss.a / st.a) break (a frame drops its item first). Items and experience orbs are hurt 5 (health 5).
export function strikeThings({ items, orbs, minecarts, boats, hanging, arrows }, bolt) {
  const box = strikeBox(bolt);
  if (items) for (const e of items.items) if (!e.dead && overlaps(items.box(e), box)) items.hurt(e, 5);
  if (orbs) for (const o of orbs.orbs) if (!o.dead && overlaps([o.x - 0.25, o.posY - 0.25, o.z - 0.25, o.x + 0.25, o.posY + 0.25, o.z + 0.25], box)) orbs.hurt(o, 'inFire', 5);
  if (minecarts) for (const c of [...minecarts.carts]) if (!c.dead && c.bb && overlaps(c.bb, box)) minecarts.attack(c, 5, { source: 'inFire' });
  if (boats) for (const b of [...boats.carts]) if (!b.dead && b.bb && overlaps(b.bb, box)) boats.attack(b, 5);
  if (hanging) for (const e of [...hanging.entities]) if (!e.dead && e.bb && overlaps(e.bb, box)) hanging.attack(e);
  if (arrows) for (const a of arrows.list) if (!a.dead && overlaps([a.x - 0.25, a.y, a.z - 0.25, a.x + 0.25, a.y + 0.5, a.z + 0.25], box)) a.fire = struckByLightning(a.fire || 0).fire;
}

// The authoritative part of the existing weather step. Client rain particles
// and sound draining remain with the caller and must run after this function.
export function tickWeatherSimulation({ world, weather, mobs, survival, things }, player, width, height) {
  weather.tick(world, player);
  for (const bolt of weather.struck) {
    const box = strikeBox(bolt);
    strikeMobs(mobs, bolt);
    if (things) strikeThings(things(), bolt);
    if (!survival.creative && survival.health > 0 && overlaps(entityBox(player, width, height), box)) {
      const hit = struckByLightning(survival.fire || 0, survival.inventory?.armor ?? []);
      survival.damage(hit.damage, 'lightning', true);
      survival.fire = hit.fire;
    }
  }
}
