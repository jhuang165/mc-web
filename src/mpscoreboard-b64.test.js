// Batch 64 mpscoreboard: the dedicated server's shared scoreboard. The packet rules are bytecode-read (ServerScoreboard lp, S3B-S3E ic/ie/hv/id, EntityPlayer.canAttackPlayer);
// the Scoreboard rules under it are the executed ones of public/research/scoreboard-reference.json (scoreboard.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { ServerScoreboard } from './multiplayer/server-scoreboard.js';
import { applyScoreboardMessage, createClientScoreboard } from './multiplayer/client-scoreboard.js';
import { colorRuns, labelRows } from './multiplayer/remote-labels.js';
import { ServerSocial } from './server-broadcast.js';
import { serializeComponent } from './chat-component.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { STAT } from './stats.js';
import { scoreboardToJSON } from './scoreboard.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });

function server(names = ['Alice', 'Bob']) {
  const world = new World('mp-scoreboard-b64');
  for (let x = 20; x <= 110; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, gameMode: 'survival' }), inbox = {}, players = [];
  const social = new ServerSocial({ simulation: sim, ops: ['Alice'], deliver: (id, m) => (inbox[id] ??= []).push(m) });
  names.forEach((n, i) => { const p = sim.addPlayer('p' + i, n, key(i + 1)); p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 }); sim.input('p' + i, input()); players.push(p); });
  for (let i = 0; i < 3; i++) sim.tick();
  for (const p of players) p.survival.protection = 0;
  const run = (id, line) => { social.command(id, line); };
  const lines = id => (inbox[id] ?? []).filter(m => m.type === 'chat').map(m => m.text);
  const packets = id => (inbox[id] ?? []).filter(m => m.type === 'sb').flatMap(m => m.packets);
  return { sim, social, inbox, players, run, lines, packets, board: sim.scoreboard };
}

test('an objective sends nothing until it is shown; a slot sends create, display and the scores; later score changes follow', () => {
  const { run, packets, inbox, board, social } = server();
  run('p0', '/scoreboard objectives add pts dummy Points');
  run('p0', '/scoreboard players set Bob pts 5');
  assert.deepEqual(packets('p1'), []); // not tracked yet: lp.b / lp.a(azz) send only for a displayed objective
  run('p0', '/scoreboard objectives setdisplay sidebar pts');
  assert.deepEqual(packets('p1'), [
    { k: 'obj', name: 'pts', display: 'Points', mode: 0 },
    { k: 'display', slot: 1, name: 'pts' },
    { k: 'score', player: 'Bob', obj: 'pts', value: 5, action: 0 },
  ]);
  inbox.p1.length = 0;
  run('p0', '/scoreboard players add Bob pts 3');
  assert.deepEqual(packets('p1'), [{ k: 'score', player: 'Bob', obj: 'pts', value: 8, action: 0 }]);
  inbox.p1.length = 0;
  board.setScore('Bob', board.objective('pts'), 8); // an unchanged value sends nothing (azz.c)
  social.flushScoreboard();
  assert.deepEqual(packets('p1'), []);
  run('p0', '/scoreboard players reset Bob');
  assert.deepEqual(packets('p1'), [{ k: 'score', player: 'Bob', obj: '', value: 0, action: 1 }]);
  inbox.p1.length = 0;
  run('p0', '/scoreboard objectives setdisplay sidebar');
  assert.deepEqual(packets('p1'), [{ k: 'obj', name: 'pts', display: 'Points', mode: 1 }]); // the last slot: g(old) removes the objective for the client
});

test('a second slot keeps the objective: S3D only; removing a displayed objective clears its slots then removes it', () => {
  const { run, packets, inbox } = server();
  run('p0', '/scoreboard objectives add a dummy');
  run('p0', '/scoreboard objectives setdisplay list a');
  run('p0', '/scoreboard objectives setdisplay belowName a');
  inbox.p1.length = 0;
  run('p0', '/scoreboard objectives setdisplay list');
  assert.deepEqual(packets('p1'), [{ k: 'display', slot: 0, name: '' }]);
  inbox.p1.length = 0;
  run('p0', '/scoreboard objectives remove a');
  assert.deepEqual(packets('p1'), [{ k: 'obj', name: 'a', display: 'a', mode: 1 }]);
});

test('team packets: create, each option as its own update, join, leave, remove; flags bit 0 friendlyFire, bit 1 seeFriendlyInvisibles', () => {
  const { run, packets, inbox } = server();
  run('p0', '/scoreboard teams add red Red Team');
  run('p0', '/scoreboard teams option red color red');
  run('p0', '/scoreboard teams option red friendlyfire false');
  run('p0', '/scoreboard teams join red Bob');
  run('p0', '/scoreboard teams leave Bob');
  run('p0', '/scoreboard teams remove red');
  const t = packets('p1');
  assert.deepEqual(t.map(p => [p.k, p.mode]), [['team', 0], ['team', 2], ['team', 2], ['team', 2], ['team', 2], ['team', 3], ['team', 4], ['team', 1]]);
  assert.deepEqual(t[0], { k: 'team', name: 'red', mode: 0, display: 'red', prefix: '', suffix: '', flags: 3, players: [] });
  assert.equal(t[1].display, 'Red Team');
  assert.deepEqual([t[2].prefix, t[3].suffix, t[4].flags], ['§c', '§r', 2]);
  assert.deepEqual(t[5].players, ['Bob']);
  assert.ok(inbox.p0.some(m => m.type === 'sb')); // the sender gets them too
});

test('a joining player receives the teams, then each displayed objective once with its scores in sort order', () => {
  const { run, board, social, inbox } = server();
  run('p0', '/scoreboard teams add t');
  run('p0', '/scoreboard teams join t Bob');
  run('p0', '/scoreboard objectives add o dummy');
  run('p0', '/scoreboard objectives setdisplay list o');
  run('p0', '/scoreboard objectives setdisplay sidebar o');
  run('p0', '/scoreboard players set Bob o 9');
  run('p0', '/scoreboard players set Alice o 2');
  social.scoreboardJoin('p9');
  const p = inbox.p9[0].packets;
  assert.deepEqual(p.map(x => x.k + (x.mode ?? x.slot ?? '')), ['team0', 'obj0', 'display0', 'display1', 'score', 'score']);
  assert.deepEqual(p.slice(4).map(x => [x.player, x.value]), [['Alice', 2], ['Bob', 9]]);
  assert.deepEqual(p[0].players, ['Bob']);
  assert.ok(board.tracked.size === 1);
});

test('the client replica follows every packet and shows what the server shows (sidebar rows, formatted names, list score)', () => {
  const { run, packets, board } = server();
  const replica = createClientScoreboard();
  const sync = () => { const all = ['p0', 'p1'].map(packets); return all[1]; };
  run('p0', '/scoreboard teams add red');
  run('p0', '/scoreboard teams option red color red');
  run('p0', '/scoreboard teams join red Bob');
  run('p0', '/scoreboard objectives add o dummy Score');
  run('p0', '/scoreboard objectives setdisplay sidebar o');
  run('p0', '/scoreboard players set Bob o 4');
  applyScoreboardMessage(replica, { type: 'sb', packets: sync() });
  assert.equal(replica.formatName('Bob'), '§cBob§r');
  assert.equal(replica.slot(1).displayName, 'Score');
  assert.equal(replica.peek('Bob', replica.slot(1)).value, 4);
  assert.equal(replica.formatName('Alice'), 'Alice');
  assert.equal(replica.team('red').friendlyFire, true);
  assert.deepEqual(scoreboardToJSON(replica).teams[0].players, ['Bob']);
  assert.equal(board.formatName('Bob'), replica.formatName('Bob'));
  assert.equal(applyScoreboardMessage(replica, { packets: [{ k: 'bogus' }, null, { k: 'score', action: 0, player: 'X', obj: 'missing', value: 1 }] }), 0); // ignored, no throw
});

test('criteria: stat.*, deathCount, totalKillCount, playerKillCount and achievement.* count per player; health sets ceil(health + absorption) when it changes', () => {
  const { sim, run, players: [a, b], board, social } = server();
  for (const [n, c] of [['jumps', 'stat.jump'], ['deaths', 'deathCount'], ['pk', 'playerKillCount'], ['tk', 'totalKillCount'], ['hp', 'health'], ['ach', 'achievement.openInventory']]) run('p0', `/scoreboard objectives add ${n} ${c}`);
  const val = (name, o) => board.peek(name, board.objective(o))?.value;
  sim.stats.add(a, STAT.jump); sim.stats.add(a, STAT.jump, 5); // a stat's criteria count +1 per call whatever the amount (EntityPlayerMP.addStat)
  assert.equal(val('Alice', 'jumps'), 2);
  assert.equal(val('Bob', 'jumps'), undefined);
  sim.stats.add(a, STAT.playerKills);
  sim.stats.add(a, STAT.mobKills);
  assert.deepEqual([val('Alice', 'pk'), val('Alice', 'tk')], [1, 2]);
  sim.stats.add(b, STAT.deaths);
  assert.equal(val('Bob', 'deaths'), 1);
  social.openInventory('p0');
  assert.equal(val('Alice', 'ach'), 1);
  social.openInventory('p0'); // locked or repeated, the criteria still counts every trigger
  assert.equal(val('Alice', 'ach'), 2);
  // health: the first value (a new objective) arrives with the first change after it exists
  a.sbHealth = undefined; a.survival.health = 20; social.drain();
  assert.equal(val('Alice', 'hp'), 20);
  a.survival.health = 7.5; social.drain();
  assert.equal(val('Alice', 'hp'), 8);
  a.survival.absorption = 2; social.drain();
  assert.equal(val('Alice', 'hp'), 10);
  // dying: health 0 is a change (score 0); the respawned entity starts again and sets the full health
  a.survival.health = 0; a.dead = true; social.drain();
  assert.equal(val('Alice', 'hp'), 2); // the absorption is still there until the respawn clears it
  a.survival.health = 20; a.survival.absorption = 0; a.dead = false; social.drain();
  assert.equal(val('Alice', 'hp'), 20);
});

test('team friendly fire: PvP between teammates is refused with friendlyFire false, allowed across teams, without teams and with the option on', () => {
  const { sim, players: [a, b], board } = server();
  const hit = () => sim.damagePlayer(b, 1, { name: 'player', from: sim.pvpRules.fromOf(a), call: () => 'hit' });
  assert.equal(hit(), 'hit'); // no team
  board.createTeam('t'); board.joinTeam('Alice', 't'); board.joinTeam('Bob', 't');
  assert.equal(hit(), 'hit'); // friendlyFire defaults true
  board.setTeam(board.team('t'), { friendlyFire: false });
  assert.equal(hit(), false);
  assert.equal(sim.damagePlayer(a, 1, { name: 'player', from: sim.pvpRules.fromOf(b), call: () => 'hit' }), false); // both ways
  assert.equal(sim.damagePlayer(b, 1, { name: 'a zombie', call: () => 'hit' }), 'hit'); // a mob is not a player attacker
  board.createTeam('u'); board.leaveTeam('Bob'); board.joinTeam('Bob', 'u');
  assert.equal(hit(), 'hit'); // another team: allowed
  board.leaveTeam('Bob'); // a team member hit by a teamless attacker: team without the attacker's team is not the same team
  assert.equal(hit(), 'hit');
  // the attacker's own Thorns / a fall have no player `from`
  board.joinTeam('Bob', 't');
  assert.equal(sim.damagePlayer(b, 1, { name: 'a fall', call: () => 'hit' }), 'hit');
  // pvp=false still wins over teams
  sim.pvp = false;
  assert.equal(sim.damagePlayer(a, 1, { name: 'player', from: sim.pvpRules.fromOf(b), call: () => 'hit' }), false);
});

test('the combat tracker and chat use the team-formatted name; chat keeps the raw name for the /msg click', () => {
  const { run, social, inbox, sim } = server();
  run('p0', '/scoreboard teams add red');
  run('p0', '/scoreboard teams option red color red');
  run('p0', '/scoreboard teams join red Bob');
  social.chat('p1', 'hello');
  const chat = inbox.p0.filter(m => m.type === 'chat').pop();
  assert.ok(chat.json.includes('§cBob§r') && chat.json.includes('/msg Bob '));
  assert.equal(sim.pvpRules.fromOf(sim.players.get('p1')).formattedName, '§cBob§r');
  inbox.p0.length = 0;
  social.death('p1');
  assert.ok(inbox.p0[0].text.includes('§cBob§r'));
});

test('only operators run /scoreboard on the server; the answers go to the sender', () => {
  const { run, lines, board } = server();
  run('p1', '/scoreboard objectives add x dummy');
  assert.equal(board.objective('x'), null);
  assert.ok(lines('p1').length > 0);
  run('p0', '/scoreboard objectives add x dummy');
  assert.ok(board.objective('x'));
  run('p0', '/scoreboard objectives list');
  assert.ok(lines('p0').some(l => l.includes('x')));
});

test('the scoreboard is saved with the world and restored without a packet burst; an empty one adds no field', () => {
  const { sim, run } = server();
  assert.equal('scoreboard' in JSON.parse(JSON.stringify(sim.save())), false);
  run('p0', '/scoreboard objectives add o dummy Obj');
  run('p0', '/scoreboard objectives setdisplay belowName o');
  run('p0', '/scoreboard teams add t');
  run('p0', '/scoreboard players set Bob o 3');
  const saved = JSON.parse(JSON.stringify(sim.save()));
  const copy = new ServerScoreboard(saved.scoreboard);
  assert.deepEqual(copy.take(), []);
  assert.equal(copy.slot(2).name, 'o');
  assert.equal(copy.peek('Bob', copy.objective('o')).value, 3);
  assert.ok(copy.tracked.has(copy.slot(2)));
  assert.ok(copy.team('t'));
  const sim2 = new DedicatedSimulation(saved, { world: sim.world });
  assert.equal(sim2.scoreboard.objective('o').displayName, 'Obj');
});

test('the belowName label rows and colour runs', () => {
  const b = createClientScoreboard();
  const o = b.addObjective('hp', 'dummy'); b.setDisplayName(o, 'hearts'); b.setSlot(2, o);
  b.createTeam('r'); b.setTeam(b.team('r'), { prefix: '§c', suffix: '§r' }); b.joinTeam('Bob', 'r');
  b.setScore('Bob', o, 12);
  assert.deepEqual(labelRows(b, 'Bob'), { top: '§cBob§r', below: '12 hearts' });
  assert.deepEqual(labelRows(b, 'Zed'), { top: 'Zed', below: '0 hearts' });
  assert.deepEqual(colorRuns('§cBob§r!'), [{ text: 'Bob', color: '#ff5555' }, { text: '!', color: '#ffffff' }]);
  b.setSlot(2, null);
  assert.equal(labelRows(b, 'Bob').below, null);
});
