// Batch 63 horses2: onSpawnWithEgg never rolls skeleton or zombie horses (type 3 or 4), and a sitting cat blocks a chest (BlockChest.func_149951_m / onBlockActivated).
// Replays public/research/horses63-reference.json (tools/probes/Horses63Probe.java: the unchanged wi, ajx and wn, executed) against horse.js, chest.js and entities.js.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { newRandom, spawnHorse } from "./horse.js";
import { openChest } from "./chest.js";
import { EntityWorld } from "./entities.js";

const ref = JSON.parse(await readFile(new URL("../public/research/horses63-reference.json", import.meta.url), "utf8"));

// [type, variant, age, maxHealth, speed, jump, next draw] of the port's horse after the roll
const rowOf = (r, h) => [h.type, h.variant, h.age, h.maxHealth, h.speed, h.jump, r.nextInt(1000000)];
const same = (got, want, at) => {
  for (let i = 0; i < 7; i++) assert.ok(i === 3 || i === 4 || i === 5 ? Math.abs(got[i] - want[i]) < 1e-6 * Math.max(1, Math.abs(want[i])) : got[i] === want[i], `${at} field ${i}: ${got[i]} vs ${want[i]}`);
};

test("reference counts", () => {
  assert.equal(ref.target, "Minecraft Java 1.7.10");
  assert.equal(ref.spawn.length, 4000);
  assert.equal(ref.herd.length, 300);
  assert.equal(ref.chestCat.length, 96);
});

test("executed: 4000 lone rolls and 300 herds of six make only types 0 and 1", () => {
  assert.equal(ref.spawnTypes.single[3] + ref.spawnTypes.single[4] + ref.spawnTypes.herd[3] + ref.spawnTypes.herd[4] + ref.spawnTypes.single[2] + ref.spawnTypes.herd[2], 0);
  assert.equal(ref.spawnTypes.single[0] + ref.spawnTypes.single[1], 4000);
  assert.equal(ref.spawnTypes.herd[0] + ref.spawnTypes.herd[1], 1800);
});

test("lone spawn rolls replay with the Random stream (4000 seeds, never type 3 or 4)", () => {
  for (const s of ref.spawn) {
    const r = newRandom(s.seed);
    const { horse, group } = spawnHorse(r);
    assert.ok(horse.type === 0 || horse.type === 1, `seed ${s.seed} type ${horse.type}`);
    same(rowOf(r, horse), s.row, `seed ${s.seed}`);
    assert.deepEqual([group.type, group.variant], s.group);
  }
});

test("herd rolls (each horse takes the previous group) replay (300 herds x 6)", () => {
  for (const h of ref.herd) {
    let group = null;
    h.rows.forEach((row, i) => {
      const r = newRandom(h.seed * 7 + i);
      const out = spawnHorse(r, group);
      group = out.group;
      assert.ok(out.horse.type <= 1);
      same(rowOf(r, out.horse), row, `herd ${h.seed} member ${i}`);
    });
  }
});

const ID = { 54: 41, 146: 162 };
test("a click on a chest under or beside a sitting cat opens what the executed chest opens (96 scenes, with partners, a dying cat and an edge)", () => {
  for (const sc of ref.chestCat) {
    // the scenes' cats are listed in the probe; rebuild them from the scene name
    const cats = {
      none: [], sitOnThis: [[64.5, 65, 64.5, 1, 10]], standOnThis: [[64.5, 65, 64.5, 0, 10]], sitOnEastPartner: [[65.5, 65, 64.5, 1, 10]], sitOnNorthPartner: [[64.5, 65, 63.5, 1, 10]],
      sitOnSouthSide: [[64.5, 65, 65.5, 1, 10]], sitBeside: [[66.9, 65, 64.5, 1, 10]], sitEdge: [[64.2, 65, 64.9, 1, 10]], sitInside: [[64.5, 64, 64.5, 1, 10]], sitHigh: [[64.5, 66.5, 64.5, 1, 10]],
      sitDead: [[64.5, 65, 64.5, 1, 0]], twoCatsStandSit: [[64.5, 65, 64.5, 0, 10], [65.5, 65, 64.5, 1, 10]],
    }[sc.scene];
    const cells = new Map(sc.chests.map((c) => [c.at.join(","), ID[c.id]]));
    const base = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
    const mobs = new EntityWorld(base, [], () => 0.5);
    for (const [x, y, z, sit, health] of cats) { const e = mobs.create("ocelot", x, y, z); e.sitting = sit === 1; e.health = health; mobs.entities.push(e); }
    const world = { get: base.get, ocelotOnChest: (x, y, z) => mobs.ocelotSitsOn(x, y, z) };
    for (const c of sc.chests) {
      const opened = openChest(world, {}, ...c.at);
      const at = `${sc.kind} ${sc.layout} ${sc.scene} ${c.at}`;
      assert.equal(opened !== null, c.opened, at);
      if (opened) assert.equal(opened.inventory.size, c.size, at);
    }
  }
});
