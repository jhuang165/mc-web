// Batch 96 spcopy96: the arrival hint for a Nether-to-Overworld trip, and in the portal tick itself.
// Executed: tools/research/spcopy96-probe (SpCopy96Probe: real ahb/oi/mt classes) cases netherToOver, blockedNetherToOverWest/East: the old world lists the copy at the SCALED chunk
// for this direction too, and the whole transfer (afterRemove, track) happens inside the portal tick: no tick between it and the Teleporter's result.
// 1. An Overworld destination reads the columns the exit prewarm built (no generation on this thread); a missing column gives no hint and no stall.
// 2. With the destination's edits read during the portal wait, travel() computes the hint before its first await (the portal tick), not after the settle.
import test from "node:test";
import assert from "node:assert/strict";
import { DimensionLive, viewRecord } from "./dimension-live.js";
import { transferTarget } from "./dimensions.js";

const root = { id: "w96", seed: 1234, biome: "javaStreamed", chunked: true, generationVersion: 18 };
const column = () => { const blocks = new Uint8Array(65536); for (let i = 0; i < 65536; i++) blocks[i] = (i & 255) <= 60 ? 1 : 0; return { blocks, metadata: new Uint8Array(65536) }; };
// Overworld cells (8 x 8 chunks) the exit prewarm would hold round the arrival: chunks 66,20 -> cells 8,2
const shellFor = (cells) => {
  const map = new Map();
  for (const [cx, cz] of cells) { const columns = new Map(); for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) columns.set(`${cx * 8 + a},${cz * 8 + b}`, column()); map.set(`${cx},${cz}`, { cellX: cx, cellZ: cz, columns }); }
  return { dimension: 0, baseColumns: new Map(), population: { cells: { map } } };
};
const allCells = () => { const l = []; for (let x = 7; x <= 9; x++) for (let z = 1; z <= 3; z++) l.push([x, z]); return l; };
const make = (cells) => {
  const got = [];
  const rec = viewRecord(root, -1);
  const host = { worlds: () => [root], active: () => rec, ticks: () => 0, arrivalHint: (h) => got.push(h), player: () => p, save: () => new Promise(() => {}), sound() {}, showCredits() {}, openWorld: async () => {} };
  const p = { x: 133.5, y: 64, z: 41.5, yaw: 0, motion: { x: 0, y: 0, z: 0 } };
  const dims = new DimensionLive(host);
  dims.readEdits = async () => [];
  dims.exitWarm = { id: `${root.id}:0`, shell: cells ? shellFor(cells) : null };
  return { dims, got, rec, p };
};

test("Overworld destination: the hint comes from the prewarmed cells and lands on the terrain surface", async () => {
  const { dims, got, rec, p } = make(allCells());
  dims.busy = true;
  await dims.announceArrival(rec, p, 0);
  assert.equal(got.length, 1, "a Nether to Overworld trip now has an early arrival");
  const tt = transferTarget(-1, 0, p.x, p.y, p.z, 0);
  assert.deepEqual(got[0].scaled, { x: tt.x, y: tt.y, z: tt.z });
  assert.ok(got[0].y >= 61 && got[0].y < 70, `stands on the 60-high terrain: ${got[0].y}`);
  assert.ok(Math.abs(got[0].x - tt.x) < 40 && Math.abs(got[0].z - tt.z) < 40);
  // arrive() on a streaming Overworld reading the same cells reaches the same spot
  const shell = dims.exitWarm.shell, prepared = { streaming: true, dimension: 0, generateTerrainChunk: (cx, cz) => shell.population.cells.map.get(`${cx >> 3},${cz >> 3}`).columns.get(`${cx},${cz}`) };
  const record = { ...root, transit: { from: -1, x: p.x, y: p.y, z: p.z, yaw: p.yaw, dir: 0 } };
  await dims.arrive(prepared, record, {});
  assert.deepEqual([got[0].x, got[0].y, got[0].z], [record.position.x, record.position.y, record.position.z], "same arrival as the real Teleporter run");
});

test("a column the prewarm did not build gives no hint and builds nothing", async () => {
  const { dims, got, rec, p } = make([[0, 0]]);
  dims.busy = true;
  await dims.announceArrival(rec, p, 0);
  assert.equal(got.length, 0);
  const none = make(null);
  none.dims.busy = true;
  await none.dims.announceArrival(none.rec, none.p, 0);
  assert.equal(none.got.length, 0, "no prewarm at all (scripted trip): as before");
});

test("travel computes the hint in the portal tick when the edits were read during the wait", async () => {
  const { dims, got, p } = make(allCells());
  await dims.armArrival(root, 0);
  dims.travel(0); // not awaited: the first await inside it is the old world's settle
  assert.equal(got.length, 1, "the hint exists before any microtask ran");
  const late = make(allCells());
  late.dims.travel(0);
  assert.equal(late.got.length, 0, "without the wait's read nothing is known yet (computed after the settle)");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(late.got.length, 1, "the settle path still gives it");
  assert.deepEqual([got[0].x, got[0].y, got[0].z], [late.got[0].x, late.got[0].y, late.got[0].z], "both paths reach the same spot");
  void p;
});

test("a delivery in flight keeps the settle path (the shared portal cache must be final first)", async () => {
  const { dims, got } = make(allCells());
  await dims.armArrival(root, 0);
  dims.flights = 1;
  dims.travel(0);
  assert.equal(got.length, 0);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(got.length, 1);
});
