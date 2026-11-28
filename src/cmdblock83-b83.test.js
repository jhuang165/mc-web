// Batch 83 cmdblock83: a command block's LastOutput and the client's view of it.
// - ServerCommandManager.func_152372_a (bl.a, bytecode-read): flag bit 0 (only CommandGameMode passes 1) skips the sender's addChatMessage, so /gamemode from a block or cart
//   leaves the previous LastOutput; the ops still get chat.type.admin. The target's "gameMode.changed" (S2B state 3) goes to the target, not into LastOutput.
// - CommandBase.getCommandSenderAsPlayer (y.b, bytecode-read) throws PlayerNotFoundException("You must specify which player you wish to perform this action on.") for a block.
// - The client comparator prediction reads the client tile's SuccessCount (akb.g: agp.g()).
// - GuiCommandBlock (bfh.b, bytecode-read) fills Previous Output with the command, then with LastOutput's unformatted text when there is one.
// Notes: .shared-memory/notes/cmdblock83-b83-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { Survival } from './survival.js';
import { createCommandHost } from './command-host.js';
import { createCommandRunner } from './commands.js';
import { commandBlockSender, newCommandBlock, COMMAND_BLOCK, installCommandBlocks } from './command-block.js';
import { lastOutputPlainText } from './chat-component.js';
import { fromOriginal } from './block-registry.js';
import { clientComparatorReadings } from './client-comparator.js';
import { commandBlockScreen } from './command-block-screen.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { ServerSocial } from './server-broadcast.js';
import { RedstoneWorld } from './redstone.js';

const LITERAL = 'You must specify which player you wish to perform this action on.';
const NOW = () => new Date(2026, 10, 18, 9, 8, 7);

function spGame() {
  const world = new World('cmdblock83', 'meadow', 1), survival = new Survival({}, 'survival'), active = { mode: 'survival', allowCommands: true }, lines = [];
  const host = createCommandHost({ active: () => active, world: () => world, survival: () => survival, position: () => ({ x: 30.5, y: 60, z: 30.5 }), commandTile: () => null,
    changed() {}, updateBlock() {}, refreshInventory() {}, stackName: () => 'diamond', giveDrop: (s) => survival.inventory.add(s), setTime() {}, destroyBlock() {}, setMode: (m) => { survival.mode = m; } });
  host.print = (text, component) => lines.push({ text, component });
  return { world, survival, active, host, lines };
}
const parsed = (tile) => JSON.parse(tile.lastOutput);

test('single player: /gamemode from a block keeps the previous LastOutput; the player gets gameMode.changed and the admin line', () => {
  const g = spGame(), tile = newCommandBlock(), sender = commandBlockSender(g.host, tile, { x: 10, y: 60, z: 10 }, { now: NOW }), run = createCommandRunner(sender);
  run.count('time set 5');
  const before = tile.lastOutput;
  assert.match(lastOutputPlainText(before), /Set the time to 5/);
  g.lines.length = 0;
  assert.equal(run.count('gamemode 1 @p'), 1);
  assert.equal(g.survival.mode, 'creative');
  assert.equal(tile.lastOutput, before, 'flag 1: no addChatMessage on the block (before b83 it held commands.gamemode.success.other)');
  const texts = g.lines.map((l) => l.text);
  assert.ok(texts.includes('Your game mode has been updated'), 'the target sees gameMode.changed');
  assert.ok(texts.some((t) => /^§7§o\[@: /.test(t)), 'ops still get chat.type.admin');
  // A fresh block with no output keeps null.
  const fresh = newCommandBlock(), s2 = commandBlockSender(g.host, fresh, { x: 0, y: 0, z: 0 }, { now: NOW });
  createCommandRunner(s2).count('gamemode 0 @p');
  assert.equal(fresh.lastOutput, null);
  // Another flag-0 notify still records.
  createCommandRunner(s2).count('time set 9');
  assert.match(lastOutputPlainText(fresh.lastOutput), /Set the time to 9/);
});

test('getCommandSenderAsPlayer on a block: the native literal for each of its callers', () => {
  const g = spGame();
  for (const command of ['gamemode 1', 'kill', 'tp 1 2 3', 'tp @p', 'setworldspawn', 'spawnpoint', 'xp 5', 'clear', 'achievement give *']) {
    const tile = newCommandBlock(), sender = commandBlockSender(g.host, tile, { x: 10, y: 60, z: 10 }, { now: NOW });
    assert.equal(createCommandRunner(sender).count(command), 0, command);
    const out = parsed(tile);
    assert.equal(out.text, '[09:08:07] ');
    assert.deepEqual(out.extra, [{ color: 'red', translate: LITERAL }], command);
    assert.equal(lastOutputPlainText(tile.lastOutput), '[09:08:07] ' + LITERAL);
  }
  // A named target that is not online is still commands.generic.player.notFound (CommandBase.getPlayer).
  const tile = newCommandBlock();
  createCommandRunner(commandBlockSender(g.host, tile, { x: 0, y: 0, z: 0 }, { now: NOW })).count('gamemode 1 Nobody');
  assert.equal(parsed(tile).extra[0].translate, 'commands.generic.player.notFound');
});

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function server() {
  const world = new World('cmdblock83-mp');
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) for (let y = 9; y <= 14; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false, commandBlocks: true });
  const got = [];
  const social = new ServerSocial({ simulation: s, ops: ['alicex'], deliver: (id, m) => got.push({ id, m }) });
  const join = (id, name, n, x) => { const p = s.addPlayer(id, name, key(n)); p.position.copy({ x, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input(id, { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) }); return p; };
  join('a', 'alicex', 1, 64.5); join('b', 'bobx', 2, 70.5);
  return { s, social, got };
}
const ticks = (s, social, n) => { for (let i = 0; i < n; i++) { s.tick(); social.drain(); } };
const said = (got, id) => got.filter((e) => e.id === id).map((e) => JSON.stringify(e.m));

test('server block: /gamemode keeps LastOutput, the target hears gameMode.changed, the op the admin line; no-target commands give the literal', () => {
  const { s, social, got } = server();
  s.world.put(60, 10, 60, COMMAND_BLOCK, 0, false);
  const tile = s.tileEntities.commandBlocks.tile(60, 10, 60);
  const fire = (command) => { s.redstone.setBlock(61, 10, 60, 0, 0, 3); ticks(s, social, 1); tile.command = command; got.length = 0; s.redstone.setBlock(61, 10, 60, 152, 0, 3); ticks(s, social, 2); return tile.successCount; };
  assert.equal(fire('gamemode 1'), 0);
  assert.equal(JSON.parse(tile.lastOutput).extra[0].translate, LITERAL);
  const before = tile.lastOutput;
  for (const command of ['gamemode 1 alicex', 'gamemode 2 bobx', 'gamemode 0 @a']) {
    assert.ok(fire(command) >= 1, command);
    assert.equal(tile.lastOutput, before, command + ': LastOutput unchanged');
  }
  assert.equal(s.players.get('a').survival.mode, 'survival');
  fire('gamemode 2 alicex');
  assert.ok(said(got, 'a').some((m) => m.includes('"setGameMode"')) && !said(got, 'a').some((m) => m.includes('gameMode.changed')), 'b102: the base player gets S2B reason 3 (its client prints gameMode.changed), no chat line');
  assert.ok(said(got, 'a').some((m) => m.includes('chat.type.admin') && m.includes('commands.gamemode.success.other')), 'the op gets the admin line');
  assert.ok(!said(got, 'b').some((m) => m.includes('gameMode.changed')));
  fire('gamemode 1 bobx');
  assert.ok(said(got, 'b').some((m) => m.includes('"setGameMode"')) && !said(got, 'b').some((m) => m.includes('gameMode.changed')), 'b102: a redirected target gets the S2B too');
  assert.equal(tile.lastOutput, before);
});

test('client comparator prediction reads the synced SuccessCount of a command block behind it', () => {
  const w = new World('cmdblock83-cc');
  for (let x = 2; x <= 10; x++) for (let z = 2; z <= 10; z++) { for (let y = 20; y <= 24; y++) w.set(x, y, z, 0, false, 0); w.set(x, 19, z, 1, false, 0); }
  w.set(5, 20, 6, COMMAND_BLOCK, false, 0);
  const counts = { '5,20,6': 7 }, hooks = { successCount: (x, y, z) => counts[`${x},${y},${z}`] ?? 0 };
  const inputs = [0, 1, 2, 3].map((d) => {
    const c = fromOriginal(149, d);
    w.set(5, 20, 5, c.id, false, c.meta);
    return clientComparatorReadings(w, 5, 20, 5, hooks).input;
  });
  assert.deepEqual(inputs.slice().sort(), [0, 0, 0, 7], 'the comparator facing away from the block reads its count (0 before b83)');
  const d = inputs.indexOf(7), c = fromOriginal(149, d);
  w.set(5, 20, 5, c.id, false, c.meta);
  counts['5,20,6'] = 20;
  assert.equal(clientComparatorReadings(w, 5, 20, 5, hooks).input, 20, 'unclamped, as akb.g');
  assert.equal(clientComparatorReadings(w, 5, 20, 5, {}).input, 0, 'no client tile: 0');
});

test('installCommandBlocks.get reads without creating a tile', () => {
  const r = new RedstoneWorld({ seed: 0, log: false }), blocks = installCommandBlocks(r, { host: () => ({}) });
  assert.equal(blocks.get(1, 2, 3), null);
  blocks.tile(1, 2, 3).successCount = 4;
  assert.equal(blocks.get(1, 2, 3).successCount, 4);
});

test('GuiCommandBlock Previous Output: the command when LastOutput is null, else its unformatted text', () => {
  const show = (opts) => {
    const fields = [], texts = [];
    const g = { text: (s) => texts.push(s), field: (_, o) => { fields.push(o); return { el: {}, value: o.value }; }, button: () => ({ enable() {} }) };
    commandBlockScreen({ done() {}, cancel() {}, ...opts }).init(g, 427, 240);
    return { output: fields.find((f) => f.enabled === false)?.value ?? null, label: texts.includes('Previous Output') };
  };
  assert.deepEqual(show({ command: 'say hi', lastOutput: null }), { output: 'say hi', label: true }, 'bfh.b: g.a(agp.i()) when agp.h() is null');
  assert.deepEqual(show({ command: '', lastOutput: null }), { output: null, label: false }, 'an empty field draws no label or field');
  assert.deepEqual(show({ command: 'say hi', lastOutput: '{"extra":["done"],"text":"[01:02:03] "}' }), { output: '[01:02:03] done', label: true });
});
