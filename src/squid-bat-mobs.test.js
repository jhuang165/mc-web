import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld } from "./entities.js";
import { SUMMONABLE } from "./commands.js";
import { mobDrops, experiencePoints } from "./combat.js";
import { JavaRandom } from "./java-random.js";
import { batSpawnLimit } from "./squid-bat.js";

// Engine wiring of squid-bat.js (the pure rules are replayed in squid-bat.test.js).
const flat = { numericSeed: 1, solid: (x, y, z) => y < 1, get: (x, y, z) => (y < 1 ? 1 : 0), surface: () => 1, spawn: () => ({ x: 64.5, y: 1, z: 64.5 }) };
const world = (list) => new EntityWorld(flat, list.map((m, i) => ({ id: `mob-${i + 1}`, health: m.type === "bat" ? 6 : 10, ...m })));

test("/summon lists Squid and Bat", () => {
  assert.equal(SUMMONABLE.Squid, "squid");
  assert.equal(SUMMONABLE.Bat, "bat");
});

test("a saved bat record keeps its hanging state", () => {
  assert.equal(world([{ type: "bat", x: 5.5, y: 1, z: 5.5, batHanging: false }]).entities[0].batHanging, false);
  assert.equal(world([{ type: "bat", x: 5.5, y: 1, z: 5.5, batHanging: true }]).entities[0].batHanging, true);
});

test("a squid drops only ink sacs (dye damage 0) and gives 1-3 experience; a bat gives none", () => {
  const squid = { type: "squid", health: 0 };
  const drops = mobDrops(squid, { playerHit: true, looting: 0 }, new JavaRandom(1));
  assert.ok(drops.length > 0 && drops.every((d) => d[0] === 351 && !d[1]));
  const xp = experiencePoints(squid, new JavaRandom(2), new JavaRandom(3));
  assert.ok(xp >= 1 && xp <= 3);
  assert.equal(experiencePoints({ type: "bat", health: 0 }, new JavaRandom(2), new JavaRandom(3)), 0);
});
