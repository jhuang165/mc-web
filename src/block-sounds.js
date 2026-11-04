// Block.SoundType (stepSound) of every original 1.7.10 block and the call-site formulas that turn it into a played sound.
// Evidence: tools/probes/BlockSoundProbe.java + tools/verify-block-sounds.mjs -> public/research/block-sounds-reference.json
// (every registered block's stepSound by field identity, plus the javap-checked call sites); notes in public/research/block-sounds.md.
//
// A SoundType is { name, volume, frequency } plus three accessors the original overrides for glass, ladder and anvil:
//   getBreakSound (ajm.a)  "dig." + name           glass: dig.glass   ladder: dig.wood     anvil: dig.stone
//   getStepResourcePath (e) "step." + name         (anvil: step.anvil, an event 1.7.10's sounds.json does not define: silent)
//   func_150496_b place (b)  getBreakSound()        glass: step.stone                       anvil: random.anvil_land
// Call sites (float arithmetic, Math.fround):
//   break  RenderGlobal.playAuxSFX 2001   (volume + 1) / 2, frequency * 0.8
//   hit    PlayerControllerMP digging     (volume + 1) / 8, frequency * 0.5, step name, every 4th tick
//   place  ItemBlock / ItemReed / ItemSnow / ItemSlab   (volume + 1) / 2, frequency * 0.8, place name
//   hoe    ItemHoe                        (volume + 1) / 2, frequency * 0.8, step name of the tilled block
//   step   Entity.func_145780_a           volume * 0.15, frequency; a snow layer on top substitutes its snow type; liquids silent
import { toOriginal } from "./block-registry.js";
import { SNOW_LAYER } from "./world.js";

const type = (field, name, volume, frequency, sounds = {}) =>
  Object.freeze({ field, name, volume, frequency, break: "dig." + name, step: "step." + name, place: "dig." + name, ...sounds });
export const SOUND_TYPES = Object.freeze({
  stone: type("soundTypeStone", "stone", 1, 1),
  wood: type("soundTypeWood", "wood", 1, 1),
  gravel: type("soundTypeGravel", "gravel", 1, 1),
  grass: type("soundTypeGrass", "grass", 1, 1),
  piston: type("soundTypePiston", "stone", 1, 1),
  metal: type("soundTypeMetal", "stone", 1, 1.5),
  glass: type("soundTypeGlass", "stone", 1, 1, { break: "dig.glass", place: "step.stone" }),
  cloth: type("soundTypeCloth", "cloth", 1, 1),
  sand: type("soundTypeSand", "sand", 1, 1),
  snow: type("soundTypeSnow", "snow", 1, 1),
  ladder: type("soundTypeLadder", "ladder", 1, 1, { break: "dig.wood", place: "dig.wood" }),
  anvil: type("soundTypeAnvil", "anvil", 0.3, 1, { break: "dig.stone", place: "random.anvil_land" }),
});

// Original block id -> SoundType key (Block.stepSound after Block.registerBlocks; Block's own default is soundTypePiston).
const BY_TYPE = {
  stone: [0, 8, 9, 10, 11, 25, 26, 30, 36, 55, 97, 115, 116, 117, 118, 119, 131, 132, 137, 138, 140],
  piston: [1, 4, 7, 14, 15, 16, 21, 22, 23, 24, 29, 33, 34, 43, 44, 45, 48, 49, 56, 61, 62, 67, 70, 73, 74, 77, 84, 87, 98, 108, 109, 112, 113, 114, 121, 122, 128, 129, 130, 139, 144, 153, 155, 156, 158, 159, 172, 173],
  grass: [2, 6, 18, 19, 31, 32, 37, 38, 39, 40, 46, 59, 83, 106, 110, 111, 141, 142, 161, 170, 175],
  gravel: [3, 13, 60, 82],
  wood: [5, 17, 47, 50, 51, 53, 54, 58, 63, 64, 68, 69, 72, 75, 76, 85, 86, 91, 93, 94, 96, 99, 100, 103, 104, 105, 107, 125, 126, 127, 134, 135, 136, 143, 146, 147, 148, 149, 150, 151, 154, 162, 163, 164],
  sand: [12, 88],
  glass: [20, 79, 89, 90, 95, 102, 120, 123, 124, 160, 174],
  metal: [27, 28, 41, 42, 52, 57, 66, 71, 101, 133, 152, 157],
  cloth: [35, 81, 92, 171],
  ladder: [65],
  snow: [78, 80],
  anvil: [145],
};
export const ORIGINAL_SOUND_TYPE = Object.freeze(
  Object.fromEntries(Object.entries(BY_TYPE).flatMap(([key, ids]) => ids.map((id) => [id, key]))),
);

// Original ids whose Material.isLiquid is true (water 8/9, lava 10/11): Entity.func_145780_a stays silent on them.
const LIQUID = new Set([8, 9, 10, 11]);
const f = Math.fround;

// Internal id -> SoundType key. Unknown ids read as the Block default (soundTypePiston), like an unregistered id's air.
export function soundTypeKey(id) {
  const original = toOriginal(id, 0);
  return ORIGINAL_SOUND_TYPE[original ? original[0] : 0] ?? "piston";
}
export const soundTypeOf = (id) => SOUND_TYPES[soundTypeKey(id)];

const volumeHalf = (t) => f(f(t.volume + 1) / 2);
const volumeEighth = (t) => f(f(t.volume + 1) / 8);
const pitch = (t, factor) => f(f(t.frequency) * f(factor));

// RenderGlobal.playAuxSFX 2001: the sound of a block broken (by the player, a mob or an effect).
export function breakSound(id) {
  const t = soundTypeOf(id);
  return { name: t.break, volume: volumeHalf(t), pitch: pitch(t, 0.8) };
}
// ItemBlock.onItemUse and its ItemReed / ItemSnow / ItemSlab variants. Doors, beds, signs, redstone dust and seeds are not
// placed by these items and play nothing in 1.7.10 (see placesSilently).
export function placeSound(id) {
  const t = soundTypeOf(id);
  return { name: t.place, volume: volumeHalf(t), pitch: pitch(t, 0.8) };
}
// PlayerControllerMP.onPlayerDamageBlock: the hit sound is the step sound at a quarter of the break volume.
export function hitSound(id) {
  const t = soundTypeOf(id);
  return { name: t.step, volume: volumeEighth(t), pitch: pitch(t, 0.5) };
}
// ItemHoe.func_150857_a: the step name of the block it turns the clicked block into.
export function hoeSound(id) {
  const t = soundTypeOf(id);
  return { name: t.step, volume: volumeHalf(t), pitch: pitch(t, 0.8) };
}
// Entity.func_145780_a(x, y, z, block): `above` is the block id one cell above the stepped one. A snow layer there plays
// the snow type; otherwise liquids are silent. Returns null when nothing plays.
export function footstepSound(id, above = 0) {
  const original = toOriginal(id, 0);
  const t = above === SNOW_LAYER ? SOUND_TYPES.snow : original && LIQUID.has(original[0]) ? null : soundTypeOf(id);
  return t && { name: t.step, volume: f(t.volume * f(0.15)), pitch: f(t.frequency) };
}
// Blocks whose item never plays the place sound: ItemDoor (64, 71), ItemBed (26), ItemSign (63, 68), ItemRedstone (55),
// ItemSkull (144) and ItemSeeds / ItemSeedFood (59, 104, 105, 115, 141, 142) do not call SoundType (verified: none of those
// classes references Block.SoundType or plays a sound; ItemBlock, ItemReed, ItemSnow and ItemSlab are the only placers that do).
const SILENT_PLACED = new Set([26, 55, 59, 63, 64, 68, 71, 104, 105, 115, 141, 142, 144]);
export function placesSilently(id) {
  const original = toOriginal(id, 0);
  return !!original && SILENT_PLACED.has(original[0]);
}
// The sound family file name of a break sound ("wood", "glass", "stone"...), the vocabulary of audio.js blockSound.
export const soundFamily = (id) => soundTypeOf(id).break.slice(4);
