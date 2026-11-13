// BlockSkull (anl, original block 144, internal 172), ItemSkull (aeb, original item 397, internal 2050) and
// TileEntitySkull (apn), ported from the unchanged 1.7.10 classes. Every rule below was read from their bytecode with
// javap (bytecode-derived; the Wither T-shape of BlockSkull.func_149965_a included). Model and textures: skull-renderer.js.
// The 12-bit edit store cannot hold SkullType/Rot, so the cell keeps only the original facing (1 floor, 2-5 wall) and the
// tile entity lives in `Skulls` (the way signs.js keeps text).
import { signSolid, clickedFace } from './signs.js';
import { doorRotationYaw } from './doors-panes.js';
import { NBT } from './nbt.js';
import { rawOf, tagOf } from './item-tags.js';
import { profileToNbt, profileOfOwnerTag, profileFromName, cloneProfile } from './skull-profile.js';

import { SKULL, skullBounds, installSkullBlocks } from './skull-bounds.js';
export { SKULL, skullBounds, installSkullBlocks };
export const ITEM_SKULL = 2050, NETHER_STAR = 2060;
// Original item 397 -> internal 2050 (original-items.js).
export const SKULL_ITEMS = Object.freeze({ 397: ITEM_SKULL });
// ItemSkull.field_94587_a: damage 0..4.
export const SKULL_TYPES = Object.freeze(['skeleton', 'wither', 'zombie', 'char', 'creeper']);
export const SKULL_NAMES = Object.freeze(['Skeleton Skull', 'Wither Skeleton Skull', 'Zombie Head', 'Head', 'Creeper Head']);
export const SKULL_ICONS = Object.freeze(['skull_skeleton', 'skull_wither', 'skull_zombie', 'skull_steve', 'skull_creeper']);
export const SKULL_TEXTURES = Object.freeze([
  '/media/1.7.10/entity/skeleton/skeleton.png', '/media/1.7.10/entity/skeleton/wither_skeleton.png',
  '/media/1.7.10/entity/zombie/zombie.png', '/media/1.7.10/entity/steve.png', '/media/1.7.10/entity/creeper/creeper.png',
]);
// TileEntitySkullRenderer: only the zombie's model is 64 x 64 (field h), the rest are 64 x 32.
export const skullTextureHeight = (type) => (type === 2 ? 64 : 32);
export const skullIconUrl = (damage) => `/media/1.7.10/items/${SKULL_ICONS[damage] ?? SKULL_ICONS[0]}.png`;
export const SKULL_MATERIAL = Object.freeze({ hardness: 1, drop: ITEM_SKULL });
export const SKULL_CREATIVE = Object.freeze(SKULL_TYPES.map((_, d) => (d ? [ITEM_SKULL, d] : ITEM_SKULL))); // ItemSkull.getSubItems: damage 0..4

export const isSkull = (b) => b === SKULL;
// TileEntitySkullRenderer: translate for the facing (x + dx, y + dy, z + dz) and the heading in degrees. A floor head
// turns by Rot * 360 / 16; the wall heads face away from their block.
export const SKULL_WALL = Object.freeze({ 2: { t: [0.5, 0.25, 0.74], angle: 0 }, 3: { t: [0.5, 0.25, 0.26], angle: 180 }, 4: { t: [0.74, 0.25, 0.5], angle: 270 }, 5: { t: [0.26, 0.25, 0.5], angle: 90 } });
export function skullPose(meta, rot) {
  const m = meta & 7;
  if (m === 1 || !SKULL_WALL[m]) return { t: [0.5, 0, 0.5], angle: ((rot & 15) * 360) / 16 };
  return { t: [...SKULL_WALL[m].t], angle: SKULL_WALL[m].angle };
}
// ItemSkull.onItemUse: the rotation byte for a head set on top of a block (rotationYaw * 16 / 360 + 0.5, floored, & 15).
export const skullRot = (yaw) => Math.floor((yaw * 16) / 360 + 0.5) & 15;
// BlockSkull.breakBlock drops the item of the tile's type unless the metadata carries bit 8 (Creative harvest).
// A player head (type 3) with a profile keeps it as the item's SkullOwner compound (BlockSkull.dropBlockAsItemWithChance, bytecode-read and executed).
export function skullDrops(type, profile = null) {
  const drop = { id: ITEM_SKULL, count: 1, damage: type | 0 };
  if ((type | 0) === 3 && profile) {
    drop.tags = { skullRaw: rawOf({ type: NBT.COMPOUND, value: profileToNbt(profile) }) };
    if (typeof profile.name === 'string') drop.tags.skullOwner = profile.name;
  }
  return [drop];
}
// ItemSkull.onItemUse: the tile's profile from the stack's SkullOwner (a compound through NBTUtil.func_152459_a, a non-empty string as GameProfile(null, name)); only a player head has one.
export function skullProfileOfStack(stack, damage = stack?.damage) {
  if ((damage | 0) !== 3 || !stack) return null;
  if (stack.skullRaw) { try { return profileOfOwnerTag(tagOf(stack.skullRaw)); } catch { return null; } }
  return typeof stack.skullOwner === 'string' && stack.skullOwner.length > 0 ? profileFromName(stack.skullOwner) : null;
}
// Mob drops: EntitySkeleton/EntityZombie/EntityCreeper pass these damages to Item skull (combat.js hooks).
export const SKULL_DAMAGE = Object.freeze({ skeleton: 0, wither: 1, zombie: 2, char: 3, creeper: 4 });

export class Skulls {
  constructor() { this.tiles = new Map(); }
  static key(x, y, z) { return `${x},${y},${z}`; }
  tile(x, y, z) { return this.tiles.get(Skulls.key(x, y, z)) ?? null; }
  // `profile` is the TileEntitySkull GameProfile (skull-profile.js); a bare `owner` name (ExtraType, old saves) becomes GameProfile(null, name).
  create(x, y, z, type = 0, rot = 0, owner = '', profile = null) {
    const p = profile && typeof profile === 'object' && Array.isArray(profile.properties) ? cloneProfile(profile) : owner ? profileFromName(String(owner)) : null;
    const tile = { x, y, z, type: type & 7, rot: rot & 15, owner: (typeof p?.name === 'string' ? p.name : '') || '', ...(p ? { profile: p } : {}) };
    this.tiles.set(Skulls.key(x, y, z), tile);
    return tile;
  }
  remove(x, y, z) { return this.tiles.delete(Skulls.key(x, y, z)); }
  sync(world) { for (const [k, t] of [...this.tiles]) if (world.get(t.x, t.y, t.z) !== SKULL) this.tiles.delete(k); }
  toJSON() { return [...this.tiles.values()].map((t) => ({ ...t })); }
  static fromJSON(list) {
    const s = new Skulls();
    for (const t of Array.isArray(list) ? list : []) if ([t?.x, t?.y, t?.z].every(Number.isInteger)) s.create(t.x, t.y, t.z, t.type, t.rot, t.owner, t.profile);
    return s;
  }
}
// The live store (main.js saves and loads it; region import/export and /setblock read it when the state carries none).
export const SKULLS = new Skulls();

const FACE_OFFSET = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
// BlockSkull.func_149966_a: the cell holds a skull block whose tile is a wither skeleton skull.
const witherSkullAt = (world, skulls, x, y, z) => world.get(x, y, z) === SKULL && (skulls.tile(x, y, z)?.type ?? 0) === 1;
// BlockSkull.func_149965_a, called after a skull's tile is placed: a wither skull whose three-skull row sits on
// four soul sand in a T (row x or z, y >= 2, not Peaceful, server side) clears the seven cells and spawns the Wither
// at the row's middle, 1.45 below the skull (z row: yaw and body yaw 90; x row: yaw 0).
// `spawn(x, y, z, yaw)` returns true when the entity was added; `difficulty` is 0 for Peaceful.
export function tryBuildWither(world, skulls, x, y, z, { difficulty = 2, spawn, soulSand = 0 } = {}) {
  if (!soulSand || y < 2 || difficulty === 0 || (skulls.tile(x, y, z)?.type ?? -1) !== 1) return null;
  const sand = (a, b, c) => world.get(a, b, c) === soulSand;
  const line = (ax) => {
    for (let i = -2; i <= 0; i++) {
      const at = (k) => (ax === 'z' ? [x, z + i + k] : [x + i + k, z]);
      const cells = [0, 1, 2].map(at);
      const base = cells.every(([a, c]) => sand(ax === 'z' ? x : a, y - 1, ax === 'z' ? c : z)) && sand(...(ax === 'z' ? [x, y - 2, z + i + 1] : [x + i + 1, y - 2, z]));
      if (!base || !cells.every(([a, c]) => witherSkullAt(world, skulls, ax === 'z' ? x : a, y, ax === 'z' ? c : z))) continue;
      for (const [a, c] of cells) {
        const cx = ax === 'z' ? x : a, cz = ax === 'z' ? c : z;
        world.set(cx, y, cz, 0, true, 0); skulls.remove(cx, y, cz);
        world.set(cx, y - 1, cz, 0, true, 0);
      }
      const mx = ax === 'z' ? x : x + i + 1, mz = ax === 'z' ? z + i + 1 : z;
      world.set(mx, y - 2, mz, 0, true, 0);
      const pos = ax === 'z' ? [x + 0.5, y - 1.45, z + i + 1.5, 90] : [x + i + 1.5, y - 1.45, z + 0.5, 0];
      spawn?.(...pos);
      return { axis: ax, position: pos.slice(0, 3), yaw: pos[3], cells: cells.map(([a, c]) => (ax === 'z' ? [x, y, c] : [a, y, z])) };
    }
    return null;
  };
  return line('z') || line('x');
}

// ItemSkull.onItemUse. `state` is {world, survival, yaw}; `request` {id, damage, target:{block, adjacent}}.
// hooks: skulls (store), difficulty, spawnWither(x, y, z, yaw), soulSand (internal id), updateBlock, renderHotbar, markUnsaved, sound.
export function placeSkull(state, { id, damage = 0, target, stack = null }, hooks = {}) {
  const { world, survival } = state, here = target.block, adjacent = target.adjacent;
  const result = (placed, reason, position = null, extra = {}) => ({ placed, reason, block: placed ? SKULL : null, position, ...extra });
  if (!adjacent) return result(false, 'skull-no-face');
  const side = clickedFace(here, adjacent);
  if (side === 0) return result(false, 'skull-bottom'); // ItemSkull: side 0 returns false
  if (!signSolid(world.get(...here))) return result(false, 'skull-support'); // the clicked block's material must be solid
  if (!survival.creative && !survival.usable(id)) return result(false, 'empty-stack');
  const [x, y, z] = [here[0] + FACE_OFFSET[side][0], here[1] + FACE_OFFSET[side][1], here[2] + FACE_OFFSET[side][2]];
  if (y < 0 || y >= (world.height ?? 256) || (world.inside && !world.inside(x, y, z))) return result(false, 'skull-range', [x, y, z]);
  // There is no canPlace or replaceable test: setBlock replaces whatever stands in the target cell.
  const rot = side === 1 ? skullRot(state.yawDegrees ?? doorRotationYaw(state.yaw ?? 0)) : 0, skulls = hooks.skulls ?? SKULLS;
  world.set(x, y, z, SKULL, true, side);
  const tile = skulls.create(x, y, z, damage, rot, '', skullProfileOfStack(stack, damage));
  const built = tryBuildWither(world, skulls, x, y, z, { difficulty: hooks.difficulty ?? 2, spawn: hooks.spawnWither, soulSand: hooks.soulSand });
  if (!survival.creative) survival.take(id);
  hooks.updateBlock?.(x, z, y);
  if (built) for (const c of built.cells) hooks.updateBlock?.(c[0], c[2], c[1]);
  hooks.renderHotbar?.();
  hooks.sound?.(true, SKULL);
  hooks.markUnsaved?.();
  return result(true, built ? 'wither-built' : 'skull', [x, y, z], { tile, built });
}

// Items, materials for survival.js. The head block is not an item (ItemSkull is).
export function installSkullItems(items) {
  items[ITEM_SKULL] = { id: ITEM_SKULL, name: SKULL_NAMES[0], texture: SKULL_ICONS[0], stack: 64, color: '#d8d8d0', glyph: 'H', variants: [...SKULL_NAMES] };
  delete items[SKULL];
}
export function installSkullMaterials(m) { m[SKULL] = { ...SKULL_MATERIAL }; }
