// b77 spcauldron77: which clicked blocks swallow the held item's right-click in single player.
// Minecraft.rightClickMouse clears its use flag when PlayerControllerMP.onPlayerRightClick returns true, and that is true when the
// CLIENT-world Block.onBlockActivated returned true (sneaking with an item skips onBlockActivated: `!sneaking || heldItem == null`).
// The client world is remote, so every block whose onBlockActivated begins `if (world.isRemote) return true` consumes any click.
// A swallowed click still lets the server run ItemStack.tryPlaceItemIntoWorld (onItemUse: blocks, hoes, seeds, fire) when the
// server-side activation declined; only ItemStack.useItemRightClick (bucket, potion, food, bow, rod, ...) is skipped.
//
// Bytecode-read (javap -c -p, onBlockActivated `a(ahb,int,int,int,yz,int,float,float,float)Z` in every Block subclass of the 1.7.10 jar).
// obf class -> block, and what the CLIENT world gets back:
//   always true: ajb anvil, ajg beacon, ajh bed, ajq brewing stand, ajs button (stone, wooden), aju cake, ajw cauldron (remote check,
//   then even an empty hand), ajx chest and trapped chest, akb command block, akc comparator, ake workbench, akm dispenser and dropper,
//   akn door (wood and iron), akp dragon egg, aks enchanting table, akv ender chest, akz fence (wood and nether brick: remote check),
//   ala fence gate, ale furnace, aln hopper, alv lever, amj note block, anf repeater, aoe trapdoor (wood and iron).
//   conditional: alq jukebox (false with metadata 0), ald flower pot (true only when a held plant is accepted), aob TNT (true only
//   with flint and steel; fire charge does not count), apr piston moving (true when its tile is gone).
//   false: aji (the default), amz redstone ore (sparkles, then false), app piston base, ans stairs (the base block's answer, false).
import { CAULDRON, FLOWER_POT, FENCE } from './world.js';
import { NETHER_FENCE } from './nether-blocks.js';
import { WOODEN_BUTTON, COMPARATOR, COMPARATOR_POWERED } from './redstone-blocks-2.js';

// Blocks the port's dispatcher does not already list in STATIONS and that answer true unconditionally.
export const CLIENT_ALWAYS_EXTRA = new Set([CAULDRON, FENCE, NETHER_FENCE, WOODEN_BUTTON, COMPARATOR, COMPARATOR_POWERED]);
export const JUKEBOX_BLOCK = 178;

// True when the clicked block's onBlockActivated answers true for the client (the held item's own right-click is then skipped).
// `stations` is the dispatcher's own always-true set; `loaded` tells whether a jukebox holds a record.
export function swallowsItemUse(block, stations, loaded) {
  if (block === JUKEBOX_BLOCK) return !!loaded;
  return stations.has(block) || CLIENT_ALWAYS_EXTRA.has(block);
}
