// Batch 65 (mpstats3): the use stat of fire charges, bone meal and eyes of ender on the server, the CombatTracker kill credit (executed records), and the two fishing findings
// (a hook never hooks a player; hooks are not saved).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DYE, SAPLING } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { useOnBlock } from './multiplayer/server-use.js';
import { KillCredit } from './multiplayer/server-combat-tracker.js';
import { makeStack } from './inventory.js';
import { STAT } from './stats.js';
import { FISHING_ROD } from './fishing-content.js';
import { ITEM_FIRE_CHARGE } from './spawn-eggs.js';
import { ITEM_EYE_OF_ENDER, END_PORTAL_FRAME } from './eye-of-ender.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = (extra = {}) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null), ...extra });
function fixture(gameMode = 'survival', mobs = false) {
  const world = new World('mp-stats3-b65');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode, mobs });
  if (mobs) { s.mobs.spawning = false; s.mobs.mobs.entities.length = 0; }
  return s;
}
const join = (s, id = 'a', n = 1) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input(id, input()); return p; };
const hold = (p, stack) => { p.survival.inventory.main[0] = stack; p.survival.inventory.current = 0; };
const use = (p, id) => p.stats.get(`stat.useItem.${id}`);
const tgt = (x, y, z, adjacent) => ({ block: [x, y, z], adjacent });

test('a fire charge counts the use stat whatever the clicked face held, is spent outside Creative, and is refused in Adventure (ItemFireball.onItemUse, bytecode-read)', () => {
  const s = fixture(), p = join(s);
  hold(p, makeStack(ITEM_FIRE_CHARGE, 5));
  assert.equal(useOnBlock(s, p, tgt(64, 9, 64, [64, 10, 64]), ITEM_FIRE_CHARGE), true);
  assert.equal(s.world.get(64, 10, 64) !== 0, true, 'fire on the air cell');
  assert.equal(p.survival.held.count, 4);
  assert.equal(use(p, 385), 1);
  s.world.put(64, 10, 66, 1, 0, false); // a solid cell on the face: no fire, but the charge is spent and the click counts
  assert.equal(useOnBlock(s, p, tgt(64, 9, 66, [64, 10, 66]), ITEM_FIRE_CHARGE), true);
  assert.equal(s.world.get(64, 10, 66), 1);
  assert.equal(p.survival.held.count, 3);
  assert.equal(use(p, 385), 2);
  p.survival.mode = 'adventure';
  assert.equal(useOnBlock(s, p, tgt(64, 9, 64, [64, 10, 65]), ITEM_FIRE_CHARGE), false);
  assert.equal(use(p, 385), 2);
  p.survival.mode = 'creative';
  assert.equal(useOnBlock(s, p, tgt(64, 9, 68, [64, 10, 68]), ITEM_FIRE_CHARGE), true);
  assert.equal(p.survival.held.count, 3, 'Creative keeps the stack');
  assert.equal(use(p, 385), 3);
});

test('bone meal counts the use stat on a sapling, grass or an unfinished crop (spent even when the roll fails) and nothing on a full crop or bare ground', () => {
  const s = fixture(), p = join(s);
  hold(p, makeStack(DYE, 6, 15));
  s.world.put(64, 10, 64, SAPLING, 0, false);
  assert.equal(useOnBlock(s, p, tgt(64, 10, 64, [64, 11, 64]), DYE), true);
  assert.equal(p.survival.held.count, 5);
  assert.equal(use(p, DYE), 1);
  assert.equal(useOnBlock(s, p, tgt(70, 9, 70, [70, 10, 70]), DYE), true, 'a grass block always can be fertilised');
  assert.equal(use(p, DYE), 2);
  s.world.put(66, 10, 64, 31, 0, false); // a young crop
  assert.equal(useOnBlock(s, p, tgt(66, 10, 64, [66, 11, 64]), DYE), true);
  assert.equal(use(p, DYE), 3);
  s.world.put(67, 10, 64, 38, 0, false); // a full-grown crop: canFertilize false, the stack stays
  const left = p.survival.held.count;
  assert.equal(useOnBlock(s, p, tgt(67, 10, 64, [67, 11, 64]), DYE), false);
  assert.equal(p.survival.held.count, left);
  assert.equal(use(p, DYE), 3);
  s.world.put(68, 9, 64, 3, 0, false); // dirt
  assert.equal(useOnBlock(s, p, tgt(68, 9, 64, [68, 10, 64]), DYE), false);
  hold(p, makeStack(DYE, 2, 1)); // red dye is not bone meal
  assert.equal(useOnBlock(s, p, tgt(70, 9, 70, [70, 10, 70]), DYE), false);
  assert.equal(use(p, DYE), 3);
});

test('an eye of ender set in a portal frame counts the use stat; throwing one counts nothing (ItemEnderEye.onItemRightClick has no addStat)', () => {
  const s = fixture(), p = join(s);
  hold(p, makeStack(ITEM_EYE_OF_ENDER, 4));
  s.world.put(64, 10, 64, END_PORTAL_FRAME, 0, false);
  assert.equal(s.dimensions.useItem(p, tgt(64, 10, 64, [64, 11, 64]), ITEM_EYE_OF_ENDER), true);
  assert.equal(p.survival.held.count, 3);
  assert.equal(use(p, 381), 1);
  assert.equal(s.dimensions.useItem(p, tgt(64, 10, 64, [64, 11, 64]), ITEM_EYE_OF_ENDER), true, 'the frame already holds an eye: no second count');
  assert.equal(use(p, 381), 1);
  s.dispense.eyeSystem.use(p); // the throw
  assert.equal(use(p, 381), 1);
});

// ---- the CombatTracker kill credit against the executed records ----
const reference = JSON.parse(readFileSync(new URL('../public/research/combat-best-reference.json', import.meta.url), 'utf8'));
const entryOf = spec => {
  if (!spec.includes(':')) return null;
  const [kind, who] = spec.split(':'), isPlayer = who.startsWith('alex') && kind !== 'mob' ? true : who.startsWith('alex');
  return { id: who, isPlayer, living: true, p: isPlayer ? who : null };
};

test('KillCredit reproduces sv.aX (CombatTracker.func_94550_c with attackingPlayer and revenge fallbacks) on every executed scenario', () => {
  assert.ok(reference.records.length >= 20);
  for (const rec of reference.records) {
    const credit = new KillCredit(); let lastPlayerHit = -1000;
    for (const h of rec.hits) {
      const [, , spec, amount] = h.op.split(' ');
      if (h.accepted) {
        const by = entryOf(spec);
        credit.hit(by, Math.fround(Number(amount)), h.tick, h.health > 0);
        if (by?.isPlayer) lastPlayerHit = h.tick;
      }
      const got = credit.killer(h.tick, 100 - (h.tick - lastPlayerHit), h.health > 0);
      assert.equal(got ? got.id : null, h.best, `${rec.name} ${h.op}`);
      assert.equal(h.accepted, !(spec.startsWith('thrown') && Number(amount) === 0), `${rec.name} accepted`);
    }
  }
});

test('the rule is per single hit, with the one-third rule, first of equals and a window that grows to 300 ticks after a living attacker', () => {
  const by = (id, isPlayer) => ({ id, isPlayer, living: true, p: isPlayer ? id : null });
  const c = new KillCredit();
  c.hit(by('alex', true), 2, 0, true); c.hit(by('alex', true), 2, 20, true); c.hit(by('zombie', false), 3.9, 40, true);
  assert.equal(c.killer(41, 100, true).id, 'alex', 'a player hit of 2 is above 3.9 / 3; totals (4 against 3.9) play no part');
  const d = new KillCredit();
  d.hit(by('zombie', false), 9, 0, true); d.hit(by('alex', true), 2.9, 20, true);
  assert.equal(d.killer(21, 100, true).id, 'zombie');
});

test('server mobs: only the last hit dies with its tracker, so a fire death credits attackingPlayer; a mob killing blow credits no player; the kill-by-type stat needs a source entity', () => {
  const s = fixture('survival', true), p = join(s);
  const mk = x => { const z = s.mobs.mobs.create('cow', x, 10, 64.5); s.mobs.mobs.entities.push(z); return z; };
  const a = mk(65.5), b = mk(66.5), c = mk(67.5); s.tick();
  const hit = (e, amount, source) => { s.dispense.credit(p, () => { s.mobs.mobs.attackEntityFrom(e, amount, source); }); };
  hit(a, 1, { name: 'player', player: true, from: { x: p.position.x, z: p.position.z } });
  s.mobs.mobs.attackEntityFrom(a, 40, { name: 'onFire' }); // dies of fire: tracker emptied by the lethal entry, attackingPlayer remains
  assert.equal(p.stats.get(STAT.mobKills), 1);
  assert.equal(p.stats.get('stat.killEntity.Cow') ?? 0, 0);
  hit(b, 1, { name: 'player', player: true, from: { x: p.position.x, z: p.position.z } });
  const z = s.mobs.mobs.create('zombie', 66.5, 10, 66.5); s.mobs.mobs.entities.push(z);
  b.hurt = 0; s.mobs.mobs.attackEntityFrom(b, 40, { name: 'mob', attacker: z }); // a zombie lands the killing blow: aX() is the zombie
  assert.equal(p.stats.get(STAT.mobKills), 1);
  hit(c, 40, { name: 'player', player: true, from: { x: p.position.x, z: p.position.z } }); // the player's own killing blow: both stats
  assert.equal(p.stats.get(STAT.mobKills), 2);
  assert.equal(p.stats.get('stat.killEntity.Cow'), 1);
});

// ---- fishing ----
test('a fishing hook never hooks a player and a hook is not saved (executed hook-zero record; EntityList has no entry for EntityFishHook)', () => {
  const rec = reference.records.find(r => r.name === 'hook-zero');
  assert.equal(rec.hits[0].accepted, false);
  assert.equal(rec.hits[0].entries, 0);
  assert.equal(rec.hits[0].best, null);
  const s = fixture(), p = join(s); const q = join(s, 'b', 2);
  hold(p, makeStack(FISHING_ROD, 1)); p.pitch = 0.3;
  assert.equal(s.fishing.use(p), true);
  assert.ok(s.fishing.hookOf(p));
  const saved = JSON.stringify([s.save(), s.savePlayer(p), s.savePlayer(q)]).toLowerCase();
  assert.ok(!saved.includes('fishhook') && !saved.includes('"fish'), 'no hook in the world or player records');
  assert.equal(s.fishing.host(p).targets().some(t => t === q || t.id === q.id), false, 'players are not hook targets');
});
