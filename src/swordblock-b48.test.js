// Batch 48: sword blocking (EntityPlayer.isBlocking). Bytecode-read: yz.bC (isBlocking), yz.d(ro, float) (damageEntity), ro.<clinit> (setDamageBypassesArmor = isUnblockable),
// blk.e (EntityPlayerSP.onLivingUpdate: `isUsingItem && !isRiding` scales the input by 0.2 and zeroes sprintToggleTimer). Nothing here is an executed record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Survival } from './survival.js';
import { makeStack } from './inventory.js';
import { blockedDamage, isUnblockable } from './armor-enchantments.js';
import { movePlayer } from './player-physics.js';
import { playerFixture } from './player-physics-fixture.js';
import { moveInput } from './player-movement.js';
import { tickPlayerItemUse } from './player-item-use.js';
import { readFileSync } from 'node:fs';
import { VOID } from './survival.js';
const f = Math.fround;
const IRON_SWORD = 114; // this build's id of the Iron Sword (the executed record below uses the original id 267)
const survivor = (blocking) => { const p = new Survival({}, 'survival'); p.protection = 0; p.health = 20; p.blocking = blocking; return p; };

test('blockedDamage is (1 + amount) * 0.5 for blockable sources only', () => {
  assert.equal(blockedDamage(7, 'mob', true), 4);
  assert.equal(blockedDamage(3, 'arrow', true), 2);
  assert.equal(blockedDamage(7, 'mob', false), 7);
  assert.equal(blockedDamage(0, 'mob', true), 0);
  for (const key of ['onFire', 'inWall', 'drown', 'starve', 'fall', 'outOfWorld', 'generic', 'magic', 'wither', 'indirectMagic']) {
    assert.equal(isUnblockable(key), true, key);
    assert.equal(blockedDamage(6, key, true), 6, key);
  }
  for (const key of ['inFire', 'lava', 'cactus', 'anvil', 'fallingBlock', 'explosion', 'arrow', 'thrown', 'thorns', 'mob', 'player', 'fireball']) assert.equal(isUnblockable(key), false, key);
});

test('a blocking player takes the halved amount before armour; unblockable sources are untouched', () => {
  const a = survivor(true), b = survivor(false);
  a.damage(7, 'a zombie', true); b.damage(7, 'a zombie', true);
  assert.equal(a.health, 16);
  assert.equal(b.health, 13);
  const c = survivor(true);
  c.damage(6, 'a fall'); assert.equal(c.health, 14);
  const d = survivor(true);
  d.damage(5, 'starvation'); assert.equal(d.health, 15);
  const e = survivor(true);
  e.damage(4, VOID); assert.equal(e.health, 16);
  const g = survivor(true);
  g.damage(4, 'burning', true); assert.equal(g.health, 16); // DamageSource.onFire is unblockable
  const h = survivor(true);
  h.damage(4, 'fire', true); assert.equal(h.health, 17.5); // DamageSource.inFire is blockable
});

test('the halving runs before armour and on the top-up difference inside the hurt window', () => {
  const p = survivor(true);
  for (let i = 0; i < 4; i++) p.inventory.setStack(36 + i, makeStack(408 + i, 1, 0)); // iron: 15 points
  assert.equal(p.armorValue, 15);
  p.damage(7, 'a zombie', true);
  assert.equal(p.health, f(20 - f(f(4 * 10) / 25)), 'iron armour reduces the halved 4');
  const healthAfter = p.health;
  p.damage(9, 'a zombie', true); // inside the window: amount - lastDamage = 2, then halved to 1.5
  const topUp = f(f(f(1 + 2) * 0.5) * 10 / 25);
  assert.equal(p.health, f(healthAfter - topUp));
  assert.equal(p.hurtAmount, 9, 'the stored last damage is the raw hit');
});

test('blocking slows movement to 0.2 and no sprint starts or continues', () => {
  const run = (eating) => {
    const state = playerFixture('land');
    for (const key of ['position', 'previous', 'velocity']) { const { x, y, z } = state[key]; state[key] = { x, y, z }; }
    state.eating = eating;
    let moved = 0, sprinted = false;
    for (let i = 0; i < 12; i++) {
      movePlayer(state, { forward: 1, strafe: 0, sneak: false, sprint: true, jump: false });
      sprinted ||= state.motion.sprinting;
      moved += Math.hypot(state.position.x - state.previous.x, state.position.z - state.previous.z);
    }
    return { speed: moved, sprinted };
  };
  const free = run(null), blocking = run({ id: IRON_SWORD, ticks: 72000, block: true });
  assert.equal(free.sprinted, true);
  assert.equal(blocking.sprinted, false);
  assert.ok(blocking.speed > 0 && blocking.speed < free.speed * 0.35, `${blocking.speed} vs ${free.speed}`);
  assert.equal(moveInput({ forward: 1, usingItem: true }).forward, f(0.2));
});

test('the block use state never completes and survives while the sword stays held', () => {
  const p = new Survival({ slots: [makeStack(IRON_SWORD)] }, 'survival');
  let use = { id: IRON_SWORD, ticks: 72000, block: true };
  for (let i = 0; i < 100; i++) use = tickPlayerItemUse(use, IRON_SWORD, p).use;
  assert.deepEqual(use, { id: IRON_SWORD, ticks: 72000, block: true });
  assert.equal(tickPlayerItemUse(use, 1, p).use, null, 'switching the held item ends it');
});

// Executed record: sword-block-reference.json (tools/verify-sword-block.mjs, BlockingProbe.java): the unchanged EntityPlayerMP.attackEntityFrom with itemInUse set.
const reference = JSON.parse(readFileSync(new URL('../public/research/sword-block-reference.json', import.meta.url)));
const SOURCES = { mob: ['a zombie', true], inFire: ['fire', true], lava: ['lava', true], cactus: ['a cactus', true], onFire: ['burning', false], inWall: ['suffocation', false],
  drown: ['drowning', false], starve: ['starvation', false], fall: ['a fall', false], outOfWorld: [VOID, false], generic: ['an accident', false] };
const SWORDS = new Set([267, 268, 272, 276, 283]);
test('the executed 1.7.10 record: damage lost while blocking, per source, amount, armour and hurt window', () => {
  assert.equal(reference.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  let checked = 0, blocked = 0;
  for (const r of reference.records) {
    const p = survivor(false);
    if (r.armor) for (let i = 0; i < 4; i++) p.inventory.setStack(36 + i, makeStack(408 + i, 1, 0));
    p.blocking = SWORDS.has(r.item);
    assert.equal(p.blocking, r.blocking, r.name + ' ' + r.item); // yz.bC: only EnumAction.block
    let tick = 0;
    for (const h of r.hits) {
      for (; tick < h.tick; tick++) if (p.hurtTicks > 0) p.hurtTicks--;
      const before = p.health, [reason, blockable] = SOURCES[h.source];
      const accepted = h.source === 'mob' ? p.scaledDamage(f(h.amount), reason) : p.damage(f(h.amount), reason, blockable);
      const at = `${r.name} item ${r.item} armor ${r.armor} ${h.source} ${h.amount} @${h.tick}`;
      assert.equal(accepted, h.accepted, at);
      assert.equal(f(before - p.health), f(h.lost), at);
      assert.equal(p.health, f(h.health), at);
      if (accepted) assert.equal(p.hurtAmount, f(h.last), at);
      checked++; if (r.blocking && h.lost < h.amount) blocked++;
    }
  }
  assert.ok(checked >= 119 && blocked >= 25, `${checked} hits, ${blocked} reduced`);
});
