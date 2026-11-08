// Live piston motion (Java 1.7.10): drawing the TileEntityPiston moving blocks, pushing entities and saving them.
//
// The push logic itself (BlockPistonBase, block events, TileEntityPiston progress) is src/redstone.js, run live by
// src/redstone-live.js. This module adds what that port leaves out:
//   - TileEntityRendererPiston (bmq): the stored block or piston head drawn at the interpolated offset;
//   - TileEntityPiston.func_145863_a: entities inside the moving box are moved by the progress delta;
//   - save / restore of tiles that are mid-motion, plus the Java "Piston" tile entity field set.
//
// installPistons({ redstone, scene, world, entities, blocks }) -> { frame(partialTicks), tick(), save(), restore(list), tiles() }
//
//   redstone  the live engine (LiveRedstone) or a plain RedstoneWorld: needs pistonTiles(), getBlock(x, y, z) and
//             setTileEntity(x, y, z, tile) (ORIGINAL ids, as in redstone.js) and an updateTileEntities() method that its
//             tick runs once per game tick after the block events (the native World.updateEntities tile loop). The
//             installer sets the instance's `pistonPush(tile, progress, delta)` hook, which that loop's TileEntityPiston
//             update calls at the native points (src/redstone.js tileUpdate).
//   scene     VoxelScene: needs setMovingBlocks(list) (src/scene.js). Optional (headless tests omit it).
//   world     the live World ({ get(x, y, z), getMeta(x, y, z) }, INTERNAL ids): collision boxes of stored blocks
//             (blockBounds) and the default entity mover (entities.js moveEntity). Optional for headless runs.
//   entities  what can be pushed (all optional):
//               player: { x, y, z } feet position (or { position: { x, y, z } }), width 0.6, height 1.8 by default,
//                       move?(dx, dy, dz): shift the runtime player (default: write the delta into the position);
//               mobs:   an EntityWorld, an array or a function returning an array of { x, y, z, type, growingAge }, moved
//                       with entities.js moveEntity through `world`;
//               extra:  () => [{ box: [minX, minY, minZ, maxX, maxY, maxZ], move(dx, dy, dz) }] (drops, orbs, carts ...);
//               move?:  (target, dx, dy, dz) overrides every mover (scripted tests).
//   blocks    optional { toInternal(originalId, meta) -> { id, meta } | null } (default block-registry fromOriginal).
//
// CONTRACT FOR THE COORDINATOR (main.js):
//   const pistons = installPistons({ redstone, scene, world, entities, blocks });   // once, after LiveRedstone exists
//   per game tick (20 Hz):  redstone.tick()  (it runs the updateEntities tile loop: per tile progress +0.5 and its entity
//                           pushes, or the final push and the replacement of the finished moving block), THEN pistons.tick()
//                           (re-installs the push hook if the engine was replaced; returns the number of moving tiles).
//   per render frame:       pistons.frame(partialTicks)  -> hands the parts to scene.setMovingBlocks(list); scene.update()
//                           then calls updateMoving() itself (geometry cached per part, only the offset changes per frame).
//   sounds:                 none to do here: redstone.hooks.sound(name, x, y, z, volume, pitch) already receives
//                           "tile.piston.out" (volume 0.5, pitch rand*0.25+0.6) and "tile.piston.in" (volume 0.5,
//                           pitch rand*0.15+0.6, from BlockPistonBase bytecode); the audio ids exist in the manifest.
//   save:                   record.pistons = pistons.save()  (JSON list; src/chunk-runtime.js partitions it per column,
//                           src/world-import.js sanitises it, src/region-export.js writes Java "Piston" tile entities).
//   load:                   after the world edits (cells hold the internal moving block 130) and redstone are restored:
//                           pistons.restore(record.pistons) -> count restored. Like native readFromNBT the tile resumes at
//                           its saved progress and the next two tile updates finish the move. Java imports put the same
//                           list in importJavaRegionArea(...).record.pistons.
//   entities adapter (every key optional):
//     player: { x, y, z } feet position or { position: {x, y, z}, width?, height?, move?(dx, dy, dz) }; with `world` and no
//             move() the delta goes through entities.js moveEntity (collision) and is written back to the position, so
//             main.js should pass the live player object (or give move() that updates its own position/velocity).
//     mobs:   EntityWorld | array | () => array of { x, y, z, type, growingAge, health? } (box from ENTITY_TYPES);
//     extra:  () => [{ box: [minX, minY, minZ, maxX, maxY, maxZ], move(dx, dy, dz) }] for drops, orbs, carts;
//     move:   (target, dx, dy, dz) overrides every mover;
//     order:  (candidates) => candidates in push order (default nativeOrder: chunk, then 16-high slice); each candidate is
//             { box, move, entity } with `entity` the pushed object (the extra itself when it has no `entity`).
//   Returned object: { frame(partial), tick(), tiles(), pushBoxes(), moves, save(), restore(list) }.
//
import { fromOriginal } from "./block-registry.js";
import { blockBounds } from "./world.js";
import { pistonQuads, FACING_OFFSETS, PISTON, STICKY_PISTON, PISTON_HEAD } from "./dispenser-piston.js";
import { ENTITY_TYPES, pushBox, moveEntity } from "./entities.js";
import { pistonTile } from "./redstone.js";
import { pushPlayer } from "./piston-push.js";

const f32 = Math.fround;
export const ORIGINAL_PISTON = 33, ORIGINAL_STICKY = 29, ORIGINAL_HEAD = 34, ORIGINAL_MOVING = 36;
const FX = [0, 0, 0, 0, -1, 1], FY = [-1, 1, 0, 0, 0, 0], FZ = [0, 0, -1, 1, 0, 0];

// TileEntityPiston.func_145860_a(partial): the eased progress (partial clamped to 1).
export function tileProgress(tile, partial) {
  const p = partial > 1 ? 1 : f32(partial);
  return f32(tile.lastProgress + f32(f32(tile.progress - tile.lastProgress) * p));
}
// TileEntityPiston.func_145865_b/c/d(partial): the offset of the drawn block along its facing.
export function tileOffset(tile, partial) {
  const p = tileProgress(tile, partial), a = tile.extending ? f32(p - 1) : f32(1 - p), k = tile.facing;
  return [f32(a * FX[k]), f32(a * FY[k]), f32(a * FZ[k])];
}
// The push box: BlockPistonMoving.func_149964_a(world, x, y, z, stored, progress, facing) on the stored block's
// collision box (`bounds` = [x0, y0, z0, x1, y1, z1] relative to the cell, or null when it has none).
export function pushBoxOf(tile, bounds, arg) {
  if (!bounds) return null;
  const b = [tile.x + bounds[0], tile.y + bounds[1], tile.z + bounds[2], tile.x + bounds[3], tile.y + bounds[4], tile.z + bounds[5]],
    k = tile.facing,
    d = [FX[k], FY[k], FZ[k]];
  for (let a = 0; a < 3; a++) {
    const shift = f32(d[a] * f32(arg));
    if (d[a] < 0) b[a] -= shift;
    else b[a + 3] -= shift;
  }
  return b;
}
// BlockPistonMoving.getCollisionBoundingBoxFromPool: the same shift with progress = extending ? 1 - p : p (retracting uses p itself, unlike
// pushArgument below, which is the entity-push argument). `p` is the eased progress (tileProgress). Replayed by block-sweep3.test.js.
export const movingCollisionBox = (tile, bounds, p) => pushBoxOf(tile, bounds, tile.extending ? f32(1 - p) : f32(p));
// The progress argument of func_145863_a: extending counts down from 1, retracting up from -1.
export const pushArgument = (tile, progress) => (tile.extending ? f32(1 - progress) : f32(progress - 1));

// RenderBlocks.renderPistonExtension(..., false): the short head, an arm 0.5 long (0.25..0.75 along its axis, half the
// piston_side texture). pistonQuads gives the full arm; the last four quads are the arm.
const ARM_AXIS = [1, 1, 2, 2, 0, 0];
export function shortenHead(quads, facing) {
  const axis = ARM_AXIS[Math.min(facing, 5)];
  return quads.map((q, i) => {
    if (i < quads.length - 4) return q;
    return { ...q, verts: q.verts.map((v) => { const out = v.slice(); out[axis] = v[3] === 1 ? 0.75 : 0.25; out[3] = v[3] === 1 ? 0.5 : 0; return out; }) };
  });
}

// Stored blocks whose native pool box differs from their render bounds when read through the moving cell (probed natively with
// PistonLiveProbe: odd-block-* and trapdoor-facing-* scenarios): carpet comes out zero high ([0,0,0,1,0,1], native stale bounds), fences, nether fences and farmland as the full cube
// (BlockFence / BlockFarmland keep their constructor bounds), soul sand 7/8 high, a cobblestone wall its post 1.5 high. Every other stored block uses blockBounds with the moving cell's metadata
// (batch 24 added every stairs id, the slab variants, anvil / trapdoor / ladder / snow metadata, carpet colour, the mossy wall: odd-block2-*).
const POOL_OVERRIDES = { 171: [0, 0, 0, 1, 0, 1], 85: [0, 0, 0, 1, 1, 1], 113: [0, 0, 0, 1, 1, 1], 60: [0, 0, 0, 1, 1, 1], 88: [0, 0, 0, 1, 0.875, 1], 139: [0.25, 0, 0.25, 0.75, 1.5, 0.75] };
const NO_POOL_BOX = new Set([27, 28, 66, 157]);
const isBase = (id) => id === ORIGINAL_PISTON || id === ORIGINAL_STICKY;
// TileEntityRendererPiston.renderTileEntityAt as drawing parts: [{ block, meta, quads?, offset }] in the cell's own frame.
// Skips an air block or a finished move (progress >= 1). `internal(original, meta)` maps to the live ids.
export function movingParts(tile, partial, internal) {
  const prog = tileProgress(tile, partial);
  if (!tile.block || prog >= 1) return [];
  const offset = tileOffset(tile, partial), none = [0, 0, 0], stored = internal(tile.block, tile.meta);
  if (!stored) return [];
  if (tile.block === ORIGINAL_HEAD && prog < 0.5) {
    const meta = tile.meta;
    return [{ block: PISTON_HEAD, meta, quads: shortenHead(pistonQuads(PISTON_HEAD, meta), Math.min(meta & 7, 5)), offset }];
  }
  if (tile.renderHead && !tile.extending) {
    // The retracting base: the head with the base's own top icon (arm full until half way, then short), then the base itself
    // in its cell.
    const meta = (tile.meta & 7) | (tile.block === ORIGINAL_STICKY ? 8 : 0), full = pistonQuads(PISTON_HEAD, meta);
    return [
      { block: PISTON_HEAD, meta, quads: prog < 0.5 ? full : shortenHead(full, Math.min(meta & 7, 5)), offset },
      { block: stored.id, meta: stored.meta, quads: pistonQuads(stored.id, stored.meta), offset: none },
    ];
  }
  const isPiston = stored.id === PISTON || stored.id === STICKY_PISTON || stored.id === PISTON_HEAD;
  return [{ block: stored.id, meta: stored.meta, quads: isPiston ? pistonQuads(stored.id, stored.meta) : null, offset }];
}

// World.getEntitiesWithinAABBExcludingEntity's order: chunk x, then chunk z, then the chunk's 16-high entity slice (Chunk.entityLists,
// clamped 0..15), then each slice's own list order. The port has no shared entity list, so inside one slice the entity systems keep
// their order (player, mobs, then the extras: items, TNT, falling blocks, orbs, carts, boats); the slice is read from the box bottom.
const chunkKey = (c) => [Math.floor((c.box[0] + c.box[3]) / 32), Math.floor((c.box[2] + c.box[5]) / 32), Math.max(0, Math.min(15, Math.floor(c.box[1] / 16)))];
export function nativeOrder(list) {
  const keyed = list.map((c, i) => ({ c, i, k: chunkKey(c) }));
  keyed.sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.i - b.i);
  return keyed.map((x) => x.c);
}
export function installPistons({ redstone, scene = null, world = null, entities = {}, blocks = null } = {}) {
  const internal = blocks?.toInternal ?? ((id, meta) => fromOriginal(id, meta));
  // The stored block's collision box in the cell. blockBounds reads the world at the cell, so give it a one-cell view.
  const boundsOf = (tile) => {
    const stored = internal(tile.block, tile.meta);
    if (!stored || tile.block === 0) return null;
    // Native: Blocks.piston_head keeps whatever bounds it was last given (a fresh game: the full cube, recorded by
    // PistonLiveProbe); BlockPistonExtension has no getCollisionBoundingBoxFromPool of its own.
    if (tile.block === ORIGINAL_HEAD) return [0, 0, 0, 1, 1, 1];
    if (POOL_OVERRIDES[tile.block]) return POOL_OVERRIDES[tile.block].slice();
    // No pool box at all, so func_149964_a returns null (no push, no collision): BlockRailBase (rails, powered, detector and
    // activator rails) and an open fence gate (probed: odd-block2-66-*, 27, 28, 157, 107-4).
    if (NO_POOL_BOX.has(tile.block) || (tile.block === 107 && tile.meta & 4)) return null;
    // Fence gate: the 1.5 high collision slab (closed on z for even metadata, x for odd), not the 1.0 render box.
    if (tile.block === 107) return stored.meta & 1 ? [0.375, 0, 0, 0.625, 1.5, 1] : [0, 0, 0.375, 1, 1.5, 0.625];
    // Native: the stored block's box methods run with the world at this cell, which holds the MOVING block. A top slab (stone or
    // wood) still comes out as the bottom box (probed: odd-block-slab-top, wooden-slab); other blocks follow their own metadata.
    const view = {
      get: (x, y, z) => (x === tile.x && y === tile.y && z === tile.z ? stored.id : world?.get ? world.get(x, y, z) : 0),
      getMeta: (x, y, z) => (x === tile.x && y === tile.y && z === tile.z ? (tile.block === 44 || tile.block === 126 ? stored.meta & 7 : stored.meta) : world?.getMeta ? world.getMeta(x, y, z) : 0),
    };
    try {
      const b = blockBounds(view, tile.x, tile.y, tile.z);
      return Array.isArray(b) ? b : [0, 0, 0, 1, 1, 1];
    } catch {
      return [0, 0, 0, 1, 1, 1];
    }
  };
  const playerBox = () => {
    const p = entities.player;
    if (!p) return null;
    const pos = p.position ?? p, w = p.width ?? 0.6, h = p.height ?? 1.8;
    return [pos.x - w / 2, pos.y, pos.z - w / 2, pos.x + w / 2, pos.y + h, pos.z + w / 2];
  };
  // The mob source: an EntityWorld (its pushMove runs the mob's own moveEntity with tails), an array, or a function of either.
  const mobSource = () => (typeof entities.mobs === "function" ? entities.mobs() : entities.mobs);
  const mobList = (m) => (!m ? [] : Array.isArray(m) ? m : m.entities ?? []);
  // Every pushable entity as { box, move }.
  const candidates = () => {
    const out = [],
      shift = (target, dx, dy, dz) => {
        if (entities.move) return entities.move(target, dx, dy, dz);
        if (target.move) return target.move(dx, dy, dz);
        if (target.pos) { target.pos.x += dx; target.pos.y += dy; target.pos.z += dz; }
      };
    const pb = playerBox();
    if (pb) {
      const p = entities.player, pos = p.position ?? p;
      out.push({
        box: pb, entity: p,
        // Entity.moveEntity on the player's own state (piston-push.js pushPlayer): motion, flags, ySize, sneak edge.
        move: (dx, dy, dz) => {
          if (entities.move) return entities.move(p, dx, dy, dz);
          if (p.move) return p.move(dx, dy, dz);
          pushPlayer(world, p, dx, dy, dz);
        },
      });
    }
    const source = mobSource();
    for (const e of mobList(source)) {
      const t = ENTITY_TYPES[e.type];
      if (!t || !(e.health > 0 || (e.death ?? 0) < 20)) continue;
      const [width, height] = source?.size ? source.size(e) : [t.width * ((e.growingAge ?? 0) < 0 ? 0.5 : 1), t.height * ((e.growingAge ?? 0) < 0 ? 0.5 : 1)];
      out.push({
        box: pushBox(e, width, height), entity: e,
        // EntityWorld.pushMove: the mob's own moveEntity (stepHeight, cactus/fire tails, steps, fall); else entities.js moveEntity.
        move: (dx, dy, dz) => {
          if (entities.move) return entities.move(e, dx, dy, dz);
          if (e.move) return e.move(dx, dy, dz);
          if (world && source?.pushMove) source.pushMove(e, dx, dy, dz);
          else if (world) moveEntity(world, e, width, height, dx, dy, dz);
          else { e.x += dx; e.y += dy; e.z += dz; }
        },
      });
    }
    for (const x of entities.extra?.() ?? []) out.push({ box: x.box, move: (dx, dy, dz) => (entities.move ? entities.move(x, dx, dy, dz) : x.move(dx, dy, dz)), entity: x.entity ?? x });
    return entities.order ? entities.order(out) : nativeOrder(out);
  };
  const moved = []; // every func_145863_a move this session (for diagnostics and tests)
  // TileEntityPiston.func_145863_a(progress, delta): the box of the stored block at `progress`, then every entity that
  // intersects it (AxisAlignedBB.intersectsWith) moves by delta along the facing, in one pass.
  function push(tile, progress, delta) {
    const box = pushBoxOf(tile, boundsOf(tile), pushArgument(tile, progress));
    if (!box) return;
    const hit = candidates().filter((c) => c.box[3] > box[0] && c.box[0] < box[3] && c.box[4] > box[1] && c.box[1] < box[4] && c.box[5] > box[2] && c.box[2] < box[5]);
    for (const c of hit) {
      const d = f32(delta), k = tile.facing, mv = [d * FX[k], d * FY[k], d * FZ[k]];
      c.move(mv[0], mv[1], mv[2]);
      moved.push({ x: tile.x, y: tile.y, z: tile.z, move: mv });
    }
  }
  // TileEntityPiston.updateEntity's func_145863_a calls, made from inside the native tile loop (redstone.js tileUpdate calls
  // `pistonPush` on the engine): each tile pushes in World.loadedTileEntityList order, so a tile later in the list sees the
  // entities already moved by earlier tiles, the earlier tiles' new lastProgress in their collision boxes and the later tiles'
  // old one, and a finishing tile pushes (1.0, 0.25) while its cell still holds the moving block.
  //   lastProgress >= 1: push(1.0, 0.25) (the final update);  extending: push(progress, progress - lastProgress + 0.0625).
  const hook = (tile, progress, delta) => push(tile, progress, delta);
  hook.pistonLive = true;
  const wrap = () => {
    if (redstone.pistonPush?.pistonLive) return;
    redstone.pistonPush = hook;
  };
  wrap();

  const api = {
    // Parts for the scene this frame; also handed to scene.setMovingBlocks.
    frame(partial = 0) {
      const list = [];
      for (const tile of redstone.pistonTiles()) {
        const parts = movingParts(tile, partial, internal);
        if (parts.length) list.push({ x: tile.x, y: tile.y, z: tile.z, parts });
      }
      scene?.setMovingBlocks?.(list);
      return list;
    },
    tick() {
      wrap();
      return redstone.pistonTiles().length;
    },
    tiles: () => redstone.pistonTiles(),
    // Current push box of every tile (BlockPistonMoving.func_149964_a at the tile's progress), null when it has none.
    pushBoxes: () => redstone.pistonTiles().map((t) => pushBoxOf(t, boundsOf(t), pushArgument(t, t.progress))),
    moves: moved,
    // BlockPistonMoving.getCollisionBoundingBoxFromPool for every moving tile whose box meets `box`: the stored block's box
    // shifted by func_149964_a at partial 0 (tile.lastProgress; extending uses 1 - p, retracting p itself).
    collisionBoxes(box) {
      const out = [];
      for (const t of redstone.pistonTiles()) {
        // World.getCollidingBoundingBoxes visits the cells floor(minX)..floor(maxX) (and z), floor(minY) - 1..floor(maxY): the
        // cell below counts, so a stored block taller than 1 (cobblestone wall post, fence gate) still meets a box above its cell.
        // An invalidated tile is no longer returned by World.getTileEntity.
        if (t.invalid || t.x < Math.floor(box[0]) || t.x > Math.floor(box[3]) || t.y < Math.floor(box[1]) - 1 || t.y > Math.floor(box[4]) || t.z < Math.floor(box[2]) || t.z > Math.floor(box[5])) continue;
        const b = movingCollisionBox(t, boundsOf(t), tileProgress(t, 0));
        if (b && b[3] > box[0] && b[0] < box[3] && b[4] > box[1] && b[1] < box[4] && b[5] > box[2] && b[2] < box[5]) out.push(b);
      }
      return out;
    },
    // Moving tiles in a JSON-able list: world position, stored ORIGINAL block and metadata, facing, progress, extending
    // (the TileEntityPiston NBT) plus renderHead and lastProgress, which the Java NBT does not carry.
    save() {
      return redstone.pistonTiles().map((t) => ({ x: t.x, y: t.y, z: t.z, block: t.block, meta: t.meta, facing: t.facing, extending: !!t.extending, renderHead: !!t.renderHead, progress: t.progress, lastProgress: t.lastProgress }));
    },
    // TileEntityPiston.readFromNBT: progress = lastProgress = the saved progress. The cell must already hold the moving
    // block (original 36); other cells are skipped. Returns the number restored.
    restore(list) {
      let n = 0;
      for (const e of Array.isArray(list) ? list : []) {
        if (![e.x, e.y, e.z, e.block, e.meta, e.facing, e.progress].every(Number.isFinite) || e.facing < 0 || e.facing > 5) continue;
        if (redstone.getBlock(e.x, e.y, e.z) !== ORIGINAL_MOVING) continue;
        const tile = pistonTile(e.block, e.meta, e.facing, !!e.extending, !!e.renderHead);
        tile.progress = tile.lastProgress = Math.max(0, Math.min(1, f32(e.progress)));
        redstone.setTileEntity(e.x, e.y, e.z, tile);
        n++;
      }
      return n;
    },
  };
  return api;
}
// Block entity fields for the Java "Piston" TileEntity (TileEntityPiston.writeToNBT): blockId, blockData, facing, progress,
// extending, used by region-export.js.
export const pistonTileFields = (t) => ({ blockId: t.block, blockData: t.meta, facing: t.facing, progress: t.progress, extending: !!t.extending });
