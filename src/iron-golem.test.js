import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/village-live-reference.json" with { type: "json" };
import { JavaRandom } from "./java-random.js";
import { IRON_GOLEM, IRON_GOLEM_SOUNDS, IRON_GOLEM_MODEL, IRON_INGOT, golemAttackDamage, golemDrops, golemCanAttack, golemDecreaseAir, IMOB_TYPES, golemCollideRetargets, golemTail, IRON_GOLEM_ROSE_TEXTURE, ironGolemShape, triangle, ironGolemAngles } from "./iron-golem.js";

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

// EntityList registry names of the IMob implementors (the probe's "imob" record) in the browser's type names.
const NATIVE_TO_TYPE = { Blaze: "blaze", CaveSpider: "cave_spider", Creeper: "creeper", EnderDragon: "ender_dragon", Enderman: "enderman", Ghast: "ghast", Giant: "giant", LavaSlime: "magma_cube", PigZombie: "pigman", Silverfish: "silverfish", Skeleton: "skeleton", Slime: "slime", Spider: "spider", Witch: "witch", WitherBoss: "wither", Zombie: "zombie" };

test("IMob is exactly the native implementor list (the wither skeleton is a Skeleton variant)", () => {
  const native = one("imob").rows.filter((r) => r[1] && r[0] !== "Monster").map((r) => NATIVE_TO_TYPE[r[0]]);
  assert.ok(native.every(Boolean), "every native IMob has a browser type name");
  assert.deepEqual([...IMOB_TYPES].filter((t) => t !== "wither_skeleton").sort(), native.sort());
  assert.ok(IMOB_TYPES.has("wither_skeleton"));
  for (const [name, imob] of one("imob").rows) if (!imob) assert.ok(!IMOB_TYPES.has(NATIVE_TO_TYPE[name] ?? name.toLowerCase()), name);
});

test("collideWithEntity retargets on a 1 in 20 roll over seeded Randoms and only draws for an IMob", () => {
  const rows = one("golemCollide").rows, kinds = { Zombie: "zombie", Creeper: "creeper", Skeleton: "skeleton", Spider: "spider", Slime: "slime", Villager: "villager", Pig: "pig", Enderman: "enderman" };
  assert.equal(rows.length, 480);
  let targeted = 0;
  for (const [kind, seed, target, next] of rows) {
    const rand = new JavaRandom(seed);
    assert.equal(golemCollideRetargets(rand, kinds[kind]), target, `${kind} seed ${seed}`);
    assert.equal(rand.nextInt(1000000), next, `${kind} seed ${seed}: the next draw`);
    if (target) targeted++;
  }
  assert.ok(targeted > 0 && targeted < 60, "about 1 in 20 of the IMob collisions");
  assert.ok(rows.filter(([k]) => k === "Villager" || k === "Pig").every((r) => r[2] === false));
});

test("the step sound is mob.irongolem.walk at 1.0 / 1.0 whatever the block", async () => {
  assert.deepEqual(one("golemStep").sounds, [`${IRON_GOLEM_SOUNDS.walk}|1.0|1.0`]);
  const { mobStepEvents, canTriggerWalking } = await import("./mob-steps.js");
  assert.equal(canTriggerWalking("iron_golem"), true);
  const world = { get: () => 1, getMeta: () => 0 };
  const golem = { type: "iron_golem", x: 0, y: 0, z: 0, onGround: true }, steps = [];
  for (let i = 1; i <= 40; i++) { const from = { x: golem.x, y: 0, z: 0 }; golem.x = i * 0.25; steps.push(...mobStepEvents(world, golem, from, { random: () => 0.5 })); }
  assert.ok(steps.length >= 5 && steps.length <= 6, "10 blocks at 0.6 step distance per block: " + steps.length);
  assert.ok(steps.every((e) => e.sound === "mob.irongolem.walk" && e.volume === 1 && e.pitch === 1), JSON.stringify(steps.slice(0, 2)));
});

test("attackTimer and holdRoseTick count down after the AI and the walking dust draws x, z, motion on the entity Random", () => {
  const rows = one("golemTimers").rows;
  assert.equal(rows.length, 12);
  let particles = 0;
  for (const row of rows) {
    const e = { attackTimer: 10, holdRose: 400, x: 64.5, y: 0, z: 64.5, vx: 0, vz: 0 }, expected = row.particles.map((p) => p.split("|"));
    let made = 0;
    row.timers.forEach(([br, bs, vx, vz, tail], t) => {
      // the draws of this tick's tail (from its last nextInt(5)) replayed as the golem's Random
      const queue = tail.map((d) => (d[0] === "i" ? Number(d.split(":")[1]) : Math.fround(Number(d.slice(2)))));
      const rand = { nextInt: (n) => { assert.equal(n, 5); return queue.shift(); }, nextFloat: () => queue.shift() };
      e.vx = vx; e.vz = vz;
      // attackTimer/holdRose were 10/400 before the first tick and the recorded values are after the decrement
      const spec = golemTail(e, tail.length ? rand : { nextInt: () => assert.fail("no draw expected"), nextFloat: () => assert.fail("no draw") }, () => ({ id: 1, meta: 0 }));
      assert.equal(e.attackTimer, br, `seed ${row.seed} tick ${t}: attackTimer`);
      assert.equal(e.holdRose, bs, `seed ${row.seed} tick ${t}: holdRose`);
      if (spec) {
        const [, px, py, pz, pvx, pvy, pvz] = expected[made++];
        // the golem moved under its AI during the probe, so only the offset from the feet is comparable: within half a width
        assert.ok(Math.abs(spec.x - Number(px)) < 2 && Math.abs(spec.z - Number(pz)) < 2);
        assert.ok(Math.abs(spec.x - e.x) <= 0.7 && Math.abs(spec.z - e.z) <= 0.7);
        assert.equal(spec.y, 0.1); assert.equal(spec.vy, 0.5);
        assert.ok(Math.abs(spec.vx - Number(pvx)) < 1e-12 && Math.abs(spec.vz - Number(pvz)) < 1e-12, `motion ${spec.vx} ${pvx}`);
        particles++;
      }
    });
    assert.equal(made, expected.length, `seed ${row.seed}: particle count`);
  }
  assert.ok(particles >= 10);
});

test("an air block under the golem makes no particle and no draws after the roll", () => {
  const drawn = [];
  const rand = { nextInt: () => (drawn.push("i"), 0), nextFloat: () => (drawn.push("f"), 0.5) };
  assert.equal(golemTail({ attackTimer: 0, holdRose: 0, x: 1.5, y: 0, z: 1.5, vx: 0.1, vz: 0 }, rand, () => null), null);
  assert.deepEqual(drawn, ["i"]);
  assert.equal(golemTail({ attackTimer: 0, holdRose: 0, x: 1.5, y: 0, z: 1.5, vx: 0, vz: 0 }, { nextInt: () => assert.fail("still"), nextFloat: () => 0 }, () => ({ id: 1 })), null);
});

test("the rose is the red_flower poppy texture", () => {
  assert.equal(IRON_GOLEM_ROSE_TEXTURE, "/media/1.7.10/blocks/flower_rose.png");
});
