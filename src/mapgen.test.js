import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MapGenBase, MapGenCaves, MapGenRavine, randomLong } from "./mapgen.js";
import {
  ChunkProviderGenerate,
  BiomeTerrainState,
} from "./terrain-generator.js";
import { JavaRandom } from "./lighting.js";
const ref = JSON.parse(
  readFileSync(
    new URL("../public/research/carver-reference.json", import.meta.url),
  ),
);
const hash = (a) => {
  const b = Buffer.alloc(a.length * 2);
  for (let i = 0; i < a.length; i++) b.writeUInt16LE(a[i], i * 2);
  return createHash("sha1").update(b).digest("hex");
};
function fixture(name) {
  const a = new Uint16Array(65536);
  for (let x = 0; x < 16; x++)
    for (let z = 0; z < 16; z++)
      for (let y = 0; y <= (name === "ceiling" ? 255 : 100); y++) {
        let id = y <= 3 ? 7 : y === 80 ? 2 : y > 76 && y < 80 ? 3 : 1;
        if (name === "materials")
          id = [1, 12, 2, 24, 3, 159, 1, 172, 2, 7, 3, 110, 1, 20, 3, 0][z];
        if (name.startsWith("water") && x === 8 && y >= 15 && y <= 90)
          id = name === "water8" ? 8 : 9;
        a[(x * 16 + z) * 256 + y] = id;
      }
  return a;
}
const changes = (a, b) =>
  Array.from(b, (id, i) => (id !== a[i] ? [i, id] : null)).filter(Boolean);
for (const [name, C] of [
  ["cave", MapGenCaves],
  ["ravine", MapGenRavine],
])
  test(`GEN-03 ${name}: native tunnel shapes, materials, water veto, lava, grass and far coordinates`, () => {
    for (const r of ref.records.filter(
      (r) => r.kind === "tunnel" && r.carver === name,
    )) {
      const g = new C(8675309n);
      g.random = new JavaRandom(1234);
      const blocks = fixture(r.fixture),
        before = blocks.slice();
      g.tunnel(BigInt(r.seed), ...r.chunk, blocks, ...r.params);
      assert.equal(
        hash(blocks),
        r.sha1,
        `${name} ${r.fixture} ${r.seed} ${r.params}`,
      );
      assert.deepEqual(changes(before, blocks), r.changes);
    }
  });
test("GEN-03 complete native pre-population chunks: caves then ravines, unchanged metadata", () => {
  for (const r of ref.records.filter((r) => r.kind === "chunk")) {
    const gen = new ChunkProviderGenerate(
        r.seed,
        r.type,
        new BiomeTerrainState(),
      ),
      chunk = gen.provideChunk(r.x, r.z);
    assert.equal(hash(chunk.blocks), r.inputSha1, "terrain input");
    const before = chunk.blocks.slice();
    new MapGenCaves(BigInt(r.seed), gen.manager, (x, z) =>
      gen.biomeState.topBlock(gen.manager.biomeAt(x, z)),
    ).generate(r.x, r.z, chunk.blocks);
    assert.equal(
      hash(chunk.blocks),
      r.cavesSha1,
      `caves ${r.seed} ${r.type} ${r.x},${r.z}`,
    );
    assert.deepEqual(changes(before, chunk.blocks), r.caves);
    const caves = chunk.blocks.slice();
    new MapGenRavine(BigInt(r.seed), gen.manager, (x, z) =>
      gen.biomeState.topBlock(gen.manager.biomeAt(x, z)),
    ).generate(r.x, r.z, chunk.blocks);
    assert.equal(
      hash(chunk.blocks),
      r.sha1,
      `ravines ${r.seed} ${r.type} ${r.x},${r.z}`,
    );
    assert.deepEqual(changes(caves, chunk.blocks), r.ravines);
    assert.equal(
      createHash("sha1").update(chunk.metadata).digest("hex"),
      r.metadataSha1,
    );
  }
});

test("GEN-03 MapGenBase replays every neighbour source seed including signed-long overflow", () => {
  class Trace extends MapGenBase {
    recursiveGenerate(x, z) {
      this.rows.push([x, z, randomLong(this.random).toString()]);
    }
  }
  for (const r of ref.records.filter((r) => r.kind === "base")) {
    const g = new Trace(r.seed);
    g.rows = [];
    g.generate(r.x, r.z, new Uint16Array(65536));
    assert.deepEqual(g.rows, r.sources);
  }
});
