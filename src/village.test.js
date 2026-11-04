import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/village-live-reference.json" with { type: "json" };
import { JavaRandom } from "./java-random.js";
import { Village, VillageCollection, VillageDoorInfo, villageDocument, villagesFromNbt, villagesToNbt } from "./village.js";
import { encodeNbt, decodeNbt } from "./nbt.js";

const records = (c) => reference.records.filter((r) => r.case === c);
const cellKey = (x, y, z) => `${x},${y},${z}`;

// The probe world: stone below y 0, wooden doors in a map, roof rectangles hide the sky, villager boxes 0.6 x 1.8.
function makeWorld(seed) {
  const cells = new Map(), roofs = [], villagers = [], spawned = [];
  const host = {
    rand: new JavaRandom(seed),
    isWoodenDoor: (x, y, z) => cells.has(cellKey(x, y, z)),
    doorFacing: (x, y, z) => cells.get(cellKey(x, y, z)) & 3,
    canSeeSky: (x, y, z) => !roofs.some((r) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]),
    hasSolidTop: (x, y, z) => y < 0,
    isNormalCube: (x, y, z) => y < 0,
    countEntities: (kind, x0, y0, z0, x1, y1, z1) => kind === "villager"
      ? villagers.filter(([x, y, z]) => x - 0.3 < x1 && x + 0.3 > x0 && y < y1 && y + 1.8 > y0 && z - 0.3 < z1 && z + 0.3 > z0).length : 0,
    spawnGolem: (x, y, z) => spawned.push([x, y, z]),
  };
  return { cells, roofs, villagers, spawned, host };
}
function placeDoor(w, x, y, z, meta) { w.cells.set(cellKey(x, y, z), meta); w.cells.set(cellKey(x, y + 1, z), meta); }

const digest = (c) => c.villages.map((v) => [...v.center, v.radius, v.doors.length, v.numVillagers, v.numGolems]);
const doorRows = (c) => c.villages.flatMap((v) => v.doors.map((d) => [d.x, d.y, d.z, d.insideX, d.insideZ, d.lastActivity, d.detached, d.restriction]));

test("VillageCollection replays native door layouts, merges, aging and reputation (4 scenarios)", () => {
  for (const s of records("scenario")) {
    const w = makeWorld(s.seed), c = new VillageCollection(w.host);
    // the probe's world Random is seeded before the collection is built; reputation names persist in village 0
    const changes = [], snaps = [], reps = [];
    let last = null, vi = 0;
    for (let t = 0; t <= s.ticks; t++) {
      for (const op of s.script) {
        const p = op.split(" ");
        if (Number(p[0]) !== t) continue;
        const n = p.slice(2).map(Number);
        switch (p[1]) {
          case "reg": c.addVillagerPosition(...n); break;
          case "door": placeDoor(w, n[0], n[1], n[2], n[3]); break;
          case "rmdoor": w.cells.delete(cellKey(n[0], n[1], n[2])); w.cells.delete(cellKey(n[0], n[1] + 1, n[2])); break;
          case "roof": w.roofs.push(n); break;
          case "vill": w.villagers.push(n); vi++; break;
          case "rep": reps.push([t, c.villages[0].changeReputation(p[2], Number(p[3]))]); break;
        }
      }
      for (const ev of s.every) { const p = ev.split(" ").map(Number); if (t % p[0] === 0) c.addVillagerPosition(p[1], p[2], p[3]); }
      c.tick();
      const cur = JSON.stringify(digest(c));
      if (cur !== last) { changes.push([t, digest(c)]); last = cur; }
      if (t % 200 === 0) snaps.push([t, doorRows(c)]);
    }
    assert.deepEqual(changes, s.changes, s.name);
    assert.deepEqual(snaps, s.snaps, s.name + " doors");
    assert.deepEqual(reps, s.reps, s.name + " reputation");
  }
});

test("Village golem spawn: 21 doors + 10 villagers, world Random draws (3 seeds)", () => {
  for (const s of records("golemSpawn")) {
    const w = makeWorld(s.seed), c = new VillageCollection(w.host);
    w.roofs.push([40, 0, 49, 100]);
    for (let i = 0; i < 21; i++) placeDoor(w, 50 + (i % 5), 0, 50 + Math.trunc(i / 5) * 3, 0);
    for (let i = 0; i < 10; i++) w.villagers.push([52.5, 0, 52.5]);
    let tick = -1;
    for (let t = 0; t < 40000 && tick < 0; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); if (w.spawned.length) tick = t; }
    assert.equal(tick, s.tick, `seed ${s.seed}`);
    assert.deepEqual(w.spawned[0], s.pos.map((v) => v), `seed ${s.seed} position`);
    assert.equal(c.villages[0].numGolems, s.golems);
    assert.deepEqual(digest(c), s.village);
  }
});

test("Village reputation clamp, aggression threshold, mating season (native)", () => {
  const [rep] = records("reputation"), w = makeWorld(3), c = new VillageCollection(w.host);
  const v = new Village(w.host);
  for (const [delta, value, low] of rep.steps) { assert.equal(v.changeReputation("P", delta), value); assert.equal(v.isPlayerReputationTooLow("P"), low); }
  v.changeAllReputations(5);
  assert.equal(v.playerReputation("P"), rep.afterAll);
  assert.equal(v.playerReputation("Q"), rep.unknown);
  const [season] = records("matingSeason"), u = new Village(w.host), seen = [u.isMatingSeason()];
  u.tickCounter = 100; u.endMatingSeason(); seen.push(u.isMatingSeason());
  u.tickCounter = 3699; seen.push(u.isMatingSeason()); u.tickCounter = 3700; seen.push(u.isMatingSeason());
  assert.deepEqual(seen, season.steps);
  assert.ok(c);
});

test("Village door lookups, restriction counters and findNearestVillage (native)", () => {
  const [m] = records("doorMath"), w = makeWorld(5), c = new VillageCollection(w.host);
  w.roofs.push([40, 0, 49, 100]);
  for (let i = 0; i < 3; i++) placeDoor(w, 50 + i, 0, 50, 0);
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  const v = c.villages[0], rows = [];
  for (let round = 0; round < 3; round++) for (const [px, py, pz] of [[50, 0, 50], [48, 0, 49], [53, 0, 50], [52, 0, 56], [80, 0, 80], [50, 0, 64]]) {
    const n = v.nearestDoor(px, py, pz), un = v.nearestDoorUnrestricted(px, py, pz);
    rows.push([round, px, py, pz, n && [n.x, n.z, n.distSqTo(px, py, pz), n.distSqToInside(px, py, pz), n.isInside(px, pz)], un && [un.x, un.z, un.restrictionCount]]);
    if (un) un.incrementRestriction();
  }
  assert.deepEqual(rows, m.rows);
  assert.equal(!!c.findNearestVillage(52, 0, 52, 0), m.found);
  assert.equal(!!c.findNearestVillage(92, 0, 52, 32), m.nearest32);
  assert.equal(!!c.findNearestVillage(132, 0, 52, 32), m.nearest33);
});

test("villages.dat NBT and browser JSON round trip", () => {
  const w = makeWorld(1), c = new VillageCollection(w.host);
  w.roofs.push([40, 0, 49, 100]);
  for (let i = 0; i < 3; i++) placeDoor(w, 50 + i, 0, 50, 0);
  for (let t = 0; t < 5; t++) { if (t === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  c.villages[0].changeReputation("Steve", -4); c.villages[0].endMatingSeason();
  const json = JSON.parse(JSON.stringify(c.toJSON()));
  const back = decodeNbt(encodeNbt(villageDocument(json)));
  assert.deepEqual(villagesFromNbt(back.tag.value.get("data")), json);
  const d = new VillageCollection(w.host); d.loadJSON(json);
  assert.deepEqual(d.toJSON(), json);
  assert.ok(villagesToNbt(json).value.has("Villages"));
});
