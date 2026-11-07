import test from "node:test";
import assert from "node:assert/strict";
import { encodeBaseColumn, decodeBaseColumn } from "./whole-save-columns.js";
import { baseToJson, baseFromJson, collectBases, basesFromJson } from "./whole-save-json.js";

function column(world, x, z, seed) {
  const cells = new Uint16Array(65536);
  for (let i = 0; i < 4096; i++) cells[(i % 256) * 256 + (i >> 8) + seed] = (1 + (i % 7)) | ((i % 16) << 8);
  return encodeBaseColumn(world, x, z, cells, { biomes: Uint8Array.from({ length: 256 }, (_, i) => (i + seed) & 255), terrainPopulated: seed % 2 === 0, lightPopulated: seed === 3 });
}

test("a stored column survives the JSON form byte for byte and decodes to the same cells", () => {
  const original = column("w", -3, 7, 2), back = baseFromJson("new", JSON.parse(JSON.stringify(baseToJson(original))));
  assert.equal(back.world, "new");
  assert.deepEqual({ ...back, world: "w" }, { ...original, biomes: Uint8Array.from(original.biomes) });
  assert.deepEqual(decodeBaseColumn(back), decodeBaseColumn(original));
  assert.equal(baseFromJson("n", baseToJson(column("w", 0, 0, 3))).lightPopulated, true);
  assert.equal(baseFromJson("n", baseToJson(column("w", 0, 0, 3))).terrainPopulated, false);
});

test("collectBases gathers the three dimensions, honours the size limit and reports what did not fit", async () => {
  const store = { w: [column("w", 0, 0, 0), column("w", 1, 0, 1)], "w~-1": [column("w~-1", 5, 5, 4)], "w~1": [] };
  const list = async (k) => store[k].map((c) => [c.x, c.z]);
  const read = async (k, cols) => cols.map(([x, z]) => store[k].find((c) => c.x === x && c.z === z) ?? null);
  const key = (d) => (d ? `w~${d}` : "w");
  const all = await collectBases({ list, read, key });
  assert.equal(all.columns, 3); assert.equal(all.omitted, 0);
  assert.deepEqual(Object.keys(all.bases).sort(), ["-1", "0"]);
  const written = basesFromJson(JSON.parse(JSON.stringify(all.bases)), (d) => (d ? `n~${d}` : "n"));
  assert.deepEqual(written.map((r) => [r.world, r.x, r.z]), [["n", 0, 0], ["n", 1, 0], ["n~-1", 5, 5]]);
  for (const [i, r] of written.entries()) assert.deepEqual(decodeBaseColumn(r), decodeBaseColumn([...store.w, ...store["w~-1"]][i]));
  const small = await collectBases({ list, read, key, limit: 1 });
  assert.equal(small.columns + small.omitted, 3); assert.ok(small.omitted >= 2);
  assert.equal(await collectBases({ list: async () => [], read, key }), null);
  assert.deepEqual(basesFromJson(undefined, key), []);
});

test("damaged imported columns are rejected", () => {
  const json = baseToJson(column("w", 0, 0, 0));
  assert.throws(() => baseFromJson("n", { ...json, v: 99 }));
  assert.throws(() => baseFromJson("n", { ...json, sections: [[16, json.sections[0][1], json.sections[0][2]]] }));
  assert.throws(() => baseFromJson("n", { ...json, sections: [[0, "AAAA", json.sections[0][2]]] }));
  assert.throws(() => basesFromJson({ 0: "no" }, () => "n"));
});
