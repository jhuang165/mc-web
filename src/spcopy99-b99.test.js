// Batch 99 spcopy99: the Teleporter's search reads saved portals from saved data only (Bytecode-read ahp.b: it scans every column within 128 blocks, native generating them;
// terrain holds no portal block, so the port's answer is the same without building those columns). A saved portal outside the 8 x 8 exit window no longer blocks the in-tick hint.
import test from "node:test";
import assert from "node:assert/strict";
import { DimensionLive, viewRecord } from "./dimension-live.js";
import { TerrainPeek } from "./dimension-world.js";
import { Teleporter, transferTarget, GAME_IDS } from "./dimensions.js";

const root = { id: "w99", seed: 1234, biome: "javaStreamed", chunked: true, generationVersion: 18 };
const column = () => { const blocks = new Uint8Array(65536); for (let i = 0; i < 65536; i++) blocks[i] = (i & 255) <= 60 ? 1 : 0; return { blocks, metadata: new Uint8Array(65536) }; };
const fill = (map, cx, cz) => { const columns = new Map(); for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) columns.set(`${cx * 8 + a},${cz * 8 + b}`, column()); map.set(`${cx},${cz}`, { cellX: cx, cellZ: cz, columns }); };
const portal = (x, z) => [[`${x},64,${z}`, GAME_IDS.portal], [`${x},65,${z}`, GAME_IDS.portal]];

const make = (edits) => {
  const got = [], rec = viewRecord(root, -1), p = { x: 133.5, y: 64, z: 41.5, yaw: 0, motion: { x: 0, y: 0, z: 0 } };
  const host = { worlds: () => [root], active: () => rec, arrivalHint: (h) => got.push(h), player: () => p, save: async () => {}, sound() {}, openWorld: async () => {} };
  const dims = new DimensionLive(host);
  dims.readEdits = async () => edits;
  const map = new Map(); fill(map, 8, 2); fill(map, 9, 2); // the window round the picked portal only
  dims.exitWarm = { id: `${root.id}:0`, shell: { dimension: 0, baseColumns: new Map(), population: { cells: { map } } }, need: null };
  dims.busy = true;
  return { dims, got, rec, p };
};

test("a saved portal outside the exit window does not stop the in-tick hint", async () => {
  const tt = transferTarget(-1, 0, 133.5, 64, 41.5, 0);
  assert.ok(tt.x > 1024 && tt.z > 256 && tt.z < 383);
  const near = portal(1070, 330), far = portal(1000, 440); // the far one is in cell (7, 3): not in the shell, and farther from the target
  const { dims, got, rec, p } = make([...far, ...near]);
  await dims.armArrival(root, 0);
  assert.equal(dims.announceNow(rec, p, 0), true);
  assert.equal(got.length, 1);
  assert.ok(Math.abs(got[0].x - 1070.5) < 2.5 && Math.abs(got[0].z - 330.5) < 2.5, `arrives at the near portal: ${got[0].x},${got[0].z}`);
});

test("searchGet answers from edits and stored columns, never terrain", () => {
  const peek = new TerrainPeek({ dimension: 0, generateTerrainChunk() { throw new Error("terrain read"); } }, new Map([["5,64,5", GAME_IDS.portal]]));
  assert.equal(peek.searchGet(5, 64, 5), GAME_IDS.portal);
  assert.equal(peek.searchGet(500, 10, 500), 0);
  peek.stored = { column: (cx, cz) => { const blocks = new Uint8Array(65536); blocks[(3 * 16 + 4) * 256 + 70] = GAME_IDS.portal; return cx === 1 && cz === 2 ? { blocks } : null; } };
  assert.equal(peek.searchGet(16 + 3, 70, 32 + 4), GAME_IDS.portal);
  assert.equal(peek.searchGet(16 + 3, 71, 32 + 4), 0);
});

test("the Teleporter picks the same portal through searchGet as through get", () => {
  const edits = new Map([...portal(10, 10), ...portal(-30, 40), ...portal(90, -20)]);
  const terrain = { dimension: -1, generateTerrainChunk: () => column() };
  const run = (strip) => {
    const peek = new TerrainPeek(terrain, new Map(edits)); peek.time = 0;
    if (strip) peek.searchGet = undefined;
    const e = { x: 0.5, y: 64, z: 0.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, teleportDirection: 0 };
    new Teleporter(peek).placeInPortal(e, 0.5, 64, 0.5, 0);
    return [e.x, e.y, e.z, e.yaw];
  };
  assert.deepEqual(run(false), run(true));
});
