// Batch 75 mpusesweep75: item uses that the dedicated server's edit path did not reach (sweep: every item id right-clicked in the air and on a block, tools/sweep-use75.mjs).
// Each calls the single-player module with the server's own ray:
//   * armour (ItemArmor.onItemRightClick): the piece moves into its empty armour slot (player-edit-simulation.js equip-armor; Creative keeps it in hand, b87);
//   * a glass bottle on water (ItemGlassBottle.onItemRightClick, potion-use.js useGlassBottle): a water bottle; spawn protection refuses it (Adventure does not: canPlayerEdit is true with a stack in hand, b78);
//   * a spawn egg aimed at water (ItemMonsterPlacer.onItemRightClick, spawn-egg-use.js useEggOnWater);
//   * a firework rocket on a block (ItemFirework.onItemUse, fireworks-live.js useFirework): the dimension's rockets launch it.
// `eye` and `dir` are the ray edit() already built. `target` is the solid-block hit or null. Returns true when the click was used.
import { ITEMS } from '../survival.js';
import { copyStack } from '../inventory.js';
import { ITEM_GLASS_BOTTLE, useGlassBottle } from '../potion-use.js';
import { ITEM_SPAWN_EGG } from '../spawn-eggs.js';
import { useEggOnWater } from '../spawn-egg-use.js';
import { ITEM_FIREWORK_ROCKET } from '../fireworks.js';
import { useFirework } from '../fireworks-live.js';
import { traceBucket } from '../buckets.js';
import { blockProtected } from './server-properties.js';
import { LILY_PAD } from '../world.js';
import { useLilyPad } from '../lily-use.js';

export function airUse(sim, p, eye, dir, target) {
  const s = p.survival, held = s.held, id = held?.id ?? 0, item = ITEMS[id];
  if (!id || p.dead || s.health <= 0) return false;
  if (item?.armor !== undefined) { // the slot is 39 - armour type: helmet 0 .. boots 3
    const inv = s.inventory, slot = 39 - item.armor;
    if (inv.getStack(slot)) return true; // mx.a: the same stack at the same size and damage is "not used": nothing changes and nothing is resent (the click still ends here)
    inv.setStack(slot, copyStack(inv.held));
    // b87 ride87: tryUseItem (mx.a, bytecode-read) restores the size in Creative (mx.d()), so the piece is worn and also stays in the hand; then, the player not using
    // an item, sendContainerToPlayer (mw.a(zs): S30 of the whole window) puts it back on the client, whose own sendUseItem had emptied the slot (client-item-use.js).
    if (!s.creative) inv.main[inv.current] = null;
    const window = sim.serverItems?.inv;
    if (window?.win) { window.win(p); window.resend(p); }
    return true;
  }
  if (id === ITEM_GLASS_BOTTLE || (id === ITEM_SPAWN_EGG && !target)) { // an egg aimed at a block was ItemMonsterPlacer.onItemUse (true whatever happened): server-use.js
    const origin = [eye.x, eye.y, eye.z], vec = [dir.x, dir.y, dir.z], hit = traceBucket(sim.world, origin, vec, true);
    if (!hit) return false;
    if (blockProtected(sim, p, hit.block)) return false;
    const bucket = { ray: { origin, dir: vec }, liquid: true, hit: null };
    if (id === ITEM_GLASS_BOTTLE) return useGlassBottle({ world: sim.world, survival: s, items: sim.items, position: p.position, yaw: p.yaw, pitch: p.pitch }, bucket).branch === 'fill-bottle';
    return useEggOnWater({ world: sim.world, survival: s, mobs: sim.mobs?.mobs }, bucket, { mobSpawned: e => { e.summonKeep = true; } });
  }
  if (id === LILY_PAD && !target) return !!useLilyPad(sim.world, s, [eye.x, eye.y, eye.z], [dir.x, dir.y, dir.z], b => !blockProtected(sim, p, b)); // b84 mpplace84: ItemLilyPad.onItemRightClick (C08 255)
  if (id === ITEM_FIREWORK_ROCKET && target) {
    const rockets = sim.dispense?.laneFor?.(p.dimension | 0)?.rockets;
    if (!rockets || !useFirework({ rockets, survival: s }, { target, usesBlock: false })) return false;
    return sim.stats.used(p, id), true;
  }
  return false;
}
