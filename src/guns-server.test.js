import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { World } from './world.js';
import { IDLE_INPUT, PROTOCOL, cleanAction } from './multiplayer/protocol.js';
import { GunSimulation, arenaKit, JOIN_PROTECTION } from './multiplayer/gun-simulation.js';
import { PositionHistory, rayBox, playerBox, lookDir } from './multiplayer/combat.js';
import { canonical, packFingerprint } from './multiplayer/fingerprint.js';
import { setMeleePacks, MELEE } from './mods/guns/install.js';
import { GUNS, AKM, P320, M870 } from './mods/guns/catalog.js';
import { loadedRounds } from './mods/guns/ammo.js';
import { ITEMS } from './survival.js';
import { installGunRules, diskFetcher } from '../server/pack-loader.js';
import { createGunsServer, MESSAGES } from '../server/guns-server.js';
import { ProfileVerifier } from '../server/profile-verifier.js';

// A synthetic LR Tactical knife (no pack files): 5 attack damage, a 3-block 90° cone, an instant strike, 10-tick cooldown.
setMeleePacks([{ namespace: 'cs2_wt', lang: {}, melee: { m9: { index: { name: 'item.m9', base_item: 'lrtactical:melee', data: {
  attributes: { 'generic.attack_damage': 5 }, draw_time: 2,
  attack: { attack_left: { factor: 1, knockback: 0.4, cooldown: 10, delay: 0, hitbox: { type: 'cone', max_range: 3, max_angle: 90 } } } } },
  display: { model: 'm', texture: 't' } } } }]);
const rules = await installGunRules(); // no pack directory: the built-in guns and the synthetic knife
const KNIFE = 4604;
const EAST = -Math.PI / 2, BODY = -0.1; // lookDir(yaw) = (-sin yaw, ., -cos yaw): +x; BODY aims 6 blocks away at the chest

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function arena(config = {}, random = () => 0) {
  const world = new World('guns-test');
  for (let x = 50; x <= 80; x++) for (let z = 55; z <= 75; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new GunSimulation({}, { world, config: { spawnProtection: 0, ...config }, random });
}
const input = (p, extra = {}) => ({ controls: { ...IDLE_INPUT }, yaw: p.yaw, pitch: p.pitch, slot: p.survival.inventory.current, ...extra });
function pair(sim) {
  const a = sim.addPlayer('a', 'Alice', id(1)), b = sim.addPlayer('b', 'Bob', id(2));
  a.position.copy({ x: 60.5, y: 10, z: 64.5 }); b.position.copy({ x: 66.5, y: 10, z: 64.5 });
  a.yaw = EAST; b.yaw = -EAST; a.pitch = BODY; // a level shot from eye height is a headshot
  for (const p of [a, b]) { p.previous.copy(p.position); p.survival.protection = 0; }
  return { a, b };
}
const run = (sim, n, each = () => {}) => { for (let i = 0; i < n; i++) { each(); sim.tick(); } };
const keep = (sim, ...players) => () => { for (const p of players) sim.input(p.id, input(p)); };

test('weapon-rule fingerprint ignores presentation and key order but not stats', async () => {
  assert.equal(canonical({ b: 1, a: [new Set([2, 1])], model: 'x', f() {} }), canonical({ a: [new Set([1, 2])], b: 1, texture: 'y' }));
  const one = await packFingerprint({ guns: { 1: { rpm: 600, sounds: { a: 1 } } } }), two = await packFingerprint({ guns: { 1: { rpm: 600, sounds: { b: 2 } } } });
  assert.equal(one, two);
  assert.notEqual(one, await packFingerprint({ guns: { 1: { rpm: 650 } } }));
  assert.match(rules.pack, /^[0-9a-f]{64}$/);
});

test('protocol v3 actions are validated', () => {
  assert.deepEqual(cleanAction({ action: 'trigger', down: true, yaw: 1, pitch: 0, view: 5 }), { action: 'trigger', down: true, look: { yaw: 1, pitch: 0 }, view: 5 });
  assert.equal(cleanAction({ action: 'trigger' }), null, 'held actions need down');
  assert.equal(cleanAction({ action: 'give', down: true }), null);
  assert.equal(cleanAction({ action: 'reload', view: 1.5 }), null);
});

test('the pack loader reads only JSON metadata inside its directory', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-packs-'));
  await mkdir(path.join(dir, 'tacz'), { recursive: true });
  await writeFile(path.join(dir, 'tacz/index.json'), '{"ok":1}'); await writeFile(path.join(dir, 'tacz/model.png'), 'png');
  const read = diskFetcher(dir);
  assert.equal(await read('/mods/tacz/index.json'), '{"ok":1}');
  assert.equal(await read('/mods/tacz/model.png'), null);
  assert.equal(await read('/mods/../package.json'), null);
  assert.equal(await read('/mods/tacz/%2e%2e/%2e%2e/etc/passwd.json'), null);
  assert.equal(await read('/mods/tacz/missing.json'), null);
  await rm(dir, { recursive: true, force: true });
});

test('a new account gets the server-owned arena kit; client inventory claims are ignored', () => {
  const sim = arena(), p = sim.addPlayer('a', 'Alice', id(1));
  const inv = p.survival.inventory;
  assert.deepEqual(inv.main.slice(0, 4).map(s => s?.id), [AKM, P320, M870, KNIFE]);
  assert.deepEqual(inv.armor.map(s => s?.id), [411, 410, 409, 408]);
  assert.equal(p.survival.mode, 'survival'); assert.equal(p.survival.protection, JOIN_PROTECTION);
  const before = JSON.stringify(inv.serialize());
  assert.equal(sim.input('a', { ...input(p), slot: 2, hotbar: [{ id: 46, count: 64 }], current: 7 }), true);
  assert.equal(inv.current, 2); assert.equal(JSON.stringify(inv.serialize()), before, 'v3 input carries no items');
  assert.equal(sim.input('a', { ...input(p), slot: 9 }), false);
  assert.equal(sim.queueEdit('a', { place: 1 }), false, 'edits are a boolean use or attack');
});

test('server-side shots spend magazine rounds, damage through armour, and kill with a death message', () => {
  const sim = arena(), { a, b } = pair(sim), keepUp = keep(sim, a, b);
  const gun = a.survival.inventory.main[0];
  run(sim, 10, keepUp); // the AKM's 0.35 s draw
  assert.equal(loadedRounds(GUNS[AKM], gun), 30);
  sim.action('a', { action: 'trigger', down: true, yaw: EAST, pitch: BODY }); sim.action('a', { action: 'trigger', down: false });
  run(sim, 1, keepUp);
  assert.equal(loadedRounds(GUNS[AKM], gun), 29, 'a tap fires one round');
  assert.ok(b.survival.health < 20 && b.survival.health > 20 - 9, `armour reduced the 9 damage: ${b.survival.health}`);
  const events = sim.drainEvents(a);
  assert.deepEqual(events.find(e => e.type === 'hit'), { type: 'hit', target: 'b', head: false, kill: false });
  assert.ok(sim.drainEvents(b).some(e => e.type === 'shot' && e.id === 'a' && e.paths.length === 1), 'the target sees the shot');
  sim.action('a', { action: 'trigger', down: true });
  run(sim, 40, keepUp);
  assert.equal(b.dead, true);
  assert.ok(loadedRounds(GUNS[AKM], gun) < 29);
  const tick = sim.tick();
  assert.ok(!tick.players.find(p => p.id === 'b') || tick.players.find(p => p.id === 'b').dead);
  assert.ok(sim.drainEvents(a).some(e => e.type === 'kill' && e.target === 'b'));
});

test('the use button eats held food on the server; letting go stops it', () => {
  const sim = arena(), { a } = pair(sim), eat = slot => sim.input('a', input(a, { slot }));
  const steak = () => a.survival.inventory.main[8]?.count ?? 0;
  eat(8); a.survival.food = 10; a.survival.saturation = 0;
  sim.action('a', { action: 'use', down: true });
  run(sim, 31, () => eat(8));
  assert.equal(a.survival.food, 10, 'not yet: eating takes 32 ticks');
  run(sim, 1, () => eat(8));
  assert.equal(a.survival.food, 18); assert.equal(steak(), 15);
  assert.equal(sim.you(a).food, 18, 'the new food level goes to the client');
  sim.action('a', { action: 'use', down: true });
  run(sim, 10, () => eat(8));
  sim.action('a', { action: 'use', down: false });
  run(sim, 40, () => eat(8));
  assert.equal(a.survival.food, 18, 'released early: nothing eaten'); assert.equal(steak(), 15);
  a.survival.food = 20;
  sim.action('a', { action: 'use', down: true });
  run(sim, 40, () => eat(8));
  assert.equal(steak(), 15, 'a full player cannot eat');
  sim.action('a', { action: 'use', down: true });
  run(sim, 5, () => eat(0));
  assert.equal(a.eating, null, 'a gun in hand eats nothing');
});

const itemId = name => +Object.keys(ITEMS).find(k => ITEMS[k].name === name);
function digger(sim) {
  const p = sim.addPlayer('a', 'Alice', id(1));
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); p.survival.protection = 0;
  p.survival.inventory.main.fill(null); p.survival.inventory.armor.fill(null);
  return p;
}
test('survival digging runs on the server while the attack button is held; the block drops and is picked up', () => {
  const sim = arena(), p = digger(sim), DIRT = 2;
  sim.world.put(64, 9, 64, DIRT, 0, false);
  p.pitch = -Math.PI / 2; const hold = keep(sim, p);
  assert.equal(cleanAction({ action: 'mine', down: true })?.action, 'mine');
  sim.action('a', { action: 'mine', down: true });
  run(sim, 8, hold);
  assert.ok(sim.you(p).mining.progress > 0.3 && sim.you(p).mining.progress < 1, 'dirt by hand takes 1 / (0.5 * 30) per tick');
  assert.ok(Array.isArray(JSON.parse(JSON.stringify(sim.you(p))).mining.block), 'the cell is sent as a plain array');
  sim.action('a', { action: 'mine', down: false }); run(sim, 1, hold);
  assert.equal(p.mining, null, 'letting go resets the progress'); assert.equal(sim.world.get(64, 9, 64), DIRT);
  sim.action('a', { action: 'mine', down: true });
  let t = 0; while (sim.world.get(64, 9, 64) === DIRT && t < 40) { run(sim, 1, hold); t++; }
  assert.ok(t >= 15 && t <= 17, `broke after ${t} ticks`);
  assert.ok(sim.drainEvents(p).some(e => e.type === 'broke' && e.id === DIRT));
  assert.equal(sim.play.items.items.length, 1);
  assert.deepEqual(sim.you(p).items.map(r => r[4]), [DIRT], 'nearby players see the dropped item');
  sim.action('a', { action: 'mine', down: false }); run(sim, 40, hold);
  assert.equal(p.survival.inventory.main.find(Boolean)?.id, DIRT, 'the item is picked up after its 10-tick delay');
  assert.ok(sim.drainEvents(p).some(e => e.type === 'pickup' && e.by === 'a'));
  sim.world.put(64, 8, 64, 3, 0, false); sim.world.put(63, 9, 64, 3, 0, false);
  p.position.copy({ x: 64.5, y: 9, z: 64.5 }); p.yaw = EAST + Math.PI; p.pitch = 0; sim.action('a', { action: 'mine', down: true });
  t = 0; while (sim.world.get(63, 9, 64) === 3 && t < 200) { run(sim, 1, hold); t++; }
  assert.ok(t > 140 && sim.play.items.items.length === 0, 'stone by hand takes 7.5 s and drops nothing');
});
test('inventory clicks run on the server: crafting, acknowledgements, closing throws the grid, bad clicks are refused', () => {
  const sim = arena(), p = digger(sim), inv = p.survival.inventory, PLANKS = itemId('Oak Wood Planks'), TABLE = itemId('Crafting Table');
  inv.main[9] = { id: PLANKS, count: 5, damage: 0 };
  assert.equal(sim.click('a', { window: 0, seq: 1, clicks: [[9, 0, 0], [1, 1, 0], [2, 1, 0], [3, 1, 0], [4, 1, 0]] }), true);
  const you = sim.you(p);
  assert.equal(you.ack, 1);
  assert.deepEqual(you.inv.window.cursor, { id: PLANKS, count: 1, damage: 0 });
  assert.deepEqual(you.inv.window.slots.find(([i]) => i === 0)[1], { id: TABLE, count: 1, damage: 0 }, 'the 2x2 grid crafts');
  sim.click('a', { window: 0, seq: 2, clicks: [[0, 0, 1]] }); // shift-click the result
  assert.ok(inv.main.some(s => s?.id === TABLE));
  sim.click('a', { window: 0, seq: 3, clicks: [[1, 1, 0]] });
  sim.closeWindow('a', 0);
  assert.equal(inv.cursor, null);
  assert.equal(sim.play.items.items.reduce((n, e) => n + e.stack.count, 0), 1, 'closing throws the held stack');
  assert.equal(sim.click('a', { window: 0, seq: 4, clicks: [[99, 0, 0]] }), false);
  assert.equal(sim.click('a', { window: 0, seq: 5, clicks: Array(65).fill([9, 0, 0]) }), false);
  assert.equal(sim.click('a', { window: 7, seq: 6, clicks: [[0, 0, 0]] }), true, 'a click for a window that already closed is ignored');
  inv.main[9] = { id: PLANKS, count: 1, damage: 0 };
  sim.click('a', { window: 0, seq: 7, clicks: [[9, 2, 3]] });
  assert.equal(inv.cursor, null, 'middle-click cloning is Creative only');
});
test('a placed crafting table opens a server window, which closes when the player walks away', () => {
  const sim = arena(), p = digger(sim), inv = p.survival.inventory, TABLE = itemId('Crafting Table'), PLANKS = itemId('Oak Wood Planks');
  inv.main[0] = { id: TABLE, count: 1, damage: 0 }; inv.main[9] = { id: PLANKS, count: 3, damage: 0 }; inv.current = 0;
  p.yaw = EAST; p.pitch = -0.6;
  assert.equal(sim.edit(p, true), true);
  assert.equal(sim.world.get(66, 10, 64), TABLE); assert.equal(inv.main[0], null);
  sim.edit(p, true);
  const open = sim.you(p).open;
  assert.equal(open.kind, 'workbench'); assert.ok(open.id >= 1);
  sim.click('a', { window: open.id, seq: 1, clicks: [[10 + 0, 0, 0], [1, 1, 0]] }); // container slot 10 is main[9] in ContainerWorkbench
  assert.equal(p.window.container.grid.stacks[0]?.count, 1);
  p.position.copy({ x: 76.5, y: 10, z: 64.5 }); run(sim, 1, keep(sim, p));
  assert.equal(p.window, null); assert.equal(sim.you(p).open, null, 'Container.canInteractWith: more than 8 blocks away');
  assert.ok(sim.play.items.items.length >= 2, 'the grid and the held stack are thrown');
});
test('creative players set inventory slots; Q drops; keepInventory keeps the inventory', () => {
  const sim = arena(), p = digger(sim), inv = p.survival.inventory, DIAMOND = itemId('Diamond');
  assert.equal(sim.creative('a', { slot: 36, stack: { id: DIAMOND, count: 64, damage: 0 } }), false, 'not in Survival');
  sim.setMode(p, 'creative');
  assert.equal(sim.creative('a', { slot: 36, stack: { id: DIAMOND, count: 64, damage: 0 }, seq: 3 }), true);
  assert.equal(p.survival.inventory.main[0]?.id, DIAMOND); assert.equal(p.clickAck, 3);
  assert.equal(sim.creative('a', { slot: 5, stack: { id: 408, count: 1, damage: 0 } }), true);
  assert.equal(p.survival.inventory.armor[3]?.id, 408, 'slot 5 is the helmet');
  sim.setMode(p, 'survival');
  const held = p.survival.inventory; held.current = 0;
  assert.equal(sim.drop('a', false), true); assert.equal(held.main[0].count, 63);
  sim.drop('a', true); assert.equal(held.main[0], null);
  assert.deepEqual(sim.play.items.items.map(e => e.stack.count), [1, 63]);
  sim.rules.keepInventory = true; held.main[4] = { id: DIAMOND, count: 2, damage: 0 };
  p.survival.health = 0; run(sim, 1);
  assert.equal(p.dead, true); assert.equal(held.main[4]?.count, 2);
});
test('/give finds items by registry name, number or mod item name and fills the inventory', () => {
  const sim = arena(), p = sim.addPlayer('a', 'Alice', id(1));
  const diamond = sim.findItem('minecraft:diamond');
  assert.equal(ITEMS[diamond.id].name, 'Diamond');
  assert.deepEqual(sim.findItem('diamond'), diamond); assert.deepEqual(sim.findItem('264'), diamond, 'numbers are Java ids');
  assert.deepEqual(sim.findItem('creative_ammo_box'), { id: 4304, damage: 0 }); assert.deepEqual(sim.findItem('4304'), { id: 4304, damage: 0 });
  assert.equal(sim.findItem('nonsense'), null);
  assert.equal(sim.give(p, { id: 4304, damage: 0 }, 1), 1);
  assert.ok(p.survival.inventory.main.some(s => s?.id === 4304));
  for (let i = 0; i < 36; i++) p.survival.inventory.main[i] = { id: 1, count: 64, damage: 0 };
  assert.equal(sim.give(p, diamond, 3), 0, 'a full inventory takes nothing');
});

test('the client is told how many shots the server fired, for its ammo prediction', () => {
  const sim = arena(), { a, b } = pair(sim), keepUp = keep(sim, a, b);
  run(sim, 10, keepUp);
  assert.equal(sim.you(a).shots, 0);
  sim.action('a', { action: 'trigger', down: true, yaw: EAST, pitch: 1.2 }); sim.action('a', { action: 'trigger', down: false });
  run(sim, 1, keepUp);
  assert.equal(sim.you(a).shots, 1);
  assert.equal(sim.you(b).shots, 0);
});

test('death messages, respawn, death drops and join protection', () => {
  const sim = arena(), { a, b } = pair(sim), keepUp = keep(sim, a, b);
  run(sim, 10, keepUp);
  sim.action('a', { action: 'trigger', down: true });
  run(sim, 40, keepUp);
  assert.equal(b.dead, true);
  assert.ok(sim.chatOut.includes('Bob was shot by Alice'), sim.chatOut.join('|'));
  assert.equal(sim.action('b', { action: 'trigger', down: true }), true);
  const pos = { ...b.position };
  sim.input('b', { ...input(b), controls: { ...IDLE_INPUT, forward: 1 } }); run(sim, 5);
  assert.deepEqual({ x: b.position.x, z: b.position.z }, { x: pos.x, z: pos.z }, 'the dead do not move');
  assert.equal(sim.respawn('b'), true);
  assert.equal(b.survival.health, 20); assert.equal(b.dead, false); assert.equal(b.survival.protection, JOIN_PROTECTION);
  assert.deepEqual(b.survival.inventory.main.slice(0, 4).map(s => s?.id), [undefined, undefined, undefined, undefined], 'without keepInventory a death drops everything');
  assert.ok(sim.play.items.items.some(e => e.stack.id === AKM), 'the dropped guns lie where Bob died');
  assert.equal(sim.respawn('b'), false, 'only the dead respawn');
  const health = b.survival.health;
  sim.action('a', { action: 'trigger', down: true }); run(sim, 5, keepUp);
  assert.equal(b.survival.health, health, 'spawn protection blocks PvP damage for 3 seconds');
});

test('knife strikes use the cone, the cooldown and the attacker position', () => {
  const sim = arena(), { a, b } = pair(sim), keepUp = keep(sim, a, b);
  a.survival.inventory.current = 3; b.position.copy({ x: 62.5, y: 10, z: 64.5 }); b.previous.copy(b.position);
  run(sim, 4, keepUp);
  sim.action('a', { action: 'melee-left', down: true }); sim.action('a', { action: 'melee-left', down: false });
  run(sim, 1, keepUp);
  const after = b.survival.health;
  assert.ok(after < 20, 'the strike lands');
  assert.ok(Math.abs(b.velocity.x) > 0, 'knockback pushes the target');
  assert.ok(sim.drainEvents(a).some(e => e.type === 'hit' && e.melee));
  sim.action('a', { action: 'melee-left', down: true }); sim.action('a', { action: 'melee-left', down: false });
  run(sim, 1, keepUp);
  assert.equal(b.survival.health, after, 'the cooldown holds the next swing');
  b.position.copy({ x: 70.5, y: 10, z: 64.5 }); b.previous.copy(b.position);
  run(sim, 12, keepUp);
  sim.action('a', { action: 'melee-left', down: true }); sim.action('a', { action: 'melee-left', down: false });
  run(sim, 2, keepUp);
  assert.ok(b.survival.health >= after - 1e-6, 'out of reach');
});

test('pvp=false and spawn protection follow server.properties', () => {
  const off = arena({ pvp: false }), { a, b } = pair(off);
  run(off, 10, keep(off, a, b));
  off.action('a', { action: 'trigger', down: true }); run(off, 10, keep(off, a, b));
  assert.equal(b.survival.health, 20);
  const sim = arena({ spawnProtection: 16 }), q = pair(sim);
  sim.world.put(63, 11, 64, 9, 0, false); // glass between them, inside the protected square
  q.a.position.copy({ x: 61.5, y: 10, z: 64.5 }); q.b.position.copy({ x: 66.5, y: 10, z: 64.5 });
  run(sim, 10, keep(sim, q.a, q.b));
  sim.action('a', { action: 'trigger', down: true }); sim.action('a', { action: 'trigger', down: false }); run(sim, 1, keep(sim, q.a, q.b));
  assert.equal(sim.world.get(63, 11, 64), 9, 'non-ops do not break protected glass');
  sim.isOp = p => p.id === 'a';
  run(sim, 3, keep(sim, q.a, q.b)); // a tap inside the 0.1 s cooldown fires nothing
  sim.action('a', { action: 'trigger', down: true }); sim.action('a', { action: 'trigger', down: false }); run(sim, 4, keep(sim, q.a, q.b));
  assert.equal(sim.world.get(63, 11, 64), 0, 'ops do');
});

test('lag compensation tests shots against the shooter\'s view, at most 6 ticks back', () => {
  const h = new PositionHistory(), p = { id: 'b', position: { x: 0, y: 0, z: 0 } };
  for (let t = 1; t <= 12; t++) { p.position = { x: t, y: 0, z: 0 }; h.record(t, [p]); }
  assert.deepEqual(h.at(p, 10, 12), { x: 9.5, y: 0, z: 0 });
  assert.deepEqual(h.at(p, 1, 12), { x: 5.5, y: 0, z: 0 }, 'clamped');
  assert.equal(h.at(p, null, 12), p.position);
  const box = playerBox({ x: 5, y: 0, z: 0 });
  assert.ok(Math.abs(rayBox([0, 1, 0], lookDir(EAST, 0), box) - 4.7) < 1e-9);
  assert.equal(rayBox([0, 1, 0], lookDir(0, 0), box), null);
  // The target walked off the line after the shooter's view tick: the rewound box is still hit.
  const sim = arena(), { a, b } = pair(sim), keepUp = keep(sim, a, b);
  run(sim, 10, keepUp);
  const view = sim.ticks;
  b.position.copy({ x: 66.5, y: 10, z: 67.5 }); b.previous.copy(b.position);
  sim.action('a', { action: 'trigger', down: true, view }); sim.action('a', { action: 'trigger', down: false });
  run(sim, 1, keepUp);
  assert.ok(b.survival.health < 20, 'hit at the drawn position');
});

test('saves keep player state per account ID', () => {
  const sim = arena(), p = sim.addPlayer('a', 'Alice', id(1));
  p.survival.inventory.main[0] = null; p.survival.health = 7;
  const saved = JSON.parse(JSON.stringify(sim.save()));
  assert.equal(saved.version, 2);
  const world = sim.world, again = new GunSimulation(saved, { world });
  const q = again.addPlayer('x', 'Alice2', id(1));
  assert.equal(q.survival.inventory.main[0], null, 'no second kit');
  assert.equal(q.survival.health, 7);
});

// ---- The WebSocket server ----
const origin = 'http://localhost:5179';
function inbox(ws) {
  const messages = [], waiting = [];
  ws.on('message', data => {
    const m = JSON.parse(data);
    const index = waiting.findIndex(w => w.predicate(m));
    if (index < 0) messages.push(m);
    else { const [w] = waiting.splice(index, 1); clearTimeout(w.timer); w.resolve(m); }
  });
  return predicate => {
    const index = messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const w = { predicate, resolve, timer: setTimeout(() => reject(new Error('Timed out waiting for server packet: ' + predicate)), 5000) };
      waiting.push(w);
    });
  };
}
const PROFILES = { 'alice-session': { id: id(1), name: 'Alice', skin: null }, 'bob-session': { id: id(2), name: 'Bob', skin: null },
  'eve-session': { id: id(3), name: 'Eve', skin: null }, 'mal-session': { id: id(4), name: 'Mal', skin: null } };
const fakeVerifier = { down: false, async verify(session) { if (this.down) throw new (await import('../server/profile-verifier.js')).ProfileUnavailable('down'); return PROFILES[session] ?? null; } };

async function server(t, { properties = '', whitelist = [id(1), id(2)], ops = [{ uuid: id(1), name: 'Alice', level: 4 }], bans = [] } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-guns-'));
  await writeFile(path.join(dir, 'server.properties'), `max-players=3\nlevel-name=arena\n${properties}`);
  await writeFile(path.join(dir, 'whitelist.json'), JSON.stringify(whitelist.map(uuid => ({ uuid, name: '' }))));
  await writeFile(path.join(dir, 'ops.json'), JSON.stringify(ops));
  await writeFile(path.join(dir, 'banned-players.json'), JSON.stringify(bans));
  const logs = [];
  const app = await createGunsServer({ port: 0, stateDir: dir, verifier: fakeVerifier, build: 'test-build', rules, simulation: arena(), tickMs: 10, saveMs: 60000, log: l => logs.push(l) });
  app.simulation.config = { ...app.simulation.config, ...app.config, spawnProtection: 0 };
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const connect = async (session, override = {}) => {
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin });
    const next = inbox(ws); await once(ws, 'open');
    ws.send(JSON.stringify({ type: 'join', protocol: PROTOCOL, build: 'test-build', pack: rules.pack, session, ...override }));
    return { ws, next, closed: once(ws, 'close').then(([code, why]) => ({ code, reason: String(why) })) };
  };
  return { app, dir, connect, logs };
}

test('the handshake checks protocol, build, packs, session, bans, whitelist and capacity', async t => {
  const { app, connect, logs } = await server(t, { bans: [{ uuid: id(4), name: 'Mal', created: '2026-11-08 00:00:00 +0000', source: 'Server', expires: 'forever', reason: 'Griefing' }] });
  assert.equal((await (await connect('alice-session', { protocol: 2 })).closed).reason, MESSAGES.version);
  assert.equal((await (await connect('alice-session', { build: 'old' })).closed).reason, MESSAGES.version);
  assert.equal((await (await connect('alice-session', { pack: 'f'.repeat(64) })).closed).reason, MESSAGES.pack);
  assert.equal((await (await connect('nobody')).closed).reason, MESSAGES.signIn);
  assert.match((await (await connect('mal-session')).closed).reason, /banned[\s\S]*Griefing/);
  assert.equal((await (await connect('eve-session')).closed).reason, MESSAGES.whitelist);
  fakeVerifier.down = true;
  const down = await (await connect('alice-session')).closed;
  assert.deepEqual(down, { code: 1013, reason: MESSAGES.unavailable });
  fakeVerifier.down = false;
  const alice = await connect('alice-session');
  const welcome = await alice.next(m => m.type === 'welcome');
  assert.equal(welcome.pack, rules.pack); assert.equal(welcome.you.mode, 'survival'); assert.ok(welcome.you.inv.slots[0]);
  assert.equal(welcome.op, 4);
  assert.ok(Array.isArray(welcome.spawn) && welcome.spawn.length === 3 && welcome.spawn.every(Number.isInteger), 'S05PacketSpawnPosition');
  const tick = await alice.next(m => m.type === 'tick' && m.you);
  assert.equal(tick.you.health, 20); assert.ok(Array.isArray(tick.events));
  const again = await connect('alice-session');
  await again.next(m => m.type === 'welcome');
  assert.equal((await alice.closed).reason, MESSAGES.replaced);
  const status = await (await fetch(`http://127.0.0.1:${app.port}/status`)).json();
  assert.deepEqual({ protocol: status.protocol, build: status.build, pack: status.pack, players: status.players, maxPlayers: status.maxPlayers },
    { protocol: PROTOCOL, build: 'test-build', pack: rules.pack, players: 1, maxPlayers: 3 });
  assert.ok(!logs.join('\n').includes('alice-session'), 'sessions are never logged');
  const forbidden = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin: 'https://untrusted.example' });
  assert.match((await once(forbidden, 'error'))[0].message, /403/);
  again.ws.close(); await again.closed;
});

test('two sockets fight through the server; commands follow op levels', async t => {
  const { app, dir, connect } = await server(t, { properties: 'white-list=false\n' });
  const alice = await connect('alice-session'), bob = await connect('bob-session');
  const a = await alice.next(m => m.type === 'welcome'), b = await bob.next(m => m.type === 'welcome');
  const sim = app.simulation, pa = sim.players.get(a.id), pb = sim.players.get(b.id);
  pa.position.copy({ x: 60.5, y: 10, z: 64.5 }); pb.position.copy({ x: 66.5, y: 10, z: 64.5 });
  pa.survival.protection = pb.survival.protection = 0;
  const look = { type: 'input', controls: { ...IDLE_INPUT }, pitch: 0, slot: 0 };
  const steer = setInterval(() => { alice.ws.send(JSON.stringify({ ...look, yaw: EAST })); bob.ws.send(JSON.stringify({ ...look, yaw: -EAST })); }, 20);
  t.after(() => clearInterval(steer));
  await new Promise(r => setTimeout(r, 200)); // draw
  alice.ws.send(JSON.stringify({ type: 'action', action: 'trigger', down: true, yaw: EAST, pitch: 0 }));
  alice.ws.send(JSON.stringify({ type: 'action', action: 'trigger', down: false }));
  const hit = await alice.next(m => m.type === 'tick' && m.events.some(e => e.type === 'hit'));
  assert.equal(hit.events.find(e => e.type === 'hit').target, b.id);
  const seen = await bob.next(m => m.type === 'tick' && m.events.some(e => e.type === 'shot'));
  assert.equal(seen.events.find(e => e.type === 'shot').id, a.id);
  await bob.next(m => m.type === 'tick' && m.you.health < 20 && m.you.inv === undefined);
  const ammo = hit.you.inv ? hit : await alice.next(m => m.type === 'tick' && m.you.inv); // the shot's tick carries the changed stack
  assert.ok(ammo.you.inv.slots[0].damage === 1, 'one round fired is stored on the stack');
  bob.ws.send(JSON.stringify({ type: 'chat', text: '/kill' }));
  await alice.next(m => m.type === 'chat' && m.text === 'Bob died'); // a death message is ordinary chat for everyone
  bob.ws.send(JSON.stringify({ type: 'respawn' }));
  await bob.next(m => m.type === 'tick' && m.you.dead === false && m.you.health === 20);
  bob.ws.send(JSON.stringify({ type: 'chat', text: '/gamemode creative' }));
  await bob.next(m => m.type === 'chat' && m.text === 'You do not have permission to use this command');
  alice.ws.send(JSON.stringify({ type: 'chat', text: '/give Bob creative_ammo_box' }));
  assert.equal((await alice.next(m => m.type === 'chat' && /^Given|no such/.test(m.text))).text, 'Given Creative Ammo Box * 1 to Bob');
  bob.ws.send(JSON.stringify({ type: 'chat', text: '/give Bob diamond 64' }));
  await bob.next(m => m.type === 'chat' && m.text === 'You do not have permission to use this command');
  alice.ws.send(JSON.stringify({ type: 'chat', text: '/gamemode creative Bob' }));
  assert.match((await alice.next(m => m.type === 'chat' && /game mode/.test(m.text))).text, /Bob's game mode to creative/);
  await bob.next(m => m.type === 'tick' && m.you.mode === 'creative');
  alice.ws.send(JSON.stringify({ type: 'chat', text: '/gamerule keepInventory true' }));
  assert.equal((await alice.next(m => m.type === 'chat' && /rule/.test(m.text))).text, 'Game rule has been updated');
  assert.equal(sim.rules.keepInventory, true);
  alice.ws.send(JSON.stringify({ type: 'chat', text: '/tp Bob 70 12 ~' }));
  assert.match((await alice.next(m => m.type === 'chat' && /Teleported/.test(m.text))).text, /Teleported Bob to 70.50, 12.00/);
  assert.equal(pb.position.x, 70.5);
  alice.ws.send(JSON.stringify({ type: 'chat', text: '/time set night' }));
  await alice.next(m => m.type === 'chat' && /time/.test(m.text));
  assert.equal(sim.time % 24000, 13000);
  bob.ws.send(JSON.stringify({ type: 'chat', text: '/tell Alice hi' }));
  assert.equal((await alice.next(m => m.type === 'chat' && /whispers/.test(m.text))).text, 'Bob whispers to you: hi');
  bob.ws.send(JSON.stringify({ type: 'click', window: 0, seq: 1, clicks: [[9, 0, 0]] }));
  await bob.next(m => m.type === 'tick' && m.you.ack === 1);
  alice.ws.send(JSON.stringify({ type: 'chat', text: '/kick Bob Testing' }));
  assert.equal((await bob.closed).reason, 'Testing');
  await alice.next(m => m.type === 'chat' && m.text === 'Bob left the game');
  alice.ws.close(); await alice.closed;
  await app.save();
  const saved = JSON.parse(await readFile(path.join(dir, 'arena.json'), 'utf8'));
  assert.deepEqual(saved.accounts.map(([account]) => account).sort(), [id(1), id(2)], 'player state is keyed by account ID');
});

test('the profile verifier asks the profile service and maps its answers', async () => {
  const calls = [];
  const v = new ProfileVerifier({ request: async opts => { calls.push(opts); return opts.headers.authorization === 'Bearer good' ? { status: 200, body: JSON.stringify({ account: { id: id(1), name: 'Alice', skin: 'ab', email: 'x' } }) } : { status: 401, body: '{}' }; } });
  assert.deepEqual(await v.verify('good'), { id: id(1), name: 'Alice', skin: 'ab' });
  assert.equal(await v.verify('bad'), null);
  assert.equal(await v.verify('has space'), null);
  assert.equal(calls.length, 2, 'malformed sessions are never sent');
  await assert.rejects(new ProfileVerifier({ request: async () => ({ status: 502, body: '' }) }).verify('good'), /502/);
});

test('a separate config directory holds server.properties and the admin lists; the world saves in the state directory', async t => {
  const state = await mkdtemp(path.join(os.tmpdir(), 'mc-web-guns-state-')), config = await mkdtemp(path.join(os.tmpdir(), 'mc-web-guns-config-'));
  t.after(() => Promise.all([rm(state, { recursive: true, force: true }), rm(config, { recursive: true, force: true })]));
  await writeFile(path.join(config, 'server.properties'), 'motd=From config\nlevel-name=arena\n');
  const app = await createGunsServer({ port: 0, stateDir: state, configDir: config, verifier: fakeVerifier, build: 'test-build', rules, simulation: arena(), tickMs: 10, saveMs: 60000, log: () => {} });
  assert.equal(app.config.motd, 'From config');
  await app.close();
  assert.ok(JSON.parse(await readFile(path.join(state, 'arena.json'), 'utf8')));
  await assert.rejects(readFile(path.join(state, 'server.properties')), { code: 'ENOENT' });
});
