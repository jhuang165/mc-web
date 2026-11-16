// b76 spdispense76: the single-player glue of the dispenser's world effects (dispense.js engine, main.js host).
//   * equipArmor: ItemArmor's dispense behaviour (abc, bytecode-read): the first living entity in the front cell block whose armour slot is empty (selector sp: alive, an
//     EntityLivingBase, getEquipmentInSlot(position) == null, an EntityLiving only when canPickUpLoot, a player always, Creative included) gets one copy of the piece.
//   * replaceableCell: ItemBucket.tryPlaceContainedLiquid's `!material.isSolid()` test (executed: SpDispense76Probe, public/research/sp-dispense76-reference.json).
//   * netherFizz: world.playSoundEffect(x + 0.5, y + 0.5, z + 0.5, "random.fizz", 0.5, 2.6 + (r - r) * 0.8) of the Nether branch; the 8 largesmoke calls are World.spawnParticle
//     on the integrated server's WorldServer, which draws nothing, so a dispenser's Nether water is a sound only.
import { fromLiveStack } from "./mob-equipment-live.js";
import { toOriginal } from "./block-registry.js";
import { GenWorld } from "./gen-world.js";

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

// `position` is 4 - armorType (4 helmet .. 1 boots); a player's armour array is boots first (index position - 1), a mob's `equipment` is [hand, boots, legs, chest, helmet].
export function equipArmor({ player, survival, mobs, size }, [i, j, k], stack, position) {
  if (player && survival.health > 0) {
    const q = player.position, hw = f(player.width / 2);
    if (q.x + hw > i && q.x - hw < i + 1 && q.y + player.height > j && q.y < j + 1 && q.z + hw > k && q.z - hw < k + 1 && !survival.inventory.armor[position - 1]) {
      survival.inventory.armor[position - 1] = { ...stack, count: 1 };
      return true;
    }
  }
  for (const e of mobs?.entities ?? []) {
    if (!e.canPickUpLoot || !(e.health > 0) || !e.equipment || e.equipment[position]) continue;
    const [w, h] = size(e), hw = w / 2;
    if (!(e.x + hw > i && e.x - hw < i + 1 && e.y + h > j && e.y < j + 1 && e.z + hw > k && e.z - hw < k + 1)) continue;
    const native = fromLiveStack({ ...stack, count: 1 });
    if (!native) continue;
    e.equipment[position] = native;
    if (e.dropChances) e.dropChances[position] = 2; // sw.a(position, 2.0F)
    return true;
  }
  return false;
}
