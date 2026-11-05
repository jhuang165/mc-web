// /summon FireworksRocketEntity {Life, LifeTime, FireworksItem, Motion}: the unchanged zf(World) constructor followed
// by Entity.readFromNBT and EntityFireworkRocket.readEntityFromNBT (zf.a(dh)). The default constructor leaves
// life = lifetime = 0 and no motion (the random lifetime and the 0.05 climb belong to the stack constructor), so a
// bare summon explodes on its first tick. FireworksItem is loaded as any item stack; a null result keeps the data
// watcher's default (no item). Evidence: public/research/polish.md, polish-reference.json (fireworkNbt records).
import { NBT } from './nbt.js';
import { nbtGet } from './nbt-get.js';
import { itemStackFromNbt } from './region-import.js';
import { createRocket } from './firework-rocket.js';

export const FIREWORK_SUMMON = 'firework_rocket';

export function summonFireworkRocket(rockets, x, y, z, tag) {
  const ignored = [];
  const r = createRocket(x, y, z, null, { nextGaussian: () => 0, nextInt: () => 0 });
  r.lifetime = 0; r.life = 0; r.mx = 0; r.my = 0; r.mz = 0;
  if (tag instanceof Map) {
    r.life = nbtGet(tag, 'Life', NBT.INT, 0);
    r.lifetime = nbtGet(tag, 'LifeTime', NBT.INT, 0);
    const motion = nbtGet(tag, 'Motion', NBT.LIST);
    if (motion?.elementType === NBT.DOUBLE) [r.mx, r.my, r.mz] = [0, 1, 2].map((i) => (Number.isFinite(motion.items[i]) && Math.abs(motion.items[i]) <= 10 ? motion.items[i] : 0));
    const item = nbtGet(tag, 'FireworksItem', NBT.COMPOUND);
    const stack = item ? itemStackFromNbt(item, { ignored }) : null;
    if (stack) r.stack = stack;
  }
  rockets.rockets.push(r);
  return { ignored };
}
