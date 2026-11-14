import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replayEntityList, entityListDivergence } from "./entity-list-replay.js";

// Batch 67 (entityprobes2). public/research/entity-throw-frame-reference.json (tools/probes/EntityThrowFrameProbe.java, executed over the unchanged
// EntityItemFrame and the throwable classes): balls thrown at an item frame, empty or holding an item, by a Survival player, a Creative player or nobody.
const ref = JSON.parse(readFileSync(new URL("../public/research/entity-throw-frame-reference.json", import.meta.url))).cases;

test("22 executed records of balls hitting item frames", () => assert.equal(ref.length, 22));
for (const c of ref) {
  test(`native frame hit ${c.name}`, () => assert.equal(entityListDivergence(c, replayEntityList(c)), null));
}

const by = (n) => ref.find((r) => r.name === n), last = (r) => r.rows[r.ticks - 1];
test("the records show what a hit does to a frame", () => {
  // a held item is knocked out and the frame stays; an empty frame breaks and drops itself
  const frameRow = (n) => last(by(n))[0].find((e) => e.length === 8);
  assert.equal(frameRow("pthrow-snowball-frame-item")[6], 0);
  assert.equal(frameRow("pthrow-snowball-frame-item")[7], 0);
  assert.equal(frameRow("pthrow-snowball-frame-empty")[6], 1);
  assert.equal(frameRow("pthrow-pearl-frame-item-creative")[6], 0);
});
test("potions and experience bottles leave a frame alone; snowballs, eggs and pearls act on it", () => {
  const frame = (n) => last(by(n))[0].find((e) => e.length === 8);
  for (const n of ["pthrow-potion-frame-item", "pthrow-expbottle-frame-item", "dispensed-potion-frame-item"]) assert.equal(frame(n)[7], 1, n + ": the held item stays");
  for (const n of ["pthrow-potion-frame-empty", "pthrow-expbottle-frame-empty"]) assert.equal(frame(n)[6], 0, n + ": the frame stays");
  for (const n of ["pthrow-egg-frame-item", "pthrow-pearl-frame-item", "dispensed-snowball-frame-item"]) assert.equal(frame(n)[7], 0, n + ": the item is knocked out");
  for (const n of ["pthrow-egg-frame-empty", "pthrow-pearl-frame-empty", "dispensed-snowball-frame-empty", "pthrow-egg-frame-hatch"]) assert.equal(frame(n)[6], 1, n + ": the frame breaks");
});

// The away run's frame drop (batch 47 awaythrows: hangingDrop in away-entities.js). Bytecode-read (javap on EntityItem.<init>): the dropped item's sideways motion is
// (float)(Math.random() * 0.2 - 0.1), its motionY 0.2, so there is no seed to replay; the range and the fixed rise are what the run has to keep.
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { Hanging } from "./hanging.js";
await populationBlockMapperReady;
test("away run: a ball knocking the item out of a frame drops it with the native rise, sideways motion within +-0.1 and a pickup delay of 10", async () => {
  const floor = (cols) => cols.map(([x, z]) => { const blocks = new Uint8Array(65536), meta = new Uint8Array(65536); for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = 3; return { x, z, blocks, meta }; });
  const h = new Hanging(); h.entities.push(h.make("frame", 0, 5, 11, 5, { item: { id: 4, count: 1, damage: 0 }, rotation: 0, dropChance: 1 }));
  const root = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 }, hanging: h.toJSON(), projectiles: [{ x: 5.5, y: 11.5, z: 1.5, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }] };
  const cols = stateColumns(root), r = await runAway({ ...awayPlan(root, cols, 5, 2), chunks: floor(cols), records: [] });
  const [d] = r.entities.drops;
  assert.ok(d, "the item joined the list");
  assert.equal(d.stack.id, 4);
  assert.equal(d.delay + d.age, 10, "pickup delay 10 at spawn, one per update");
  assert.ok(Math.abs(d.mx) <= 0.1 && Math.abs(d.mz) <= 0.1 && d.my > 0, JSON.stringify(d));
});
