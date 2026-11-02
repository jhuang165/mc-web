import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { World, SIZE, HEIGHT } from "./world.js";
import {
  JAVA_LANDSCAPES,
  JAVA_TERRAIN_BLOCKS,
  javaSeed,
} from "./java-world.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { LightVolume } from "./lighting.js";
import { EntityWorld } from "./entities.js";
import { Fluids } from "./fluids.js";
import { Fire } from "./fire.js";
import { Trees } from "./trees.js";
import { precipitationHeight, canSeeSky } from "./weather.js";
import { TILES, blockTile } from "./block-textures.js";
const ref = JSON.parse(
  readFileSync(
    new URL("../public/research/carver-reference.json", import.meta.url),
  ),
);
const sha = (a) => createHash("sha1").update(a).digest("hex");
function chunkHash(chunk) {
  const bytes = Buffer.alloc(chunk.blocks.length * 2);
  for (let i = 0; i < chunk.blocks.length; i++) {
    const [id] = toOriginal(chunk.blocks[i], chunk.meta[i]);
    bytes.writeUInt16LE(id === 8 ? 9 : id === 10 ? 11 : id, i * 2);
  }
  return sha(bytes);
}
test("Java runtime seed parsing retains full signed longs and Java UTF-16 hashes", () => {
  for (const seed of [
    "0",
    "-1",
    "+1",
    "9223372036854775807",
    "-9223372036854775808",
  ])
    assert.equal(javaSeed(seed), BigInt(seed));
  assert.equal(javaSeed("Overworld"), BigInt(1258808094));
  const s = "😀";
  assert.equal(javaSeed(s), BigInt(0xd83d * 31 + 0xde00));
});
test("playable Java viewport matches independent native chunks and spawn-biome search for all types", () => {
  for (const r of ref.records.filter((r) => r.kind === "viewport")) {
    const landscape = Object.keys(JAVA_LANDSCAPES).find(
        (k) => JAVA_LANDSCAPES[k] === r.type,
      ),
      world = new World(r.seed, landscape, 9);
    assert.equal(world.height, 256);
    assert.equal(world.seaLevel, 63);
    assert.deepEqual([world.originX, world.originZ], r.origin);
    for (const [cx, cz] of [
      [0, 0],
      [4, 4],
      [7, 7],
    ]) {
      const x = r.origin[0] / 16 + cx,
        z = r.origin[1] / 16 + cz,
        c = ref.records.find(
          (c) =>
            c.kind === "chunk" &&
            c.seed === r.seed &&
            c.type === r.type &&
            c.x === x &&
            c.z === z,
        );
      assert.ok(c);
      const chunk = world.chunkAt(cx, cz);
      assert.equal(
        chunkHash(chunk),
        c.runtimeSha1,
        `${r.seed} ${r.type} ${cx},${cz}`,
      );
      assert.equal(sha(chunk.meta), c.metadataSha1);
    }
    const p = world.spawn();
    assert.ok(p.y > 0 && p.y + 2 < 256);
    assert.equal(
      world.solid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)),
      false,
    );
  }
});
test("Java worlds retain high edits, metadata, scheduled ticks and high entities through JSON reload", () => {
  const w = new World("8675309", "java", 9);
  assert.equal(HEIGHT, 64, "legacy constant is preserved");
  w.set(16, 180, 15, 58, true, 12);
  w.set(16, 181, 15, 42, true, 0);
  w.set(17, 182, 15, 45, true, 2);
  const fluids = new Fluids(w),
    fire = new Fire(w);
  fluids.schedule(16, 181, 15, 30);
  fire.schedule(17, 182, 15, 30);
  const payload = JSON.parse(
    JSON.stringify({
      seed: w.seed,
      biome: w.biome,
      generationVersion: w.generationVersion,
      edits: [...w.edits],
      fluids: fluids.save(),
      fire: fire.save(),
    }),
  );
  const resumed = new World(
    payload.seed,
    payload.biome,
    payload.generationVersion,
  );
  resumed.restore(payload.edits);
  assert.deepEqual(
    [resumed.get(16, 180, 15), resumed.getMeta(16, 180, 15)],
    [58, 12],
  );
  assert.equal(resumed.inside(1, 255, 1), true);
  assert.equal(resumed.inside(1, 256, 1), false);
  assert.deepEqual(resumed.snapshot(), w.snapshot());
  assert.equal(
    resumed.sectionTickCount(1, 0, 11),
    w.sectionTickCount(1, 0, 11),
  );
  const rf = new Fluids(resumed);
  rf.load(payload.fluids);
  assert.deepEqual(rf.save(), payload.fluids);
  const rfire = new Fire(resumed);
  rfire.load(payload.fire);
  assert.deepEqual(rfire.save(), payload.fire);
  const mobs = new EntityWorld(resumed, [
    { id: "high-pig", type: "pig", x: 16.5, y: 183, z: 15.5, health: 10 },
  ]);
  assert.equal(mobs.entities.length, 1);
  assert.equal(mobs.entities[0].y, 183);
  const trees = new Trees(resumed);
  assert.equal(trees.maxY, 256);
});
test("Java high-altitude light, roof height 256 and weather see the complete world", () => {
  const w = new World("8675309", "java", 9);
  w.set(64, 200, 64, 3);
  w.set(65, 200, 64, 20);
  w.set(70, 255, 70, 3);
  const light = new LightVolume(w);
  assert.equal(light.height, 256);
  assert.equal(light.heights[70 * SIZE + 70], 256);
  assert.equal(light.skyAt(70, 255, 70), 0);
  assert.equal(light.skyAt(70, 256, 70), 15);
  assert.equal(light.blockAt(65, 200, 64), 14);
  assert.equal(precipitationHeight(w, 64, 64), 201);
  assert.equal(canSeeSky(w, 64, 199, 64), false);
  assert.equal(canSeeSky(w, 64, 201, 64), true);
  w.set(70, 255, 70, 0);
  light.update(70, 255, 70);
  assert.equal(light.skyAt(70, 255, 70), 15);
});
test("Java surface IDs, metadata and original textures cover every emitted surface family", () => {
  for (const [native, id] of Object.entries(JAVA_TERRAIN_BLOCKS)) {
    assert.equal(fromOriginal(+native).id, id);
    assert.equal(
      toOriginal(id)[0],
      +native === 8 ? 9 : +native === 10 ? 11 : +native,
    );
  }
  assert.equal(TILES[blockTile(6, 2, false, 1)], "red_sand");
  assert.equal(TILES[blockTile(2, 2, false, 2)], "dirt_podzol_top");
  assert.equal(
    TILES[blockTile(58, 0, false, 12)],
    "hardened_clay_stained_brown",
  );
  assert.equal(TILES[blockTile(56, 2)], "sandstone_top");
  assert.equal(TILES[blockTile(57, 2)], "mycelium_top");
});
