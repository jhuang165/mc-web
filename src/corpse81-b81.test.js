// Batch 81 corpse81: the dying horse's AI, a converting zombie's second apple and its corpse conversion, the inventory key while riding, and a player's hit on a dragon part.
// Bytecode-read (javap -c -p, 1.7.10 jar): wi.bh (EntityHorse.isMovementBlocked) is `l != null && cu() || cm() || cn()` with no health test, so sv.e runs the AI (sw.bn) of a dying
// horse; yq.a(yz) has no isConverting test and yq.h counts the timer down with no health test; bao.p's inventory key asks bje.j (riding an EntityHorse) and sends C0B 7 (bjk.j),
// nh.a(jj) calls wi.g(player), which opens only for a tame horse; yz.r(sa) reads the enchantment damage, Knockback level, critical and Fire Aspect only for an sv target, and the
// part (wy) extends sa.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";
import { EntityWorld } from "./entities.js";
import { canCure } from "./zombie-villager.js";
import { riddenHorse, ridingHorse } from "./horse-gear-live.js";
import { spawnDragonIfAbsent, setDragonRandom } from "./dragon-mobs.js";
import { JavaRandom } from "./lighting.js";

const GOLDEN_APPLE = 372, WEAKNESS = 18, DIAMOND_SWORD = 115, SHARPNESS = 16, KNOCKBACK = 19, FIRE_ASPECT = 20;
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const one = (type, extra = {}) => { const w = new EntityWorld(grass, [{ id: "mob-1", type, x: 64, y: 0, z: 66, health: 8, ...extra }], () => 0.5); Object.assign(w.ai.player, { x: 64, y: 0, z: 64 }); return w; };
const player = { x: 64, y: 0, z: 64, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
const thinks = (w) => { const seen = []; const think = w.ai.think.bind(w.ai); w.ai.think = (e) => { seen.push(e); think(e); }; return seen; };

test("dying horse: not saddled-ridden, eating or rearing, it runs its AI (wi.bh has no health test) and its own update; other corpses and an eating horse do not", () => {
  const w = one("horse", { horse: { type: 0, tame: false, speed: 0.225, jump: 0.7, maxHealth: 20 } }), e = w.entities[0], seen = thinks(w);
  e.health = 0; e.death = 0; e.mouthTicks = 1;
  w.tick(player, new Survival({}));
  assert.deepEqual(seen, [e], "the corpse's AI tasks ran");
  assert.equal(e.mouthTicks, 2, "wi.h's mouth counter steps on a corpse");
  e.horse.eating = true;
  w.tick(player, new Survival({}));
  assert.equal(seen.length, 1, "an eating corpse is movement-blocked");
  const cow = one("cow"), c = cow.entities[0], cowSeen = thinks(cow);
  c.health = 0; c.death = 0;
  cow.tick(player, new Survival({}));
  assert.equal(cowSeen.length, 0, "sv.bh blocks every other corpse");
});

test("zombie villager: a converting zombie weakened again takes a second apple and restarts its timer (yq.a has no isConverting test)", () => {
  const z = { type: "zombie", villager: true, health: 20, conversionTime: 100, effects: [{ id: WEAKNESS, amplifier: 0, duration: 100 }] };
  assert.equal(canCure(z, GOLDEN_APPLE, 0), true);
  assert.equal(canCure({ ...z, effects: [] }, GOLDEN_APPLE, 0), false, "startConversion cleared the Weakness, so a plain second apple is still refused");
  const w = one("zombie", { villager: true }), e = w.entities[0];
  e.conversionTime = 5; e.effects = [{ id: WEAKNESS, amplifier: 0, duration: 100 }];
  const s = new Survival({ slots: [makeStack(GOLDEN_APPLE, 2)] }, "survival");
  assert.equal(w.cure(e, GOLDEN_APPLE, s, 0), true);
  assert.ok(e.conversionTime >= 3600, "the timer restarts at nextInt(2401) + 3600");
  assert.equal(s.held.count, 1);
});

test("zombie villager: a dying converting zombie still counts down and becomes the villager when the timer runs out (yq.h has no health test)", () => {
  const w = one("zombie", { villager: true }), e = w.entities[0];
  e.conversionTime = 2; e.health = 0; e.death = 0;
  w.tick(player, new Survival({}));
  assert.equal(e.conversionTime, 1);
  assert.ok(!w.entities.some((x) => x.type === "villager"));
  w.tick(player, new Survival({}));
  assert.ok(w.entities.some((x) => x.type === "villager"), "the villager spawned");
  assert.ok(!w.entities.includes(e), "the zombie corpse is gone");
});

test("inventory key while riding: any horse takes it (bje.j), the window is a tame one's (wi.g), with no saddle or health test", () => {
  const horse = (h, health = 20) => ({ vehicle: { horse: true, entity: { type: "horse", health, horse: h } } });
  assert.ok(ridingHorse(horse({ tame: false })), "riding an untamed horse still sends C0B 7");
  assert.equal(riddenHorse(horse({ tame: false })), null, "wi.g opens nothing for it");
  assert.ok(riddenHorse(horse({ tame: true, saddled: false })), "a tame unsaddled horse opens");
  assert.ok(riddenHorse(horse({ tame: true, saddled: true }, 0)), "a dying one opens (its window closes on the reach test)");
  assert.equal(ridingHorse({ vehicle: { horse: true, entity: { type: "pig", health: 10 } } }), null);
});

function dragonWorld() {
  const cells = new Map();
  const world = { numericSeed: 1, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 64, z: 0 }), get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0,
    set(x, y, z, id) { cells.set(`${x},${y},${z}`, id); return true; }, inside: () => true, streaming: true, isTicking: () => true, height: 256 };
  const w = new EntityWorld(world, [], () => 0.5), d = spawnDragonIfAbsent(world, w), far = { x: 200, y: 70, z: 200, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
  setDragonRandom(d, new JavaRandom(7));
  w.tick(far, new Survival({}));
  return { w, d };
}
const sword = (enchantments) => new Survival({ slots: [{ id: DIAMOND_SWORD, count: 1, damage: 0, enchantments }] });

test("live dragon: the part takes no Sharpness, Knockback level, critical or Fire Aspect; the sprint knock goes to the part, the sword wears and the stat is none", () => {
  const plain = dragonWorld(), ench = dragonWorld();
  const at = { x: plain.d.x + 3, z: plain.d.z, yaw: 0 };
  assert.equal(plain.w.attack(plain.d, DIAMOND_SWORD, sword([]), at, 0, false), true);
  const s = sword([{ id: SHARPNESS, lvl: 5 }, { id: KNOCKBACK, lvl: 2 }, { id: FIRE_ASPECT, lvl: 2 }]), info = {};
  const v = [ench.d.vx, ench.d.vy, ench.d.vz];
  assert.equal(ench.w.attack(ench.d, DIAMOND_SWORD, s, at, 1, true, info), true);
  assert.equal(ench.d.health, plain.d.health, "the same damage as a plain, non-critical hit");
  assert.ok(ench.d.health < 200, "the hit landed");
  assert.equal(info.critical, false, "no critical on a part");
  assert.equal(info.enchantCritical, false);
  assert.equal(info.knockback, 1, "the sprint level still slows the player");
  assert.deepEqual([ench.d.vx, ench.d.vy, ench.d.vz], v, "the dragon is not pushed");
  assert.ok(!(ench.d.fire > 0), "Fire Aspect sets nothing alight");
  assert.equal(s.held.damage, 1, "the sword wears on the dragon");
  assert.equal(ench.w.lastAttackDamage, 0, "no damageDealt stat (yz.r adds it only for an sv)");
});
