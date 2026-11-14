// Batch 72 smallfixes72: step cell after a sneak drop, the climb stat's isOnLadder, away-run droppers into containers, one brewing flag.
// Facts: .shared-memory/notes/smallfixes72-b72-track.md. No browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { World } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { stepBlock } from "./step-block.js";
import { nextYSize } from "./player-movement.js";
import { isOnLadder } from "./ladders.js";
import { addMovementStat } from "./stats-live.js";
import { STAT } from "./stats.js";

await populationBlockMapperReady;
const f = Math.fround;
const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");

// ---- (1) the step cell after a sneak drop (executed: StepBlockProbe kind "ysize") ----
const ref = JSON.parse(readFileSync(new URL("../public/research/step-block-reference.json", import.meta.url)));
test("a step with ySize 0.2 set before the move uses the decayed ySize (executed)", () => {
  const cases = ref.cases.filter((c) => c.kind === "ysize");
  assert.ok(cases.length >= 20);
  for (const c of cases) {
    const up = fromOriginal(c.upperId, 0).id, lo = fromOriginal(c.lowerId, 0).id;
    const w = { get: (x, y, z) => (x !== 64 || z !== 64 ? 0 : y === c.cy ? up : y === c.cy - 1 ? lo : y < c.cy - 1 ? 3 : 0) };
    assert.equal(f(c.v), f(f(0.2) * f(0.4)), "moveEntity decays ySize by 0.4 before the step test");
    // the port's position.y is the box minY (posY - yOffset + ySize); main.js passes position.y - motion.ySize, motion.ySize being the decayed value
    const minY = c.endY - f(c.yOffset) + c.v;
    const sb = stepBlock(w, 64.5, minY - c.v, 64.5);
    assert.equal(sb.id !== 0, c.step !== null, `${c.upper} over ${c.lower} feet ${c.feet}`);
    if (c.step) assert.equal(sb.y, c.step.y);
  }
});

test("the player's ySize is already decayed when main.js reads it for the step (physics runs first)", () => {
  assert.equal(nextYSize(0, true), f(f(0.2) * f(0.4)), "raise to 0.2 then * 0.4 in one endMove");
  assert.ok(main.indexOf("movePlayer(state, controls, toast)") < main.indexOf("stepBlock(world, position.x, position.y - motion.ySize"), "movePlayer (motion.endMove) runs before the step block");
});

// ---- (2) climb stat: EntityPlayer.k -> sv.h_ (ladder or vine at floor(minY)); the step distance keeps the ladder-only rule ----
test("the climb stat treats a vine like a ladder (bytecode-read: sv.h_ tests ajn.ap and ajn.bd)", () => {
  const vine = fromOriginal(106, 0).id, ladder = fromOriginal(65, 2).id;
  for (const [id, want] of [[vine, true], [ladder, true], [3, false], [0, false]]) {
    const w = { get: () => id };
    assert.equal(isOnLadder(w, 5.5, 64, 5.5), want, `block ${id}`);
  }
  const rec = []; const stats = { increment: (s, n) => rec.push([s, n]) };
  addMovementStat(stats, { dx: 0, dy: 0.12, dz: 0, ladder: isOnLadder({ get: () => fromOriginal(106, 0).id }, 5.5, 64, 5.5), ground: false });
  assert.deepEqual(rec, [[STAT.climb, 12]]);
  assert.ok(!/onLadder: !flying && countsVertical/.test(main), "main.js no longer feeds the climb stat the 0.2-below ladder test");
  assert.ok(/onLadder: isOnLadder\(world, position\.x, position\.y, position\.z\)/.test(main));
});

test("the step distance still counts vertical motion only over a ladder, not a vine (executed, steps71)", () => {
  const vine = fromOriginal(106, 0).id;
  assert.equal(stepBlock({ get: () => vine }, 5.5, 64, 5.5).ladder, false);
  assert.equal(stepBlock({ get: () => fromOriginal(65, 2).id }, 5.5, 64, 5.5).ladder, true);
});

// ---- (3) away-run droppers push into the container they face ----
const STONE = 3;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b, m = 0) => {
  const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y;
  c.blocks[i] = b; c.meta[i] = m;
};
test("an away-run powered dropper over a dropper fills it instead of spilling an item entity", async () => {
  const O = [5, 12, 5], seedWorld = new World("away-dropper72", "meadow");
  const put = (w, dx, dy, id, meta) => { const m = fromOriginal(id, meta); w.put(O[0] + dx, O[1] + dy, O[2], m.id, m.meta, false); };
  for (let x = 0; x <= 3; x++) for (let y = 0; y <= 4; y++) for (let z = 0; z <= 3; z++) seedWorld.put(O[0] + x - 1, O[1] + y - 2, O[2] + z - 1, 0, 0, false);
  put(seedWorld, 0, 0, 158, 0); put(seedWorld, 0, -1, 158, 3);
  const rt = createRedstoneRuntime({ world: seedWorld, game: { dispensers: () => ({}), maxStack: () => 64, dispense: {} } });
  put(seedWorld, 1, 0, 152, 0);
  rt.redstone.placed(O[0] + 1, O[1], O[2]);
  const saved = rt.save(); rt.dispose();
  const items = [{ id: 4, count: 2, damage: 0 }, ...Array(8).fill(null)];
  const root = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], redstone: saved, player: { dispensers: { "5,12,5": { items } } } };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, 200), chunks: floorChunks(cols), records: [] };
  const raw = { put: (x, y, z, id, meta) => setBlock(plan.chunks, x, y, z, id, meta) };
  put(raw, 0, 0, 158, 0); put(raw, 0, -1, 158, 3); put(raw, 1, 0, 152, 0);
  const r = await runAway(plan);
  assert.equal(r.tiles.dispensers["5,12,5"].items[0].count, 1, "one item left the upper dropper");
  assert.equal(r.entities.drops.length, 0, "nothing was thrown");
  const lower = r.tiles.dispensers["5,11,5"];
  assert.equal(lower?.items.filter(Boolean).reduce((n, s) => n + s.count, 0), 1, "the lower dropper received it");
});

// ---- (4) the brewing stand selection flag: one per process, as the Block instance is natively ----
test("single player has one brewing flag for the integrated simulation and the client view (one module instance)", async () => {
  const { brewingShared, brewingSelection } = await import("./brewing.js");
  const { blockBounds, collisionBoxes } = await import("./world.js");
  const w = new World("b72-brew", "meadow");
  for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) for (let z = 0; z < 6; z++) w.put(x, y, z, 0, 0, false);
  w.put(2, 2, 2, 134, 0, false);
  brewingShared.passed = false;
  assert.deepEqual(blockBounds(w, 2, 2, 2), brewingSelection(), "the client view and the shared flag agree before any pass");
  const before = blockBounds(w, 2, 2, 2);
  collisionBoxes(w, 2, 2, 2); // the integrated server's entity move touches the stand: the same flag flips for the client's selection
  assert.equal(brewingShared.passed, true);
  assert.deepEqual(blockBounds(w, 2, 2, 2), brewingSelection());
  assert.notDeepEqual(blockBounds(w, 2, 2, 2), before, "the unit cube before the pass, the slab after it");
  brewingShared.passed = false;
});
