// Batch 73 mpblocks73: item uses that change blocks in single player (player-edit-simulation.js) and that the dedicated server's place path did not run:
//   * ItemBed.onItemUse (bed.js placeBed: top face only, both cells air over solid tops, facing from the yaw, foot and head halves);
//   * ItemReed.onItemUse for the cake item (stems-cake.js cakePlacement: the clicked cell or the cell on the face, replaceable, a solid block below);
//   * ItemHoe.func_150857_a (Farming.till: grass or dirt with air above, never from below, one point of wear, the block's step sound).
// Each calls the single-player module (nothing is copied). Returns true when the click was the item's, so the caller's use statistic follows.
// The cell changes go out with the world's edits (block changes, per-player under chunk streaming); a bed's two halves are two edits.
import { CAKE, ITEM_CAKE, cakePlacement } from '../stems-cake.js';
import { ITEM_BED, placeBed } from '../bed.js';
import { doorReplaceable } from '../doors-panes.js';
import { ITEMS } from '../survival.js';
import { hoeSound } from '../block-sounds.js';

const FARMLAND = 29; // farming.js till(): internal dry farmland

export function placeBlockItem(sim, p, target, id) {
  const s = p.survival, w = sim.world;
  if (id === ITEM_BED) {
    // placeBed reads state.yaw (camera radians) and takes the item; farming.observe registers the foot cell.
    const put = placeBed({ world: w, survival: s, yaw: p.yaw, farming: sim.farming }, { id, target });
    if (put.placed) sim.golems?.afterPlace?.(put);
    return put.placed;
  }
  if (id === ITEM_CAKE) {
    const cell = cakePlacement(w, target, doorReplaceable);
    // ItemReed refuses a size-0 stack in either mode (attributes2-reference.json use, cake).
    if (!cell || (!s.creative && !s.usable(id)) || (s.held?.id === id && s.held.count === 0) || s.adventure) return false;
    w.set(cell[0], cell[1], cell[2], CAKE, true, 0);
    if (!s.creative) s.take(id);
    return true;
  }
  if (ITEMS[id]?.kind === 'hoe') {
    const [x, y, z] = target.block;
    if (s.adventure || (!s.creative && !s.usable(id))) return false;
    if (target.adjacent?.[1] !== y - 1 && sim.farming.till(x, y, z)) {
      s.wear(id);
      sim.farming.drain();
      const snd = hoeSound(FARMLAND);
      sim.soundsOut.push({ name: snd.name, x: x + 0.5, y: y + 0.5, z: z + 0.5, volume: snd.volume, pitch: snd.pitch, except: null, dim: p.dimension | 0 });
    }
    return true;
  }
  return false;
}
