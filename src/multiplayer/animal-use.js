// Batch 61 (mpanimals): C02 UseEntity, interact, on the animals of the dedicated world. Wire: in `animUse` { mob (wire id), claim (the client's prediction handled it) }.
//
// Server (`serverAnimalUse`): EntityPlayer.interactWith runs the mob's interact and then the held item's itemInteractionForEntity. The rules are the single-player ones
// of EntityWorld (feed = EntityAnimal.interact, shear = EntitySheep.interact, mooshroomInteract = EntityMooshroom.interact, saddleUse = ItemSaddle, dye = ItemDye) and
// buckets.js milkCow (EntityCow.interact), called in the order player-edit-simulation.js uses. Riding a saddled pig is not done here (mpvehicles).
// Client (`predictAnimalUse`): the same click on the client's copy (the stand-in record of remote-mobs.js), drawn at once. The client does what the native client does:
// EntityPlayer.interactWith runs on both sides, and the server's answer is the slot message of the next tick; a prediction the server did not make is sent back by
// `animResend` (the server marks the held slot as unseen).
import { BREED_ITEM } from '../entities.js';
import { milkCow } from '../buckets.js';
import { mooshroomUse, useBowl, SHEARS } from '../mooshroom.js';
import { SADDLE } from '../pig-saddle.js';
import { makeStack } from '../inventory.js';
import { DYE } from '../world.js';

export const isCow = type => type === 'cow' || type === 'mooshroom';
export const ANIMAL_TYPES = new Set(['pig', 'cow', 'sheep', 'chicken', 'mooshroom']);
const SHEAR_SOUND = 'mob.sheep.shear';

// The server half. `mobs` is the EntityWorld, `p` the player record, `ctx.drop(stack)` throws an item at the player (a full inventory). Returns true when handled.
export function serverAnimalUse(mobs, p, e, ctx) {
  const s = p.survival, held = s.held, id = held?.id ?? 0;
  if (e.type === 'pig' && mobs.saddleUse?.(e, s)) return true;
  if (e.type === 'wolf' && mobs.wolfInteract?.(e, s)) return true; // only when mpmobtypes puts wolves on the server (SUPPORTED); status 6 / 7 are still to be wired (see the track note)
  if (e.type === 'ocelot' && mobs.ocelotInteract?.(e, s)) return true;
  if (e.type === 'mooshroom' && mobs.mooshroomInteract(e, s)) return true;
  if (mobs.shear(e, id, s)) return true;
  if (isCow(e.type) && e.health > 0 && mobs.entities.includes(e) && milkCow(s, { drop: st => ctx.drop(st) })) return true;
  if (mobs.feed(e, id, s)) { e.breeder = p.id; return true; } // EntityAnimal.func_146082_f(player): the breeder is credited with breedCow
  return mobs.dye(e, held, s);
}

// The client half, on the stand-in `mob` ({ type, growingAge, love, sheared, color, saddled, health }) and the client's Survival. Returns { handled, sound? }.
export function predictAnimalUse(mob, survival, { drop = () => {} } = {}) {
  if (!mob || mob.health <= 0 || !ANIMAL_TYPES.has(mob.type)) return { handled: false };
  const held = survival.held, id = held?.id ?? 0, adult = (mob.growingAge ?? 0) >= 0, creative = !!survival.creative;
  const spend = () => { if (!creative) survival.inventory.decr(survival.inventory.current, 1); };
  const wear = () => { if (!creative && survival.count(SHEARS)) survival.wear(SHEARS, 1); };
  if (mob.type === 'pig' && id === SADDLE) {
    if (!mob.saddled && adult) { mob.saddled = true; spend(); return { handled: true, sound: 'mob.horse.leather' }; }
    return { handled: true };
  }
  if (mob.type === 'mooshroom') {
    const use = mooshroomUse(id, mob.growingAge ?? 0);
    if (use === 'bowl') return { handled: useBowl(survival, makeStack) };
    if (use === 'shear') { wear(); return { handled: true, sound: SHEAR_SOUND }; }
  }
  if (mob.type === 'sheep' && id === SHEARS && !mob.sheared && adult && (creative || survival.count(id))) { mob.sheared = true; wear(); return { handled: true, sound: SHEAR_SOUND }; }
  if (isCow(mob.type) && milkCow(survival, { drop })) return { handled: true };
  if (BREED_ITEM[mob.type] === id && id && (held || survival.count(id)) && mob.growingAge === 0 && !(mob.love > 0)) {
    mob.love = 600;
    if (!creative) { if (held?.id === id) survival.inventory.decr(survival.inventory.current, 1); else survival.take(id); }
    return { handled: true };
  }
  if (mob.type === 'sheep' && held?.id === DYE) {
    const colour = ~held.damage & 15;
    if (!mob.sheared && mob.color !== colour) { mob.color = colour; spend(); }
    return { handled: true };
  }
  return { handled: false };
}
