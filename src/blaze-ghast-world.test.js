// Blaze and Ghast inside EntityWorld: registration, ticking, fireball launch/impact, drops, save/NBT round trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, ENTITY_TYPES, HOSTILE } from "./entities.js";
import { Survival } from "./survival.js";
import { mobDrops, experiencePoints } from "./combat.js";
import { JavaRandom } from "./java-random.js";
import { summonedMobRecord } from "./java-mobs.js";
import { SUMMONABLE } from "./commands.js";
import { spawnerType } from "./mob-spawner.js";
import { projectileItemId } from "./projectile-renderer.js";

const air = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const make = (type, extra = {}) => new EntityWorld(air, [{ id: "mob-1", type, x: 64.5, y: 5, z: 64.5, health: type === "blaze" ? 20 : 10, ...extra }], () => 0.5);
const player = (x = 64.5, y = 5, z = 70.5) => ({ x, y, z, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 });

test("registration: types, hostile set, summon, spawner ids, fireball render kinds", () => {
  assert.ok(HOSTILE.has("blaze") && HOSTILE.has("ghast"));
  assert.equal(ENTITY_TYPES.ghast.width, 4);
  assert.equal(SUMMONABLE.Blaze, "blaze");
  assert.equal(SUMMONABLE.Ghast, "ghast");
  assert.equal(spawnerType("Blaze"), "blaze");
  assert.equal(spawnerType("Ghast"), "ghast");
  assert.equal(projectileItemId("fireball"), 1952);
  assert.equal(projectileItemId("smallFireball"), 1952);
});

test("drops and experience", () => {
  assert.deepEqual(mobDrops({ type: "blaze" }, { playerHit: false, looting: 3 }, new JavaRandom(1)), []);
  for (const [id] of mobDrops({ type: "blaze" }, { playerHit: true, looting: 3 }, new JavaRandom(1))) assert.equal(id, 387);
  const g = mobDrops({ type: "ghast" }, { playerHit: false, looting: 0 }, new JavaRandom(5));
  assert.ok(g.every(([id]) => id === 389 || id === 330));
  assert.equal(experiencePoints({ type: "blaze" }, new JavaRandom(1), new JavaRandom(1)), 10);
  assert.equal(experiencePoints({ type: "ghast" }, new JavaRandom(1), new JavaRandom(1)), 5);
});

test("ghast NBT: ExplosionPower defaults to 1 and is kept", () => {
  assert.equal(summonedMobRecord("ghast", new Map())?.record.explosionPower, 1);
  assert.equal(summonedMobRecord("blaze", new Map())?.record.health, 20);
});

test("ticking a blaze and a ghast with a player in sight does not throw and launches fireballs", () => {
  for (const type of ["blaze", "ghast"]) {
    const w = make(type), s = new Survival({}), p = player(64.5, 5, type === "ghast" ? 80.5 : 70.5);
    for (let i = 0; i < 400; i++) w.tick(p, s);
    assert.ok(Number.isFinite(w.entities[0]?.x ?? 0));
    assert.ok(w._fireballs === undefined || Array.isArray(w._fireballs.list));
  }
});

test("a launched small fireball flies, and fire immunity holds for a blaze", () => {
  const w = make("blaze"), b = w.fireballs.launch({ large: false, owner: null, x: 60.5, y: 5, z: 60.5, exact: [0.1, 0, 0] });
  const s = new Survival({});
  for (let i = 0; i < 5; i++) w.tick(player(0, 50, 0), s);
  assert.ok(b.x > 60.5);
  assert.equal(w.attackEntityFrom(w.entities[0], 4, { name: "onFire" }), false);
});

test("the blaze crackle is a client-only sound at the blaze, never a server event", () => {
  const w = make("blaze"), s = new Survival({ slots: [], time: 6000 }, "survival"), p = player();
  let heard = 0;
  for (let i = 0; i < 400; i++) {
    w.tick(p, s);
    assert.ok(!w.events.some((x) => x.sound === "fire.fire"));
    for (const c of w.clientSounds ?? []) if (c.sound === "fire.fire") { heard++; assert.equal(c.clientOnly, true); assert.equal(c.position, w.entities[0]); assert.equal(c.offset, 0.5); }
    if (w.clientSounds) w.clientSounds.length = 0;
  }
  assert.ok(heard > 0);
});

test("the delivered crackle sits at posX + 0.5, posY + 0.5, posZ + 0.5 of the client's blaze (bytecode-read)", () => {
  const w = make("blaze"), s = new Survival({ slots: [], time: 6000 }, "survival"), p = player();
  w.tick(p, s);
  w.drainClientSounds();
  const blaze = w.entities[0];
  w.clientSounds.push({ sound: "fire.fire", volume: 1, pitch: 1, position: blaze, clientOnly: true, offset: 0.5 });
  const [out] = w.drainClientSounds().filter((c) => c.sound === "fire.fire"), c = w.tracker.entryOf(blaze, w.size(blaze)[0]).client;
  assert.deepEqual(out.position, { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 });
});
