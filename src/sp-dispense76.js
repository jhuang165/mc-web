// b76 spdispense76: the single-player glue of the dispenser's world effects (dispense.js engine, main.js host).
//   * equipArmor: ItemArmor's dispense behaviour (abc, bytecode-read): the first living entity in the front cell block whose armour slot is empty (selector sp: alive, an
//     EntityLivingBase, getEquipmentInSlot(position) == null, an EntityLiving only when canPickUpLoot, a player always, Creative included) gets one copy of the piece.
//   * replaceableCell: ItemBucket.tryPlaceContainedLiquid's `!material.isSolid()` test (executed: SpDispense76Probe, public/research/sp-dispense76-reference.json).
//   * netherFizz: world.playSoundEffect(x + 0.5, y + 0.5, z + 0.5, "random.fizz", 0.5, 2.6 + (r - r) * 0.8) of the Nether branch; the 8 largesmoke calls are World.spawnParticle
//     on the integrated server's WorldServer, which draws nothing, so a dispenser's Nether water is a sound only.
import { fromLiveStack } from "./mob-equipment-live.js";
import { toOriginal } from "./block-registry.js";
import { GenWorld } from "./gen-world.js";
import { orderTargets } from "./candidate-order.js";

const f = Math.fround;
// The native Material of the cell (gen-world.js' per-original-id table; a web, a sign and glass are solid, a ladder, torch, carpet and snow layer are not), executed against the probe.
export function replaceableCell(world, x, y, z) {
  const id = world.get(x, y, z);
  if (!id) return true;
  const original = toOriginal(id, world.getMeta(x, y, z));
  return original ? !GenWorld.prototype.isSolid(original[0]) : !world.solid(x, y, z);
}

export function netherFizz(play, x, y, z, random = Math.random) {
  play("random.fizz", x + 0.5, y + 0.5, z + 0.5, f(0.5), f(f(2.6) + f(f(f(random()) - f(random())) * f(0.8))));
}

// b78 loot78: the mob half of ItemArmor's selector and of the dressing, shared with the server (multiplayer/server-dispense.js). `mobCandidate` is the selector inside the entity query (alive, canPickUpLoot,
// the slot empty, the box touching the cell); `dressMob` is sv.c(position, copy) + sw.a(position, 2.0F) once the first candidate in the native list order is known.
export function mobCandidate(e, [i, j, k], position, size) {
  if (!e.canPickUpLoot || !(e.health > 0) || e.equipment?.[position]) return null;
  const [w, h] = size(e), hw = w / 2;
  if (!(e.x + hw > i && e.x - hw < i + 1 && e.y + h > j && e.y < j + 1 && e.z + hw > k && e.z - hw < k + 1)) return null;
  return { ref: e, box: [e.x - hw, e.y, e.z - hw, e.x + hw, e.y + h, e.z + hw] };
}
export function dressMob(e, stack, position) {
  const native = fromLiveStack({ ...stack, count: 1 });
  if (!native) return false; // no native id for the piece (the port lists none); the first entity is the one chosen natively, so no later one is tried
  e.equipment ??= [null, null, null, null, null];
  e.dropChances ??= Array(5).fill(f(0.085));
  e.equipment[position] = native;
  e.dropChances[position] = 2; // sw.a(position, 2.0F)
  return true;
}

// `position` is 4 - armorType (4 helmet .. 1 boots); a player's armour array is boots first (index position - 1), a mob's `equipment` is [hand, boots, legs, chest, helmet].
// b77 spdispense77: the selector (sp, bytecode-read) runs inside World.getEntitiesWithinAABB, so only qualifying entities are listed and the FIRST in the native list order
// (chunk x, chunk z, vertical slice, insertion: candidate-order.js) wins; before, the player always went first and the mobs came in the port's own list order. A mob qualifies
// with canPickUpLoot whatever its type (any EntityLiving has an equipment array): a mob type without gear storage gets an empty one the moment it is dressed.
export function equipArmor({ player, survival, mobs, size }, [i, j, k], stack, position) {
  const cands = [];
  if (player && survival.health > 0 && !survival.inventory.armor[position - 1]) {
    const q = player.position, hw = f(player.width / 2);
    if (q.x + hw > i && q.x - hw < i + 1 && q.y + player.height > j && q.y < j + 1 && q.z + hw > k && q.z - hw < k + 1)
      cands.push({ ref: "player", player: true, box: [q.x - hw, q.y, q.z - hw, q.x + hw, q.y + player.height, q.z + hw] });
  }
  const all = [...(player ? [{ ref: "player", player: true, box: [player.position.x, player.position.y, player.position.z, player.position.x, player.position.y, player.position.z] }] : []), ...(mobs?.entities ?? []).map((e) => ({ ref: e, box: [e.x, e.y, e.z, e.x, e.y, e.z] }))];
  for (const e of mobs?.entities ?? []) { const c = mobCandidate(e, [i, j, k], position, size); if (c) cands.push(c); }
  for (const c of orderTargets(cands, all)) {
    if (c.player) {
      survival.inventory.armor[position - 1] = { ...stack, count: 1 };
      return true;
    }
    return dressMob(c.ref, stack, position);
  }
  return false;
}
