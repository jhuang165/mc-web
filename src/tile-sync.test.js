// Batch 42 (tilesync): tile entity descriptions after a chunk resend (tile-sync.js, multiplayer/protocol.js splitChanges).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, FLOWER_POT, MOB_SPAWNER } from "./world.js";
import { Signs, SIGN_POST } from "./signs.js";
import { Skulls, SKULL } from "./skull.js";
import { Beacons, BEACON } from "./pyramid.js";
import { MobSpawners } from "./mob-spawner.js";
import { setPotContents, potContents } from "./stone-utility.js";
import { describeTiles, applyTiles } from "./tile-sync.js";
import { splitChanges, expandChunks, CHUNK_RESEND } from "./multiplayer/protocol.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/tile-description-reference.json", import.meta.url)));
const stores = (world) => ({ world, signs: new Signs(), skulls: new Skulls(), beacons: new Beacons(), spawners: new MobSpawners() });

test("the executed probe: exactly six tile entity classes send a description packet on a resend", () => {
  assert.deepEqual(ref.describing.map((d) => d.name).sort(), ["TileEntityBeacon", "TileEntityCommandBlock", "TileEntityFlowerPot", "TileEntityMobSpawner", "TileEntitySign", "TileEntitySkull"]);
  const action = (name) => Number(ref.describing.find((d) => d.name === name).fields.d);
  assert.deepEqual(["TileEntityMobSpawner", "TileEntityCommandBlock", "TileEntityBeacon", "TileEntitySkull", "TileEntityFlowerPot"].map(action), [1, 2, 3, 4, 5]);
  assert.equal(ref.describing.find((d) => d.name === "TileEntitySign").packet, "ii", "the sign has its own S33 packet");
  assert.ok(ref.silent.length >= 10, "chests, furnaces and the rest send nothing");
});

function fill(w, s) {
  w.put(5, 70, 5, SIGN_POST, 3, false); s.signs.create(5, 70, 5).text = ["Hello", "", "a b", "d"];
  w.put(6, 70, 5, SKULL, 1, false); s.skulls.create(6, 70, 5, 4, 9);
  w.put(7, 70, 5, BEACON, 0, false); Object.assign(s.beacons.ensure(7, 70, 5), { primary: 1, secondary: 5, levels: 4 });
  w.put(8, 70, 5, MOB_SPAWNER, 0, false); s.spawners.add({ x: 8, y: 70, z: 5, entityId: "Zombie" });
  w.put(9, 70, 5, FLOWER_POT, 0, false); setPotContents(w, 9, 70, 5, { id: 48, damage: 2 });
  w.put(40, 70, 5, SIGN_POST, 0, false); s.signs.create(40, 70, 5).text = ["other chunk", "", "", ""];
}

test("describeTiles lists the tile entities of the masked sections of one chunk, and only where the block is still there", () => {
  const w = new World("tilesync", "java", 9), s = stores(w);
  fill(w, s);
  const kinds = (mask) => describeTiles(s, 0, 0, mask).map((t) => t.kind);
  assert.deepEqual(kinds(1 << 4), ["sign", "skull", "spawner", "beacon", "pot"]);
  assert.deepEqual(kinds(1 << 3), [], "another section sends nothing");
  assert.equal(describeTiles(s, 2, 0, 1 << 4).length, 1, "the chunk at x 32..47 has its own sign");
  w.put(6, 70, 5, 0, 0, false);
  assert.deepEqual(kinds(1 << 4), ["sign", "spawner", "beacon", "pot"], "a tile goes with its block");
});

test("a 64-cell resend carries the tile entities, a 63-cell change set does not, and the replica ends with the same sign, skull, spawner, pot and beacon", () => {
  const w = new World("tilesync2", "java", 9), s = stores(w);
  fill(w, s);
  const cells = (n) => Array.from({ length: n }, (_, i) => [i % 16, 70 + (i >> 4) * 0, 9 + (i >> 4), 3, 0]);
  const column = (cx, cz) => w.chunks.get(`${cx},${cz}`);
  const tilesOf = (cx, cz, mask) => describeTiles(s, cx, cz, mask);
  // rows of 16 across z 9..12 at y 70: 64 distinct cells, one section
  const sixtyFour = cells(CHUNK_RESEND);
  assert.equal(splitChanges(sixtyFour.slice(0, 63), column, tilesOf).chunks.length, 0);
  const { chunks, changes } = splitChanges(sixtyFour, column, tilesOf);
  assert.equal(chunks.length, 1);
  assert.equal(changes.length, 0);
  assert.deepEqual(chunks[0].tiles.map((t) => t.kind), ["sign", "skull", "spawner", "beacon", "pot"]);
  const message = expandChunks({ changes: [], chunks });
  assert.equal(message.tiles.length, 5);
  const replica = new World("tilesync2", "java", 9), r = stores(replica);
  for (const [x, y, z, b, m] of message.changes) replica.put(x, y, z, b, m, false);
  for (const t of [[5, SIGN_POST, 3], [6, SKULL, 1], [7, BEACON, 0], [8, MOB_SPAWNER, 0], [9, FLOWER_POT, 0]]) replica.put(t[0], 70, 5, t[1], t[2], false);
  assert.equal(applyTiles(message.tiles, r), 5);
  assert.deepEqual(r.signs.tile(5, 70, 5).text, ["Hello", "", "a b", "d"]);
  assert.equal(r.signs.tile(5, 70, 5).editable, false);
  assert.deepEqual([r.skulls.tile(6, 70, 5).type, r.skulls.tile(6, 70, 5).rot], [4, 9]);
  assert.deepEqual([r.beacons.get(7, 70, 5).primary, r.beacons.get(7, 70, 5).secondary, r.beacons.get(7, 70, 5).levels], [1, 5, 4]);
  assert.equal(r.spawners.get(8, 70, 5).entityId, "Zombie");
  assert.deepEqual(potContents(replica, 9, 70, 5), { id: 48, damage: 2 });
  // a description for a cell whose block the replica does not hold is ignored, and bad entries never throw
  assert.equal(applyTiles([{ kind: "sign", x: 1, y: 1, z: 1, text: ["x"] }, null, { kind: "skull" }, { kind: "bogus", x: 5, y: 70, z: 5 }], r), 0);
});

test("a dedicated tick with 64 changes in a chunk with a saved sign sends the sign with the chunk and it round-trips through save", () => {
  const a = new DedicatedSimulation({ seed: "tilesync3", biome: "java", generationVersion: 9 });
  a.world.put(5, 70, 5, SIGN_POST, 3, false);
  a.tileEntities.signs.create(5, 70, 5).text = ["Spawn", "here", "", ""];
  a.tick();
  for (let i = 0; i < 64; i++) a.world.put(i % 16, 64 + (i >> 4), 3, 3, 0);
  const tick = a.tick();
  assert.equal(tick.chunks.length, 1);
  assert.deepEqual(tick.chunks[0].tiles, [{ kind: "sign", x: 5, y: 70, z: 5, text: ["Spawn", "here", "", ""] }]);
  const saved = JSON.parse(JSON.stringify(a.save()));
  const b = new DedicatedSimulation(saved);
  assert.deepEqual(b.tileEntities.signs.tile(5, 70, 5).text, ["Spawn", "here", "", ""]);
});
