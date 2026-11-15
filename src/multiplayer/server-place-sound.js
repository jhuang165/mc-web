// Batch 74 mpsounds74: the sound of a block placement on the dedicated server.
// ItemBlock, ItemReed, ItemSnow and ItemSlab.onItemUse end with world.playSoundEffect(x + 0.5, y + 0.5, z + 0.5, block.stepSound.func_150496_b(),
// (volume + 1) / 2, frequency * 0.8) on the placed cell (bytecode-read: abh, abi, ada, aec, each calls ahb.a(DDDString,F,F) after the setBlock).
// On a WorldServer that is WorldManager.playSound (bf.a): sendToAllNear with no excluded player, so every player within 16 blocks of the cell hears
// it, the placer too. The client's own playSoundEffect is silent (RenderGlobal.playSound does nothing), so the S29 is the only sound: no double.
// ItemDoor, ItemBed, ItemSign, ItemSkull, ItemRedstone, ItemSeeds (and nether wart) and ItemDye's cocoa play nothing (placesSilently).
import { placeSound, placesSilently } from '../block-sounds.js';

// `block` is the block the item placed (ItemBlock.field_150939_a), `cell` the placed cell [x, y, z].
export function placeSoundOut(sim, p, block, cell) {
  if (!block || !cell || placesSilently(block)) return false;
  const snd = placeSound(block);
  sim.soundsOut.push({ name: snd.name, x: cell[0] + 0.5, y: cell[1] + 0.5, z: cell[2] + 0.5, volume: snd.volume, pitch: snd.pitch, except: null, dim: p.dimension | 0 });
  return true;
}
// The result of placeHeldBlock: ItemDye's cocoa branch (reason 'cocoa') is silent; every other placed result plays its block's place sound.
export function placedResultSound(sim, p, put) {
  return put?.placed && put.reason !== 'cocoa' ? placeSoundOut(sim, p, put.block, put.position) : false;
}

// Client side of S29 (WorldClient.playSound plays any name sounds.json defines): the block family names the server sends for placements and the hoe.
import { SOUND_TYPES } from '../block-sounds.js';
const BLOCK_SOUND_NAMES = new Set(Object.values(SOUND_TYPES).flatMap(t => [t.break, t.step, t.place]));
export const isBlockSound = name => BLOCK_SOUND_NAMES.has(name) && name !== SOUND_TYPES.anvil.step; // the anvil's step name is no sounds.json event (silent)
