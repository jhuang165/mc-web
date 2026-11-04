import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RedstoneWorld } from "./redstone.js";
import { installPistons, tileOffset, tileProgress, movingParts, shortenHead, pistonTileFields, ORIGINAL_MOVING, ORIGINAL_HEAD } from "./piston-live.js";
import { pistonQuads, PISTON_HEAD, PISTON, STICKY_PISTON } from "./dispenser-piston.js";

// Recorded by tools/verify-piston-live.mjs from the unchanged 1.7.10 TileEntityPiston / BlockPistonMoving classes.
const ref = JSON.parse(readFileSync(new URL("../public/research/piston-live-reference.json", import.meta.url)));
const [ox, oy, oz] = ref.origin, [sx, sy, sz] = ref.size;
const INTERNAL = { 1: 1, 29: STICKY_PISTON, 33: PISTON, 34: PISTON_HEAD };
const blocks = { toInternal: (id, meta) => (id === 0 ? null : { id: INTERNAL[id] ?? id, meta }) };
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

function build(s) {
  const w = new RedstoneWorld({ seed: s.seed ?? 1 }), cells = s.grid.split(",");
  for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) {
    const [id, meta = 0] = cells[(x * sy + y) * sz + z].split(":").map(Number);
    if (id) w.setRaw(ox + x, oy + y, oz + z, id, meta);
  }
  return w;
}
function step(w, p, s, tick, ents, moves) {
  moves.now = tick;
  for (const [t, op, x0, y0, z0, a, ...rest] of s.events) {
    if (t !== tick) continue;
    const x = ox + x0, y = oy + y0, z = oz + z0;
    if (op === "place") w.setBlock(x, y, z, a, rest[0], 3);
    else if (op === "air") w.setBlockToAir(x, y, z);
    else if (op === "entity") {
      const b = [ox + rest[0], oy + rest[1], oz + rest[2], ox + rest[3], oy + rest[4], oz + rest[5]];
      ents.push({ label: a, box: b, move(dx, dy, dz) { moves.push([moves.now, a, dx, dy, dz]); b[0] += dx; b[3] += dx; b[1] += dy; b[4] += dy; b[2] += dz; b[5] += dz; } });
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
    const w = build(s), ents = [], moves = [], p = installPistons({ redstone: w, blocks, entities: { extra: () => ents } });
    for (let tick = 1; tick <= s.ticks; tick++) {
      step(w, p, s, tick, ents, moves);
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
      p.pushBoxes().forEach((b, k) => {
        const nb = s.pushBoxes[tick - 1][k];
        assert.equal(b === null, nb === null);
        if (b) b.forEach((v, j) => close(v - [ox, oy, oz, ox, oy, oz][j], nb[j], `push box tick ${tick}`));
      });
      ents.forEach((e, k) => [e.box[0] - ox, e.box[1] - oy, e.box[2] - oz].forEach((v, j) => close(v, s.entities[tick - 1][k][j + 1], `entity ${k} tick ${tick}`)));
    }
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
