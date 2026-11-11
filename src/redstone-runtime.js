// The browser game's redstone and piston runtime: builds LiveRedstone (src/redstone-live.js) over the running World
// with every hook wired to the game's systems, installs the pistons (src/piston-live.js) and exposes the few calls
// src/main.js makes. Everything the game owns arrives through the `game` object (getters, because main.js reassigns
// its runtimes), so this module runs headlessly in tests.
//
//   createRedstoneRuntime({ world, scene, game }) -> { redstone, pistons, tick, frame, flush, use, applyEdit,
//     fluidChanges, containerClosed, save, restore, dispose }
//
//   game.sound(name, x, y, z, volume, pitch)   positional sound
//   game.drop(x, y, z, { id, count, damage })  block drop (Block.dropBlockAsItem)
//   game.primeTnt(x, y, z)                     BlockTNT.func_150114_a (the block is removed by the engine)
//   game.markUnsaved()
//   game.music: particle(name, x, y, z, vx, vy, vz), play(discItem | null, x, y, z) (record start / stop), spawn(stack, x, y, z) (an ejected disc)
//   game.player()  -> { position: {x, y, z}, width, height, alive, velocity?, motion?, onGround?, collidedH?, fallDistance?,
//                       flying?, inWater?, vehicle?, rider? } | null (the flag fields as getters/setters on the live state)
//   game.boatSystem() -> Boats (pistons move boats with Boats.move)
//   game.mobs()    -> EntityWorld | null         game.items() / arrows() / orbs() / primed() -> arrays
//   game.chests() / furnaces() / dispensers() / hoppers()    keyed "x,y,z" stores (survival.js)
//   game.maxStack(stack)
//   game.subtracted() -> skylight subtracted     game.angle() -> celestial angle in [0, 1)
//   game.skyLight(x, y, z)
import { installCommandBlocks } from "./command-block.js";
import { installNoteBlocks } from "./note-blocks.js";
import { installJukeboxes, JUKEBOX_ID } from "./jukebox.js";
import { isDisc } from "./note-jukebox-content.js";
import { installShapedBlocks, trapdoorSupportOriginal } from "./shaped-blocks.js";
import { blockProperties, pistonTile } from "./redstone.js";
import { LiveRedstone } from "./redstone-live.js";
import { installPistons } from "./piston-live.js";
import { pistonPushExtras } from "./piston-push.js";
import { setMovingBoxes } from "./entities.js";
import { applyPlayerEdit } from "./player-edit-simulation.js";
import { pushBox, ENTITY_TYPES } from "./entities.js";
import { LEVER, STONE_BUTTON, REPEATER } from "./redstone-blocks.js";
import { WOODEN_BUTTON, COMPARATOR, COMPARATOR_POWERED, PISTON_MOVING } from "./world.js";
import { CHEST } from "./chest.js";
import { TRAPPED_CHEST, trappedPower, trappedStrongPower } from "./chest-blocks.js";
import { hopperBehaviour } from "./hopper.js";
import { installPoweredRails } from "./powered-rails.js";
import { installDispensers } from "./dispense.js";

// Blocks a right click operates through the redstone engine (lever, both buttons, repeater, both comparators).
export const USE_BLOCKS = new Set([LEVER, STONE_BUTTON, WOODEN_BUTTON, REPEATER, COMPARATOR, COMPARATOR_POWERED]);
const inside = (b, [x0, y0, z0, x1, y1, z1]) => b[3] > x0 && b[0] < x1 && b[4] > y0 && b[1] < y1 && b[5] > z0 && b[2] < z1;
const FALLING_HALF = 0.49, FALLING_SIZE = 0.98;
const ITEM_SIZE = 0.25, ITEM_HALF = 0.125, ARROW_HALF = 0.25, ARROW_SIZE = 0.5, TNT_HALF = 0.49, TNT_SIZE = 0.98;

// The comparators' view of the TileEntity inventories (LiveRedstone hooks.containerSlots): { count, max } slots by original id, a double
// chest reading both halves (west or north first). `game` gives chests(), furnaces(), dispensers(), hoppers(), brewing(), maxStack(s);
// the gun server uses it too (multiplayer/simulation.js).
export function containerSlotsOf(world, game) {
  const slotsOf = (items) => (items ?? []).map((s) => (s && s.count > 0 ? { count: s.count, max: game.maxStack?.(s) ?? 64 } : null));
  return (x, y, z, id) => {
    const key = `${x},${y},${z}`;
    if (id === 54 || id === 146) { // a trapped chest (146, internal 162) pairs only with its own kind
      const kind = id === 146 ? TRAPPED_CHEST : CHEST, chests = game.chests?.() ?? {}, self = chests[key]?.items ?? Array(27).fill(null);
      for (const [dx, dz, first] of [[-1, 0, true], [1, 0, false], [0, -1, true], [0, 1, false]]) {
        if (world.get(x + dx, y, z + dz) !== kind) continue;
        const other = chests[`${x + dx},${y},${z + dz}`]?.items ?? Array(27).fill(null);
        return slotsOf(first ? [...other, ...self] : [...self, ...other]);
      }
      return slotsOf(self);
    }
    if (id === 61 || id === 62) return slotsOf(game.furnaces?.()[key]?.items ?? [null, null, null]);
    if (id === 23 || id === 158) return slotsOf(game.dispensers?.()[key]?.items ?? Array(9).fill(null));
    if (id === 154) return slotsOf(game.hoppers?.()[key]?.items ?? Array(5).fill(null));
    if (id === 117) return slotsOf(game.brewing?.()[key]?.items ?? Array(4).fill(null)); // TileEntityBrewingStand: Container.calcRedstoneFromInventory over 4 slots
    return null;
  };
}
export function createRedstoneRuntime({ world, scene = null, game = {} }) {
  const changes = [];
  const flush = () => {
    if (!changes.length) return;
    const list = changes.splice(0);
    scene?.updateBlocks?.(list);
    game.markUnsaved?.();
  };
  // Minecarts (game.minecarts() -> Minecarts): "minecart" asks for EntityMinecart, "inventory" for the carts that are IInventory
  // (chest carts, as { cart, signal } with Container.calcRedstoneFromInventory); "all" (pressure plates) includes every cart.
  const cartsIn = (box, mode) => {
    const mc = game.minecarts?.(), out = [];
    for (const c of mc?.carts ?? []) {
      if (c.dead || !c.bb || !inside(c.bb, box)) continue;
      if (mode !== "inventory") out.push(c);
      else if (c.type === 1 || c.type === 5) out.push({ cart: c, signal: mc.comparator(c) });
    }
    return out;
  };
  // Modes beyond the plates': "tripwire" (BlockTripWire.func_150140_e: all entities but EntityBat, whose class answers true to
  // doesEntityNotTriggerPressurePlate) and "collider" (the entities that reach Entity.func_145775_I and so call
  // onEntityCollidedWithBlock: not thrown snowballs/eggs/pearls/potions, not an arrow stuck in a block). Probed in
  // tripwire-reference.json (tripwireEntities, collisionCallers).
  const entitiesIn = (box, mode) => {
    if (mode === "minecart" || mode === "inventory") return cartsIn(box, mode);
    const tripwire = mode === "tripwire" || mode === "collider", collider = mode === "collider";
    if (tripwire) mode = "all";
    const out = [], p = game.player?.();
    if (p && p.alive !== false && inside(pushBox(p.position, p.width ?? 0.6, p.height ?? 1.8), box)) out.push(p);
    const mobs = game.mobs?.();
    for (const e of mobs?.entities ?? []) {
      if (!(e.health > 0) || !ENTITY_TYPES[e.type] || (tripwire && e.type === "bat")) continue;
      if (inside(pushBox(e, ...mobs.size(e)), box)) out.push(e);
    }
    if (mode !== "all") return out;
    for (const e of game.items?.() ?? []) if (inside([e.x - ITEM_HALF, e.y, e.z - ITEM_HALF, e.x + ITEM_HALF, e.y + ITEM_SIZE, e.z + ITEM_HALF], box)) out.push(e);
    if (tripwire && !collider)
      for (const e of game.thrown?.() ?? []) if (!e.dead && inside([e.x - ITEM_HALF, e.y, e.z - ITEM_HALF, e.x + ITEM_HALF, e.y + ITEM_SIZE, e.z + ITEM_HALF], box)) out.push(e);
    for (const e of game.arrows?.() ?? []) if (!e.dead && !(collider && e.inGround) && inside([e.x - ARROW_HALF, e.y, e.z - ARROW_HALF, e.x + ARROW_HALF, e.y + ARROW_SIZE, e.z + ARROW_HALF], box)) out.push(e);
    for (const e of game.orbs?.() ?? []) if (e.bb && inside(e.bb, box)) out.push(e);
    for (const e of game.primed?.() ?? []) if (inside([e.x - TNT_HALF, e.y, e.z - TNT_HALF, e.x + TNT_HALF, e.y + TNT_SIZE, e.z + TNT_HALF], box)) out.push(e);
    out.push(...cartsIn(box, "minecart"));
    // EntityBoat and EntityFallingBlock (getEntitiesWithinAABB takes every entity; both reach func_145775_I through moveEntity,
    // so they also count in "collider" mode). Probed: tripwire-reference.json boat-trips / falling-block-trips.
    for (const b of game.boats?.() ?? []) if (!b.dead && b.bb && inside(b.bb, box)) out.push(b);
    for (const e of game.falling?.() ?? []) if (!e.dead && inside([e.x - FALLING_HALF, e.y, e.z - FALLING_HALF, e.x + FALLING_HALF, e.y + FALLING_SIZE, e.z + FALLING_HALF], box)) out.push(e);
    return out;
  };
  const containerSlots = containerSlotsOf(world, game);
  const redstone = new LiveRedstone(world, {
    changed: (x, y, z, old, now) => {
      if (changes.length < 20000) changes.push([x, y, z, old ?? world.get(x, y, z), now ?? world.get(x, y, z)]);
    },
    sound: (name, x, y, z, volume, pitch) => game.sound?.(name, x, y, z, volume, pitch),
    drop: (x, y, z, stack) => game.drop?.(x, y, z, stack),
    primeTnt: (x, y, z) => game.primeTnt?.(x, y, z),
    entitiesIn,
    containerSlots,
    environment: () => ({ skylightSubtracted: game.subtracted?.() ?? 0, celestialAngle: Math.fround((game.angle?.() ?? 0) * Math.PI * 2), sky: 15, noSky: !!world.hasNoSky }), // BlockDaylightDetector.func_149957_e returns early where provider.hasNoSky (aqo.g)
    skyLight: (x, y, z) => game.skyLight?.(x, y, z) ?? 15,
  });
  const commandBlocks = installCommandBlocks(redstone, { host: () => game.commandHost(), changed: () => game.markUnsaved?.() });
  installShapedBlocks(redstone, trapdoorSupportOriginal(blockProperties())); // fence gates (107) and trapdoors (96): redstone opening, trapdoor support loss
  const noteBlocks = installNoteBlocks(redstone, { particle: (...a) => game.music?.particle?.(...a), changed: () => game.markUnsaved?.() });
  const jukeboxes = installJukeboxes(redstone, { play: (...a) => game.music?.play?.(...a), spawn: (...a) => game.music?.spawn?.(...a), changed: () => game.markUnsaved?.() });
  // Note block and jukebox right and left clicks (note-blocks.js, jukebox.js): { handled, consumed } where consumed is a disc taken from the held stack.
  const music = {
    noteBlocks,
    jukeboxes,
    use(x, y, z, held = 0) {
      const id = redstone.getBlock(x, y, z);
      let result = { handled: false, consumed: false };
      if (id === JUKEBOX_ID && redstone.getBlockMetadata(x, y, z) === 0) {
        if (isDisc(held) && jukeboxes.insert(x, y, z, held)) result = { handled: true, consumed: true };
      } else if (id === 25 || id === JUKEBOX_ID) result = { handled: redstone.use(x, y, z), consumed: false };
      flush();
      return result;
    },
    click(x, y, z) { if (redstone.getBlock(x, y, z) === 25) { noteBlocks.click(x, y, z); flush(); } },
    // One record list: { kind: "note", x, y, z, note } and { kind: "jukebox", x, y, z, record }.
    save: () => [...noteBlocks.save().map((e) => ({ kind: "note", ...e })), ...jukeboxes.save().map((e) => ({ kind: "jukebox", ...e }))],
    restore(records) { noteBlocks.restore(records?.filter((e) => e.kind === "note")); jukeboxes.restore(records?.filter((e) => e.kind === "jukebox")); },
  };
  // BlockChest type 1 (trapped chest 146): canProvidePower; weak power is the viewer count (TileEntityChest.numPlayersUsing) clamped to
  // 0..15 on every side, strong power only toward the block beneath (side 1). chests-reference.json "power" records.
  const viewers = (x, y, z) => game.chests?.()[`${x},${y},${z}`]?.users ?? 0;
  redstone.registerBehaviour(146, {
    weak: (w, x, y, z) => trappedPower(viewers(x, y, z)),
    strong: (w, x, y, z, side) => trappedStrongPower(viewers(x, y, z), side),
  });
  redstone.registerBehaviour(154, hopperBehaviour); // BlockHopper: power disables it (metadata bit 8)
  installPoweredRails(redstone); // powered / detector / activator rails and the plain rail's redstone hooks
  // BlockDispenser (23) and BlockDropper (158): dispense.js over the game's entity and block hooks (game.dispense). Sounds are the
  // aux effects 1000 / 1001 (click) and 1002 (bow); the smoke particles (2000) are not drawn.
  const AUX_SOUNDS = { 1000: ["random.click", 1], 1001: ["random.click", 1.2], 1002: ["random.bow", 1.2] };
  const hooks = () => game.dispense ?? {};
  installDispensers(redstone, {
    tile: (x, y, z) => (game.dispensers()[`${x},${y},${z}`] ??= { items: Array(9).fill(null) }),
    aux: (id, x, y, z) => { const s = AUX_SOUNDS[id]; if (s) game.sound?.(s[0], x + 0.5, y + 0.5, z + 0.5, 1, s[1]); },
    rng: () => hooks().rng?.(),
    spawnItem: (...a) => hooks().spawnItem?.(...a),
    arrow: (...a) => hooks().arrow?.(...a),
    thrown: (...a) => hooks().thrown?.(...a),
    cart: (...a) => hooks().cart?.(...a),
    fireball: (...a) => hooks().fireball?.(...a), // fire charges (dispense.js FIRE_CHARGE)
    firework: (...a) => hooks().firework?.(...a), // firework rockets (dispense.js FIREWORK)
    spawnTnt: (...a) => hooks().spawnTnt?.(...a),
    setLiquid: (...a) => hooks().setLiquid?.(...a),
    setAir: (...a) => hooks().setAir?.(...a),
    setFire: (...a) => hooks().setFire?.(...a),
    breakBlock: (...a) => hooks().breakBlock?.(...a),
    boneMeal: (...a) => hooks().boneMeal?.(...a),
    transfer: () => game.transfer?.(),
    maxStack: (s) => game.maxStack?.(s) ?? 64,
    changed: () => game.markUnsaved?.(),
  });
  const pistons = installPistons({
    redstone,
    scene,
    world,
    entities: {
      // The runtime player adapter (position, velocity, motion, flag setters): pushed through its own moveEntity (piston-push.js).
      get player() { return game.player?.() ?? null; },
      mobs: () => game.mobs?.() ?? [], // the EntityWorld: pushMove runs each mob's own moveEntity
      extra: () => pistonPushExtras(world, game),
    },
  });

  // BlockPistonMoving's collision box joins World.getCollidingBoundingBoxes (entities.js collisionBoxes): entities stand on and bump into moving blocks.
  setMovingBoxes((box) => pistons.collisionBoxes(box));

  // A gun server's moving tiles (multiplayer/server-pistons.js rows: x, y, z, ORIGINAL block and metadata, facing, extending,
  // renderHead, progress, lastProgress) in place of this tab's own: frame() draws them between the server's last two ticks.
  // Only cells that hold the moving block here are taken (a column this tab has not got is skipped).
  function showPistons(rows) {
    for (const t of redstone.pistonTiles()) redstone.removeTileEntity(t.x, t.y, t.z);
    for (const r of Array.isArray(rows) ? rows.slice(0, 256) : []) {
      if (!Array.isArray(r) || r.length < 10 || !r.every(Number.isFinite)) continue;
      const [x, y, z, block, meta, facing, extending, renderHead, progress, lastProgress] = r;
      if (facing < 0 || facing > 5 || world.get(x, y, z) !== PISTON_MOVING) continue;
      const te = pistonTile(block, meta, facing, !!extending, !!renderHead);
      te.progress = Math.max(0, Math.min(1, progress));
      te.lastProgress = Math.max(0, Math.min(1, lastProgress));
      redstone.setTileEntity(x, y, z, te);
    }
  }

  // One 20 TPS game tick: scheduled block updates, block events and the tile-entity loop (pistons), then the pistons'
  // entity pushes. main.js calls this right after the fluid and fire scheduled ticks (see public/research/redstone-live.md).
  // A cart over a detector rail (Entity.func_145775_I -> BlockRailDetector.onEntityCollidedWithBlock), wired lazily because
  // main.js reassigns its Minecarts when a world loads.
  const cartTouch = (x, y, z) => {
    redstone.collide(x, y, z);
    flush();
  };
  const tick = () => {
    const mc = game.minecarts?.();
    if (mc && mc.blockHook !== cartTouch) mc.blockHook = cartTouch;
    redstone.tick();
    pistons.tick();
    flush();
  };
  // A right click on a redstone block. True when the engine consumed the click.
  const use = (x, y, z) => {
    const used = redstone.use(x, y, z);
    flush();
    return used;
  };
  // Wraps applyPlayerEdit: levers, buttons, repeaters and comparators run through the engine; a placement that did not go
  // through world.set (two-step placeHeldBlock) gets its onBlockAdded / neighbour tail and onBlockPlacedBy afterwards.
  const applyEdit = (state, request, hooks) => {
    const target = request.place && !request.aimedEntity && request.target?.block;
    if (target && state.screen === "playing" && !(state.motion?.sneaking && state.heldTool) && USE_BLOCKS.has(world.get(...target))) {
      hooks.unlock?.();
      hooks.swing?.();
      if (use(...target)) {
        game.markUnsaved?.();
        return { handled: true, branch: "use-redstone" };
      }
    }
    redstone.touched = new Set();
    let result;
    try {
      result = applyPlayerEdit(state, request, hooks);
      const placement = result?.placement;
      if (placement?.placed && placement.position) {
        const [x, y, z] = placement.position, cells = placement.reason === "door" ? [[x, y, z], [x, y + 1, z]] : [[x, y, z]];
        for (const c of cells) if (!redstone.touched.has(c.join(","))) redstone.placed(...c);
        if (placement.reason === "block") placedBy(x, y, z, state);
      }
    } finally {
      redstone.touched = null;
    }
    flush();
    return result;
  };
  // Block.onBlockPlacedBy for the diodes and pistons (their metadata was already set from the placer by the placement code).
  function placedBy(x, y, z, state) {
    const id = redstone.getBlock(x, y, z), behaviour = redstone.behaviours[id];
    if (id === 137) { commandBlocks.tile(x, y, z).customName = state.survival?.held?.displayName ?? '@'; return; }
    if (id === 131) { behaviour.onPostBlockPlaced(redstone, x, y, z, redstone.getBlockMetadata(x, y, z)); return; } // ItemBlock.placeBlockAt: onPostBlockPlaced(meta)
    if (!behaviour?.onBlockPlacedBy) return;
    const mcYaw = Math.fround(180 - (state.yaw * 180) / Math.PI);
    behaviour.onBlockPlacedBy(redstone, x, y, z, id === 33 || id === 29 ? { x: state.position.x, y: state.position.y, z: state.position.z, yaw: mcYaw } : mcYaw);
  }
  // [x, y, z, old, new] changes of the fluid and fire ticks: fluids write with world.put, so the redstone side learns here.
  const fluidChanges = (list) => {
    for (const [x, y, z, old, now] of list) if (old !== now) redstone.external(x, y, z, old);
    flush();
  };
  // A container screen closed: comparators read the new contents.
  const containerClosed = (keys) => {
    for (const key of keys ?? []) redstone.containerChanged(...String(key).split(",").map(Number));
    flush();
  };
  // TileEntityChest.func_145969_a / func_145976_d (a viewer opened or closed): notifyBlocksOfNeighborChange at the chest and at the block
  // beneath it, with the chest as the source (the probe's openLog/closeLog), so a trapped chest's power reaches its neighbours.
  const chestViewersChanged = (keys) => {
    for (const key of keys ?? []) {
      const [x, y, z] = String(key).split(",").map(Number), id = redstone.getBlock(x, y, z);
      if (id !== 146 && id !== 54) continue;
      redstone.notifyBlocksOfNeighborChange(x, y, z, id);
      redstone.notifyBlocksOfNeighborChange(x, y - 1, z, id);
    }
    flush();
  };
  // WorldServer random tick of a tripwire hook or string (both Block.tickRandomly): updateTick, true when it was one of them.
  const randomTick = (x, y, z, b) => {
    if (b !== 113 && b !== 114) return false;
    redstone.randomTick(x, y, z);
    flush();
    return true;
  };
  return {
    randomTick,
    redstone,
    pistons,
    commandBlocks,
    music,
    tick,
    frame: (partial) => pistons.frame(partial),
    showPistons,
    flush,
    use,
    applyEdit,
    fluidChanges,
    containerClosed,
    chestViewersChanged,
    save: () => redstone.save(),
    restore: (record) => {
      commandBlocks.restore(record?.commandBlocks);
      music.restore(record?.musicTiles);
      // A Java import carries only Piston tile entities (record.pistons).
      // A Java import's `redstone` carries pending ticks and lit repeaters but no piston tiles: those stay in record.pistons.
      if (record?.redstone) redstone.restore(record.redstone);
      if (Array.isArray(record?.pistons) && !record?.redstone?.pistons?.length) pistons.restore(record.pistons);
      flush();
    },
    dispose: () => { setMovingBoxes(null); redstone.dispose(); },
  };
}
