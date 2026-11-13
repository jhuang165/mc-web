// Batch 63 mppvp: player-versus-player on the dedicated server. Replays public/research/pvp-reference.json (tools/probes/PvpAttackProbe.java run by tools/verify-pvp.mjs):
// the unchanged EntityPlayer.attackTargetEntityWithCurrentItem with a real EntityPlayerMP attacker and victim. The rest are tests of the server pieces (pvp property, reach, creative
// immunity, the death message and killer, arrows and potions under pvp=false, the wire message and the client aim).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.js';
import { makeStack } from './inventory.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { ServerPvp, pickPlayer } from './multiplayer/server-pvp.js';
import { drainKnockback } from './player-knockback.js';
import { enchantmentRandom } from './armor-enchantments.js';
import { CombatTracker } from './combat-tracker.js';
import { JavaRandom } from './java-random.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { STAT } from './stats.js';

const reference = JSON.parse(readFileSync(new URL('../public/research/pvp-reference.json', import.meta.url)));
const f = Math.fround, key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
// the probe's vanilla item ids -> this port's ids
const PORT = { 268: 112, 272: 113, 267: 114, 276: 115, 283: 119, 271: 104, 275: 105, 258: 106, 279: 107, 278: 103, 257: 102, 256: 110, 277: 111, 273: 109, 269: 108, 280: 300 };

function joined(options = {}) {
  const world = new World('mp-pvp-b63');
  for (let x = 20; x <= 110; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', ...options }), ps = [];
  for (let i = 0; i < 2; i++) {
    const p = s.addPlayer('p' + i, i ? 'Victim' : 'Attacker', key(i + 1));
    p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 });
    s.input('p' + i, input()); ps.push(p);
  }
  for (let i = 0; i < 3; i++) s.tick();
  for (const p of ps) p.survival.protection = 0;
  return { s, ps };
}
const stack = (spec) => spec[0] === 0 ? null : makeStack(PORT[spec[0]], 1, 0, undefined, spec.length > 1 ? { enchantments: spec.slice(1).reduce((a, v, i) => (i % 2 ? (a[a.length - 1].lvl = v, a) : [...a, { id: v }]), []) } : {});

test('the reference was recorded from the unchanged 1.7.10 client', () => {
  assert.equal(reference.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.equal(reference.tag, 'b63pvp');
  assert.ok(reference.records.length >= 60);
});

test('every executed attack (damage, Sharpness, crits, Knockback, sprint, Fire Aspect, armour, hurt window, wear, creative, death) matches', () => {
  const { s, ps: [a, v] } = joined();
  const pvp = s.pvpRules, failures = [];
  for (const r of reference.records) {
    const as = a.survival, vs = v.survival;
    as.mode = 'survival'; vs.mode = r.creative ? 'creative' : 'survival';
    for (const p of [a, v]) { p.dead = false; p.position.copy({ x: p === a ? 64.5 : 65.5, y: 10, z: 64.5 }); }
    Object.assign(vs, { health: r.startHealth, hurtTicks: 0, hurtAmount: 0, fire: 0, absorption: 0, protection: 0, combat: new CombatTracker(), knockQueue: [] });
    vs.inventory.armor.fill(null);
    if (r.material >= 0) for (let i = 0; i < 4; i++) vs.inventory.armor[i] = makeStack(400 + [0, 2, 4][r.material] * 4 + (3 - i), 1, 0, undefined, r.ench >= 0 ? { enchantments: [{ id: r.ench, lvl: r.level }] } : {});
    vs.inventory.random = new JavaRandom(7n);
    Object.assign(as, { health: 20, hurtTicks: 0 });
    a.yaw = f(f((180 - r.yaw) * Math.PI) / 180);
    a.velocity.x = a.velocity.z = 1; a.motion.sprinting = r.sprint;
    a.fallDistance = r.fall ? 2 : 0; a.grounded = !r.fall; a.inWater = false; a.mount = null;
    enchantmentRandom.setSeed(BigInt(r.seed));
    s.events = [];
    const got = [], wear = [];
    r.hits.forEach((spec, i) => {
      const held = stack(spec);
      as.inventory.main[0] = held; as.inventory.current = 0;
      pvp.attack(a, 'p1');
      got.push({ health: vs.health, weapon: held ? held.damage : null });
      vs.hurtTicks = vs.hurtTicks; // the hits of one record share a tick: no decay between them
    });
    const motion = { x: 0, y: 0, z: 0 }; drainKnockback(vs, motion, v.position);
    const have = { health: got.map(x => x.health), weapon: got.map(x => x.weapon), motion: [motion.x, motion.y, motion.z].map(x => Number(x.toFixed(6))), attacker: [a.velocity.x, a.velocity.z].map(x => Number(x.toFixed(6))),
      sprint: !!a.motion.sprinting, burning: vs.fire > 0, armor: [0, 1, 2, 3].map(i => vs.inventory.armor[i]?.damage ?? null) };
    const want = { health: r.results.map(x => f(x.health)), weapon: r.results.map(x => x.weapon), motion: r.victimMotion.map(x => Number(x.toFixed(6))), attacker: r.attackerMotion.map(x => Number(x.toFixed(6))),
      sprint: r.attackerSprinting, burning: r.victimBurning, armor: r.armor };
    // the reference weapon column is the weapon's damage after its hit; a non-tool (fist, stick) has none
    want.weapon = want.weapon.map((w, i) => (r.hits[i][0] === 0 ? null : r.hits[i][0] === 280 ? 0 : w));
    if (r.death) { s.serverSurvival.settle(v); const e = s.events.find(x => x.type === 'death'); have.death = e ? 'slain' : null; want.death = /slain by/.test(r.death.text) ? 'slain' : r.death.text; }
    if (JSON.stringify(have) !== JSON.stringify(want)) failures.push(`${r.case}: got ${JSON.stringify(have)} want ${JSON.stringify(want)}`);
  }
  assert.equal(failures.length, 0, failures.length + ' of ' + reference.records.length + '\n' + failures.slice(0, 12).join('\n'));
});

const sword = () => makeStack(115, 1, 0);
const hold = (p, st) => { p.survival.inventory.main[0] = st; p.survival.inventory.current = 0; };

test('a queued C02 attack goes through the network tick: damage, hurt flag, swing, knockback, wear', () => {
  const { s, ps: [a, v] } = joined();
  hold(a, sword());
  assert.equal(s.queuePvpAttack('p0', 'p1'), true);
  s.tick(); s.tick();
  assert.equal(v.survival.health, 12);
  assert.equal(a.survival.held.damage, 1);
  assert.equal(s.players.get('p0').swing > 0, true);
  assert.ok(v.velocity.x > 0 || v.position.x > 65.5, 'pushed away from the attacker');
  assert.equal(s.serverSurvival.outgoing(v).some(m => m.type === 'healthHurt' && m.hurt), true);
  assert.equal(s.events.filter(e => e.type === 'pvpHit').length, 1); // no ServerSocial in this harness: the event stays queued until it drains
});

test('pvp=false: melee, arrows and splash potions do nothing to players; mob hits still land', () => {
  const { s, ps: [a, v] } = joined({ pvp: false });
  assert.equal(s.pvp, false);
  hold(a, sword());
  assert.equal(s.pvpRules.attack(a, 'p1'), false);
  assert.equal(v.survival.health, 20);
  assert.equal(a.survival.held.damage, 0, 'a refused hit wears nothing');
  assert.equal(v.survival.knockQueue?.length ?? 0, 0);
  const from = s.pvpRules.fromOf(a);
  assert.equal(s.damagePlayer(v, 6, { name: 'an arrow', from, call: () => v.survival.damage(6, 'an arrow', true, undefined, from) }), false);
  assert.equal(s.damagePlayer(v, 6, { name: 'magic', from, call: () => v.survival.damage(6, 'magic', false, undefined, from) }), false);
  assert.equal(s.damagePlayer(a, 6, { name: 'an arrow', from, call: () => a.survival.damage(6, 'an arrow', true, undefined, from) }), false, 'EntityPlayerMP.canAttackPlayer(self) is false too');
  assert.equal(v.survival.health, 20);
  assert.equal(s.damagePlayer(v, 4, { name: 'a zombie', from: { x: 60, z: 64, type: 'zombie' } }) !== false, true);
  assert.equal(v.survival.health, 16);
  v.survival.hurtTicks = 0;
  assert.equal(s.damagePlayer(v, 1, { name: 'a fall', from: undefined, call: () => v.survival.damage(1, 'a fall', false) }) !== false, true, 'fall damage is no player attack');
});

test('pvp defaults to true and the dedicated server wires --pvp, MC_WEB_PVP and the attackPlayer message', () => {
  assert.equal(new DedicatedSimulation({}, {}).pvp, true);
  const src = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
  assert.match(src, /pvp = true/);
  assert.match(src, /argument\('--pvp'/);
  assert.match(src, /m\.type === 'attackPlayer' && typeof m\.player === 'string'\) simulation\.queuePvpAttack\(id, m\.player\)/);
});

test('reach: below 6 blocks, below 3 without line of sight, never self, dead, creative victim or another dimension', () => {
  const { s, ps: [a, v] } = joined();
  hold(a, sword());
  const pvp = s.pvpRules;
  v.position.copy({ x: 64.5 + 5.9, y: 10, z: 64.5 }); assert.equal(pvp.inReach(a, v), true);
  v.position.copy({ x: 64.5 + 6.1, y: 10, z: 64.5 }); assert.equal(pvp.inReach(a, v), false);
  assert.equal(pvp.attack(a, 'p1'), false);
  v.position.copy({ x: 64.5 + 5, y: 10, z: 64.5 });
  for (let y = 10; y <= 12; y++) s.world.put(67, y, 64, 1, 0, false); // a wall between the eyes
  assert.equal(pvp.inReach(a, v), false, 'without sight the limit is 3');
  v.position.copy({ x: 64.5 + 2.5, y: 10, z: 64.5 }); s.world.put(66, 10, 64, 1, 0, false); s.world.put(66, 11, 64, 1, 0, false);
  assert.equal(pvp.inReach(a, v), true);
  v.position.copy({ x: 65.5, y: 10, z: 64.5 });
  for (let y = 10; y <= 12; y++) s.world.put(67, y, 64, 0, 0, false); s.world.put(66, 10, 64, 0, 0, false); s.world.put(66, 11, 64, 0, 0, false);
  assert.equal(pvp.attack(a, 'a0'), false);
  assert.equal(pvp.attack(a, 'p0'), false, 'attacking yourself is no hit');
  v.survival.mode = 'creative';
  assert.equal(pvp.attack(a, 'p1'), false);
  assert.equal(v.survival.health, 20);
  assert.equal(a.survival.held.damage, 0);
  v.survival.mode = 'survival'; v.dimension = -1;
  assert.equal(pvp.attack(a, 'p1'), false);
  v.dimension = 0; v.dead = true;
  assert.equal(pvp.attack(a, 'p1'), false);
  v.dead = false;
  assert.equal(pvp.attack(a, 'p1'), true);
});

test('spawn protection refuses the hit (and the weapon is not worn)', () => {
  const { s, ps: [a, v] } = joined();
  hold(a, sword()); v.survival.protection = 60;
  assert.equal(s.pvpRules.attack(a, 'p1'), false);
  assert.equal(a.survival.held.damage, 0);
  assert.equal(v.survival.health, 20);
});

test('a kill: "X was slain by Y" to everyone, the killer and a pvpHit event, drops at death', () => {
  const { s, ps: [a, v] } = joined();
  hold(a, sword()); v.survival.health = 3;
  assert.equal(s.pvpRules.attack(a, 'p1'), true);
  s.tick();
  assert.equal(v.dead, true);
  const death = s.events.find(e => e.type === 'death');
  assert.equal(death.killer, 'p0');
  assert.equal(death.id, 'p1');
  assert.match(JSON.stringify(death.component), /death\.attack\.player/);
  assert.match(JSON.stringify(death.component), /Victim/);
  assert.match(JSON.stringify(death.component), /Attacker/);
  assert.equal(s.events.filter(e => e.type === 'pvpHit').length, 1);
  assert.equal(s.events.find(e => e.type === 'pvpHit').damage, 80);
});

test('b63 lead: a PvP hit and kill count in the server statistics (damageDealt round(f * 10), playerKills, the victim\'s deaths)', () => {
  const { s, ps: [a, v] } = joined();
  hold(a, sword()); v.survival.health = 3;
  const dealt = a.stats.get(STAT.damageDealt) | 0, kills = a.stats.get(STAT.playerKills) | 0, deaths = v.stats.get(STAT.deaths) | 0;
  assert.equal(s.pvpRules.attack(a, 'p1'), true);
  s.tick();
  assert.equal(v.dead, true);
  assert.equal(a.stats.get(STAT.damageDealt) - dealt, 80);
  assert.equal(a.stats.get(STAT.playerKills) - kills, 1);
  assert.equal(v.stats.get(STAT.deaths) - deaths, 1);
  assert.equal(v.stats.get(STAT.playerKills) | 0, 0);
});

test('a mob kill carries no killer', () => {
  const { s, ps: [, v] } = joined();
  s.damagePlayer(v, 50, { name: 'a zombie', from: { x: 60, z: 64, type: 'zombie' } }); s.tick();
  assert.equal(s.events.find(e => e.type === 'death').killer, undefined);
});

test('Thorns on the victim hurt the attacker once the hit landed', () => {
  const { s, ps: [a, v] } = joined();
  hold(a, sword());
  v.survival.inventory.armor[2] = makeStack(409, 1, 0, undefined, { enchantments: [{ id: 7, lvl: 3 }] }); // iron chestplate, Thorns III (rolls on the victim's random: seeded until it fires)
  let hurt = 0;
  for (let i = 0; i < 40 && !hurt; i++) {
    v.survival.hurtTicks = 0; a.survival.hurtTicks = 0; v.survival.health = 20; v.survival.inventory.random = new JavaRandom(BigInt(i) * 2654435761n + 12345n); // small seeds give alike first draws
    s.pvpRules.attack(a, 'p1');
    if (a.survival.health < 20) { hurt++; assert.match(a.survival.lastSource ?? '', /thorns/); }
    a.survival.health = 20;
  }
  assert.ok(hurt > 0, 'Thorns III fires in some rolls');
});

test('Fire Aspect that does not land leaves nothing burning; a landed one burns 4 s per level', () => {
  const { s, ps: [a, v] } = joined({ pvp: false });
  hold(a, makeStack(115, 1, 0, undefined, { enchantments: [{ id: 20, lvl: 2 }] }));
  s.pvpRules.attack(a, 'p1');
  assert.equal(v.survival.fire, 0);
  s.pvp = true;
  s.pvpRules.attack(a, 'p1');
  assert.equal(v.survival.fire, 160);
});

test('pickPlayer: the nearest box on the ray within reach, skipping dead players', () => {
  const near = { state: { x: 4, y: 0, z: 0, dead: false } }, far = { state: { x: 6, y: 0, z: 0 } }, gone = { state: { x: 2, y: 0, z: 0, dead: true } };
  const entries = new Map([['far', far], ['near', near], ['gone', gone]]);
  const hit = pickPlayer(entries, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 6);
  assert.equal(hit.id, 'near');
  assert.ok(Math.abs(hit.distance - 3.7) < 1e-9);
  assert.equal(pickPlayer(entries, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 3), null);
  assert.equal(pickPlayer(entries, { x: 0, y: 1, z: 0 }, { x: -1, y: 0, z: 0 }, 6), null);
  assert.equal(pickPlayer(entries, { x: 0, y: 3, z: 0 }, { x: 1, y: 0, z: 0 }, 6), null, 'above their head');
  assert.ok(ServerPvp);
});

test('queuePvpAttack validates its input', () => {
  const { s } = joined();
  assert.equal(s.queuePvpAttack('p0', 5), false);
  assert.equal(s.queuePvpAttack('nobody', 'p1'), false);
  assert.equal(s.queuePvpAttack('p0', 'x'.repeat(65)), false);
  for (let i = 0; i < 4; i++) assert.equal(s.queuePvpAttack('p0', 'p1'), true);
  assert.equal(s.queuePvpAttack('p0', 'p1'), false);
});
