// Wearable heads (polish track). 1.7.10 lets a carved pumpkin (Blocks.pumpkin, an ItemBlock) and a mob head (Items.skull)
// sit in the helmet slot: SlotArmor.isItemValid accepts them for armorType 0 (bytecode-derived, ContainerPlayer's slot
// class), and RenderPlayer.renderSpecials (bop.a(blg, float)) draws them after the head part's postRender(0.0625):
//   ItemBlock whose render type is a 3D block: translate(0, -0.25, 0), rotate 90 about y, scale(0.625, -0.625, -0.625),
//     then ItemRenderer.renderItem(entity, stack, 0), the same renderer a held block uses;
//   Items.skull: scale(1.0625, -1.0625, -1.0625), then TileEntitySkullRenderer.func_152674_a(-0.5, 0, -0.5, 1, 180, damage, profile).
// The skull call translates by (x + 0.5, y, z + 0.5) = 0, scales (-1, -1, 1) and turns the head model 180 degrees, so the
// net matrix is a plain uniform scale of 1.0625 in the head frame and the box keeps its -z face.
import * as THREE from "three";
const ITEM_SKULL = 2050; // skull.js ITEM_SKULL (not imported: inventory.js loads this module)

export const PUMPKIN_BLOCK = 67; // internal id of Blocks.pumpkin (original 86)
export const HEAD_ITEMS = Object.freeze(new Set([PUMPKIN_BLOCK, ITEM_SKULL]));
export const SKULL_SCALE = 1.0625, PUMPKIN_SCALE = 0.625;
export const headWearable = (id) => HEAD_ITEMS.has(id);
// The armour slot (0 helmet .. 3 boots) a stack fits: the item's own armorType, or the helmet slot for the two head items.
export const armorTypeOf = (items, id) => items[id]?.armor ?? (HEAD_ITEMS.has(id) ? 0 : undefined);

const RAD = Math.PI / 180;
// The head item's matrix in the head part's postRender frame (GL conventions, as heldItemMatrix).
export function headItemMatrix(id) {
  const m = new THREE.Matrix4(), t = new THREE.Matrix4();
  if (id === ITEM_SKULL) return m.makeScale(SKULL_SCALE, SKULL_SCALE, SKULL_SCALE);
  m.makeTranslation(0, -0.25, 0);
  m.multiply(t.makeRotationY(90 * RAD));
  m.multiply(t.makeScale(PUMPKIN_SCALE, -PUMPKIN_SCALE, -PUMPKIN_SCALE));
  return m;
}
// First-person overlay: GuiIngame.renderPumpkinBlur draws misc/pumpkinblur.png over the screen in the first-person view
// when the helmet slot holds a pumpkin block (not a skull).
export const showsPumpkinBlur = (helmet, thirdPerson = 0) => thirdPerson === 0 && helmet?.id === PUMPKIN_BLOCK;
