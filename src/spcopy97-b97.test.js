// Batch 97 spcopy97: the early arrival hint for more trips.
// Executed: tools/research/spcopy97-probe (SpCopy97Probe, real ahb/oi/mt classes) case overToEnd: the End portal trip (mw.b(1) from BlockEndPortal) removes, places with the Teleporter
// (arrival 100,49,0) and tracks inside the one portal tick; no tick runs between it and the Teleporter's result, as for the Nether trips of batch 95/96.
// 1. The End portal has no wait: arrival edits are read when the player is near an End portal block, so travel computes the hint in the portal tick.
// 2. The portal wait builds the cell holding the arrival first (nearest the target leads each lane), so a wait that ends early still has the arrival's columns.
// 3. A finite Overworld root gets the hint too (its terrain built during the wait, after the tick, as peekFor builds it for travelling mobs).
import test from "node:test";
import assert from "node:assert/strict";
import { DimensionLive, viewRecord } from "./dimension-live.js";
import { transferTarget, END, OVERWORLD, GAME_IDS } from "./dimensions.js";
import { arrivalWarmer } from "./travel-loading.js";
import { World } from "./world.js";

const root = { id: "w97", seed: 1234, biome: "javaStreamed", chunked: true, generationVersion: 18 };
const make = (r = root, active = r) => {
  const got = [];
  const p = { x: 40.5, y: 64, z: 40.5, yaw: 0, motion: { x: 0, y: 0, z: 0 } };
  const host = { worlds: () => [r], active: () => active, ticks: () => 0, arrivalHint: (h) => got.push(h), player: () => p, save: () => new Promise(() => {}), sound() {}, showCredits() {}, openWorld: async () => {} };
  const dims = new DimensionLive(host);
  dims.readEdits = async () => [];
  return { dims, got, p };
};
const portalWorld = (at) => ({ dimension: 0, get: (x, y, z) => (x === at[0] && y === at[1] && z === at[2] ? GAME_IDS.endPortal : 0) });

test("End portal: standing near one arms the destination's edits, and the trip computes the hint inside the portal tick", async () => {
  const { dims, got, p } = make();
  const world = portalWorld([42, 63, 40]);
  dims.tick(world, { x: 40.5, y: 64, z: 40.5 }, { x: 40.5, y: 64, z: 40.5 }, {});
  assert.equal(dims.arrivalPre?.key, `w97:${END}`, "armed by the scan");
  await dims.arrivalPre.ready;
  assert.ok(dims.arrivalPre.edits, "edits pre-read");
  dims.travel(END); // the portal tick's travel, not awaited
  assert.equal(got.length, 1, "hint exists before any microtask ran");
  assert.ok(got[0].y > 0);
  assert.ok(Math.abs(got[0].x - 100) < 1.5 && Math.abs(got[0].z) < 1.5, `End platform arrival: ${got[0].x},${got[0].z}`);
  void p;
});

test("End portal: with no earlier arming the hint still comes after the settle", async () => {
  const { dims, got } = make();
  dims.travel(END);
  assert.equal(got.length, 0);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(got.length, 1);
});

test("no End portal near: nothing is read", () => {
  const { dims } = make();
  const world = portalWorld([200, 63, 200]);
  for (let i = 0; i < 25; i++) dims.tick(world, { x: 40.5, y: 64, z: 40.5 }, { x: 40.5, y: 64, z: 40.5 }, {});
  assert.equal(dims.arrivalPre, null);
});

test("the portal wait asks for the cell holding the target first (one lane builds nearest first)", async () => {
  const ports = [], windowAt = (px, pz) => ({ minX: (Math.floor(px / 16) - 4) * 16, minZ: (Math.floor(pz / 16) - 4) * 16 });
  const world = { streaming: true, generationVersion: 13, population: { cells: { max: 1 }, hasCell: () => false }, chunks: new Map(), pregenerated: new Map(), windowAt, baseColumns: new Map(), javaSeed: 1n };
  const createWorker = () => { const p = { posted: [], postMessage(m) { p.posted.push(m); }, terminate() {} }; ports.push(p); return p; };
  const had = globalThis.Worker; globalThis.Worker = function Worker() {};
  const warm = arrivalWarmer(world, { pause: async () => {}, createWorker, maxWorkers: 1, timeoutMs: 10 });
  await warm.window(136, 136, 0); // chunk 8,8: the window is chunks 4..11, cells 0..1
  globalThis.Worker = had;
  const asked = ports[0].posted.filter((m) => m.type === "cell").map((m) => `${m.x},${m.z}`);
  warm.dispose();
  assert.equal(asked[0], "1,1", "the target's own cell leads");
  assert.equal(asked.length, 4);
});

test("a finite Overworld root gets the arrival hint, the same spot arrive() reaches", async () => {
  const fin = { id: "f97", seed: "fin", biome: "meadow", edits: [] };
  const { dims, got, p } = make(fin, viewRecord(fin, -1));
  p.x = 8.5; p.z = 8.5;
  dims.busy = true;
  await dims.announceArrival(viewRecord(fin, -1), p, OVERWORLD);
  assert.equal(got.length, 1, "finite root: hint");
  const tt = transferTarget(-1, 0, p.x, p.y, p.z, 0);
  assert.deepEqual(got[0].scaled, { x: tt.x, y: tt.y, z: tt.z });
  const prepared = new World(fin.seed, fin.biome, 1);
  const record = { ...fin, transit: { from: -1, x: p.x, y: p.y, z: p.z, yaw: p.yaw, dir: 0 } };
  await dims.arrive(prepared, record, {});
  assert.deepEqual([got[0].x, got[0].y, got[0].z], [record.position.x, record.position.y, record.position.z]);
});

test("a finite root's travel computes the hint in the portal tick once armed during the wait", async () => {
  const fin = { id: "f97b", seed: "fin", biome: "meadow", edits: [] };
  const { dims, got } = make(fin, viewRecord(fin, -1));
  await dims.armArrival(fin, OVERWORLD);
  dims.travel(OVERWORLD);
  assert.equal(got.length, 1);
});
