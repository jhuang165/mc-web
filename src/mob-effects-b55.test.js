// Batch 55 (effects3): replays of the b55 records of tools/probes/MobEffects2Probe.java, the unchanged 1.7.10 classes (public/research/mob-effects-reference.json):
// b55attr (getCreatureAttribute, isEntityUndead, isPotionApplicable per kind), b55comb (PotionEffect.combine through addPotionEffect, ambient flag included),
// b55inst (Potion.affectEntity, the splash potion's instant branch).
import test from 'node:test';
import assert from 'node:assert/strict';
import reference from '../public/research/mob-effects-reference.json' with { type: 'json' };
import { addMobEffect, tickMobEffects, isUndeadMob, isPotionApplicable, effectsInMapOrder } from './mob-effects.js';
import { creatureAttribute } from './enchantment-effects.js';
import { splashImpact } from './witch.js';
import { witherIsUndead } from './wither-boss-mobs.js';
import { ENTITY_TYPES } from './entities.js';
import { Effects } from './status-effects.js';
import { JavaRandom } from './java-random.js';

const TYPE = { Creeper: 'creeper', Skeleton: 'skeleton', Spider: 'spider', Giant: 'giant', Zombie: 'zombie', Slime: 'slime', Ghast: 'ghast', PigZombie: 'pigman', Enderman: 'enderman',
  CaveSpider: 'cave_spider', Silverfish: 'silverfish', Blaze: 'blaze', LavaSlime: 'magma_cube', EnderDragon: 'ender_dragon', WitherBoss: 'wither', Bat: 'bat', Witch: 'witch', Pig: 'pig',
  Sheep: 'sheep', Cow: 'cow', Chicken: 'chicken', Squid: 'squid', Wolf: 'wolf', MushroomCow: 'mooshroom', SnowMan: 'snow_golem', Ozelot: 'ocelot', VillagerGolem: 'iron_golem', Villager: 'villager' };
const mob = (kind) => { const m = /^Horse(\d)$/.exec(kind); return m ? { type: 'horse', horse: { type: Number(m[1]) }, effects: [], health: 10 } : { type: TYPE[kind], effects: [], health: 10 }; };
const row = (x) => [x.id, x.amplifier, x.duration, x.ambient ? 1 : 0];
const size = { width: 0.6, height: 1.8 };

test('creature attribute, undead and isPotionApplicable match the executed classes for every kind (the undead horses are not undead in 1.7.10)', () => {
  assert.equal(reference.attr55.length, 33);
  for (const r of reference.attr55) {
    assert.equal(r.error, undefined, r.kind);
    const e = mob(r.kind);
    assert.equal(isUndeadMob(e), r.undead, r.kind);
    assert.equal(witherIsUndead(e), r.undead, r.kind);
    if (e.type !== 'horse') assert.equal(creatureAttribute(e.type), r.attribute, r.kind); else assert.equal(r.attribute, 'UNDEFINED');
    for (let id = 1; id <= 23; id++) assert.equal(isPotionApplicable(e, id), r.applicable[id] === 1, `${r.kind} ${id}`);
  }
});

test('addPotionEffect on a mob replays PotionEffect.combine (ambient flag included) and refuses what isPotionApplicable refuses', () => {
  assert.equal(reference.combine55.length, 72);
  let ambientCleared = 0, refused = 0;
  for (const r of reference.combine55) {
    assert.equal(r.error, null, r.kind);
    const e = mob(r.kind);
    for (const op of r.ops) {
      if (op.add) {
        const [id, amp, dur, amb] = op.add;
        if (!isPotionApplicable(e, id) || e.type === 'wither') refused++;
        const before = (e.effects.find((x) => x.id === id) ?? {}).ambient;
        addMobEffect(e, id, dur, amp, amb === 1);
        if (before && !(e.effects.find((x) => x.id === id) ?? {}).ambient) ambientCleared++;
      } else tickMobEffects(e, size, 10, new JavaRandom(7), undefined, undefined);
      assert.deepEqual(effectsInMapOrder(e).map(row), op.effects, `${r.kind} seed ${r.seed}`);
    }
  }
  assert.ok(ambientCleared >= 10 && refused >= 20, `${ambientCleared} ${refused}`);
});

test('the player takes the same combine rule, with the ambient flag (a beacon effect) and the absorption refill of an unchanged re-add', () => {
  const effects = new Effects();
  effects.player = { absorption: 0 };
  effects.add({ id: 1, duration: 100, amplifier: 1, ambient: true });
  effects.add({ id: 1, duration: 500, amplifier: 0 }); // weaker: nothing but the ambient flag goes
  assert.deepEqual(effects.get(1), { id: 1, duration: 100, amplifier: 1 });
  effects.add({ id: 3, duration: 100, amplifier: 0, ambient: true });
  effects.add({ id: 3, duration: 200, amplifier: 0 }); // equal amplifier, longer: duration only, the ambient flag stays
  assert.deepEqual(effects.get(3), { id: 3, duration: 200, amplifier: 0, ambient: true });
  effects.add({ id: 3, duration: 50, amplifier: 2 }); // stronger: replaces amplifier and duration, the old ambient flag stays
  assert.deepEqual(effects.get(3), { id: 3, duration: 50, amplifier: 2, ambient: true });
  effects.add({ id: 3, duration: 50, amplifier: 2 }); // equal and not longer: the non-ambient effect clears the flag
  assert.deepEqual(effects.get(3), { id: 3, duration: 50, amplifier: 2 });
  effects.add({ id: 22, duration: 100, amplifier: 1 });
  assert.equal(effects.player.absorption, 8);
  effects.player.absorption = 3;
  effects.add({ id: 22, duration: 60, amplifier: 1 }); // onChangedPotionEffect: the amount comes off (floored at 0) and goes on again, a full 8
  assert.equal(effects.player.absorption, 8);
  assert.deepEqual(new Effects(effects.serialize()).get(1), { id: 1, duration: 100, amplifier: 1 });
});

test('splash instant health and harm follow Potion.affectEntity and the executed undead set', () => {
  assert.equal(reference.instant55.length, 396);
  // the witch module's splash table holds instant damage I (32732) only; the other cases (instant health, amplifier 1 and 2) use the same formulas directly
  const meta = { '7:0': 32732 };
  let n = 0, viaSplash = 0;
  for (const r of reference.instant55) {
    assert.equal(r.error, null, r.kind);
    if (r.kind === 'WitherBoss') continue; // the boss has its own invulnerability and armour rules
    const e = mob(r.kind), max = r.kind.startsWith('Horse') ? 53 : ENTITY_TYPES[e.type].health;
    const hurt = Math.trunc(r.factor * (6 << r.amp) + 0.5), heal = Math.trunc(r.factor * (4 << r.amp) + 0.5);
    const harms = (r.id === 7) !== isUndeadMob(e);
    if (meta[`${r.id}:${r.amp}`]) {
      const [res] = splashImpact(meta[`${r.id}:${r.amp}`], { x: 0, y: 0, z: 0 }, [{ x: 4 * (1 - r.factor), y: 0, z: 0, width: 0.6, height: 1.8, undead: isUndeadMob(e), ref: e, direct: false }]);
      assert.equal(res.hurt, harms ? hurt : 0, `${r.kind} ${r.id}`);
      assert.equal(res.heal, harms ? 0 : heal, `${r.kind} ${r.id}`);
      viaSplash++;
    }
    const start = Math.min(r.health0, max);
    const health = harms ? Math.max(0, start - hurt) : Math.min(max, start + heal);
    assert.equal(health, r.health, `${r.kind} ${r.id} amp ${r.amp} factor ${r.factor} from ${r.health0}`);
    n++;
  }
  assert.ok(n > 300 && viaSplash > 30, `${n} ${viaSplash}`);
});
