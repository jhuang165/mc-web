import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference34 as reference, firstDivergence } from "./village-fight-replay.js";
import { EntityWorld } from "./entities.js";

// village-fight-b34-reference.json: VillageFightProbe on the unchanged 1.7.10 classes (tools/verify-village-fight.mjs). Same row layout as b33. These records read blocks through the real
// ChunkCache and Chunk objects and may leave chunk columns unloaded (field `unloaded`: World.spawnEntityInWorld refuses a non-player entity there).
for (const r of reference.records) {
  test(`village fight b34: ${r.name} replays with no divergence`, () => {
    const got = replayFight(r);
    assert.equal(firstDivergence(r, got), null, r.name);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
  });
}

const rec = (name) => reference.records.find((x) => x.name === name);
const diverges = (name, change) => {
  const r = { ...rec(name), ...change };
  return firstDivergence(r, replayFight(r)) !== null;
};

// A site in a chunk that is not loaded: yq.a still charges both zombies and stops searching, World.spawnEntityInWorld just refuses the zombie.
test("village fight b34: reinforcements whose site is in an unloaded chunk are refused (fewer zombies, and the later world Random draws still happen)", () => {
  let refusedHere = 0;
  for (const sd of [0, 1, 2]) {
    const loaded = rec(`b34-reinforce-loaded-${sd}`), unloaded = rec(`b34-reinforce-unloaded-${sd}`);
    assert.ok(unloaded.unloaded.length > 0 && !loaded.unloaded);
    assert.ok(unloaded.zombies.length < loaded.zombies.length, `seed ${sd}`);
    const made = (r) => replayFight(r).made.filter((m) => m[1] === "reinforce").length;
    assert.equal(made(unloaded), unloaded.zombies.length);
    assert.equal(made(loaded), loaded.zombies.length);
    refusedHere += diverges(`b34-reinforce-unloaded-${sd}`, { unloaded: undefined }) ? 1 : 0;
  }
  // the same fights without the unloaded columns do not match the records (in at least two of the three, a site fell in them)
  assert.ok(refusedHere >= 2, String(refusedHere));
});

// The ChunkCache does not bound the search: ayg reads blocks from entity.worldObj, so a wall beyond the region still seals the ring (b34-ring-sealed-d3: the golem never gets round it).
test("village fight b34: removing the walls, the fences, the cobweb or the ring changes the fights", () => {
  for (const name of ["b34-ring-sealed-d3", "b34-sealed-cell-d3", "b34-wall-closed-d3", "b34-nether-fence-closed-d3", "b34-arrows-cobweb-d3", "b34-web-fall-d3"]) assert.ok(diverges(name, { blocks: [] }), name);
  assert.ok(diverges("b34-wall-gap-d3", { blocks: rec("b34-wall-closed-d3").blocks }));
});

test("village fight b34: the cobweb and wall arenas are all present", () => {
  const names = reference.records.map((r) => r.name).join(" ");
  for (const k of ["ring-east", "ring-sealed", "sealed-cell", "chunk-border", "reinforce-loaded", "reinforce-unloaded", "wall-gap", "wall-closed", "nether-fence", "arrows-cobweb", "web-fall"]) assert.ok(names.includes(k), k);
});

// EntityLivingBase's constructor rolls rotationYaw = (float)(Math.random() * 3.1415927 * 2.0) in degrees (0 to 6.28) and sets rotationYawHead to it; the other yaw fields stay 0 (bytecode-read).
test("village fight b34: a live reinforcement zombie takes the constructor's yaw, the head with it", () => {
  const flat = { numericSeed: 1, getMeta: () => 0, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 8.5, y: 0, z: 8.5 }) };
  const ew = new EntityWorld(flat, []);
  const yaws = new Set();
  for (let i = 0; i < 20; i++) {
    const z = ew.spawnNatural("zombie", 8, 0, 8, "reinforce");
    assert.ok(z.rotationYaw >= 0 && z.rotationYaw < 6.2832, String(z.rotationYaw));
    assert.equal(z.rotationYawHead, z.rotationYaw);
    assert.equal(z.rotationYaw, Math.fround(z.rotationYaw));
    assert.ok(Math.abs(z.yaw - (-z.rotationYaw * Math.PI) / 180) < 1e-12);
    yaws.add(z.rotationYaw);
  }
  assert.ok(yaws.size > 10);
});
