// Saddled pigs inside EntityWorld (entities.js): ItemSaddle on a pig (use and hit), EntityPig.interact's mount,
// ItemCarrotOnAStick's boost and the stick wear of EntityAIControlledByPlayer. The rules are in pig-saddle.js
// (replayed against public/research/pig-saddle-reference.json); ai.js runs the steering task, horse-live.js the seat.
import * as P from "./pig-saddle.js";
import { copyStack } from "./inventory.js";
import { entityRandom } from "./entities.js";

const alive = (mobs, e) => e && e.health > 0 && mobs.entities.includes(e);

// ub.e and abp.a: a stick used up becomes `new ItemStack(Items.fishing_rod)` carrying the old stack's tag.
export function rodFrom(old) {
  const rod = { ...copyStack(old), id: P.FISHING_ROD, count: 1, damage: 0 };
  return rod;
}

// ItemStack.damageItem(amount, player) on the held carrot on a stick; a broken one is replaced by the fishing rod.
// Returns true when the stick broke (survival.broken then names it, as for every broken tool).
export function wearStick(survival, amount) {
  const inv = survival?.inventory, s = inv?.held;
  if (!s || s.id !== P.CARROT_ON_A_STICK) return false;
  const old = copyStack(s);
  if (!inv.damage(inv.current, amount)) return false;
  inv.main[inv.current] = rodFrom(old);
  survival.broken = P.CARROT_ON_A_STICK;
  return true;
}

export function installPigSaddle(EntityWorld) {
  const proto = EntityWorld.prototype;
  proto.wearStick = function (survival, amount) {
    const broke = wearStick(survival, amount);
    this.stickWorn = true; // main.js redraws the hotbar
    return broke;
  };
  const saddle = function (e, survival, hit) {
    const out = (hit ? P.saddleHit : P.saddleUse)({ pig: e.type === "pig", saddled: !!e.saddled, child: (e.growingAge ?? 0) < 0 });
    if (!out.result) return false;
    if (out.saddle) {
      e.saddled = true;
      this.events.push({ sound: out.sound.name, volume: out.sound.volume, pitch: out.sound.pitch, position: { x: e.x, y: e.y, z: e.z } });
      // itemInteractionForEntity works on a copy in Creative; hitEntity on the real stack, so a hit uses it up there too.
      if (hit || !survival.creative) survival.inventory.decr(survival.inventory.current, 1);
    }
    return true;
  };
  // ItemSaddle.itemInteractionForEntity (EntityPlayer.interactWith, after interactFirst): true for any pig.
  proto.saddleUse = function (e, survival) {
    if (!alive(this, e) || survival.held?.id !== P.SADDLE) return false;
    return saddle.call(this, e, survival, false);
  };
  // ItemSaddle.hitEntity from attackTargetEntityWithCurrentItem, once the attack has landed.
  proto.saddleHit = function (e, survival) {
    if (!e || survival.held?.id !== P.SADDLE) return false;
    return saddle.call(this, e, survival, true);
  };
  // EntityPig.interact after EntityAnimal.interact declined: a saddled pig with a free seat mounts the player.
  proto.pigMount = function (e, seats) {
    if (!alive(this, e) || e.type !== "pig" || !seats?.player) return false;
    const rider = seats.player;
    if (!P.pigMounts({ saddled: !!e.saddled, riderFree: !e.rider, riderIsPlayer: e.rider === rider })) return false;
    if (e.rider !== rider && !rider.vehicle) seats.mount(e, rider);
    return true;
  };
  // ItemCarrotOnAStick.onItemRightClick: riding a pig the player controls (ub.h) with 7 durability to spare boosts it
  // (ub.g on the pig's Random) and damages the stick by 7. Returns whether the stick was used.
  proto.stickUse = function (survival, rider) {
    const s = survival.held, pig = rider?.vehicle?.entity;
    if (s?.id !== P.CARROT_ON_A_STICK) return false;
    const ridingPig = !!pig && pig.type === "pig" && alive(this, pig);
    const control = ridingPig ? this.ai.brain(pig).control : null;
    const out = P.stickUse({ ridingPig: !!control, controlled: !!control && P.controlledByPlayer(control.t), damage: s.damage ?? 0 });
    if (!out.boost) return false;
    P.controlBoost(control.t, entityRandom(pig));
    wearStick(survival, out.cost);
    return true;
  };
}
