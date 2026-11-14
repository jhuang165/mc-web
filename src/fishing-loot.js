// A fishing catch as a live stack. fishing.js rolls WeightedRandomFishable with native item ids (349:1 salmon, 346 rod ...); this build's items use their own ids
// (fishing-content.js 700-706, region-import.js itemFromOriginal for the rest), so a catch is mapped before it becomes an item entity. Enchantments and the random wear stay.
import { nativeStackToLive } from './anvil-container.js';
import { ITEMS } from './survival.js';

export function liveFishStack(stack) {
  const live = nativeStackToLive({ ...stack });
  if (!live) return null;
  if (stack.damage > 0 && ITEMS[live.id]?.durability) live.damage = stack.damage; // a damaged tool keeps its wear (the map only knows damage values of variants)
  return live;
}
