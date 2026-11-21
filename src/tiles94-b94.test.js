// Batch 94 tiles94: the away clock's returned shift is applied whatever the live rule at return (awayTimeShift), a run stopped by the wall budget counts the ticks it skipped
// under the rule as it stands, and the dispenser record carries no facing (the cell metadata is the facing). Notes: .shared-memory/notes/tiles94-b94-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { awayTimeShift } from "./away-time-shift.js";

await populationBlockMapperReady;
const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");

test("awayTimeShift: a positive shift survives, junk is zero", () => {
  assert.equal(awayTimeShift({ timeShift: 60 }), 60);
  assert.equal(awayTimeShift({ timeShift: -7 }), -7);
  assert.equal(awayTimeShift({}), 0);
  assert.equal(awayTimeShift(null), 0);
  assert.equal(awayTimeShift({ timeShift: NaN }), 0);
});

test("main.js awayResult adds the shift through the helper, not behind timeFrozen", () => {
  const line = src("main.js").split("\n").find((l) => l.includes("awayResult:"));
  assert.match(line, /survival\.time \+= awayTimeShift\(r\)/);
  assert.doesNotMatch(line, /timeFrozen/);
});

const STONE = 3, COMMAND_BLOCK = 139;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const runBudget = (command, rules, ticks = 100) => {
  const root = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 }, ...(rules ? { rules } : {}),
    redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 137, 30, 0, 1]], events: [] },
    commandBlocks: [{ x: 3, y: 11, z: 3, command, successCount: 0, customName: "@", trackOutput: true, lastOutput: "" }] };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
  const c = plan.chunks.find((k) => k.x === 0 && k.z === 0); c.blocks[((3 & 15) * 16 + 3) * 256 + 11] = COMMAND_BLOCK;
  let t = 0;
  return runAway(plan, { now: () => (t += 1), budgetMs: 0 }); // the first budget check (tick 31) stops the run
};

test("budget stop: the skipped ticks follow the rule the run ended with", async () => {
  const off = await runBudget("gamerule doDaylightCycle false");
  assert.equal(off.stats.stopped, "budget");
  assert.equal(off.stats.ran, 31);
  const skipped = off.stats.requested - off.stats.ran;
  assert.ok(off.timeShift <= -(skipped - 1) && off.timeShift >= -(skipped + 1), `shift ${off.timeShift}`);
  const same = await runBudget("say x");
  assert.equal(same.stats.stopped, "budget");
  assert.equal(same.timeShift, 0, "the rule never changed: the trip's assumption stands");
});

test("dispenser records from a populated import carry no facing", () => {
  assert.doesNotMatch(src("imported-population.js"), /out\.dispensers\[[^\n]*facing/);
});
