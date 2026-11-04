// Adventure mode (WorldSettings.GameType.ADVENTURE, game type 2) of 1.7.10: survival with PlayerCapabilities.allowEdit
// false. Its one effect is EntityPlayer.isCurrentToolAdventureModeExempt, which the block hit and break paths consult
// (PlayerControllerMP.clickBlock / onPlayerDestroyBlock, ItemInWorldManager.onBlockClicked / tryHarvestBlock, and the hit
// particles and swing of Minecraft.sendClickBlockToController). canPlayerEdit stays true with any item in hand
// (Item.canItemEditBlocks is true for every 1.7.10 item), so placing and using items work as in survival; the
// CanDestroy/CanPlaceOn tags are 1.8. Evidence: public/research/adventure-reference.json (tools/verify-adventure.mjs).
import { EXEMPT_MATERIAL_BLOCKS, TOOL_BLOCKS } from "./adventure-data.js";
import { toOriginal } from "./block-registry.js";
import { originalOfLive } from "./item-names.js";

const EXEMPT = new Set(EXEMPT_MATERIAL_BLOCKS);
const BY_TOOL = new Map(Object.entries(TOOL_BLOCKS).map(([item, blocks]) => [Number(item), new Set(blocks)]));

// isCurrentToolAdventureModeExempt for an adventure player (allowEdit false): an internal block cell and the held
// browser item id (0 or null for the empty hand). Air is never exempt.
export function adventureExempt(block, meta = 0, held = 0, state = {}) {
  const original = block ? toOriginal(block, meta, state)?.[0] : 0;
  if (!original) return false;
  if (EXEMPT.has(original)) return true;
  const item = held ? originalOfLive(held)?.id : null;
  return item != null && !!BY_TOOL.get(item)?.has(original);
}

// The gate as the callers use it: true when the player may hit/break the block (every mode but adventure, or an
// exempt tool in adventure).
export const mayHitBlock = (survival, block, meta, held, state) => !survival?.adventure || adventureExempt(block, meta, held, state);
