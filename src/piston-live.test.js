import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromOriginal } from "./block-registry.js";
import { pistonPushExtras, bodyMove } from "./piston-push.js";
import { moveEntity, setMovingBoxes, EntityWorld, setEntityBoxes } from "./entities.js";
import { Minecarts, Y_OFFSET } from "./minecarts.js";
import { Boats } from "./boats.js";
import { boatBoxProvider } from "./entity-collision.js";
import { solidBlock } from "./world.js";
import { RedstoneWorld } from "./redstone.js";
import { installPistons, tileOffset, tileProgress, movingParts, shortenHead, pistonTileFields, ORIGINAL_MOVING, ORIGINAL_HEAD } from "./piston-live.js";
import { pistonQuads, PISTON_HEAD, PISTON, STICKY_PISTON } from "./dispenser-piston.js";

// Recorded by tools/verify-piston-live.mjs from the unchanged 1.7.10 TileEntityPiston / BlockPistonMoving classes.
const ref = JSON.parse(readFileSync(new URL("../public/research/piston-live-reference.json", import.meta.url)));
const [ox, oy, oz] = ref.origin, [sx, sy, sz] = ref.size;
const INTERNAL = { 1: 1, 29: STICKY_PISTON, 33: PISTON, 34: PISTON_HEAD };
const blocks = { toInternal: (id, meta) => (id === 0 ? null : { id: INTERNAL[id] ?? fromOriginal(id, meta)?.id ?? id, meta: fromOriginal(id, meta)?.meta ?? meta }) };
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

function build(s) {
  const w = new RedstoneWorld({ seed: s.seed ?? 1 }), cells = s.grid.split(",");
  for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) {
    const [id, meta = 0] = cells[(x * sy + y) * sz + z].split(":").map(Number);
    if (id) w.setRaw(ox + x, oy + y, oz + z, id, meta);
  }
  return w;
}
// The game's view of the redstone world (internal ids) and real entity systems for the "live" events (EntityPig, empty
// minecart, boat in the probe): pigs through EntityWorld.pushMove, carts / boats through Minecarts.move / Boats.move.
function liveSystems(w) {
  const cell = (x, y, z) => blocks.toInternal(w.getBlock(x, y, z), w.getBlockMetadata(x, y, z));
  const view = { get: (x, y, z) => cell(x, y, z)?.id ?? 0, getMeta: (x, y, z) => cell(x, y, z)?.meta ?? 0, solid: (x, y, z) => { const c = cell(x, y, z); return !!c && solidBlock(c.id, c.meta); }, set() {} };
  const rand = { nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5, nextGaussian: () => 0 };
  const sys = { view, mobs: new EntityWorld(view, [], () => 0.5), carts: new Minecarts({ random: () => rand }), boats: new Boats(), lives: [], liveMoves: [] };
  for (const [obj, key] of [[sys.mobs, "pushMove"], [sys.carts, "move"], [sys.boats, "move"]]) {
    const orig = obj[key].bind(obj);
    obj[key] = (...a) => { sys.liveMoves.push(key === "pushMove" ? [sys.now, a[0].label, ...a.slice(1, 4)] : [sys.now, a[1].label, ...a.slice(2, 5)]); return orig(...a); };
  }
  return sys;
}
function step(w, p, s, tick, ents, moves, sys) {
  if (sys) sys.now = tick;
  moves.now = tick;
  for (const [t, op, x0, y0, z0, a, ...rest] of s.events) {
    if (t !== tick) continue;
    const x = ox + x0, y = oy + y0, z = oz + z0;
    if (op === "place") w.setBlock(x, y, z, a, rest[0], 3);
    else if (op === "air") w.setBlockToAir(x, y, z);
    else if (op === "entity") {
      const b = [ox + rest[0], oy + rest[1], oz + rest[2], ox + rest[3], oy + rest[4], oz + rest[5]];
      ents.push({ label: a, box: b, move(dx, dy, dz) { moves.push([moves.now, a, dx, dy, dz]); b[0] += dx; b[3] += dx; b[1] += dy; b[4] += dy; b[2] += dz; b[5] += dz; } });
    } else if (op === "live" && sys) {
      const [kind, vx, vy, vz] = rest, px = x + 0.5, pz = z + 0.5;
      let e;
      if (kind === 0) { e = { id: sys.mobs.nextId++, type: "pig", x: px, y, z: pz, vx, vy, vz, onGround: true, fallDistance: 0, health: 10, growingAge: 0, rotationYaw: 0 }; sys.mobs.entities.push(e); }
      else if (kind === 1) { e = sys.carts.spawnEmpty({ x: px, y: y + Y_OFFSET, z: pz }, { seed: 1 }); Object.assign(e, { vx, vy, vz, onGround: true }); }
      else { e = sys.boats.spawnBoat({ x: px, y, z: pz, vx, vy, vz }, { seed: 1 }); e.onGround = true; }
      e.label = a;
      sys.lives.push(e);
    }
  }
  w.time++;
  w.tickUpdates();
  w.sendQueuedBlockEvents();
  w.updateTileEntities();
  p.tick();
}
for (const s of ref.scenarios)
  test(`native replay: ${s.name}`, () => {
    const w = build(s), ents = [], moves = [], sys = liveSystems(w);
    const p = installPistons({ redstone: w, world: sys.view, blocks, entities: { mobs: sys.mobs, extra: () => [...ents, ...pistonPushExtras(sys.view, { minecarts: () => sys.carts, boatSystem: () => sys.boats, mobs: () => sys.mobs, player: () => null })] } });
    setMovingBoxes((b) => p.collisionBoxes(b));
    setEntityBoxes(boatBoxProvider({ get carts() { return sys.boats.carts; } }));
    try {
    for (let tick = 1; tick <= s.ticks; tick++) {
      step(w, p, s, tick, ents, moves, sys);
      const rows = w.pistonTiles().map((t) => [t.x - ox, t.y - oy, t.z - oz, t.block, t.meta, t.facing, t.extending ? 1 : 0, t.renderHead ? 1 : 0, t.progress, t.lastProgress]);
      assert.deepEqual(rows, s.te[tick - 1].map((r) => r.slice(0, 10)), `tiles at tick ${tick}`);
      s.te[tick - 1].forEach((r, k) => {
        const tile = w.pistonTiles()[k];
        ref.partials.forEach((pt, j) => {
          const [prog, ...off] = r[10][j];
          assert.equal(tileProgress(tile, pt), Math.fround(prog));
          assert.deepEqual(tileOffset(tile, pt).map((v) => v + 0), off.map((v) => Math.fround(v) + 0));
        });
      });
      // World.getCollidingBoundingBoxes over each moving cell: BlockPistonMoving's own box (partial 0 progress).
      const cellBoxes = w.pistonTiles().map((t) => p.collisionBoxes([t.x + 0.001, t.y + 0.001, t.z + 0.001, t.x + 0.999, t.y + 0.999, t.z + 0.999]).map((b) => [b[0] - ox, b[1] - oy, b[2] - oz, b[3] - ox, b[4] - oy, b[5] - oz]));
      assert.equal(cellBoxes.length, s.collide[tick - 1].length);
      cellBoxes.forEach((list, k) => {
        assert.equal(list.length, s.collide[tick - 1][k].length, `collision box count tick ${tick}`);
        list.forEach((b, i) => b.forEach((v, j) => close(v, s.collide[tick - 1][k][i][j], `collision box tick ${tick}`)));
      });
      p.pushBoxes().forEach((b, k) => {
        const nb = s.pushBoxes[tick - 1][k];
        assert.equal(b === null, nb === null);
        if (b) b.forEach((v, j) => close(v - [ox, oy, oz, ox, oy, oz][j], nb[j], `push box tick ${tick}`));
      });
      ents.forEach((e, k) => [e.box[0] - ox, e.box[1] - oy, e.box[2] - oz].forEach((v, j) => close(v, s.entities[tick - 1][k][j + 1], `entity ${k} tick ${tick}`)));
      // Real entities: position (box bottom), motion, onGround, isCollidedHorizontally, fallDistance after the tick.
      const live = sys.lives.map((e) => [e.label, e.x - ox, (e.bb ? e.bb[1] : e.y) - oy, e.z - oz, e.vx, e.vy, e.vz, e.onGround ? 1 : 0, e.collidedH ? 1 : 0, e.fallDistance ?? 0]);
      assert.equal(live.length, s.live?.[tick - 1].length ?? 0);
      live.forEach((e, k) => e.forEach((v, j) => close(v, s.live[tick - 1][k][j], `live ${e[0]} field ${j} tick ${tick}`)));
    }
    } finally { setMovingBoxes(null); setEntityBoxes(null); }
    assert.equal(sys.liveMoves.length, s.liveMoves?.length ?? 0);
    sys.liveMoves.forEach((m, k) => m.forEach((v, j) => close(v, s.liveMoves[k][j], `live move ${k}`)));
    assert.equal(moves.length, s.moves.length);
    moves.forEach((m, k) => m.forEach((v, j) => close(v, s.moves[k][j], `move ${k}`)));
  });

test("reference records class digests and entity pushes", () => {
  for (const c of Object.values(ref.classes)) assert.match(c.sha256, /^[0-9a-f]{64}$/);
  assert.ok(ref.scenarios.reduce((n, s) => n + s.moves.length, 0) >= 30);
});

test("render parts follow TileEntityRendererPiston", () => {
  const tile = (o) => ({ kind: "piston", progress: 0.5, lastProgress: 0, extending: true, renderHead: false, facing: 5, ...o });
  const internal = blocks.toInternal;
  // Extending head below half way: short arm; from half way: the plain head with the full arm.
  const head = movingParts(tile({ block: 34, meta: 5 }), 0, internal);
  assert.equal(head.length, 1);
  assert.equal(head[0].block, PISTON_HEAD);
  const full = pistonQuads(PISTON_HEAD, 5), shortQ = shortenHead(full, 5);
  assert.deepEqual(head[0].quads, shortQ);
  assert.equal(Math.max(...shortQ.slice(-4).flatMap((q) => q.verts.map((v) => v[0]))), 0.75);
  assert.equal(Math.min(...shortQ.slice(-4).flatMap((q) => q.verts.map((v) => v[0]))), 0.25);
  assert.deepEqual(movingParts(tile({ block: 34, meta: 5, progress: 1, lastProgress: 0.5 }), 0, internal)[0].quads, full);
  // Retracting base: the head (sticky icon, full arm before half way) then the base in its cell.
  const back = movingParts(tile({ block: 29, meta: 5, extending: false, renderHead: true }), 0, internal);
  assert.equal(back.length, 2);
  assert.equal(back[0].block, PISTON_HEAD);
  assert.equal(back[0].meta & 8, 8);
  assert.deepEqual(back[1].offset, [0, 0, 0]);
  assert.equal(back[1].block, STICKY_PISTON);
  // Plain block, finished move and air draw as expected.
  assert.equal(movingParts(tile({ block: 1, meta: 0 }), 0, internal)[0].quads, null);
  assert.deepEqual(movingParts(tile({ block: 1, meta: 0, progress: 1, lastProgress: 1 }), 0, internal), []);
  assert.deepEqual(movingParts(tile({ block: 0, meta: 0 }), 0, internal), []);
  // Offsets: extending from -1 to 0 along +x; retracting from 1 down to 0.
  assert.deepEqual(tileOffset(tile({ block: 1, meta: 0, progress: 0.5, lastProgress: 0.5 }), 0).map((v) => v + 0), [-0.5, 0, 0]);
  assert.deepEqual(tileOffset(tile({ block: 1, meta: 0, extending: false, facing: 1, progress: 0.5, lastProgress: 0 }), 0.5), [0, 0.75, 0]);
});

test("live scenario: frame() hands the scene the moving parts and tick() keeps the wrapper", () => {
  const s = ref.scenarios[0], w = build(s), seen = [], scene = { setMovingBlocks: (l) => seen.push(l) };
  const p = installPistons({ redstone: w, scene, blocks });
  const ents = [], moves = [];
  step(w, p, s, 1, ents, moves);
  const list = p.frame(0.5);
  assert.equal(seen.at(-1), list);
  assert.equal(list.length, 3);
  assert.ok(list.every((e) => e.parts.length === 1 && e.parts[0].offset[0] < 0));
  assert.ok(w.updateTileEntities.pistonLive);
  p.tick();
  assert.ok(w.updateTileEntities.pistonLive);
});

test("saving and restoring tiles mid-motion", () => {
  const s = ref.scenarios[0], w = build(s), p = installPistons({ redstone: w, blocks }), ents = [], moves = [];
  step(w, p, s, 1, ents, moves);
  const saved = JSON.parse(JSON.stringify(p.save()));
  assert.equal(saved.length, 3);
  const fresh = new RedstoneWorld({ seed: 1 }), q = installPistons({ redstone: fresh, blocks });
  for (const e of saved) fresh.setRaw(e.x, e.y, e.z, ORIGINAL_MOVING, e.meta);
  assert.equal(q.restore(saved), 3);
  assert.equal(q.restore([{ x: 0, y: 0, z: 0, block: 1, meta: 0, facing: 5, progress: 0.5 }]), 0, "cell without a moving block is skipped");
  for (const t of fresh.pistonTiles()) {
    const o = saved.find((e) => e.x === t.x && e.y === t.y && e.z === t.z);
    assert.deepEqual([t.block, t.meta, t.facing, t.extending, t.progress, t.lastProgress], [o.block, o.meta, o.facing, o.extending, o.progress, o.progress]);
  }
  // Both worlds finish the move the same way.
  fresh.updateTileEntities();
  fresh.updateTileEntities();
  assert.equal(fresh.getBlock(saved[0].x, saved[0].y, saved[0].z), saved[0].block);
  assert.deepEqual(pistonTileFields(saved[0]), { blockId: saved[0].block, blockData: saved[0].meta, facing: 5, progress: 0.5, extending: true });
});

test("piston sounds: tile.piston.out/in at volume 0.5, pitch rand*0.25+0.6 / rand*0.15+0.6 (BlockPistonBase bytecode)", () => {
  const seen = [];
  for (const s of ref.scenarios) {
    const w = build(s), p = installPistons({ redstone: w, blocks }), ents = [], moves = [];
    for (let tick = 1; tick <= s.ticks; tick++) step(w, p, s, tick, ents, moves);
    seen.push(...w.sounds.filter((e) => e.name.startsWith("tile.piston.")));
  }
  assert.ok(seen.some((e) => e.name === "tile.piston.out") && seen.some((e) => e.name === "tile.piston.in"));
  for (const e of seen) {
    assert.equal(e.volume, 0.5);
    const span = e.name.endsWith("out") ? 0.25 : 0.15;
    assert.ok(e.pitch >= Math.fround(0.6) && e.pitch < Math.fround(0.6 + span) + 1e-6, `${e.name} pitch ${e.pitch}`);
  }
});

test("Java round trip: moving pistons export as Piston tile entities, import back and finish on restore", async () => {
  const { World } = await import("./world.js");
  const { exportJavaSave } = await import("./region-export.js");
  const { importJavaRegionArea } = await import("./region-import.js");
  const { importedRuntime } = await import("./world-import.js");
  const { splitRuntime, joinRuntime } = await import("./chunk-runtime.js");
  const s = ref.scenarios[0], w = build(s), p = installPistons({ redstone: w, blocks }), ents = [], moves = [];
  step(w, p, s, 1, ents, moves);
  const saved = p.save();
  assert.equal(saved.length, 3);
  // The record: world edits put the moving block (internal 130) in each cell; pistons ride in record.pistons.
  const world = new World("17", "javaStreamed", 12), local = saved.map((e) => ({ ...e, x: e.x - ox + 3, y: 70 + (e.y - oy), z: e.z - oz + 3 }));
  world.restore(local.map((e) => [`${e.x},${e.y},${e.z}`, 130]));
  const rec = { id: "p", name: "P", seed: "17", biome: "javaStreamed", generationVersion: 12, mode: "survival", edits: [...world.edits], player: {}, position: { x: 3.5, y: 90, z: 3.5, yaw: 0, pitch: 0 }, pistons: local };
  const split = splitRuntime(rec);
  assert.equal(joinRuntime(split.metadata, split.columns).pistons.length, 3, "chunk runtime keeps pistons");
  assert.equal(importedRuntime(JSON.parse(JSON.stringify(rec))).pistons.length, 3, "import sanitiser keeps pistons");
  const { files } = await exportJavaSave(rec, { world });
  const inFiles = [...files].filter(([k]) => k.startsWith("region/")).map(([k, bytes]) => ({ filename: k.split("/").pop(), bytes }));
  const res = await importJavaRegionArea(inFiles, { area: { chunkX: world.originX / 16, chunkZ: world.originZ / 16, width: 1, depth: 1 }, mode: "survival" });
  assert.equal(res.record.pistons.length, 3);
  assert.equal(res.report.tileEntities.converted.Piston, 3);
  for (const [i, e] of res.record.pistons.entries()) {
    const o = local[i];
    assert.deepEqual([e.block, e.meta, e.facing, e.extending, e.progress], [o.block, o.meta, o.facing, o.extending, Math.fround(o.progress)]);
  }
  // Restoring them finishes the move: after two tile updates the final blocks stand.
  const fresh = new RedstoneWorld({ seed: 1 }), q = installPistons({ redstone: fresh, blocks });
  for (const e of saved) fresh.setRaw(e.x, e.y, e.z, ORIGINAL_MOVING, 0);
  assert.equal(q.restore(saved.map((e, i) => ({ ...res.record.pistons[i], x: e.x, y: e.y, z: e.z }))), 3);
  fresh.updateTileEntities();
  fresh.updateTileEntities();
  assert.equal(fresh.pistonTiles().length, 0);
  // (A finished head with no base beside it breaks on its neighbour update, as BlockPistonExtension does.)
  for (const e of saved) if (e.block !== ORIGINAL_HEAD) assert.equal(fresh.getBlock(e.x, e.y, e.z), e.block);
  assert.ok(saved.some((e) => e.block !== ORIGINAL_HEAD));
});

test("reference covers all six facings, odd collision shapes and the moving-block collision query", () => {
  const names = ref.scenarios.map((s) => s.name);
  for (const n of ["south-facing", "standing-on-moving-block", "odd-block-slab-top", "odd-block-fence", "odd-block-carpet", "trapdoor-facing-0", "trapdoor-facing-4"]) assert.ok(names.includes(n), n);
  const facings = new Set(ref.scenarios.flatMap((s) => s.te.flat().map((r) => r[5])));
  assert.deepEqual([...facings].sort(), [0, 1, 2, 3, 4, 5]);
  assert.ok(ref.scenarios.reduce((n, s) => n + s.collide.flat(2).length, 0) >= 100);
});

test("no sticky entity pull: retracting a sticky piston moves only the stored block, never an entity on it (1.7.10 has no slime)", () => {
  const s = ref.scenarios.find((x) => x.name === "sticky-extend-retract"), w = build(s), ents = [], moves = [], p = installPistons({ redstone: w, blocks, entities: { extra: () => ents } });
  for (let tick = 1; tick <= s.ticks; tick++) step(w, p, s, tick, ents, moves);
  // The native moves of this scenario are all pushes along +x by the delta of the extension (+0.0625 steps) or the final 0.25;
  // none is negative, so no entity was ever dragged back on the retract.
  for (const m of s.moves) assert.ok(m[2] >= 0 && m[3] === 0 && m[4] === 0, JSON.stringify(m));
  assert.ok(moves.every((m) => m[2] >= 0));
});

test("piston-push: every pushable entity system moves with moveEntity along the delta and stops at walls", () => {
  const world = { get: (x, y, z) => (y === 0 || (x === 3 && y === 1 && z === 1) ? 1 : 0), getMeta: () => 0, solid: (x, y, z) => y === 0 || (x === 3 && y === 1 && z === 1) };
  const orb = { x: 1.5, y: 1, z: 1.5, posY: 1.25, bb: [1.25, 1, 1.25, 1.75, 1.5, 1.75], vx: 0, vy: 0, vz: 0 };
  const cart = { x: 1.5, y: 1, z: 3.5, posY: 1.35, bb: [1.01, 1, 3.01, 1.99, 1.7, 3.99] };
  const game = {
    items: () => [{ x: 1.5, y: 1, z: 2.5 }],
    primed: () => [{ x: 1.5, y: 1, z: 4.5 }],
    falling: () => [{ x: 1.5, y: 1, z: 5.5 }],
    orbs: () => [orb],
    minecarts: () => ({ carts: [cart] }),
    boats: () => [],
  };
  const extras = pistonPushExtras(world, game);
  assert.equal(extras.length, 5);
  for (const e of extras) e.move(0.25, 0, 0);
  const orbX = (orb.bb[0] + orb.bb[3]) / 2;
  assert.ok(Math.abs(orbX - 1.75) < 1e-9 && Math.abs(orb.x - 1.75) < 1e-9 && Math.abs(orb.posY - 1.25) < 1e-9);
  assert.ok(Math.abs(cart.x - 1.75) < 1e-9 && Math.abs(cart.bb[3] - 2.24) < 1e-9, JSON.stringify(cart));
  const item = { x: 2.8, y: 1, z: 1.5 };
  bodyMove(world, item, 0.25, 0.25, 0.5, 0, 0);
  assert.ok(item.x + 0.125 <= 3 + 1e-9, "the wall at x = 3 stops the item"); // item half width 0.125 against the cell at x 3
});

test("moving-block collision: an entity standing on a block being lifted is carried by the box, and the box blocks sideways motion", () => {
  const s = ref.scenarios.find((x) => x.name === "vertical-up"), w = build(s), ents = [], moves = [], p = installPistons({ redstone: w, blocks, entities: { extra: () => ents } });
  const world = { get: () => 0, getMeta: () => 0, solid: () => false, isSolid: () => false };
  setMovingBoxes((b) => p.collisionBoxes(b));
  try {
    for (let tick = 1; tick <= 2; tick++) step(w, p, s, tick, ents, moves);
    const t = w.pistonTiles()[0];
    const boxes = p.collisionBoxes([t.x, t.y, t.z, t.x + 1, t.y + 1, t.z + 1]);
    assert.equal(boxes.length, 1);
    const body = { x: t.x + 0.5, y: boxes[0][4], z: t.z + 0.5, vx: 0, vy: -0.5, vz: 0, onGround: false };
    // Falling onto the moving block's top face stops at its top (the block gives a floor).
    moveEntity(world, body, 0.6, 1.8, 0, -0.5, 0);
    assert.ok(body.y >= boxes[0][4] - 1e-9, `stopped on the moving block: ${body.y} vs ${boxes[0][4]}`);
    assert.equal(body.onGround, true);
  } finally {
    setMovingBoxes(null);
  }
});

// ---- Batch 24: the pushed entity's own moveEntity state (piston-push.js pushPlayer, EntityWorld.pushMove, Minecarts.move) ----
const flatWorld = (solid = () => false) => ({ get: (x, y, z) => (solid(x, y, z) ? 1 : 0), getMeta: () => 0, solid, set() {} });
const floorAndWall = flatWorld((x, y) => y < 0 || (x >= 2 && y < 3));
const adapter = (over = {}) => {
  const st = { onGround: true, collidedH: false, fallDistance: 0 };
  return Object.assign({
    position: { x: 1.5, y: 0, z: 0.5 }, velocity: { x: 0.2, y: 0, z: 0.1 }, motion: { ySize: 0.5, sneaking: false, inWeb: false }, width: 0.6, height: 1.8, flying: false,
    get onGround() { return st.onGround; }, set onGround(v) { st.onGround = v; }, get collidedH() { return st.collidedH; }, set collidedH(v) { st.collidedH = v; },
    get fallDistance() { return st.fallDistance; }, set fallDistance(v) { st.fallDistance = v; },
  }, over);
};

test("pushPlayer: a push into a wall stops at it, zeroes that axis of motion, sets collidedH and decays ySize by 0.4", async () => {
  const { pushPlayer } = await import("./piston-push.js");
  const p = adapter();
  pushPlayer(floorAndWall, p, 0.5625, 0, 0);
  close(p.position.x, 2 - Math.fround(0.6) / 2, "stopped at the wall face (float width)");
  assert.equal(p.velocity.x, 0);
  assert.equal(p.velocity.z, 0.1);
  assert.equal(p.collidedH, true);
  assert.equal(p.motion.ySize, Math.fround(Math.fround(0.5) * Math.fround(0.4)));
});

test("pushPlayer: an upward push leaves the player off the ground (onGround = ody != dy && ody < 0) and keeps vertical motion", async () => {
  const { pushPlayer } = await import("./piston-push.js");
  const p = adapter({ position: { x: 0.5, y: 0, z: 0.5 }, velocity: { x: 0, y: -0.0784, z: 0 } });
  pushPlayer(flatWorld((x, y) => y < 0), p, 0, 0.5625, 0);
  close(p.position.y, 0.5625, "lifted");
  assert.equal(p.onGround, false);
  assert.equal(p.velocity.y, -0.0784);
});

test("pushPlayer: a sneaking grounded player is kept on the edge; the web flag slows the push and is cleared", async () => {
  const { pushPlayer } = await import("./piston-push.js");
  const ledge = flatWorld((x, y) => y < 0 && x < 1);
  const p = adapter({ position: { x: 0.5, y: 0, z: 0.5 }, motion: { ySize: 0, sneaking: true, inWeb: false } });
  pushPlayer(ledge, p, 1, 0, 0);
  assert.ok(p.position.x < 1.3 + 1e-9, `sneak edge: ${p.position.x}`);
  const q = adapter({ position: { x: 0.5, y: 0, z: 0.5 }, motion: { ySize: 0, sneaking: false, inWeb: true } });
  pushPlayer(flatWorld((x, y) => y < 0), q, 0.5, 0, 0);
  close(q.position.x, 0.5 + 0.5 * 0.25, "web x 0.25");
  assert.equal(q.motion.inWeb, false);
  assert.deepEqual([q.velocity.x, q.velocity.y, q.velocity.z], [0, 0, 0]);
});

test("EntityWorld.pushMove: a grounded mob steps 0.5 up onto a slab-high box; an ungrounded one does not", async () => {
  const { EntityWorld } = await import("./entities.js");
  // a bottom-slab-high obstacle at x 2 through the moving-box provider
  setMovingBoxes((b) => (b[3] > 2 && b[0] < 3 && b[1] < 0.5 && b[4] > 0 ? [[2, 0, 0, 3, 0.5, 1]] : []));
  try {
    const mobs = new EntityWorld({ ...flatWorld((x, y) => y < 0) }, [], () => 0.5);
    const a = { id: 1, type: "pig", x: 1.5, y: 0, z: 0.5, vx: 0, vy: 0, vz: 0, onGround: true, fallDistance: 0, health: 10, growingAge: 0, rotationYaw: 0 };
    const b = { ...a, id: 2, onGround: false };
    mobs.entities.push(a, b);
    mobs.pushMove(a, 0.5625, 0, 0);
    mobs.pushMove(b, 0.5625, 0, 0);
    close(a.y, 0.5, "stepped");
    close(a.x, 2.0625, "moved the full delta");
    close(b.y, 0, "no step off the ground");
    assert.equal(b.collidedH, true);
  } finally {
    setMovingBoxes(null);
  }
});

test("pistonPushExtras: a pushed minecart runs Minecarts.move (detector rail hook), a pushed boat Boats.move; both stop at walls", async () => {
  const { Minecarts, Y_OFFSET } = await import("./minecarts.js");
  const { Boats } = await import("./boats.js");
  const DETECTOR = 136; // internal detector rail
  const world = { get: (x, y) => (y === 0 && x === 3 ? DETECTOR : y < 0 || x >= 5 ? 1 : 0), getMeta: () => 0, solid: (x, y) => y < 0 || x >= 5, set() {} };
  const carts = new Minecarts(), boats = new Boats(), touched = [];
  carts.blockHook = (x, y, z, cart) => touched.push([x, y, z, cart.id]);
  const cart = carts.spawnEmpty({ x: 2.5, y: Y_OFFSET, z: 0.5 }, { seed: 1 }), boat = boats.spawnBoat({ x: 3.5, y: 0, z: 3.5 }, { seed: 1 });
  const extras = pistonPushExtras(world, { minecarts: () => carts, boatSystem: () => boats, mobs: () => null, player: () => null });
  assert.equal(extras.length, 2);
  for (const e of extras) e.move(0.5625, 0, 0);
  close(cart.x, 3.0625, "cart pushed");
  assert.ok(touched.some(([x, y]) => x === 3 && y === 0), "detector rail under the pushed cart");
  close(boat.x, 4.0625, "boat pushed");
  for (const e of pistonPushExtras(world, { minecarts: () => carts, boatSystem: () => boats })) e.move(1, 0, 0);
  close(boat.bb[3], 5, "boat stopped at the wall");
  assert.equal(boat.collidedH, true);
});

test("moving boxes collide for minecarts, boats and dropped items (shared moving-boxes.js provider)", async () => {
  const { Minecarts, Y_OFFSET } = await import("./minecarts.js");
  const { ItemEntities } = await import("./item-entities.js");
  const world = flatWorld((x, y) => y < 0);
  setMovingBoxes((b) => (b[3] > 3 && b[0] < 4 && b[4] > 0 && b[1] < 1 ? [[3, 0, 0, 4, 1, 1]] : []));
  try {
    const carts = new Minecarts(), cart = carts.spawnEmpty({ x: 2.5, y: Y_OFFSET, z: 0.5 }, { seed: 1 });
    carts.move(world, cart, 1, 0, 0, []);
    close(cart.bb[3], 3, "cart stopped by the moving box");
    const items = new ItemEntities();
    assert.ok(items.boxes(world, 2.9, 0.1, 0.1, 3.1, 0.3, 0.3).some((b) => b[0] === 3 && b[4] === 1), "item collision list holds the moving box");
  } finally {
    setMovingBoxes(null);
  }
});
