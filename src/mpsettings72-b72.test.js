// Batch 72 (mpsettings): C15PacketClientSettings on the dedicated server. Rules bytecode-read from iu / mw / nh (see mpsettings72-b72-track.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { createDedicatedServer } from '../server/server.js';
import { PROTOCOL } from './multiplayer/protocol.js';
import { clientSettingsMessage, applyClientSettings, chatDelivered, chatSendAllowed } from './multiplayer/server-settings.js';
import { chatDelivered as clientDelivered } from './chat.js';

const ok = { type: 'settingsClient', language: 'en_US', view: 8, chat: 0, colours: true, difficulty: 2, cape: true };

test('client message carries all six C15 fields from the options', () => {
  assert.deepEqual(clientSettingsMessage({ language: 'de_DE', distance: 12, chatVisibility: 1, chatColors: false, difficulty: 3, showCape: false }),
    { type: 'settingsClient', language: 'de_DE', view: 12, chat: 1, colours: false, difficulty: 3, cape: false });
  assert.deepEqual(clientSettingsMessage({}), { ...ok, view: 0 });
});

test('server stores the fields and the cape flag; bad values are refused', () => {
  const p = {};
  assert.ok(applyClientSettings(p, { ...ok, chat: 4, difficulty: 5, cape: false }));
  assert.deepEqual(p.clientSettings, { language: 'en_US', viewDistance: 8, chatVisibility: 1, chatColours: true, difficulty: 1 }); // id % 3, id % 4
  assert.equal(p.hideCape, true);
  for (const bad of [{ language: 'toolong8' }, { chat: -1 }, { view: 1.5 }, { colours: 1 }, { cape: 'x' }]) assert.equal(applyClientSettings({}, { ...ok, ...bad }), false);
});

test('chat filter: FULL all, SYSTEM only lines without a sender, HIDDEN none; HIDDEN cannot send', () => {
  const at = chat => { const p = {}; applyClientSettings(p, { ...ok, chat }); return p; };
  const player = { type: 'chat', name: 'Bo', text: 'hi' }, system = { type: 'chat', name: '', text: 'Bo joined the game' };
  assert.deepEqual([0, 1, 2].map(v => [chatDelivered(at(v), player), chatDelivered(at(v), system)]), [[true, true], [false, true], [false, false]]);
  assert.deepEqual([0, 1, 2].map(v => chatSendAllowed(at(v))), [true, true, false]);
  assert.equal(chatDelivered(undefined, player), true);
  for (const v of [0, 1, 2]) assert.equal(clientDelivered(v, true), chatDelivered(at(v), system)); // single player uses the same rule
});

test('live server: one player hides chat, the other keeps hearing and talking', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-settings-')), token = 'test-only-not-a-deployed-server-key';
  const world = new World('settings-b72'); world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, 'w.json'), simulation: new DedicatedSimulation({}, { world, mobs: false }), tickMs: 5, saveMs: 60000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const join = async name => {
    const session = (await app.accounts.register({ invite: token, name, password: 'correct horse' }, token)).session;
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin: 'http://localhost:5179' }); const got = []; ws.on('message', d => got.push(JSON.parse(d)));
    await once(ws, 'open'); ws.send(JSON.stringify({ type: 'join', protocol: PROTOCOL, session }));
    for (let i = 0; i < 400 && !got.some(m => m.type === 'welcome'); i++) await new Promise(r => setTimeout(r, 10));
    return { ws, got, say: m => ws.send(JSON.stringify(m)) };
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const lines = c => c.got.filter(m => m.type === 'chat').map(m => m.text);
  const a = await join('Anna'), b = await join('Bert');
  b.say({ ...ok, chat: 2 }); await wait(60);
  a.say({ type: 'chat', text: 'hello all' }); await wait(80);
  assert.ok(lines(a).includes('<Anna> hello all') || lines(a).some(l => l.includes('hello all')), 'Anna hears herself');
  assert.ok(!lines(b).some(l => l.includes('hello all')), 'Bert (hidden) hears nothing');
  b.say({ type: 'chat', text: 'secret' }); await wait(80);
  assert.ok(!lines(a).some(l => l.includes('secret')), 'a hidden player cannot send chat');
  b.say({ ...ok, chat: 0 }); await wait(60);
  b.say({ type: 'chat', text: 'back again' }); await wait(80);
  assert.ok(lines(a).some(l => l.includes('back again')) && lines(b).some(l => l.includes('back again')));
  b.say({ ...ok, chat: 1 }); await wait(60);
  a.say({ type: 'chat', text: 'second line' }); await wait(80);
  assert.ok(!lines(b).some(l => l.includes('second line')), 'SYSTEM hides player chat');
  b.say({ ...ok, language: 'waytoolong' }); await wait(80);
  assert.ok(b.got.some(m => m.type === 'error'), 'a malformed message is refused');
  a.ws.close(); b.ws.close();
});
