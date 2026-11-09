// Paintings and item frames (server-hanging.js) and the per-player statistics and achievements (server-stats.js) on the gun
// server: a frame hung on a wall, a map set in it and seen by a player who does not carry it, turned, emptied and broken into
// server items; a painting that falls off a removed wall; the stats of walking, fishing, deaths and kills, the achievements a tab
// reports or the server unlocks, the stats reply, and both kept with the account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { furnaceTaken } from './multiplayer/server-stats.js';
import { makeStack } from './inventory.js';
import { FRAME_ITEM, PAINTING_ITEM } from './hanging.js';
import { ITEM_EMPTY_MAP, ITEM_FILLED_MAP, mapStore } from './maps.js';
import { FISHING_ROD } from './fishing-content.js';
import { STAT } from './stats.js';
import { WATER } from './world.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const quiet = { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const IDLE = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false };
function hold(sim, a, n, controls = {}) {
  for (let i = 0; i < n; i++) {
    for (const p of sim.players.values()) sim.input(p.id, { controls: p === a ? { ...IDLE, ...controls } : IDLE, yaw: p.yaw, pitch: p.pitch, slot: p.survival.inventory.current });
    sim.tick();
  }
}
// A stone floor in the sky with a stone wall two blocks ahead (toward -z) of player a, and a pool behind it.
function setup(seed) {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: quiet, random: seeded(seed) });
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const y = 150, x0 = Math.floor(a.position.x), z0 = Math.floor(a.position.z);
  for (let dx = -8; dx <= 8; dx++) for (let dz = -14; dz <= 8; dz++) for (let k = 1; k <= 3; k++) {
    const wet = Math.abs(dx) <= 5 && dz >= 3 && dz <= 7;
    sim.world.put(x0 + dx, y - k, z0 + dz, wet && k < 3 ? WATER : 1, 0);
  }
  for (let dx = -2; dx <= 2; dx++) for (let k = 0; k < 3; k++) sim.world.put(x0 + dx, y + k, z0 - 2, 1, 0);
  sim.teleport(a, { x: x0 + 0.5, y, z: z0 + 0.5 });
  a.yaw = 0; a.pitch = 0;
  hold(sim, a, 2);
  sim.mobs.ew.entities.length = 0;
  a.survival.mode = 'survival'; a.survival.inventory.creative = false;
  return { sim, a, y, x0, z0 };
}
const give = (a, id, count = 1, damage = 0, slot = 0) => { a.survival.inventory.main[slot] = makeStack(id, count, damage); a.survival.inventory.current = slot; };
const events = (sim, p, type) => sim.drainEvents(p).filter(e => e.type === type);

test('a frame hangs on the wall, holds a map that a player without it sees, turns, empties and breaks into server items', () => {
  const { sim, a, y, x0, z0 } = setup(21);
  give(a, FRAME_ITEM, 2);
  assert.equal(sim.edit(a, true), true, 'the frame is hung');
  const [frame] = sim.hanging.entities;
  assert.ok(frame && frame.kind === 'frame', 'one frame');
  assert.deepEqual([frame.tx, frame.ty, frame.tz], [x0, y + 1, z0 - 2], 'on the aimed wall block');
  assert.equal(a.survival.inventory.main[0].count, 1, 'one frame spent');
  const rows = sim.you(a).hanging;
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].slice(0, 6), [frame.id, 1, frame.dir, x0, y + 1, z0 - 2]);
  assert.equal(sim.you(a).hanging, undefined, 'unchanged, not sent again');
  // A filled map set in the frame: its marker is drawn, and a player who does not carry it gets the map.
  give(a, ITEM_EMPTY_MAP, 1, 0, 1);
  a.yaw = Math.PI; // facing away: aimed at the frame, the frame would take the empty map itself (EntityItemFrame.interactFirst)
  assert.equal(sim.edit(a, true), true, 'the empty map is used');
  a.yaw = 0;
  const slot = a.survival.inventory.main.findIndex(s => s?.id === ITEM_FILLED_MAP), map = a.survival.inventory.main[slot];
  a.survival.inventory.current = slot;
  assert.equal(sim.edit(a, true), true, 'the map goes into the frame');
  assert.equal(frame.item?.id, ITEM_FILLED_MAP);
  assert.equal(a.survival.inventory.main[slot], null, 'out of the hand');
  const b = sim.addPlayer('b', 'Bob', 'acct-b');
  sim.teleport(b, { x: x0 + 3.5, y, z: z0 + 0.5 });
  hold(sim, a, 12);
  const data = mapStore.get(map.damage);
  assert.ok(data.decorations.has(`frame-${frame.id}`), 'the frame marker');
  const seen = sim.you(b);
  assert.ok(seen.maps?.some(r => r.id === map.damage), 'the framed map reaches a player who does not carry it');
  assert.equal(seen.hanging[0][7].id, ITEM_FILLED_MAP, 'and the frame row holds it');
  // Used again it turns; hit, it lets the map go, then breaks.
  assert.equal(sim.edit(a, true), true);
  assert.equal(frame.rotation, 1, 'turned');
  const items = sim.play.items.items;
  const before = items.length;
  assert.equal(sim.edit(a, false), true, 'hit');
  assert.equal(frame.item, null, 'the map dropped');
  assert.equal(items.length, before + 1);
  assert.equal(sim.edit(a, false), true, 'hit again');
  assert.ok(frame.dead, 'broken');
  assert.equal(items.length, before + 2, 'the frame dropped too');
  assert.deepEqual(sim.you(a).hanging, [], 'gone from the tab');
});

test('a painting falls off a removed wall; paintings and frames are saved with the world', () => {
  const { sim, a, y, x0, z0 } = setup(22);
  give(a, PAINTING_ITEM, 1);
  assert.equal(sim.edit(a, true), true, 'the painting is hung');
  const [painting] = sim.hanging.entities;
  assert.equal(painting.kind, 'painting');
  const saved = JSON.parse(JSON.stringify(sim.save()));
  const back = new GunSimulation(saved, { config: quiet });
  assert.equal(back.hanging.entities.length, 1, 'kept with the world');
  assert.deepEqual([back.hanging.entities[0].tx, back.hanging.entities[0].art], [painting.tx, painting.art]);
  for (let dx = -2; dx <= 2; dx++) for (let k = 0; k < 3; k++) sim.world.put(x0 + dx, y + k, z0 - 2, 0, 0);
  const before = sim.play.items.items.length;
  hold(sim, a, 101);
  assert.ok(painting.dead, 'off the wall within 100 ticks');
  assert.equal(sim.play.items.items.length, before + 1, 'dropped as a painting');
});

test('the server counts the stats and unlocks the achievements of each player, and keeps them with the account', () => {
  const { sim, a } = setup(23);
  const b = sim.addPlayer('b', 'Bob', 'acct-b');
  sim.teleport(b, { ...a.position }); hold(sim, a, 1);
  sim.drainEvents(a); sim.drainEvents(b);
  assert.deepEqual(sim.you(a).achievements, [], 'the unlocked list, once');
  assert.equal(sim.you(a).achievements, undefined);
  const ticks = a.stats.get(STAT.playOneMinute);
  // Walking back toward the pool (+z, away from the wall).
  a.yaw = Math.PI;
  hold(sim, a, 10, { forward: 1 });
  assert.equal(a.stats.get(STAT.playOneMinute), ticks + 10, 'one per tick');
  assert.ok(a.stats.get(STAT.walk) > 100, `walked (${a.stats.get(STAT.walk)} cm)`);
  hold(sim, a, 2, { jump: true });
  assert.ok(a.stats.get(STAT.jump) >= 1, 'jumped');
  // The tab's opened inventory, then a picked-up log: openInventory, then mineWood, announced to everyone.
  sim.clientStatus(a.id, 'openInventory');
  assert.ok(a.achievements.has('openInventory'));
  const toA = events(sim, a, 'achievement'), toB = events(sim, b, 'achievement');
  assert.deepEqual(toA.map(e => [e.id, e.by, e.self]), [['openInventory', 'Alice', true]]);
  assert.deepEqual(toB.map(e => [e.id, e.by, e.self]), [['openInventory', 'Alice', false]]);
  sim.play.items.spawn(makeStack(4, 1), a.position.x, a.position.y + 0.2, a.position.z, { delay: 0 });
  hold(sim, a, 3);
  assert.ok(a.achievements.has('mineWood'), 'picking up a log');
  assert.deepEqual(sim.you(a).achievements, ['openInventory', 'mineWood']);
  // A catch: fishCaught, junkFished or treasureFished.
  a.yaw = Math.PI; a.pitch = -0.3;
  give(a, FISHING_ROD);
  assert.equal(sim.edit(a, true), true, 'cast');
  hold(sim, a, 40);
  assert.ok(a.fishing.hook, 'the bobber is out');
  a.fishing.hook.ticksCatchable = 20;
  assert.equal(sim.edit(a, true), true, 'reeled in');
  assert.equal(a.stats.get(STAT.fishCaught) + a.stats.get(STAT.junkFished) + a.stats.get(STAT.treasureFished), 1, 'one catch counted');
  // A furnace output taken: its crafted stat and the orbs (iron: 0.7 each).
  const orbs = sim.mobs.orbs.orbs.length;
  furnaceTaken(sim, a)(makeStack(302, 3), 3);
  assert.ok(sim.mobs.orbs.orbs.length > orbs, 'smelting experience');
  // A worn-out tool: its depleted stat, random.break for the players near, the crumbs.
  a.survival.broken = FISHING_ROD;
  hold(sim, a, 1);
  assert.equal(a.survival.broken, 0);
  assert.ok(Object.keys(a.stats.save()).some(k => k.startsWith('stat.breakItem.')), 'the depleted stat');
  const heard = sim.drainEvents(b);
  assert.ok(heard.some(e => e.type === 'sound' && e.sound === 'random.break'), 'the break sound');
  assert.ok(heard.some(e => e.type === 'crumbs' && e.by === a.id && e.id === FISHING_ROD), 'the crumbs');
  // A death by another player: deaths for the victim, playerKills for the killer.
  b.survival.protection = 0;
  sim.damage(b, 1000, { attacker: a, kind: 'gun' });
  hold(sim, a, 1);
  assert.equal(b.stats.get(STAT.deaths), 1);
  assert.equal(a.stats.get(STAT.playerKills), 1);
  // REQUEST_STATS -> every stat.
  sim.drainEvents(a);
  sim.requestStats(a.id);
  const [reply] = events(sim, a, 'stats');
  assert.equal(reply.stats[STAT.playerKills], 1);
  assert.equal(reply.stats[STAT.playOneMinute], a.stats.get(STAT.playOneMinute));
  // Kept with the account: leaving counts leaveGame, and joining again restores both.
  const walked = a.stats.get(STAT.walk);
  sim.removePlayer(a.id);
  const again = sim.addPlayer('a2', 'Alice', 'acct-a');
  assert.equal(again.stats.get(STAT.walk), walked);
  assert.equal(again.stats.get(STAT.leaveGame), 1);
  assert.ok(again.achievements.has('mineWood'));
  const reloaded = new GunSimulation(JSON.parse(JSON.stringify(sim.save())), { config: quiet });
  const third = reloaded.addPlayer('a3', 'Alice', 'acct-a');
  assert.equal(third.stats.get(STAT.playerKills), 1, 'and with the saved world');
});
