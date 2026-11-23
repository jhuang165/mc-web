// Batch 98 spcopy98: the arrival hint for a trip whose portal wait ended before the exit window was built, and for a trip with no wait.
// Bytecode/port-read: the Teleporter runs inside the portal tick natively; here the page cannot generate Overworld cells (1 to 2 s each), so when the cells are not held the trip asks
// the exit prewarm for the window (workers) and gives the hint when it has arrived, before the old world's save. The window is the 8 x 8 chunks round the focus: a target near a
// cell border has the neighbouring cell in the same request (all cells the window touches are `need`), so waiting for `need` covers it.
import test from "node:test";
import assert from "node:assert/strict";
import { DimensionLive, viewRecord } from "./dimension-live.js";
import { transferTarget } from "./dimensions.js";

const root = { id: "w98", seed: 1234, biome: "javaStreamed", chunked: true, generationVersion: 18 };
const column = () => { const blocks = new Uint8Array(65536); for (let i = 0; i < 65536; i++) blocks[i] = (i & 255) <= 60 ? 1 : 0; return { blocks, metadata: new Uint8Array(65536) }; };
const fill = (map, cx, cz) => { const columns = new Map(); for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) columns.set(`${cx * 8 + a},${cz * 8 + b}`, column()); map.set(`${cx},${cz}`, { cellX: cx, cellZ: cz, columns }); };
const make = (px = 133.5) => {
  const got = [], rec = viewRecord(root, -1), p = { x: px, y: 64, z: 41.5, yaw: 0, motion: { x: 0, y: 0, z: 0 } };
  const host = { worlds: () => [root], active: () => rec, ticks: () => 0, arrivalHint: (h) => got.push(h), player: () => p, save: () => new Promise(() => {}), sound() {}, showCredits() {}, openWorld: async () => {} };
  const dims = new DimensionLive(host);
  dims.readEdits = async () => [];
  const map = new Map(), starts = [];
  dims.exitWarm = { id: null, shell: { dimension: 0, baseColumns: new Map(), population: { cells: { map } } }, need: null,
    start(r, to, tt) { starts.push(tt); this.id = `${r.id}:${to}`; this.need = new Promise((res) => setTimeout(() => { for (let x = 7; x <= 9; x++) for (let z = 1; z <= 3; z++) fill(map, x, z); res(); }, 20)); return true; } };
  return { dims, got, rec, p, starts };
};

test("no wait (or one shorter than the cell build): the trip asks for the window and the hint comes when it arrives", async () => {
  const { dims, got, rec, p, starts } = make();
  dims.busy = true;
  await dims.announceArrival(rec, p, 0);
  assert.equal(starts.length, 1, "prewarm started by the trip");
  assert.equal(got.length, 1, "hint after the window arrived");
  const tt = transferTarget(-1, 0, p.x, p.y, p.z, 0);
  assert.deepEqual(got[0].scaled, { x: tt.x, y: tt.y, z: tt.z });
  assert.ok(got[0].y >= 61 && got[0].y < 70);
});

test("a prewarm the portal wait already started is awaited, not restarted", async () => {
  const { dims, got, rec, p, starts } = make();
  dims.busy = true;
  dims.exitWarm.start(root, 0, { x: 1, z: 1 });
  starts.length = 0;
  await dims.announceArrival(rec, p, 0);
  assert.equal(starts.length, 0);
  assert.equal(got.length, 1);
});

test("the Overworld hint waits for need only up to the bound and builds nothing itself", async () => {
  const { dims, got, rec, p } = make();
  dims.busy = true;
  dims.exitWarm.start = function (r, to) { this.id = `${r.id}:${to}`; this.need = new Promise(() => {}); return true; };
  const t0 = Date.now();
  await dims.waitExitWindow(root, -1, 0, p, 30);
  assert.ok(Date.now() - t0 < 1000);
  await dims.announceNow(rec, p, 0);
  assert.equal(got.length, 0);
});

test("a prewarm that cannot start (no shell) leaves the trip with no hint and no wait", async () => {
  const { dims, got, rec, p } = make();
  dims.busy = true;
  dims.exitWarm.start = () => false;
  await dims.announceArrival(rec, p, 0);
  assert.equal(got.length, 0);
});
