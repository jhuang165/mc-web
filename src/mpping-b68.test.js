// Batch 68 (mpping): keep-alive ping, tab list items, status ping, server list rules, GuiDisconnected. Rules bytecode-read from nh / oi / bjb /
// bfz / bgc / bdf / bdg / bde (see .shared-memory/notes/mpping-b68-track.md); no sockets or browser.
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { createDedicatedServer } from '../server/server.js';
import { PROTOCOL } from './multiplayer/protocol.js';
import assert from 'node:assert/strict';
import { KeepAlive, ServerPings, statusReply, handleStatus, STATUS_VERSION } from './multiplayer/server-ping.js';
import { ClientPings, rowState, pingAnimationRow, pingServer, playersText } from './multiplayer/client-ping.js';
import { pingRow } from './player-list.js';
import { ServerList, addressUrl, validEntry, nextResourceMode, serverListLayout, disconnectedLayout, disconnectHeading, disconnectedScreen, tr, addServerLayout, directLayout } from './multiplayer/server-list-gui.js';

const store = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('keep-alive: sent when ticks - last > 40, ping = (ping*3 + elapsed)/4', () => {
  let t = 1000; const ka = new KeepAlive(() => t);
  const sent = []; for (let i = 1; i <= 82; i++) { const id = ka.tick(); if (id !== null) sent.push(i); }
  assert.deepEqual(sent, [41, 82]);
  assert.equal(ka.ack(12345), false);
  t = 1000; ka.sentAt = 1000; t = 1100; assert.ok(ka.ack(ka.id)); assert.equal(ka.ping, 25);
  ka.sentAt = 1000; t = 1100; ka.ack(ka.id); assert.equal(ka.ping, Math.trunc((25 * 3 + 100) / 4));
});

test('tab list items: join 1000 broadcast, full list to the newcomer, rotation, leave', () => {
  const out = []; const sp = new ServerPings({ send: (id, m) => out.push([id, m]) });
  sp.join('a', 'Alice'); assert.deepEqual(out.splice(0), [['a', { type: 'pingList', items: [{ name: 'Alice', online: true, ping: 0 }] }]]);
  sp.join('b', 'Bob');
  assert.deepEqual(out[0], ['a', { type: 'pingList', items: [{ name: 'Bob', online: true, ping: 1000 }] }]);
  assert.equal(out[1][1].items.length, 2); out.length = 0;
  sp.tick(); // cycle 1: index 1 (Bob) is shown to both
  assert.deepEqual(out.filter(([, m]) => m.type === 'pingList').map(([id, m]) => [id, m.items[0].name]), [['a', 'Bob'], ['b', 'Bob']]);
  out.length = 0; sp.leave('b');
  assert.deepEqual(out, [['a', { type: 'pingList', items: [{ name: 'Bob', online: false, ping: 0 }] }]]);
});

test('client pings: keep-alive answered, S38 add / update / remove', () => {
  const c = new ClientPings(), sent = [];
  assert.ok(c.handle({ type: 'pingKeepAlive', id: 7 }, m => sent.push(m))); assert.deepEqual(sent, [{ type: 'pingKeepAliveAck', id: 7 }]);
  c.handle({ type: 'pingList', items: [{ name: 'A', online: true, ping: 80 }] }, () => {}); assert.equal(c.get('A'), 80);
  c.handle({ type: 'pingList', items: [{ name: 'A', online: false, ping: 0 }] }, () => {}); assert.equal(c.get('A'), 0);
  assert.equal(c.handle({ type: 'tick' }, () => {}), false);
});

test('ping bars: thresholds 0 / 150 / 300 / 600 / 1000', () => {
  assert.deepEqual([-1, 0, 149, 150, 299, 300, 599, 600, 999, 1000].map(pingRow), [5, 0, 0, 1, 1, 2, 2, 3, 3, 4]);
});

test('status reply and the handler', () => {
  const r = statusReply({ motd: 'Hi', online: 2, max: 8, names: ['a', 'b'] });
  assert.deepEqual(r.version, STATUS_VERSION); assert.equal(r.version.protocol, 5); assert.equal(r.version.name, '1.7.10');
  assert.equal(r.players.online, 2); assert.equal(r.description, 'Hi');
  const out = []; assert.ok(handleStatus({ type: 'pingProbe', time: 5 }, m => out.push(m), () => ({}))); assert.deepEqual(out, [{ type: 'pingProbeReply', time: 5 }]);
  assert.equal(handleStatus({ type: 'join' }, () => {}, () => ({})), false);
});

test('row state: pinging, out of date, no connection, ping text', () => {
  assert.equal(rowState({ pinged: false, players: '' }).label, 'Pinging...');
  assert.equal(rowState({ pinged: true, protocol: 6, version: 'x', ping: 5, players: '' }).label, 'Client out of date!');
  assert.equal(rowState({ pinged: true, protocol: 4, version: 'x', ping: 5, players: '' }).label, 'Server out of date!');
  assert.equal(rowState({ pinged: true, protocol: 5, ping: -1, players: '' }).label, '(no connection)');
  const ok = rowState({ pinged: true, protocol: 5, ping: 200, players: 'p' }); assert.equal(ok.label, '200ms'); assert.equal(ok.row, 1);
  assert.equal(playersText({ online: 1, max: 8 }), '§71§8/§78');
  assert.deepEqual([0, 1, 2, 3, 4].map(i => pingAnimationRow(i * 100, 0)), [0, 1, 2, 3, 4]);
  assert.equal(pingAnimationRow(500, 0), 3);
});

test('pingServer round trip against a fake socket, and failure', async () => {
  let now = 1000;
  const ok = pingServer('ws://x', { now: () => now, open: () => { const ws = { send(d) { const m = JSON.parse(d);
    if (m.type === 'pingStatus') setTimeout(() => ws.onmessage({ data: JSON.stringify({ ...statusReply({ motd: 'M', online: 1, max: 8 }) }) }), 0);
    if (m.type === 'pingProbe') { now += 42; setTimeout(() => ws.onmessage({ data: JSON.stringify({ type: 'pingProbeReply', time: m.time }) }), 0); } }, close() {} }; setTimeout(() => ws.onopen(), 0); return ws; } });
  const s = await ok; assert.equal(s.ping, 42); assert.equal(s.motd, 'M'); assert.equal(s.protocol, 5);
  const bad = await pingServer('ws://x', { open: () => { const ws = { send() {}, close() {} }; setTimeout(() => ws.onerror(), 0); return ws; } });
  assert.equal(bad.ping, -1); assert.equal(bad.motd, "§4Can't connect to server.");
});

test('server list storage, addresses and the Edit screen rules', () => {
  const s = store(), a = new ServerList(s); assert.equal(a.entries.length, 1);
  a.add({ name: 'N', ip: 'example.org:1234' }); a.remove(0);
  const b = new ServerList(s); assert.deepEqual(b.entries, [{ name: 'N', ip: 'example.org:1234', acceptTextures: null }]);
  assert.equal(addressUrl('example.org'), 'wss://example.org/multiplayer'); assert.equal(addressUrl('localhost:8089'), 'ws://localhost:8089/multiplayer'); assert.equal(addressUrl('wss://h/p'), 'wss://h/p');
  assert.ok(!validEntry('', 'x') && !validEntry('x', ' ') && validEntry('a', 'b'));
  assert.deepEqual(['enabled', 'disabled', 'prompt'].map(m => nextResourceMode({ enabled: true, disabled: false, prompt: null }[m])), ['disabled', 'prompt', 'enabled']);
});

test('native layouts from bytecode', () => {
  const L = serverListLayout(320, 240), c = 160;
  assert.deepEqual(L.buttons.edit, { x: c - 154, y: 212, w: 70, h: 20 }); assert.deepEqual(L.buttons.add, { x: c + 54, y: 188, w: 100, h: 20 });
  assert.deepEqual(L.buttons.cancel, { x: c + 80, y: 212, w: 75, h: 20 }); assert.equal(L.list.bottom, 176); assert.equal(L.list.width, 305);
  assert.equal(addServerLayout(320, 240).buttons.done.y, 60 + 96 + 18); assert.equal(directLayout(320, 240).ip.y, 116);
  assert.deepEqual(disconnectedLayout(320, 240).button, { x: 60, y: 60 + 120 + 12, w: 200, h: 20 });
});

test('GuiDisconnected: heading by phase, lang strings, one button to the parent', () => {
  assert.equal(tr(disconnectHeading(true)), 'Connection Lost'); assert.equal(tr(disconnectHeading(false)), 'Failed to connect to the server');
  assert.equal(tr('gui.toMenu'), 'Back to title screen'); assert.equal(tr('selectServer.title'), 'Select Server');
  const calls = []; let back = 0;
  const g = { text: (s, x, y, o) => calls.push(['text', s, x, y, o?.color]), button: (r, label, fn) => { calls.push(['button', label]); fn(); } };
  disconnectedScreen({ headingKey: 'disconnect.lost', message: 'Bye', back: () => back++ }).init(g, 320, 240);
  assert.deepEqual(calls[0], ['text', 'Connection Lost', 160, 70, 0xaaaaaa]); assert.deepEqual(calls[1], ['text', 'Bye', 160, 90, undefined]);
  assert.deepEqual(calls[2], ['button', 'Back to title screen']); assert.equal(back, 1);
});

test('live server: status and probe before login, keep-alive and S38 after', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-ping-')), token = 'test-only-not-a-deployed-server-key';
  const world = new World('ping-b68'); world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, 'w.json'), simulation: new DedicatedSimulation({}, { world, mobs: false }), motd: 'Hello ping', tickMs: 5, saveMs: 60000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const open = async () => { const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin: 'http://localhost:5179' }); const got = []; ws.on('message', d => got.push(JSON.parse(d))); await once(ws, 'open'); return { ws, got }; };
  const until = async (got, f) => { for (let i = 0; i < 400; i++) { const m = got.find(f); if (m) return m; await new Promise(r => setTimeout(r, 10)); } throw new Error('timeout'); };
  const status = await open(); status.ws.send(JSON.stringify({ type: 'pingStatus' })); status.ws.send(JSON.stringify({ type: 'pingProbe', time: 77 }));
  const reply = await until(status.got, m => m.type === 'pingStatusReply');
  assert.equal(reply.description, 'Hello ping'); assert.equal(reply.version.protocol, 5); assert.equal(reply.players.online, 0);
  assert.equal((await until(status.got, m => m.type === 'pingProbeReply')).time, 77); status.ws.close();
  const session = (await app.accounts.register({ invite: token, name: 'Ping', password: 'correct horse' }, token)).session;
  const c = await open(); c.ws.send(JSON.stringify({ type: 'join', protocol: PROTOCOL, session }));
  await until(c.got, m => m.type === 'welcome');
  assert.deepEqual((await until(c.got, m => m.type === 'pingList')).items, [{ name: 'Ping', online: true, ping: 0 }]);
  const ka = await until(c.got, m => m.type === 'pingKeepAlive'); c.ws.send(JSON.stringify({ type: 'pingKeepAliveAck', id: ka.id }));
  await new Promise(r => setTimeout(r, 50)); assert.ok(app.simulation.players.size === 1);
  c.ws.close();
});
