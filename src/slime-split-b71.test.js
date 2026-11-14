// Batch 71 mobfixes71: EntitySlime.setDead (ym.B, bytecode-read) spawns 2 + nextInt(3) children with no mob count test; the old 40-mob cap is gone.
// Seeded JavaRandom only (no Math.random).
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";

const flat = { numericSeed: 123, getMeta: () => 0, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64, y: 0, z: 64 }) };

for (const type of ["slime", "magma_cube"]) {
  test(`${type}: a size 4 ${type} splits into 2 to 4 children even in a world holding 100 mobs`, () => {
    for (let seed = 0; seed < 12; seed++) {
      const w = new EntityWorld(flat, [], () => 0.5);
      for (let i = 0; i < 100; i++) w.entities.push(w.create("pig", 40 + (i % 10), 0, 40 + Math.floor(i / 10)));
      const s = w.create(type, 64.5, 0, 64.5);
      s.size = 4; s.health = 0; // setDead splits only a dead slime (getHealth() <= 0)
      w.entities.push(s);
      const before = w.entities.length, rand = new JavaRandom(seed);
      const expected = 2 + new JavaRandom(seed).nextInt(3);
      w.splitSlime(s, rand);
      const kids = w.entities.length - before;
      assert.equal(kids, expected, `seed ${seed}`);
      assert.ok(kids >= 2 && kids <= 4);
      for (const k of w.entities.slice(before)) { assert.equal(k.type, type); assert.equal(k.size, 2); }
    }
  });
}
