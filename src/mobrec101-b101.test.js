// Batch 101 mobrec101:
// 1. The knockback of a witch hit by its own potion draws its direction from java.lang.Math.random (the coincident-attacker nudge of EntityLivingBase.attackEntityFrom, sv.a),
//    not from a seeded Random: the two records dropped in batch 100 replay with the probe's recorded Math.random values (EndermanWolfProbe emits `mathRandom`).
// 2. Iron golem spawn gating of Village.tick: public/research/village-gate-b101-reference.json (tools/verify-village101.mjs, probes/VillageGate101Probe.java), replayed through the
//    real createVillageHost (village-host.js) and VillageCollection on a fake EntityWorld that holds the probe's blocks and entities.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";
import { createVillageHost } from "./village-host.js";
import { VillageCollection } from "./village.js";
import { JavaRandom } from "./java-random.js";
import { WOODEN_DOOR } from "./world.js";

const witch = JSON.parse(readFileSync(new URL("../public/research/enderman-wolf-b101mr-witchknock-reference.json", import.meta.url)));
const gate = JSON.parse(readFileSync(new URL("../public/research/village-gate-b101-reference.json", import.meta.url)));

for (const r of witch.records) {
  test(`mobrec101 witch knockback: ${r.name} replays with no divergence (Executed, Math.random values fed)`, () => {
    const got = replayEndermanWolf(r);
    assert.equal(JSON.stringify(firstDivergence(r, got)), "null", r.name);
    // the nudge loop (while dx*dx + dz*dz < 1.0E-4: four Math.random per pass) draws the same number of values on every tick that has one
    const per = (a) => a.reduce((m, x) => ((m[x[0]] = (m[x[0]] ?? 0) + 1), m), {});
    const want = per(r.mathRandom), have = per(got.mathCalls);
    const nudge = Object.keys(want).filter((t) => want[t] > 1);
    assert.ok(nudge.length >= 2, "the record has nudge ticks");
    for (const t of nudge) assert.equal(have[t], want[t], `tick ${t}`);
  });
}
test("mobrec101 witch knockback: the first nudge tick's direction comes from the fed values (the replay does not draw its own)", () => {
  const r = structuredClone(witch.records[0]);
  const first = Math.min(...r.mathRandom.filter((x, _, a) => a.filter((y) => y[0] === x[0]).length > 1).map((x) => x[0]));
  r.mathRandom.filter((m) => m[0] === first).forEach((m, i) => { m[1] = [0.9, 0.1, 0.8, 0.2][i % 4]; });
  assert.notEqual(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null");
});

// ---- iron golem spawn gating ----
const key = (x, y, z) => `${x},${y},${z}`;
function replay(r) {
  const cells = new Map(), roofs = [[40, 0, 49, 100]], entities = [];
  const world = {
    get: (x, y, z) => cells.get(key(x, y, z))?.[0] ?? (y < 0 ? 1 : 0),
    getMeta: (x, y, z) => cells.get(key(x, y, z))?.[1] ?? 0,
    solid: (x, y, z) => (cells.has(key(x, y, z)) ? cells.get(key(x, y, z))[0] !== 0 && cells.get(key(x, y, z))[0] !== WOODEN_DOOR : y < 0),
  };
  const rolls = [], draws = [], zero = [];
  let tick = 0;
  const rand = new JavaRandom(r.seed), nextInt = rand.nextInt.bind(rand);
  rand.nextInt = (b) => { const v = nextInt(b); if (b === 7000 && v === 0) zero.push(tick); if (b === 16 || b === 6) draws.push([tick, b, v]); return v; };
  const sizes = { villager: [0.6, 1.8], iron_golem: [1.4, 2.9] };
  const ew = {
    world, entities, worldRandom: rand, size: (e) => sizes[e.type], frozen: null, ai: { deps: { canSeeSky: (x, y, z) => !roofs.some((q) => x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3]) } },
    spawnIronGolem: (x, y, z) => { const g = { type: "iron_golem", x, y, z, health: 100 }; entities.push(g); return g; },
  };
  const host = createVillageHost(ew), c = new VillageCollection(host), spawns = [], snaps = [];
  for (tick = 0; tick <= r.ticks; tick++) {
    for (const op of r.script) {
      const p = op.split(" ");
      if (Number(p[0]) !== tick) continue;
      const n = p.slice(2).map(Number);
      if (p[1] === "door") { cells.set(key(n[0], n[1], n[2]), [WOODEN_DOOR, n[3]]); cells.set(key(n[0], n[1] + 1, n[2]), [WOODEN_DOOR, 8 | 0]); }
      else if (p[1] === "rmdoor") { cells.delete(key(n[0], n[1], n[2])); cells.delete(key(n[0], n[1] + 1, n[2])); }
      else if (p[1] === "vill") entities.push({ type: "villager", x: n[0], y: n[1], z: n[2], health: 20 });
      else if (p[1] === "golem") entities.push({ type: "iron_golem", x: n[0], y: n[1], z: n[2], health: 100 });
      else if (p[1] === "fill") for (let x = n[0]; x <= n[3]; x++) for (let y = n[1]; y <= n[4]; y++) for (let z = n[2]; z <= n[5]; z++) cells.set(key(x, y, z), [1, 0]);
    }
    const before = entities.filter((e) => e.type === "iron_golem").length;
    if (tick % 60 === 0) c.addVillagerPosition(52, 0, 52);
    c.tick();
    for (const g of entities.filter((e) => e.type === "iron_golem").slice(before)) spawns.push([tick, g.x, g.y, g.z, c.villages[0].numGolems]);
    if (tick % 500 === 0) snaps.push([tick, c.villages.map((v) => [...v.center, v.radius, v.doors.length, v.numVillagers, v.numGolems])]);
  }
  return { spawns, zero, draws, snaps };
}

test("mobrec101 golem gate: 20 executed records, ten of them spawn", () => {
  assert.equal(gate.records.length, 20);
  assert.equal(gate.records.filter((r) => r.spawns.length).length, 10);
});
for (const r of gate.records) {
  test(`mobrec101 golem gate: ${r.name} replays the spawns, rolls, search draws and village counts (Executed)`, () => {
    const got = replay(r);
    assert.deepEqual(got.spawns, r.spawns, "spawns");
    assert.deepEqual(got.zero, r.zeroRolls, "nextInt(7000) == 0 ticks");
    assert.deepEqual(got.draws, r.draws, "spawn box search draws");
    assert.deepEqual(got.snaps, r.snaps, "village digests");
  });
}
test("mobrec101 golem gate: the facts behind the gate (Executed records, Bytecode-read vz.a(int))", () => {
  const by = Object.fromEntries(gate.records.map((r) => [r.name, r]));
  assert.equal(by["gate-doors20-42"].spawns.length + by["gate-doors20-vill30-42"].spawns.length, 0); // 20 doors never (doors > 20)
  assert.equal(by["gate-vill9-42"].spawns.length, 0); // 9 / 10 = 0 golems allowed
  assert.equal(by["gate-vill19-golem1-42"].spawns.length, 0); // 19 / 10 = 1, one counted
  assert.equal(by["gate-vill20-golem1-42"].spawns.length, 1); // 20 / 10 = 2, one counted
  assert.equal(by["gate-vill20-golem2-42"].spawns.length, 0);
  assert.equal(by["gate-vill-high-42"].snaps.at(-1)[1][0][5], 0); // a villager 10 up is outside the y +-4 box
  assert.equal(by["gate-slab1-42"].spawns[0][2], 2); // the search found the slab top (py 2) because every py 0 box held the slab
  assert.equal(by["gate-long-vill20-42"].spawns.length, 2);
  assert.equal(by["gate-long-vill10-42"].spawns.length, 1); // the first golem is counted from the entity list at the next recount
  assert.ok(by["gate-door-removed-42"].zeroRolls.every((t) => t < 500)); // no roll once the 21st door is gone
});
