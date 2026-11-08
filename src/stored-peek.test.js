import test from "node:test";
import assert from "node:assert/strict";
import { buildStoredIndex } from "./stored-peek.js";
import { TerrainPeek } from "./dimension-world.js";
import { encodeBaseColumn } from "./whole-save-columns.js";

const PORTAL = 90;
function record(x, z, fill) {
  const cells = new Uint16Array(65536);
  fill(cells);
  return { world: "w", ...encodeBaseColumn("w", x, z, cells) };
}
const cell = (lx, lz, y) => (lx * 16 + lz) * 256 + y;
const records = new Map([
  ["0,0", record(0, 0, (c) => { c[cell(1, 2, 63)] = 1; c[cell(1, 2, 70)] = 3; c[cell(0, 0, 0)] = 7; })],
  ["5,-2", record(5, -2, (c) => { c[cell(4, 9, 40)] = 1; c[cell(4, 9, 41)] = PORTAL; c[cell(4, 9, 42)] = PORTAL; })],
]);
const index = () => buildStoredIndex({
  list: async () => [...records.values()].map((r) => [r.x, r.z]),
  read: async (cols) => cols.map(([x, z]) => records.get(`${x},${z}`) ?? null),
  marker: PORTAL,
});

test("stored index: tops follow CommandSpreadPlayers (y >= 1, 257 over an empty column)", async () => {
  const i = await index();
  assert.equal(i.topY(1, 2), 71);
  assert.equal(i.topY(0, 0), 257); // only bedrock-level y 0 is ignored
  assert.equal(i.topY(3, 3), 257);
  assert.equal(i.topY(500, 500), undefined);
  assert.ok(i.has(5, -2) && !i.has(9, 9));
});

test("stored index: portal columns and kept terrain feed the Teleporter peek", async () => {
  const i = await index();
  assert.deepEqual(i.portalColumns(-1e3, 1e3, -1e3, 1e3), [[5 * 16 + 4, -2 * 16 + 9]]);
  const peek = new TerrainPeek({ generateTerrainChunk: () => ({ blocks: new Uint8Array(65536), metadata: new Uint8Array(65536) }) });
  peek.stored = i;
  assert.deepEqual(peek.portalColumns(PORTAL, 0, 200, -100, 100), [[84, -23]]);
  assert.deepEqual(peek.portalColumns(PORTAL, 0, 50, -100, 100), []);
  assert.equal(peek.get(84, 41, -23), PORTAL);
  assert.equal(peek.get(84, 43, -23), 0);
  assert.equal(new TerrainPeek({ generateTerrainChunk: () => ({ blocks: new Uint8Array(65536) }) }).portalColumns(PORTAL, 0, 200, -100, 100).length, 0);
});
