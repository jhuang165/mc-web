// Batch 61 (mpanimals): C02 UseEntity, interact, on the animals of the dedicated world. Wire: in `animUse` { mob (wire id), claim (the client's prediction handled it) }.
//
// Server (`serverAnimalUse`): EntityPlayer.interactWith runs the mob's interact and then the held item's itemInteractionForEntity. The rules are the single-player ones
// of EntityWorld (feed = EntityAnimal.interact, shear = EntitySheep.interact, mooshroomInteract = EntityMooshroom.interact, saddleUse = ItemSaddle, dye = ItemDye) and
// buckets.js milkCow (EntityCow.interact), called in the order player-edit-simulation.js uses. Riding a saddled pig is not done here (mpvehicles).
// Client (`predictAnimalUse`): the same click on the client's copy (the stand-in record of remote-mobs.js), drawn at once. The client does what the native client does:
// EntityPlayer.interactWith runs on both sides, and the server's answer is the slot message of the next tick; a prediction the server did not make is sent back by
// `animResend` (the server marks the held slot as unseen).
import { isBreedingItem } from '../entities.js';
import { milkCow } from '../buckets.js';
import { mooshroomUse, useBowl, SHEARS } from '../mooshroom.js';
import { SADDLE } from '../pig-saddle.js';
import { makeStack } from '../inventory.js';
import { DYE } from '../world.js';
import { ITEMS } from '../survival.js';
import { ITEM_SPAWN_EGG, eggOf } from '../spawn-eggs.js';
import { AGEABLE_EGG_TYPES, isAgeable } from '../entities.js';
import { originalId, NAME_TAG_ORIGINAL } from '../horse-gear.js';

export const isCow = type => type === 'cow' || type === 'mooshroom';
export const ANIMAL_TYPES = new Set(['pig', 'cow', 'sheep', 'chicken', 'mooshroom']);
const SHEAR_SOUND = 'mob.sheep.shear';

// The server half. `mobs` is the EntityWorld, `p` the player record, `ctx.drop(stack)` throws an item at the player (a full inventory). Returns true when handled.
export function serverAnimalUse(mobs, p, e, ctx) {
  const s = p.survival, held = s.held, id = held?.id ?? 0;
  if (ctx.extra?.first(e)) return true; // b75 mpusesweep75: flint and steel on a creeper, a spawn egg on an ageable mob (server-use-entity.js)
  if (ctx.lead?.(p, e)) return true; // b62: EntityLiving.interactFirst: the lead comes before the mob's own interact (server-leads.js)
  // b62: EntityPig.interact: the feed first, then a saddled pig takes the player (ItemSaddle only reaches a pig that did not).
  if (e.type === 'villager' && ctx.villager?.(p, e)) return true; // b66: the merchant window hook (mptrade fills sm.villagerUse)
  if (e.type === 'zombie' && e.villager && mobs.cure(e, id, s, held?.damage ?? 0)) return true; // b66: EntityZombie.interact, a golden apple on a weakened zombie villager
  if (e.type === 'pig' && e.saddled && ctx.ride) { if (mobs.feed(e, id, s)) { e.breeder = p.id; return true; } if (ctx.ride(p, e)) return true; }
  if (e.type === 'pig' && mobs.saddleUse?.(e, s)) return true;
  if (e.type === 'wolf' && mobs.wolfInteract?.(e, s)) return true; // only when mpmobtypes puts wolves on the server (SUPPORTED); status 6 / 7 are still to be wired (see the track note)
  if (e.type === 'ocelot' && mobs.ocelotInteract?.(e, s)) return true;
  if (e.type === 'mooshroom' && mobs.mooshroomInteract(e, s)) return true;
  if (ctx.extra?.later(e)) return true; // b75 mpusesweep75: horses and name tags (server-use-entity.js)
  if (mobs.shear(e, id, s)) return true;
  if (isCow(e.type) && e.health > 0 && mobs.entities.includes(e) && milkCow(s, { drop: st => ctx.drop(st) })) return true;
  if (mobs.feed(e, id, s)) { e.breeder = p.id; return true; } // EntityAnimal.func_146082_f(player): the breeder is credited with breedCow
  return mobs.dye(e, held, s);
}

// The client half, on the stand-in `mob` ({ type, growingAge, love, sheared, color, saddled, health }) and the client's Survival. Returns { handled, sound? }.
export function predictAnimalUse(mob, survival, { drop = () => {} } = {}) {
  const extra = predictEntityExtras(mob, survival);
  if (extra) return extra;
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
  if (id && isBreedingItem(mob.type, id) && (held || survival.count(id)) && mob.growingAge === 0 && !(mob.love > 0)) {
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

// b76 mpclicks76: the right clicks batch 75 put on the server (server-use-entity.js) for every mob kind, predicted on the client copy. Natively EntityPlayer.interactWith (yz.q, bytecode-read)
// runs `target.interactFirst` (sa.c) and then, for a living target, ItemStack.interactWithEntity (add.a) on BOTH sides (PlayerControllerMP.interactWithEntitySendPacket sends C02 and then calls it
// locally); Creative gets a copy of the held stack, so only a Survival stack shrinks or wears. The sound of a flint and steel is the server's (`except: null` reaches the clicker), so none here.
// Kinds whose own interact consumes the click first on the client too (an adult villager's trade window, a tamed wolf's or ocelot's sit) are left to the server; a wrong guess is put right by `animResend`.
const takesClickFirst = (mob) => (mob.type === 'villager' && (mob.growingAge ?? 0) >= 0) || ((mob.type === 'wolf' || mob.type === 'ocelot') && !!mob.owner); // EntityVillager.interact (adult), EntityTameable.interact (tamed)
function predictEntityExtras(mob, survival) {
  if (!mob || mob.health <= 0) return null;
  const held = survival.held, id = held?.id ?? 0;
  if (!id) return null;
  const creative = !!survival.creative, spend = () => { if (!creative) survival.inventory.decr(survival.inventory.current, 1); };
  if (mob.type === 'creeper' && ITEMS[id]?.kind === 'flint_and_steel') { mob.ignited = true; if (!creative) survival.wear(id); return { handled: true }; } // EntityCreeper.interact
  if (id === ITEM_SPAWN_EGG && isAgeable(mob.type)) { // EntityAgeable.interact: the click is consumed on any ageable mob (villager included); one egg goes only when its class fits; the baby is the server's spawn
    if (AGEABLE_EGG_TYPES[eggOf(held.damage)?.entity]?.includes(mob.type)) spend();
    return { handled: true };
  }
  if (originalId(held) === NAME_TAG_ORIGINAL && typeof held.displayName === 'string' && !takesClickFirst(mob)) { // ItemNameTag.itemInteractionForEntity
    mob.customName = held.displayName.slice(0, 64); mob.persistent = true; spend(); return { handled: true };
  }
  return null;
}
