// Batch 84 mobs84: live zombie conversion runs the rest of its update, the enderman's hurt has no health test, the wither's head particles draw on Entity.rand, the live squid pushes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Survival } from "./survival.js";
import { EntityWorld, entityRandom, setEntityRandom } from "./entities.js";
import { JavaRandom } from "./java-random.js";

const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const one = (type, extra = {}) => { const w = new EntityWorld(grass, [{ id: "mob-1", type, x: 64, y: 0, z: 66, health: 8, ...extra }], () => 0.5); Object.assign(w.ai.player, { x: 64, y: 0, z: 64 }); return w; };
const player = { x: 64, y: 0, z: 64, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };

test("live zombie conversion: the rest of the update runs in that tick (age, draws, the push) and the removal marker is put back after it", () => {
  const w = one("zombie", { villager: true, health: 20 }), e = w.entities[0];
  e.conversionTime = 1; e.recentlyHit = 7;
  let pushed = 0; const push = w.push.bind(w); w.push = (...a) => { pushed++; return push(...a); };
  const age = e.age || 0;
  w.tick(player, new Survival({}));
  assert.equal(w.entities.filter((m) => m.type === "villager").length, 1);
  assert.equal(e.age, age + 1, "yq.h's tail ran: ticksExisted counted and the AI, push and steps followed");
  assert.ok(pushed >= 1, "collideWithNearbyEntities ran");
  assert.equal(w.entities.includes(e), false, "removed at the end of the tick");
  assert.equal(e.health, 0);
  assert.equal(e.removedHealth, 20);
  assert.equal(e.death, 20);
  assert.equal(e.recentlyHit, 0);
});

test("enderman attackEntityFrom (ya.a) has no health test: a hit on a corpse still runs the enderman rules", () => {
  const src = readFileSync(new URL("./entities.js", import.meta.url), "utf8");
  assert.ok(/e\.type === "enderman" && !endermanHurt\(/.test(src));
  assert.ok(!/e\.type === "enderman" && e\.health > 0/.test(src));
  const w = one("enderman"), e = w.entities[0];
  e.health = 0; e.death = 0;
  let called = 0;
  const orig = entityRandom(e), nf = orig.nextDouble.bind(orig); orig.nextDouble = () => { called++; return nf(); };
  w.attackEntityFrom(e, 3, { name: "arrow", projectile: true });
  assert.ok(called > 0, "the teleport roll drew on the corpse's Entity.rand");
});

test("wither head particles draw on the server entity's Entity.rand and the world's rand, with or without a particle sink", () => {
  const run = (fx) => {
    const w = one("wither", { health: 150 }), e = w.entities[0];
    e.invul = 0; if (fx) w.fx = { spawn() {} };
    setEntityRandom(e, new JavaRandom(5)); w.worldRandom = new JavaRandom(9);
    w.tick(player, new Survival({}));
    return [entityRandom(e).nextInt(1 << 30), w.worldRandom.nextInt(1 << 30)];
  };
  assert.deepEqual(run(true), run(false), "the draws do not depend on the fx sink");
  const ref = new JavaRandom(5); void ref;
  assert.equal(readFileSync(new URL("./wither-boss-mobs.js", import.meta.url), "utf8").includes("visual.get"), false);
});

test("live squid pushes (sv.bo) after its move", () => {
  const w = one("squid", { health: 10 }), e = w.entities[0];
  e.inWater = true;
  let pushed = 0; const push = w.push.bind(w); w.push = (...a) => { pushed++; return push(...a); };
  w.tick(player, new Survival({}));
  assert.ok(pushed >= 1);
});
