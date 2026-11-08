// BlockSign (original blocks 63 standing and 68 wall, internal 175 and 176), ItemSign (original 323, internal 480)
// and TileEntitySign, ported from the unchanged 1.7.10 classes ank, adz and apm. Native evidence:
// public/research/sign-reference.json (tools/verify-signs.mjs + tools/probes/SignProbe.java), replayed by signs.test.js.
// Rendering lives in sign-renderer.js and the edit screen in sign-editor.js; this module is the rules and the tile store.
import { SIGN_POST, WALL_SIGN, BLOCKS } from './world.js';
import { toOriginal } from './block-registry.js';
import { doorReplaceable, doorRotationYaw } from './doors-panes.js';
import { setCakeSolid } from './stems-cake.js';
import { signBounds, SIGN_POST_BOUNDS, WALL_SIGN_BOUNDS } from './sign-bounds.js';

export { SIGN_POST, WALL_SIGN, signBounds, SIGN_POST_BOUNDS, WALL_SIGN_BOUNDS };
export const ITEM_SIGN = 480;
// Original item 323 -> internal 480 (original-items.js / tools/inventory-replay.mjs).
export const SIGN_ITEMS = Object.freeze({ 323: ITEM_SIGN });
// The lang strings of the original jar (sign-reference.json "names").
export const SIGN_TEXT = Object.freeze({ edit: 'Edit sign message', done: 'Done', name: 'Sign' });
export const MAX_LINE = 15; // TileEntitySign lines are cut to 15 characters on read and refused longer on the server
export const SIGN_LINES = 4;
export const SIGN_VIEW_DISTANCE_SQUARED = 4096; // TileEntity.getMaxRenderDistanceSquared of TileEntitySign (64 blocks)

export const isSign = (b) => b === SIGN_POST || b === WALL_SIGN;

// Block.getMaterial().isSolid() is false for these original blocks (everything the "support" and below-block probes
// refused): air, liquids, plants, circuits, the snow layer, vines, portals, carpet and the like.
const NON_SOLID_ORIGINAL = new Set([0, 6, 27, 28, 66, 157, 8, 9, 10, 11, 31, 32, 37, 38, 39, 40, 50, 51, 55, 59, 65, 69, 75, 76, 77, 78, 83, 90, 93, 94, 104, 105, 106, 111, 115,
  119, 127, 131, 132, 140, 141, 142, 143, 144, 149, 150, 171, 175]);
let nonSolid = null;
// The clicked or supporting block's material is solid (ItemSign.onItemUse, BlockSign.onNeighborBlockChange).
export function signSolid(b) {
  if (!nonSolid) {
    nonSolid = new Set();
    BLOCKS.forEach((_, id) => { const o = toOriginal(id, 0); if (o && NON_SOLID_ORIGINAL.has(o[0])) nonSolid.add(id); });
  }
  return !nonSolid.has(b);
}

setCakeSolid(signSolid); // BlockCake.canBlockStay uses the same Material.isSolid test

// ItemSign.onItemUse: (float)(yaw + 180) * 16 / 360 in single precision, plus 0.5 as a double, floored, & 15.
export const standingMeta = (yaw) => Math.floor(Math.fround(Math.fround(Math.fround(Math.fround(yaw) + 180) * 16) / 360) + 0.5) & 15;

// The face index (0 down, 1 up, 2 north -z, 3 south +z, 4 west -x, 5 east +x) of the click, from block and adjacent cell.
export function clickedFace(block, adjacent) {
  const d = [adjacent[0] - block[0], adjacent[1] - block[1], adjacent[2] - block[2]];
  return d[1] < 0 ? 0 : d[1] > 0 ? 1 : d[2] < 0 ? 2 : d[2] > 0 ? 3 : d[0] < 0 ? 4 : 5;
}
const FACE_OFFSET = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

// BlockSign.onNeighborBlockChange: should the sign at (x, y, z) pop off? A standing sign needs a solid block below;
// a wall sign the solid block behind it (metadata 2: +z, 3: -z, 4: +x, 5: -x); any other wall metadata always pops.
export function signShouldPop(world, x, y, z) {
  const b = world.get(x, y, z), meta = world.getMeta(x, y, z);
  if (b === SIGN_POST) return !signSolid(world.get(x, y - 1, z));
  if (b !== WALL_SIGN) return false;
  const behind = { 2: [0, 1], 3: [0, -1], 4: [1, 0], 5: [-1, 0] }[meta];
  return !behind || !signSolid(world.get(x + behind[0], y, z + behind[1]));
}
// BlockSign.getItemDropped: the sign item (quantity 1), whatever the metadata.
export const signDrops = () => [{ id: ITEM_SIGN, count: 1, damage: 0 }];

// ChatAllowedCharacters.isAllowedCharacter: neither the section sign, a control character nor DEL.
export const isAllowedChar = (c) => (typeof c === 'string' ? c.charCodeAt(0) : c) !== 167 && (typeof c === 'string' ? c.charCodeAt(0) : c) >= 32 && (typeof c === 'string' ? c.charCodeAt(0) : c) !== 127;
// ChatAllowedCharacters.filerAllowedCharacters: drops the disallowed characters.
export const filterText = (s) => Array.from(String(s)).filter((ch) => ch.length === 1 ? isAllowedChar(ch) : true).join('');
// NetHandlerPlayServer.processUpdateSign: a line over 15 characters or with a disallowed one is replaced by "!?".
export function acceptLine(line) {
  const s = String(line ?? '');
  if (s.length > MAX_LINE) return '!?';
  for (let i = 0; i < s.length; i++) if (!isAllowedChar(s.charCodeAt(i))) return '!?';
  return s;
}
// TileEntitySign.readFromNBT: each Text1-Text4 is cut to 15 characters.
export const readLine = (line) => String(line ?? '').slice(0, MAX_LINE);

// ItemSign.onItemUse for a held sign at the copied ray target. `state` is {world, survival, yaw}; `request` is
// {id, target:{block, adjacent}} (yaw is the camera yaw in the original rotationYaw degrees via state.yawDegrees).
// hooks: signs (the Signs store), openEditor(tile), updateBlock(x, z, y), renderHotbar, markUnsaved, sound(placed, id).
export function placeSign(state, { id, target }, hooks = {}) {
  const { world, survival } = state, here = target.block, adjacent = target.adjacent;
  const result = (placed, reason, block = null, position = null) => ({ placed, reason, block, position });
  if (!adjacent) return result(false, 'sign-no-face');
  const side = clickedFace(here, adjacent);
  if (side === 0) return result(false, 'sign-bottom', null, adjacent);
  if (!signSolid(world.get(...here))) return result(false, 'sign-support', null, adjacent);
  if (!survival.creative && !survival.usable(id)) return result(false, 'empty-stack', null, adjacent);
  const [x, y, z] = [here[0] + FACE_OFFSET[side][0], here[1] + FACE_OFFSET[side][1], here[2] + FACE_OFFSET[side][2]];
  if (y < 0 || y >= (world.height ?? 256) || (world.inside && !world.inside(x, y, z))) return result(false, 'sign-range', null, [x, y, z]);
  if (!doorReplaceable(world.get(x, y, z))) return result(false, 'sign-occupied', null, [x, y, z]);
  const block = side === 1 ? SIGN_POST : WALL_SIGN, meta = side === 1 ? standingMeta(state.yawDegrees ?? doorRotationYaw(state.yaw ?? 0)) : side;
  world.set(x, y, z, block, true, meta);
  const tile = hooks.signs?.create(x, y, z);
  if (!survival.creative) survival.take(id);
  hooks.updateBlock?.(x, z, y);
  hooks.renderHotbar?.();
  hooks.sound?.(true, block);
  hooks.markUnsaved?.();
  if (tile) hooks.openEditor?.(tile);
  return result(true, 'sign', block, [x, y, z]);
}

// TileEntitySign for every sign in the world, keyed "x,y,z" (the way chests are). A tile exists exactly while its
// block does; an imported or loaded sign is not editable (readFromNBT clears the flag).
export class Signs {
  constructor() { this.tiles = new Map(); }
  static key(x, y, z) { return `${x},${y},${z}`; }
  tile(x, y, z) { return this.tiles.get(Signs.key(x, y, z)) ?? null; }
  // A fresh tile is editable with four empty lines (reference tile.fresh).
  create(x, y, z) {
    const tile = { x, y, z, text: ['', '', '', ''], editable: true };
    this.tiles.set(Signs.key(x, y, z), tile);
    return tile;
  }
  remove(x, y, z) { return this.tiles.delete(Signs.key(x, y, z)); }
  // NetHandlerPlayServer.processUpdateSign: only an editable tile takes text, each line passing acceptLine.
  update(x, y, z, lines) {
    const tile = this.tile(x, y, z);
    if (!tile || !tile.editable) return false;
    tile.text = Array.from({ length: SIGN_LINES }, (_, i) => acceptLine(lines?.[i]));
    return true;
  }
  // Drop tiles whose block is gone, make tiles for sign blocks that have none (a sign loaded without a record).
  sync(world) {
    for (const [k, t] of [...this.tiles]) if (!isSign(world.get(t.x, t.y, t.z))) this.tiles.delete(k);
  }
  toJSON() { return [...this.tiles.values()].map((t) => ({ x: t.x, y: t.y, z: t.z, text: [...t.text] })); }
  static fromJSON(list) {
    const signs = new Signs();
    for (const t of Array.isArray(list) ? list : []) {
      if (![t?.x, t?.y, t?.z].every(Number.isInteger)) continue;
      signs.tiles.set(Signs.key(t.x, t.y, t.z), { x: t.x, y: t.y, z: t.z, text: Array.from({ length: SIGN_LINES }, (_, i) => readLine(t.text?.[i])), editable: false });
    }
    return signs;
  }
}

// GuiEditSign (bfx) key handling as a pure model: lines, the line being edited, Done.
export class SignEditModel {
  constructor(text = ['', '', '', '']) { this.lines = Array.from({ length: SIGN_LINES }, (_, i) => String(text[i] ?? '')); this.line = 0; this.done = false; }
  // keyTyped: Up (200) goes to line - 1, Down (208), Enter (28) and numpad Enter (156) to line + 1, all & 3; Backspace (14)
  // removes the last character; a typed character needs isAllowedCharacter and fewer than 15 already; Esc (1) is Done.
  keyCode(code) {
    if (code === 1) this.done = true;
    else if (code === 200) this.line = (this.line - 1) & 3;
    else if (code === 208 || code === 28 || code === 156) this.line = (this.line + 1) & 3;
    else if (code === 14 && this.lines[this.line].length > 0) this.lines[this.line] = this.lines[this.line].slice(0, -1);
  }
  type(ch) {
    if (isAllowedChar(ch) && this.lines[this.line].length < MAX_LINE) this.lines[this.line] += ch;
  }
  // The text of the line as rendered: the line being edited is wrapped as "> text <" (TileEntitySignRenderer).
  display(i) { return i === this.line ? `> ${this.lines[i]} <` : this.lines[i]; }
}

// Items, materials and the recipe the survival tables install (survival.js).
export function installSignItems(items) {
  items[ITEM_SIGN] = { id: ITEM_SIGN, name: SIGN_TEXT.name, texture: 'sign', stack: 16, color: '#9c7f4e', glyph: 'S' };
  // The sign blocks are not items (ItemSign is): survival.js builds an item per block, so drop theirs.
  for (const b of [SIGN_POST, WALL_SIGN]) delete items[b];
}
// BlockSign: Material.wood, hardness 1, no tool required; drops the sign item.
export function installSignMaterials(m) {
  for (const b of [SIGN_POST, WALL_SIGN]) m[b] = { hardness: 1, drop: ITEM_SIGN };
}
// CraftingManager: six planks over a stick make three signs ("###", "###", " X ").
export function installSignRecipes({ recipe }) {
  recipe('sign', 'Sign', ['###', '###', ' X '], { '#': 7, X: 300 }, ITEM_SIGN, 3);
}
