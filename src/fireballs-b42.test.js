import test from "node:test";
import assert from "node:assert/strict";
import { fireballReference42, replayFireballs, fireballDivergence } from "./fireballs-replay.js";
import { EntityWorld } from "./entities.js";
import { thrownHit } from "./projectiles.js";

// public/research/fireballs-b42-reference.json (tools/probes/FireballProbe.java, FB_PREFIX=fb42-): one World.loadedEntityList walked in insertion order (balls and
// mobs interleave by when each joined), a ghast's balls at mobs, the ghast's own target, and an EntitySnowball.onImpact on a blaze (all executed on the unchanged classes).
for (const r of fireballReference42) {
  test(`native b42 fireballs ${r.name}`, () => {
    assert.equal(fireballDivergence(r, replayFireballs(r)), null);
  });
}

const by = (s) => fireballReference42.filter((r) => r.name.includes(s));

test("the b42 records cover the list order, ghast balls at mobs, the ghast target and the snowball", () => {
  assert.equal(fireballReference42.length, 17);
  assert.equal(by("order-").length, 9);
  assert.equal(by("order-").filter((r) => r.script.some((x) => x.includes(" join "))).length, 8); // all but the mob-first control launch a ball before a mob joins
  // the killed zombie: ball first, the corpse's death update runs; mob first, the zombie updates alive on the hit tick
  const first = by("kill-ball-first")[0], second = by("kill-mob-first")[0];
  const dead = (r) => r.rows.findIndex((x) => x[0][0][6] === 0);
  assert.ok(dead(first) > 0 && dead(second) > 0);
  assert.notEqual(dead(first), dead(second));
  // a ghast targets only players (EntityGhast.updateEntityActionState): its slot 9 is the player's index or -1 whatever hurt it
  for (const r of by("ghast-hurt")) {
    const n = r.types.length;
    assert.ok(r.rows.every((x) => x[0][0][9] === n || x[0][0][9] === -1));
    assert.ok(r.rows.some((x) => x[0][0][9] === n)); // it does target the player
    assert.ok(r.rows.some((x, i) => i && x[0][0][6] < r.rows[i - 1][0][0][6])); // and the hurts landed
  }
  // balls at mobs: the blaze, the pigman and the silverfish take the ghast (index 0) as entityToAttack
  const large = by("ghast-mobs-large")[0], last = large.rows[large.ticks - 1][0];
  assert.deepEqual([3, 4, 6].map((i) => last[i][9]), [0, 0, 0]);
  // the snowball: 3 to the blaze, 0 to the zombie, the thrower becomes the blaze's target
  const snow = by("snowball-blaze")[0];
  assert.deepEqual(snow.rows[3][5], [[0, true, 17], [2, false, 20]]);
  assert.equal(snow.rows[3][0][0][9], 1);
});

test("the records need the shared insertion order: a balls-after-all-mobs walk diverges", () => {
  const real = EntityWorld.prototype.withBalls;
  EntityWorld.prototype.withBalls = function (order) { const b = this._fireballs?.list.filter((x) => !x.dead) ?? []; return b.length ? [...order, ...b] : order; };
  try {
    for (const r of by("order-small-0").concat(by("order-large-1"), by("kill-ball-first"), by("between"))) assert.notEqual(fireballDivergence(r, replayFireballs(r)), null, r.name);
    for (const r of by("kill-mob-first")) assert.equal(fireballDivergence(r, replayFireballs(r)), null, r.name);
  } finally { EntityWorld.prototype.withBalls = real; }
});

test("EntitySnowball.onImpact (zj.a): 3 damage to a blaze from a ball, none to others; a mob thrower is the source entity", () => {
  const mk = (type) => ({ type, health: 20, hurt: 0, x: 5, y: 10, z: 5, yaw: 0, vx: 0, vy: 0, vz: 0, age: 0 });
  const blaze = mk("blaze"), cow = mk("cow"), egg = mk("blaze"), golem = mk("snow_golem"), mobs = Object.assign(Object.create(EntityWorld.prototype), { entities: [blaze, cow, egg, golem], events: [], clientSounds: [], tickOrder: null });
  const calls = [];
  mobs.damage = (e, amount, x, z, player, attacker, extra) => { calls.push({ e, amount, player, shooter: extra?.shooter }); return true; };
  thrownHit(mobs, blaze, { x: 0, z: 0 }, { kind: "snowball" });
  thrownHit(mobs, cow, { x: 0, z: 0 }, { kind: "snowball" });
  thrownHit(mobs, egg, { x: 0, z: 0 }, { kind: "egg" });
  thrownHit(mobs, blaze, golem, { kind: "snowball", owner: golem });
  assert.deepEqual(calls.map((c) => [c.amount, c.player, c.shooter === golem]), [[3, true, false], [0, true, false], [0, true, false], [3, false, true]]);
});
