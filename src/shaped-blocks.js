// Wood slabs (original 125/126), fence gate (107), trapdoor (96) and cobblestone wall (139), ported from the unchanged
// 1.7.10 classes BlockWoodSlab, BlockFenceGate, BlockTrapDoor and BlockWall (public/research/shaped-blocks-reference.json,
// tools/probes/ShapedBlocksProbe.java, replayed by src/shaped-blocks.test.js; notes in public/research/shaped-blocks.md).
// Pure rules with no runtime imports, so world.js, the scene, the edit simulations and the redstone engine can share them.
//
// Internal block ids 165-169 (world.js reserves 140-164 for other tracks); block items are 1000 + id (the double slab has none):
//   165 wood slab (single; metadata = wood type 0-5, bit 3 the top half)     item 1165, damage = wood type
//   166 double wood slab (metadata = wood type)                              drops two 1165
//   167 fence gate (bits 0-1 facing, bit 2 open)                             item 1167
//   168 trapdoor (bits 0-1 the support side, bit 2 open, bit 3 top half)     item 1168
//   169 cobblestone wall (metadata 0 normal, 1 mossy)                        item 1169
export const WOOD_SLAB = 165, DOUBLE_WOOD_SLAB = 166, FENCE_GATE = 167, TRAPDOOR = 168, COBBLE_WALL = 169;
export const ITEM_WOOD_SLAB = 1165, ITEM_FENCE_GATE = 1167, ITEM_TRAPDOOR = 1168, ITEM_COBBLE_WALL = 1169;
export const SHAPED_FIRST = 165, SHAPED_LAST = 169;
export const isShaped = (b) => b >= SHAPED_FIRST && b <= SHAPED_LAST;
export const isWoodSlab = (b) => b === WOOD_SLAB || b === DOUBLE_WOOD_SLAB;
// Original block ids (block-registry.js maps these).
export const ORIGINAL = Object.freeze({ [WOOD_SLAB]: 126, [DOUBLE_WOOD_SLAB]: 125, [FENCE_GATE]: 107, [TRAPDOOR]: 96, [COBBLE_WALL]: 139 });

const ITEM_OF_BLOCK = { [WOOD_SLAB]: ITEM_WOOD_SLAB, [DOUBLE_WOOD_SLAB]: ITEM_WOOD_SLAB, [FENCE_GATE]: ITEM_FENCE_GATE, [TRAPDOOR]: ITEM_TRAPDOOR, [COBBLE_WALL]: ITEM_COBBLE_WALL };
const BLOCK_OF_ITEM = { [ITEM_WOOD_SLAB]: WOOD_SLAB, [ITEM_FENCE_GATE]: FENCE_GATE, [ITEM_TRAPDOOR]: TRAPDOOR, [ITEM_COBBLE_WALL]: COBBLE_WALL };
export const itemOfBlock = (b) => ITEM_OF_BLOCK[b] ?? 0;
export const blockOfItem = (id) => BLOCK_OF_ITEM[id] ?? 0;

// lang tile.woodSlab.*.name, tile.fenceGate.name, tile.trapdoor.name, tile.cobbleWall.*.name.
export const WOOD_SLAB_NAMES = ['Oak Wood Slab', 'Spruce Wood Slab', 'Birch Wood Slab', 'Jungle Wood Slab', 'Acacia Wood Slab', 'Dark Oak Wood Slab'];
export const WALL_NAMES = ['Cobblestone Wall', 'Mossy Cobblestone Wall'];
export const SHAPED_ITEM_NAMES = Object.freeze({ [ITEM_WOOD_SLAB]: 'Oak Wood Slab', [ITEM_FENCE_GATE]: 'Fence Gate', [ITEM_TRAPDOOR]: 'Trapdoor', [ITEM_COBBLE_WALL]: 'Cobblestone Wall' });
const WOOD_TEXTURES = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'big_oak'];
export const woodSlabTexture = (meta) => 'planks_' + (WOOD_TEXTURES[meta & 7] ?? 'oak');
export const wallTexture = (meta) => ((meta & 15) === 1 ? 'cobblestone_mossy' : 'cobblestone');
export const SHAPED_TILES = ['trapdoor', 'cobblestone_mossy'];

// ---------------------------------------------------------------------------------------------------------------------
// Slabs (BlockSlab / BlockWoodSlab / ItemSlab). Wood types 0-5 are the planks damage; 6 and 7 are kept raw (BlockSlab reads meta & 7) and draw as oak.
export const woodSlabType = (meta) => meta & 7;
export function woodSlabInfo(b, meta = 0) {
  if (b === WOOD_SLAB) return { type: woodSlabType(meta), top: (meta & 8) !== 0, double: false };
  if (b === DOUBLE_WOOD_SLAB) return { type: woodSlabType(meta), top: false, double: true };
  return null;
}
// BlockSlab.setBlockBoundsBasedOnState.
export const woodSlabBounds = (b, meta = 0) => { const s = woodSlabInfo(b, meta); return !s || s.double ? [0, 0, 0, 1, 1, 1] : s.top ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1]; };
// BlockSlab.onBlockPlaced: the top bit for a click on the underside, or on a side above the middle of the block.
export const woodSlabPlacedMeta = (type, side, hitY) => (type & 7) | (side === 0 || (side !== 1 && hitY > 0.5) ? 8 : 0);
// ItemSlab.onItemUse (and func_150946_a for the adjacent cell). Returns { merge: 'clicked'|'adjacent'|null, id, meta }.
export function planWoodSlabUse(type, cell, adj, side, hitY) {
  const c = woodSlabInfo(cell.id, cell.meta);
  if (c && !c.double && c.type === type && ((side === 1 && !c.top) || (side === 0 && c.top))) return { merge: 'clicked', id: DOUBLE_WOOD_SLAB, meta: type };
  const a = adj && woodSlabInfo(adj.id, adj.meta);
  if (a && !a.double && a.type === type) return { merge: 'adjacent', id: DOUBLE_WOOD_SLAB, meta: type };
  return { merge: null, id: WOOD_SLAB, meta: woodSlabPlacedMeta(type, side, hitY) };
}
// BlockSlab.quantityDropped / damageDropped: a single slab one item, the double slab two, damage = metadata & 7.
export const woodSlabDrops = (b, meta) => { const s = woodSlabInfo(b, meta); return s ? [{ id: ITEM_WOOD_SLAB, count: s.double ? 2 : 1, damage: s.type }] : null; };

// ---------------------------------------------------------------------------------------------------------------------
// Fence gate (BlockFenceGate, original 107). Metadata: facing (BlockDirectional) 0-3 south, west, north, east; bit 2 open.
export const gateOpen = (meta) => (meta & 4) !== 0;
// ItemBlock/onBlockPlacedBy: (floor(yaw * 4 / 360 + 0.5) & 3) % 4 with the player's Minecraft yaw (degrees, float arithmetic).
export const yawFacing = (mcYaw) => Math.floor(Math.fround(Math.fround(Math.fround(mcYaw) * 4) / 360) + 0.5) & 3;
export const gatePlacedMeta = (mcYaw) => yawFacing(mcYaw);
// The gate occupies its facing's axis: facing 0/2 spans x (a thin z box), 1/3 spans z.
export const gateBounds = (meta) => ((meta & 1) === 0 ? [0, 0, 0.375, 1, 1, 0.625] : [0.375, 0, 0, 0.625, 1, 1]);
// addCollisionBoxesToList: none while open, else the same footprint 1.5 high.
export const gateBoxes = (meta) => { if (gateOpen(meta)) return []; const b = gateBounds(meta); b[4] = 1.5; return [b]; };
// BlockFenceGate.onBlockActivated: an open gate closes; a closed one opens, turning to face away from the player.
export function gateUseMeta(meta, mcYaw) {
  if (gateOpen(meta)) return meta & ~4;
  const l = yawFacing(mcYaw) % 4, dir = meta & 3;
  return (dir === (l + 2) % 4 ? l : meta) | 4;
}
// BlockFenceGate.canPlaceBlockAt: the block below has a solid Material; `solidBelow` is that test.
export const gateCanPlace = (solidBelow) => !!solidBelow;
// BlockWall.canConnectWallTo: a wall, a fence gate, or an opaque block that renders as a normal block and is not a gourd (`solid` is that
// test without the fence itself: world.js wallSolid, the fence rule of fences.js minus the fence post).
export const isGourd = (b) => b === 67 || b === 81;
export const wallConnectsTo = (b, solid) => b === COBBLE_WALL || b === FENCE_GATE || (!isGourd(b) && !!solid(b));
// RenderBlocks.renderBlockFenceGate: posts and rails across the gate; an open gate swings its two leaves towards the facing.
export function gateRenderBoxes(meta) {
  const open = gateOpen(meta), dir = meta & 3, boxes = [];
  // Built for facing 0/2 (spanning x, thin in z); `rot` swaps the axes for 1/3.
  const post = [[0, 5 / 16, 7 / 16, 2 / 16, 1, 9 / 16], [14 / 16, 5 / 16, 7 / 16, 1, 1, 9 / 16]];
  boxes.push(...post);
  if (!open) {
    boxes.push([2 / 16, 6 / 16, 7 / 16, 14 / 16, 9 / 16, 9 / 16], [2 / 16, 12 / 16, 7 / 16, 14 / 16, 15 / 16, 9 / 16], [6 / 16, 9 / 16, 7 / 16, 10 / 16, 12 / 16, 9 / 16]);
  } else {
    // Each leaf swings 90 degrees about its post, towards +z for facing 0 and -z for facing 2.
    const z0 = dir === 0 || dir === 1 ? 9 / 16 : 0, z1 = dir === 0 || dir === 1 ? 1 : 7 / 16;
    for (const [x0, x1] of [[0, 2 / 16], [14 / 16, 1]]) boxes.push([x0, 6 / 16, z0, x1, 9 / 16, z1], [x0, 12 / 16, z0, x1, 15 / 16, z1]);
  }
  if ((meta & 1) === 0) return boxes;
  // Facing 1/3: swap x and z; the open leaves swing towards -x for 1 and +x for 3 (the dir test above chose z halves).
  const swapped = boxes.map(([a, b, c, d, e, f]) => [c, b, a, f, e, d]);
  return dir === 3 && open ? swapped.map(([a, b, c, d, e, f]) => [1 - d, b, c, 1 - a, e, f]) : swapped;
}

// ---------------------------------------------------------------------------------------------------------------------
// Trapdoor (BlockTrapDoor, original 96). Metadata: bits 0-1 which side holds it (0 south neighbour, 1 north, 2 east, 3 west... as
// the support offsets below), bit 2 open, bit 3 the top half of the cell (clicked above the middle).
export const TRAP_SUPPORT = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // [dx, dz] of the supporting block for metadata & 3
// BlockTrapDoor.onBlockPlaced: only side faces (2-5) attach; bit 3 when the click is above the middle.
export const trapPlacedMeta = (side, hitY) => (side >= 2 && side <= 5 ? [0, 1, 2, 3][side - 2] | (hitY > 0.5 ? 8 : 0) : null);
export const trapOpen = (meta) => (meta & 4) !== 0;
// func_150117_b: the thin slab. Closed: 3/16 at the bottom, or the top for bit 3. Open: 3/16 against the supporting side.
export function trapBounds(meta) {
  const t = 0.1875;
  if (!trapOpen(meta)) return (meta & 8) ? [0, 1 - t, 0, 1, 1, 1] : [0, 0, 0, 1, t, 1];
  switch (meta & 3) { case 0: return [0, 0, 1 - t, 1, 1, 1]; case 1: return [0, 0, 0, 1, 1, t]; case 2: return [1 - t, 0, 0, 1, 1, 1]; default: return [0, 0, 0, t, 1, 1]; }
}
// BlockTrapDoor.func_150119_a: an opaque normal cube, glowstone, a slab or a stair. `normalCube`, `isStair`, `isSlab` come from world.js/stairs.js.
export const trapSupports = (b, normalCube, isStair, isSlab) => !!normalCube(b) || b === 131 || !!isStair(b) || !!isSlab(b);

// ---------------------------------------------------------------------------------------------------------------------
// Cobblestone wall (BlockWall, original 139). mask: bit 0 north (z-1), 1 south (z+1), 2 west (x-1), 3 east (x+1).
export function wallMask(world, x, y, z, normalCube) {
  const c = (dx, dz) => wallConnectsTo(world.get(x + dx, y, z + dz), normalCube);
  return (c(0, -1) ? 1 : 0) | (c(0, 1) ? 2 : 0) | (c(-1, 0) ? 4 : 0) | (c(1, 0) ? 8 : 0);
}
// setBlockBoundsBasedOnState: a straight run is thinner (0.3125-0.6875) and 0.8125 high, otherwise the post plus arms, 1 high.
export function wallBounds(mask) {
  let x0 = 0.25, x1 = 0.75, z0 = 0.25, z1 = 0.75, h = 1;
  if (mask & 1) z0 = 0;
  if (mask & 2) z1 = 1;
  if (mask & 4) x0 = 0;
  if (mask & 8) x1 = 1;
  if ((mask & 3) === 3 && !(mask & 12)) { h = 0.8125; x0 = 0.3125; x1 = 0.6875; }
  else if ((mask & 12) === 12 && !(mask & 3)) { h = 0.8125; z0 = 0.3125; z1 = 0.6875; }
  return [x0, 0, z0, x1, h, z1];
}
// BlockWall.getCollisionBoundingBoxFromPool: the bounds 1.5 high.
export const wallCollisionBox = (mask) => { const b = wallBounds(mask); b[4] = 1.5; return b; };
// RenderBlocks.renderBlockWall: a straight run with air above is one thin box, otherwise the post plus 0.8125-high arms.
export function wallRenderBoxes(mask, airAbove = true) {
  const n = mask & 1, s = mask & 2, w = mask & 4, e = mask & 8, straightZ = n && s && !w && !e, straightX = w && e && !n && !s;
  if ((straightZ || straightX) && airAbove) return [straightZ ? [0.3125, 0, 0, 0.6875, 0.8125, 1] : [0, 0, 0.3125, 1, 0.8125, 0.6875]];
  const out = [[0.25, 0, 0.25, 0.75, 1, 0.75]], a = 0.3125, b = 0.6875, h = 0.8125;
  if (w) out.push([0, 0, a, 0.25, h, b]);
  if (e) out.push([0.75, 0, a, 1, h, b]);
  if (n) out.push([a, 0, 0, b, h, 0.25]);
  if (s) out.push([a, 0, 0.75, b, h, 1]);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Per-cell shapes for world.js. `world.get/getMeta` read the live cell; `normalCube` is world.js's predicate.
export function shapedBounds(world, x, y, z, normalCube) {
  const b = world.get(x, y, z), meta = world.getMeta(x, y, z);
  if (b === WOOD_SLAB || b === DOUBLE_WOOD_SLAB) return woodSlabBounds(b, meta);
  if (b === FENCE_GATE) return gateBounds(meta);
  if (b === TRAPDOOR) return trapBounds(meta);
  return wallBounds(wallMask(world, x, y, z, normalCube));
}
export function shapedBoxes(world, x, y, z, normalCube) {
  const b = world.get(x, y, z), meta = world.getMeta(x, y, z);
  if (b === FENCE_GATE) return gateBoxes(meta);
  if (b === COBBLE_WALL) return [wallCollisionBox(wallMask(world, x, y, z, normalCube))];
  return [shapedBounds(world, x, y, z, normalCube)];
}
export const shapedPick = (b, meta) => (b === FENCE_GATE || b === TRAPDOOR ? { id: itemOfBlock(b), damage: 0 }
  : b === COBBLE_WALL ? { id: ITEM_COBBLE_WALL, damage: meta & 1 } : isWoodSlab(b) ? { id: ITEM_WOOD_SLAB, damage: woodSlabType(meta) } : null);
// Block drops (population-content.js populationDrops): slabs by quantity, the others themselves with their damage.
export function shapedDrops(b, meta) {
  if (isWoodSlab(b)) return woodSlabDrops(b, meta);
  if (b === FENCE_GATE || b === TRAPDOOR) return [{ id: itemOfBlock(b), count: 1, damage: 0 }];
  if (b === COBBLE_WALL) return [{ id: ITEM_COBBLE_WALL, count: 1, damage: meta & 15 }];
  return null;
}
// Materials (survival.js MATERIALS): hardness 2 wood (slabs, gate; hardness 3 for the trapdoor) with the axe, the wall rock hardness 2 with a pickaxe.
export const SHAPED_MATERIALS = Object.freeze({
  [WOOD_SLAB]: { hardness: 2, kind: 'axe' }, [DOUBLE_WOOD_SLAB]: { hardness: 2, kind: 'axe' },
  [FENCE_GATE]: { hardness: 2, kind: 'axe' }, [TRAPDOOR]: { hardness: 3, kind: 'axe' }, [COBBLE_WALL]: { hardness: 2, kind: 'pickaxe', tier: 0 },
});
// Explosion resistance (Block.blockResistance / 5 is the stored value): wood 3 (resistanceField 15), the wall 6 (30).
export const SHAPED_RESISTANCE = Object.freeze({ [WOOD_SLAB]: 3, [DOUBLE_WOOD_SLAB]: 3, [FENCE_GATE]: 3, [TRAPDOOR]: 3, [COBBLE_WALL]: 6 });

// ---------------------------------------------------------------------------------------------------------------------
// Items, recipes (CraftingManager entries 109, 150-155, 200-205 of recipe-registry-reference.json).
export function installShapedItems(items) {
  // BLOCKS-derived rows for internal 165-169 are not items (their block items are 1000 + id).
  for (let id = 165; id <= SHAPED_LAST; id++) if (items[id]) items[id].hidden = true;
  items[ITEM_WOOD_SLAB] = { id: ITEM_WOOD_SLAB, name: SHAPED_ITEM_NAMES[ITEM_WOOD_SLAB], stack: 64, block: true, color: '#b49462', variants: WOOD_SLAB_NAMES };
  items[ITEM_FENCE_GATE] = { id: ITEM_FENCE_GATE, name: 'Fence Gate', stack: 64, block: true, color: '#b49462' };
  items[ITEM_TRAPDOOR] = { id: ITEM_TRAPDOOR, name: 'Trapdoor', stack: 64, block: true, color: '#8f6f3a' };
  items[ITEM_COBBLE_WALL] = { id: ITEM_COBBLE_WALL, name: 'Cobblestone Wall', stack: 64, block: true, color: '#8d8d8d', variants: WALL_NAMES };
}
export function installShapedMaterials(m) {
  for (const [id, v] of Object.entries(SHAPED_MATERIALS)) m[id] = { ...v };
}
// Shaped recipes (ids only: planks 7 matches any damage like the original's wildcard). Wood-type-specific slabs, mossy walls and the
// daylight sensor are in shapedCraftingResult.
export function installShapedRecipes({ recipe }) {
  recipe('fence-gate', 'Fence Gate', ['SPS', 'SPS'], { S: 300, P: 7 }, ITEM_FENCE_GATE);
  recipe('trapdoor', 'Trapdoor', ['PPP', 'PPP'], { P: 7 }, ITEM_TRAPDOOR, 2);
}
// Metadata-sensitive recipes (matched before the id-only catalogue): three planks of one wood type -> six slabs of that type
// (recipes 200-205), six cobblestone -> six walls (150), six mossy cobblestone -> six mossy walls (151).
export function shapedCraftingResult(cells, size) {
  const filled = cells.filter(Boolean);
  if (filled.length === 3 && filled.every((s) => s.id === 7)) {
    for (let y = 0; y < size; y++) for (let x = 0; x <= size - 3; x++) {
      const a = cells[y * size + x], b = cells[y * size + x + 1], c = cells[y * size + x + 2];
      if (a?.id === 7 && b?.id === 7 && c?.id === 7 && a.damage === b.damage && b.damage === c.damage && a.damage < 6) return { id: ITEM_WOOD_SLAB, count: 6, damage: a.damage };
    }
  }
  if (filled.length === 6 && filled.every((s) => s.id === filled[0].id) && (filled[0].id === 12 || filled[0].id === 74)) {
    // 3 wide x 2 high anywhere in the grid.
    for (let y = 0; y <= size - 2; y++) for (let x = 0; x <= size - 3; x++) {
      let ok = true;
      for (let j = 0; j < size && ok; j++) for (let i = 0; i < size && ok; i++) {
        const inside = i >= x && i < x + 3 && j >= y && j < y + 2;
        if (!!cells[j * size + i] !== inside) ok = false;
      }
      if (ok) return { id: ITEM_COBBLE_WALL, count: 6, damage: filled[0].id === 74 ? 1 : 0 };
    }
  }
  return null;
}

// BlockTrapDoor.func_150119_a over original ids: `rows` are redstone.js blockProperties() rows ([id, opaque, renderNormal, power, isNormalCube, top]);
// the support is a normal cube, glowstone (89), a slab (44, 126) or one of the original stairs.
export const ORIGINAL_STAIRS = [53, 67, 108, 109, 114, 128, 134, 135, 136, 156, 163, 164];
export function trapdoorSupportOriginal(rows) {
  const ok = new Set([89, 44, 126, ...ORIGINAL_STAIRS]);
  for (const r of rows) if (r[4]) ok.add(r[0]);
  return (id) => ok.has(id);
}

// ---------------------------------------------------------------------------------------------------------------------
// Redstone engine behaviours (original ids 107 and 96), registered on a RedstoneWorld / LiveRedstone. `validSupport(id)` is the
// trapdoor's func_150119_a over original ids.
export function installShapedBlocks(redstone, validSupport) {
  const sound = (w, x, y, z) => w.playAuxSFX(1003, x, y, z);
  // BlockFenceGate.onNeighborBlockChange.
  redstone.registerBehaviour(107, {
    onNeighborBlockChange(w, x, y, z, source) {
      const powered = w.isBlockIndirectlyGettingPowered(x, y, z), meta = w.getBlockMetadata(x, y, z);
      if (!powered && !w.canProvidePower(source)) return;
      if (powered && !gateOpen(meta)) { w.setBlockMetadataWithNotify(x, y, z, meta | 4, 2); sound(w, x, y, z); }
      else if (!powered && gateOpen(meta)) { w.setBlockMetadataWithNotify(x, y, z, meta & ~4, 2); sound(w, x, y, z); }
    },
  });
  // BlockTrapDoor.onNeighborBlockChange: pops off without its support, then follows power (func_150120_a re-reads the metadata,
  // which is 0 once the block is gone).
  redstone.registerBehaviour(96, {
    onNeighborBlockChange(w, x, y, z, source) {
      const meta = w.getBlockMetadata(x, y, z), [dx, dz] = TRAP_SUPPORT[meta & 3];
      if (!validSupport(w.getBlock(x + dx, y, z + dz))) { w.setBlockToAir(x, y, z); w.dropBlockAsItem(x, y, z, 96, meta); }
      const powered = w.isBlockIndirectlyGettingPowered(x, y, z);
      if (powered || w.canProvidePower(source)) {
        const now = w.getBlockMetadata(x, y, z);
        if (trapOpen(now) !== powered) { w.setBlockMetadataWithNotify(x, y, z, now ^ 4, 2); sound(w, x, y, z); }
      }
    },
  });
}
