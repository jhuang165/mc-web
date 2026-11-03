import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JavaRandom } from './java-random.js';
import { miningState } from './mining.js';
import { ITEMS, MATERIALS, Survival } from './survival.js';
import { fromOriginal } from './block-registry.js';
import { itemFromOriginal } from './region-import.js';
import { harvestBlock, harvestRuleBlocks, playerMiningState } from './enchantment-effects.js';

const reference = JSON.parse(await readFile(new URL('../public/research/enchantment-effects-reference.json', import.meta.url)));
const f = Math.fround;

test('reference covers the unchanged-class records', () => {
  assert.equal(reference.dig.length, reference.counts.dig);
  assert.equal(reference.harvest.length, reference.counts.harvest);
  assert.equal(reference.attack.length, reference.counts.attack);
});

// env: 0 dry ground, 1 wet ground, 2 wet ground with Aqua Affinity, 3 dry airborne, 4 wet airborne with Aqua Affinity.
test('Efficiency, Aqua Affinity, underwater and airborne dig speed match the original for every mapped block and tool', () => {
  let checked = 0;
  for (const [block, tool, eff, env, speed] of reference.dig) {
    const b = fromOriginal(block, 0), t = tool ? itemFromOriginal(tool, 0) : null;
    if (!b || (tool && !t)) continue;
    const underwater = env === 1 || env === 2 || env === 4, aquaAffinity = env === 2 || env === 4, onGround = env < 3;
    const state = miningState(b.id, MATERIALS[b.id], t ? ITEMS[t.id] : null, { underwater, onGround, efficiency: eff, aquaAffinity });
    assert.equal(state.speed, f(speed), `block ${block} tool ${tool} eff ${eff} env ${env}`);
    checked++;
  }
  assert.ok(checked > 3000, `${checked} dig cases mapped`);
});

test('the live player mining state reads Efficiency from the held stack and Aqua Affinity from the helmet', () => {
  const stone = fromOriginal(1, 0).id;
  const pick = itemFromOriginal(257, 0).id;
  const plain = new Survival({ slots: [{ id: pick, count: 1 }] });
  const efficient = new Survival({ slots: [{ id: pick, count: 1, enchantments: [{ id: 32, lvl: 3 }] }] });
  assert.equal(playerMiningState(plain, stone, pick).speed, plain.mining(stone, pick).speed);
  assert.equal(playerMiningState(efficient, stone, pick).speed, f(plain.mining(stone, pick).speed + 10));
  const helmet = itemFromOriginal(306, 0).id;
  const diver = new Survival({ slots: [{ id: pick, count: 1 }], armor: [null, null, null, { id: helmet, count: 1, enchantments: [{ id: 6, lvl: 1 }] }] });
  assert.equal(playerMiningState(diver, stone, pick, true).speed, plain.mining(stone, pick).speed);
  assert.equal(plain.mining(stone, pick, true).speed, f(plain.mining(stone, pick).speed / 5));
  // The tool being dug with must be the held stack.
  assert.equal(playerMiningState(efficient, stone, 0).speed, efficient.mining(stone, 0).speed);
});

const SETS = [{}, { silk: true }, { fortune: 1 }, { fortune: 2 }, { fortune: 3 }, { silk: true, fortune: 3 }, { fortune: 4 }];
test('Silk Touch and Fortune drops, experience and World.rand draws match Block.harvestBlock', () => {
  let checked = 0;
  const skipped = new Set();
  for (const h of reference.harvest) {
    if (!harvestRuleBlocks.has(h.block) && !(h.set === 1 || h.set === 5)) { skipped.add(h.block); continue; }
    const rand = new JavaRandom(h.seed);
    const r = harvestBlock(h.block, h.meta, { ...SETS[h.set], rand });
    if (!r) { skipped.add(h.block); continue; }
    const where = `block ${h.block}:${h.meta} set ${h.set} seed ${h.seed}`;
    assert.deepEqual(r.drops.flatMap((d) => Array.from({ length: d.count }, () => [d.id, 1, d.damage])), h.drops, where);
    assert.equal(r.xp, h.xp.reduce((a, b) => a + b, 0), where);
    // BlockIce leaves water unless silk-harvested, over a blocking or liquid cell only.
    assert.equal(r.water && h.below !== 0, h.sets.length > 0, where);
    assert.equal(rand.nextInt(), h.next, where);
    checked++;
  }
  assert.ok(checked > 4000, `${checked} harvest cases replayed`);
});

// ---- attack and looting ---------------------------------------------------

const { EntityWorld, setEntityRandom, entityRandom, ENTITY_TYPES } = await import('./entities.js');
const { ATTACK_SLOWDOWN } = await import('./player-movement.js');
const flat = { numericSeed: 1, solid: (x, y) => y < 0, get: (x, y) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };

function replayAttack(r) {
  const w = new EntityWorld(flat, []);
  w.fx = { spawn() {} };
  w.worldRandom = new JavaRandom(r.seed + 900);
  const e = w.create(r.mob, 8.5, 0, -4.5);
  if (r.mob === 'sheep') e.color = r.seed % 16;
  e.knockbackResistance = 0;
  e.health = Math.min(f(r.health0), ENTITY_TYPES[r.mob].health); // setHealth clamps to the maximum
  w.entities.push(e);
  setEntityRandom(e, new JavaRandom(r.seed));
  if (r.burning) e.fire = 160;
  const weapon = r.weapon ? itemFromOriginal(r.weapon, 0) : null;
  const survival = new Survival({ slots: weapon ? [{ id: weapon.id, count: 1, damage: 0, enchantments: r.ench.map(([id, lvl]) => ({ id, lvl })) }] : [] });
  if (r.armorBane) survival.inventory.armor[1] = { id: itemFromOriginal(300, 0).id, count: 1, damage: 0, enchantments: [{ id: 18, lvl: r.armorBane }] };
  if (r.prehit) { w.hazard(e, 3, 'fall'); w.drain(); }
  Object.assign(e, { vx: 0, vy: 0, vz: 0 });
  const info = { playerRandom: new JavaRandom(r.seed * 7 + 3) };
  const player = { x: 10.5, z: -4.0, yaw: f(f(180 - r.yaw) * f(Math.PI)) / 180 };
  player.yaw = (180 - r.yaw) * Math.PI / 180;
  const pmotion = [0.3, 0, -0.2];
  const hit = w.attack(e, weapon?.id ?? 0, survival, player, r.sprint ? 1 : 0, r.crit, info);
  const slowed = info.knockback !== undefined ? info.knockback > 0 : r.sprint;
  if (hit && slowed) { pmotion[0] *= ATTACK_SLOWDOWN; pmotion[2] *= ATTACK_SLOWDOWN; }
  const drops = w.drain().filter((x) => x.drop).map((x) => [x.drop, x.count, x.damage || 0]);
  return { w, e, hit, info, survival, pmotion, drops, sprinting: r.sprint && !(hit && slowed), player: info.playerRandom };
}

test('Sharpness, Smite, Bane, Knockback, Fire Aspect and Looting attacks match EntityPlayer.attackTargetEntityWithCurrentItem', () => {
  const seen = { landed: 0, knockback: 0, fire: 0, magic: 0, slowness: 0, rejected: 0, drops: 0, killed: 0, looted: 0 };
  for (const r of reference.attack) {
    const at = `attack ${r.index} ${r.mob} weapon ${r.weapon} ench ${JSON.stringify(r.ench)} seed ${r.seed}`;
    const x = replayAttack(r);
    assert.equal(x.e.health, f(r.health), at);
    assert.equal(x.e.fire, r.fire, at);
    assert.deepEqual([x.e.vx, x.e.vy, x.e.vz], r.motion, at);
    assert.deepEqual(x.pmotion, r.pmotion, at);
    assert.equal(x.sprinting, r.sprinting, at);
    assert.equal(x.hit && r.crit, r.critFx, at);
    assert.equal(!!(x.hit && x.info.enchantCritical), r.magicFx, at);
    assert.equal(x.e.recentlyHit, r.recentlyHit, at);
    assert.equal(x.e.hurt > 0 ? x.e.hurt + 10 : 0, r.resist > 10 ? r.resist : 0, at);
    assert.equal(x.e.lastDamage, f(r.lastDamage), at);
    assert.equal(x.survival.held?.damage ?? 0, r.toolDamage, at);
    assert.equal(x.survival.held?.count ?? 0, r.toolCount, at);
    assert.deepEqual(x.info.slowness != null && x.hit ? [x.info.slowness, 3] : null, r.slowness, at);
    const expected = r.drops.map(([id, n, d]) => { const item = itemFromOriginal(id, d); return [item.id, n, item.damage || 0]; });
    assert.deepEqual(x.drops, expected, at);
    assert.equal(entityRandom(x.e).nextInt(), r.randNext, `${at} Entity.rand`);
    assert.equal(x.player.nextInt(), r.playerNext, `${at} player rand`);
    seen.landed += x.hit; seen.knockback += x.info.knockback > 0; seen.fire += r.fire > 0; seen.magic += r.magicFx; seen.slowness += !!r.slowness;
    seen.rejected += !x.hit; seen.drops += x.drops.length; seen.killed += r.health === 0; seen.looted += r.ench.some(([id]) => id === 21);
  }
  for (const [k, v] of Object.entries(seen)) assert.ok(v > 20, `${k} covered ${v}`);
});
