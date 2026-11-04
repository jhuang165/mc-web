import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/village-live-reference.json" with { type: "json" };
import { JavaRandom } from "./java-random.js";
import { IRON_GOLEM, IRON_GOLEM_SOUNDS, IRON_GOLEM_MODEL, IRON_INGOT, golemAttackDamage, golemDrops, golemCanAttack, golemDecreaseAir, ironGolemShape, triangle, ironGolemAngles } from "./iron-golem.js";

const one = (c) => reference.records.find((r) => r.case === c);

test("EntityIronGolem constants and flags match the unchanged class", () => {
  const f = one("golemFacts");
  assert.equal(IRON_GOLEM.width, Math.fround(f.width));
  assert.equal(IRON_GOLEM.height, Math.fround(f.height));
  assert.equal(IRON_GOLEM.health, f.maxHealth);
  assert.equal(IRON_GOLEM.movement, Math.fround(f.speed));
  assert.equal(IRON_GOLEM.followRange, f.followRange);
  assert.equal(IRON_GOLEM.knockbackResistance, f.knockbackResistance);
  assert.equal(IRON_GOLEM_SOUNDS.hit, f.hit);
  assert.equal(IRON_GOLEM_SOUNDS.death, f.death);
  assert.equal(golemDecreaseAir(f.decreaseAir), f.decreaseAir);
  assert.equal(golemCanAttack({ playerCreated: false }, "player"), f.canAttackPlayer);
  const g = one("golemFlags");
  assert.equal(golemCanAttack({ playerCreated: g.playerCreated }, "player"), g.canAttackPlayer);
  assert.equal(golemCanAttack({ playerCreated: g.playerCreated }, "zombie"), g.canAttackZombie);
  assert.equal(golemCanAttack({}, "creeper"), false);
});

test("the melee attack damage is 7 + nextInt(15) on 40 native seeds", () => {
  const rows = one("golemAttack").rows;
  assert.equal(rows.length, 40);
  for (const row of rows) {
    assert.equal(row[1], true);
    // the villager target has 20 health: the recorded damage is what it lost
    assert.equal(Math.min(golemAttackDamage(new JavaRandom(row[0])), 20), row[2], "seed " + row[0]);
    assert.ok(row[2] >= 7 && row[2] <= 20);
    assert.equal(Math.fround(row[3]), Math.fround(0.8)); // vy after the 0.4 fling on a motionless target
  }
});

test("drops are nextInt(3) poppies then 3 + nextInt(3) iron ingots on 300 native seeds, looting ignored", () => {
  const rows = one("golemDrops").rows, POPPY = 9999;
  assert.equal(rows.length, 300);
  rows.forEach((row, seed) => {
    const mine = golemDrops(new JavaRandom(seed), POPPY).map(([id, n, d]) => [id === POPPY ? 38 : id === IRON_INGOT ? 265 : id, n, d]);
    assert.deepEqual(mine, row, "seed " + seed);
  });
});

test("the model boxes are ModelIronGolem's", () => {
  const parts = Object.values(one("model").model.parts);
  const mine = ["head", "body", "rightArm", "leftArm", "leftLeg", "rightLeg"].map((k) => IRON_GOLEM_MODEL[k]);
  assert.equal(parts.length, mine.length);
  parts.forEach((p, i) => {
    assert.deepEqual(p.texture, IRON_GOLEM_MODEL.texture);
    assert.deepEqual(p.point, mine[i].point);
    assert.deepEqual(
      p.boxes.map((b) => [...b.from, ...b.to.map((v, k) => v - b.from[k]), ...b.uv, b.grow]),
      mine[i].boxes,
    );
  });
});

test("the arm and leg animation follows the triangle wave", () => {
  assert.equal(triangle(0, 13), Math.fround(1));
  assert.equal(ironGolemAngles(0, 0, 0, 0, 0).rightArm, 0);
  const a = ironGolemAngles(3.25, 1, 0, 0, 0);
  assert.equal(a.leftLeg, -a.rightLeg);
  assert.equal(ironGolemAngles(0, 0, 10, 0, 0).rightArm, Math.fround(-2 + Math.fround(1.5 * triangle(10, 10))));
  assert.ok(ironGolemAngles(0, 0, 0, 20, 0).rightArm < 0);
});

test("two iron blocks and two side blocks under a pumpkin shape a golem", () => {
  const iron = new Set(["5,0,5", "5,1,5", "4,1,5", "6,1,5"]), at = (x, y, z) => iron.has(`${x},${y},${z}`);
  const s = ironGolemShape(at, 5, 2, 5);
  assert.equal(s.cells.length, 5);
  assert.ok(Math.abs(s.at.y - 0.05) < 1e-9 && s.at.x === 5.5 && s.at.z === 5.5);
  iron.delete("6,1,5");
  assert.equal(ironGolemShape(at, 5, 2, 5), null);
});
