import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_PROPERTIES, DEFAULT_CONFIG, parseProperties, readServerConfig, formatReport, stringifyProperties, AdminLists, loadServerFiles }
  from '../server/properties.js';

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mc-props-'));
const write = (dir, file, value) => fs.writeFileSync(path.join(dir, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
const readJson = (dir, file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const statusOf = (report, key) => report.find(e => e.key === key)?.status;
const config = text => readServerConfig(parseProperties(text));

// A server.properties as written by a 1.7.10 dedicated server, edited by its host and carried over from 1.6.
const VANILLA = `#Minecraft server properties
#Sat Nov 08 12:00:00 UTC 2026
generator-settings=
op-permission-level=4
allow-nether=true
level-name=world
enable-query=false
allow-flight=false
announce-player-achievements=true
server-port=25565
rcon.port=25575
level-type=DEFAULT
enable-rcon=true
force-gamemode=false
level-seed=-4172144997902289642
server-ip=
max-build-height=256
spawn-npcs=true
white-list=false
spawn-animals=true
hardcore=false
snooper-enabled=true
texture-pack=
online-mode=false
resource-pack=
pvp=true
difficulty=1
enable-command-block=false
gamemode=0
player-idle-timeout=0
max-players=50
spawn-monsters=true
rcon.password=hunter2
generate-structures=true
view-distance=10
spawn-protection=16
motd=A Minecraft Server
`;

test('parseProperties follows java.util.Properties.load', () => {
  const text = [
    '# comment', '   ! bang comment', '', '  \t  ',
    'colon:value', 'spaced   value with  spaces  ', 'equals = padded', 'colonSpaced : x', 'a==b', 'c = = d', 'e :=f',
    'keyonly', 'empty=', 'esc\\=key\\:x\\ y=v', 'tabs=a\\tb\\nc\\rd\\fe\\\\f\\qg',
    'unicode=caf\\u00e9 \\u00A7a', 'multi=one, \\', '    two, \\', '\t three', 'evenslash=end\\\\', 'next=after-even',
    '# comment continues? \\', 'notcont=yes', 'blankcont=x\\', '', 'afterblank=1',
    'cont-hash=x\\', '  # not a comment', 'dup=first', 'dup=second', '__proto__=inert', '\f  leading=ws',
  ].join('\r\n') + '\nlast=trailing\\';
  const p = parseProperties(text);
  assert.deepEqual(p, {
    colon: 'value', spaced: 'value with  spaces  ', equals: 'padded', colonSpaced: 'x', a: '=b', c: '= d', e: '=f',
    keyonly: '', empty: '', 'esc=key:x y': 'v', tabs: 'a\tb\nc\rd\fe\\fqg', unicode: 'café §a', multi: 'one, two, three',
    evenslash: 'end\\', next: 'after-even', notcont: 'yes', blankcont: 'x', afterblank: '1', 'cont-hash': 'x# not a comment',
    dup: 'second', ['__proto__']: 'inert', leading: 'ws', last: 'trailing',
  });
  assert.equal(Object.getPrototypeOf(p), Object.prototype);
  assert.equal(Object.keys(p).indexOf('dup') < Object.keys(p).indexOf('leading'), true, 'duplicates keep the first position');
  assert.throws(() => parseProperties('ok=1\nbad=\\u00zz'), { name: 'SyntaxError', message: /line 2/ });
  assert.throws(() => parseProperties('bad=\\u12'), SyntaxError);
});

test('stringifyProperties escapes like Properties.store and round-trips', () => {
  const values = { 'z key': ' lead and trail ', a: 'x=y:z#!\\', motd: '§6Gold\tTab\nLine é ☃ 😀', empty: '', n: 5, t: true };
  const out = stringifyProperties(values, 'Header line\n#already a comment\nsecond');
  assert.deepEqual(out.split('\n').slice(0, 3), ['#Header line', '#already a comment', '#second']);
  assert.match(out, /^z\\ key=\\ lead and trail $/m);
  assert.match(out, /^a=x\\=y\\:z\\#\\!\\\\$/m);
  assert.match(out, /^motd=\\u00A76Gold\\tTab\\nLine \\u00E9 \\u2603 \\uD83D\\uDE00$/m);
  assert.ok(/^[\x00-\x7f]*$/.test(out), 'output is ASCII');
  const keys = out.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('=')[0]);
  assert.deepEqual(keys, [...keys].sort());
  assert.deepEqual(parseProperties(out), { ...values, n: '5', t: 'true' });
});

test('DEFAULT_PROPERTIES is the starting template and parses to the defaults', () => {
  const { config: c, report } = config(DEFAULT_PROPERTIES);
  assert.deepEqual(c, DEFAULT_CONFIG);
  assert.equal(c.motd, 'ledoge0 Survival - CS2 Unified');
  assert.deepEqual([...new Set(report.map(e => e.status))].sort(), ['applied', 'deferred']);
  assert.equal(report.length, Object.keys(DEFAULT_CONFIG).length);
  assert.equal(readServerConfig({}).report.length, 0, 'absent keys produce no entries');
});

test('gamemode and difficulty accept 1.7.10 numbers and names', () => {
  for (const [value, mode] of [['0', 'survival'], ['1', 'creative'], ['2', 'adventure'], ['Survival', 'survival'], ['CREATIVE', 'creative'], [' adventure ', 'adventure']]) {
    const { config: c, report } = config('gamemode=' + value);
    assert.equal(c.gamemode, mode, value); assert.equal(report[0].status, 'applied');
  }
  for (const [value, level] of [['0', 0], ['3', 3], ['peaceful', 0], ['Easy', 1], ['normal', 2], ['HARD', 3]])
    assert.equal(config('difficulty=' + value).config.difficulty, level, value);
  for (const value of ['3', 'spectator', 'Spectator', 'x', 'constructor']) {
    const { config: c, report } = config('gamemode=' + value);
    assert.equal(c.gamemode, 'survival'); assert.equal(report[0].status, 'invalid');
    assert.match(report[0].note, /no spectator mode/);
  }
  const bad = config('difficulty=4\nlevel-type=default_1_1');
  assert.equal(bad.config.difficulty, 2); assert.equal(bad.config.levelType, 'DEFAULT');
  assert.deepEqual(bad.report.map(e => e.status), ['invalid', 'invalid']);
  assert.equal(config('level-type=largeBiomes').config.levelType, 'LARGEBIOMES');
});

test('ranges clamp, malformed values keep defaults, and text values are validated', () => {
  const cases = [
    ['max-players=50', 'maxPlayers', 20], ['max-players=0', 'maxPlayers', 1], ['spawn-protection=-1', 'spawnProtection', 0],
    ['spawn-protection=999', 'spawnProtection', 256], ['view-distance=32', 'viewDistance', 15], ['view-distance=1', 'viewDistance', 3],
    ['op-permission-level=0', 'opPermissionLevel', 1], ['op-permission-level=9', 'opPermissionLevel', 4], ['max-build-height=250', 'maxBuildHeight', 256],
    ['max-build-height=1000', 'maxBuildHeight', 256], ['max-build-height=10', 'maxBuildHeight', 64],
  ];
  for (const [line, prop, value] of cases) {
    const { config: c, report } = config(line);
    assert.equal(c[prop], value, line); assert.equal(report[0].status, 'invalid', line); assert.match(report[0].note, /clamped|using/, line);
  }
  for (const line of ['max-players=many', 'max-players=1.5', 'max-players=99999999999', 'pvp=yes', 'pvp=1', 'white-list=', 'level-name=../escape', 'level-name=..', 'level-name=my world']) {
    const { config: c, report } = config(line);
    assert.deepEqual(c, DEFAULT_CONFIG, line); assert.equal(report[0].status, 'invalid', line); assert.match(report[0].note, /using default/, line);
  }
  const ok = config('max-players=+12\npvp=FALSE\nwhite-list=False\nplayer-idle-timeout=30\nlevel-name=arena_2.v-1\nlevel-seed= spaced seed\nmax-build-height=128');
  assert.equal(ok.config.maxPlayers, 12); assert.equal(ok.config.pvp, false); assert.equal(ok.config.whitelist, false);
  assert.equal(ok.config.idleTimeout, 30); assert.equal(ok.config.levelName, 'arena_2.v-1'); assert.equal(ok.config.maxBuildHeight, 128);
  assert.equal(ok.config.levelSeed, 'spaced seed', 'only whitespace around the separator is trimmed');
  assert.ok(ok.report.every(e => e.status !== 'invalid'));
  const long = config('motd=' + 'x'.repeat(120));
  assert.equal(long.config.motd, 'x'.repeat(100)); assert.equal(long.report[0].status, 'invalid');
});

test('a vanilla 1.7.10 server.properties yields every report class and never leaks the RCON password', () => {
  const { config: c, report } = config(VANILLA);
  assert.deepEqual([...new Set(report.map(e => e.status))].sort(), ['applied', 'deferred', 'ignored', 'invalid', 'unknown', 'unsupported']);
  assert.equal(report.length, Object.keys(parseProperties(VANILLA)).length, 'one entry per key in the file');
  const status = key => statusOf(report, key);
  assert.equal(status('motd'), 'applied'); assert.equal(c.motd, 'A Minecraft Server');
  assert.equal(status('white-list'), 'applied'); assert.equal(c.whitelist, false);
  assert.equal(c.difficulty, 1); assert.equal(c.levelName, 'world'); assert.equal(c.levelSeed, '-4172144997902289642');
  assert.equal(status('view-distance'), 'deferred'); assert.equal(c.viewDistance, 10);
  assert.equal(report.find(e => e.key === 'hardcore').note, 'parsed; takes effect with full Survival world authority');
  assert.equal(status('max-players'), 'invalid'); assert.equal(c.maxPlayers, 20);
  assert.equal(status('online-mode'), 'ignored');
  assert.match(report.find(e => e.key === 'online-mode').note, /website account sessions are always required/);
  for (const key of ['server-port', 'server-ip', 'snooper-enabled', 'resource-pack', 'rcon.port', 'rcon.password', 'enable-query']) assert.equal(status(key), 'ignored', key);
  assert.equal(status('enable-rcon'), 'unsupported');
  assert.equal(status('texture-pack'), 'unknown');
  assert.equal(c.enforceWhitelist, true, 'keys absent from the file keep this server\'s defaults');
  const lines = formatReport(report);
  assert.ok(lines.includes('unsupported enable-rcon=true: RCON is not implemented'));
  assert.ok(lines.includes('ignored rcon.password=<redacted>: RCON is not implemented'));
  assert.ok(!JSON.stringify(report).includes('hunter2'));
  assert.ok(!lines.join('\n').includes('hunter2'));
  // formatReport redacts on its own too, and keeps control characters out of log lines.
  const extra = formatReport([{ key: 'my-secret', value: 'leak', status: 'unknown', note: '' }, { key: 'motd', value: 'a\nb', status: 'applied', note: '' }]);
  assert.deepEqual(extra, ['unknown my-secret=<redacted>', 'applied motd=a\\u000ab']);
  assert.equal(readServerConfig({ 'enable-rcon': 'false', 'enable-query': 'true', 'some-api-token': 'abc' }).report
    .map(e => `${e.status}:${e.value}`).join(), 'ignored:false,unsupported:true,unknown:<redacted>');
});

test('loadServerFiles uses defaults for a missing file and writes the template only when asked', async () => {
  const dir = tempDir();
  const first = await loadServerFiles(dir);
  assert.equal(first.propertiesFound, false); assert.deepEqual(first.config, DEFAULT_CONFIG); assert.deepEqual(first.report, []);
  assert.ok(!fs.existsSync(path.join(dir, 'server.properties')));
  assert.ok(first.admin instanceof AdminLists); assert.deepEqual(first.admin.whitelistEntries(), []);
  const written = await loadServerFiles(dir, { writeDefaults: true });
  assert.equal(written.propertiesFound, false);
  const file = path.join(dir, 'server.properties');
  assert.equal(fs.readFileSync(file, 'utf8'), DEFAULT_PROPERTIES);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  const again = await loadServerFiles(dir, { writeDefaults: true });
  assert.equal(again.propertiesFound, true); assert.deepEqual(again.config, DEFAULT_CONFIG);
  assert.ok(again.report.every(e => e.status === 'applied' || e.status === 'deferred'));
});

test('loadServerFiles merges admin reports and keeps a malformed server.properties untouched', async () => {
  const dir = tempDir();
  write(dir, 'server.properties', VANILLA);
  write(dir, 'banned-ips.json', [{ ip: '203.0.113.9', created: '2026-11-08 12:00:00 +0000', source: 'Server', expires: 'forever', reason: 'x' }]);
  write(dir, 'ops.json', [{ uuid: randomUUID(), name: 'Owner' }]);
  const loaded = await loadServerFiles(dir, { writeDefaults: true });
  assert.equal(loaded.config.maxPlayers, 20);
  assert.equal(statusOf(loaded.report, 'banned-ips.json'), 'unsupported');
  assert.equal(loaded.admin.opEntries()[0].level, 4, 'missing op level uses op-permission-level');
  const broken = tempDir(), bad = 'motd=fine\nlevel-name=\\u12zz\n';
  write(broken, 'server.properties', bad);
  const result = await loadServerFiles(broken, { writeDefaults: true });
  assert.equal(result.propertiesFound, true); assert.deepEqual(result.config, DEFAULT_CONFIG);
  assert.deepEqual(result.report.map(e => [e.key, e.status]), [['server.properties', 'invalid']]);
  assert.equal(fs.readFileSync(path.join(broken, 'server.properties'), 'utf8'), bad);
  const latin = tempDir();
  fs.writeFileSync(path.join(latin, 'server.properties'), Buffer.from('motd=\xa7aGreen caf\xe9\n', 'latin1'));
  assert.equal((await loadServerFiles(latin)).config.motd, '§aGreen café');
});

test('identity-map translates Java uuids; name-only entries are reported and never matched', async () => {
  const dir = tempDir(), java = randomUUID(), account = randomUUID(), direct = randomUUID(), opAccount = randomUUID();
  const mapping = JSON.stringify({ [java.toUpperCase()]: account, 'not-a-uuid': direct }, null, 2);
  write(dir, 'identity-map.json', mapping);
  write(dir, 'whitelist.json', [{ uuid: java, name: 'Alex' }, { uuid: direct, name: 'Steve' }, { name: 'NameOnly' }, 'junk']);
  write(dir, 'ops.json', [{ uuid: opAccount.replaceAll('-', ''), name: 'Owner', level: 3, bypassesPlayerLimit: true }, { uuid: direct, name: 'Steve', level: 9 }]);
  const lists = await new AdminLists(dir).load();
  assert.ok(lists.whitelisted(account)); assert.ok(lists.whitelisted(java), 'a mapped uuid resolves to its account');
  assert.ok(lists.whitelisted(direct)); assert.ok(!lists.whitelisted(randomUUID())); assert.ok(!lists.whitelisted('NameOnly'));
  assert.ok(!lists.whitelistEntries().some(e => e.name === 'NameOnly'));
  const unresolved = lists.report.find(e => e.key === 'whitelist.json[2]');
  assert.equal(unresolved.status, 'invalid'); assert.equal(unresolved.value, 'NameOnly'); assert.match(unresolved.note, /^unresolved/);
  assert.equal(statusOf(lists.report, 'whitelist.json[3]'), 'invalid');
  assert.equal(statusOf(lists.report, 'identity-map.json[not-a-uuid]'), 'invalid');
  assert.equal(lists.opLevel(opAccount), 3); assert.equal(lists.opLevel(direct), 4); assert.equal(lists.opLevel(account), 0);
  assert.equal(statusOf(lists.report, 'ops.json[1]'), 'invalid');
  assert.equal(lists.opEntries()[0].bypassesPlayerLimit, true);
  // Nothing changed: save writes nothing, so the name-only entry stays in the file.
  const before = fs.readFileSync(path.join(dir, 'whitelist.json'), 'utf8');
  await lists.save();
  assert.equal(fs.readFileSync(path.join(dir, 'whitelist.json'), 'utf8'), before);
  assert.equal(lists.addWhitelist({ id: direct, name: 'Steve' }), false, 'identical entry is not a change');
  const newcomer = randomUUID();
  assert.equal(lists.addWhitelist({ id: newcomer, name: 'Newcomer' }), true);
  assert.equal(lists.addOp({ id: opAccount, name: 'Owner' }, 4), true);
  await lists.save();
  assert.deepEqual(readJson(dir, 'whitelist.json'), [{ uuid: account, name: 'Alex' }, { uuid: direct, name: 'Steve' }, { uuid: newcomer, name: 'Newcomer' }]);
  assert.deepEqual(readJson(dir, 'ops.json')[0], { uuid: opAccount, name: 'Owner', level: 4, bypassesPlayerLimit: true });
  assert.equal(fs.readFileSync(path.join(dir, 'identity-map.json'), 'utf8'), mapping);
  assert.match(fs.readFileSync(path.join(dir, 'whitelist.json'), 'utf8'), /^\[\n  \{\n    "uuid"/);
});

test('admin commands: removal by id or case-insensitive name, op levels, pardon', async () => {
  const dir = tempDir(), a = randomUUID(), b = randomUUID();
  const lists = await new AdminLists(dir).load();
  lists.addWhitelist({ id: a, name: 'Alex' }); lists.addWhitelist({ id: b, name: 'Bob' });
  assert.equal(lists.removeWhitelist('alex'), true); assert.equal(lists.removeWhitelist('alex'), false);
  assert.equal(lists.removeWhitelist(b.toUpperCase()), true); assert.deepEqual(lists.whitelistEntries(), []);
  lists.addOp({ id: a, name: 'Alex' });
  assert.equal(lists.opLevel(a), 4);
  assert.throws(() => lists.addOp({ id: a, name: 'Alex' }, 5), RangeError);
  assert.throws(() => lists.addWhitelist({ name: 'NoId' }), TypeError);
  assert.equal(lists.removeOp('ALEX'), true); assert.equal(lists.opLevel(a), 0);
  lists.addBan({ id: b, name: 'Bob' }, { reason: 'Griefing' });
  assert.equal(lists.ban(b).reason, 'Griefing'); assert.equal(lists.ban(b).expires, null);
  assert.equal(lists.pardon('bob'), true); assert.equal(lists.ban(b), null); assert.equal(lists.pardon(b), false);
});

test('bans use the Java date format, expire by the injected clock and are pruned on save', async () => {
  const dir = tempDir(), old = randomUUID(), temp = randomUUID(), perm = randomUUID();
  let now = Date.UTC(2026, 10, 8, 12, 0, 0);
  write(dir, 'banned-players.json', [
    { uuid: old, name: 'Old', created: '2026-11-01 10:00:00 +0100', source: 'Server', expires: '2026-11-08 13:30:00 +0200', reason: 'Spam' },
    { uuid: perm, name: 'Perm', created: 'yesterday', source: 'Console', expires: 'whenever', reason: 'Cheating' },
  ]);
  const lists = await new AdminLists(dir, { now: () => now }).load();
  assert.equal(lists.ban(old), null, '13:30 +0200 is 11:30 UTC, already past');
  assert.equal(lists.ban(perm).expires, null, 'unreadable expiry is permanent, like 1.7.10');
  assert.equal(lists.ban(perm).created, now);
  assert.equal(lists.report.filter(e => e.key === 'banned-players.json[1]').length, 2);
  lists.addBan({ id: temp, name: 'Temp' }, { expires: now + 3600_000 });
  assert.equal(lists.ban(temp).source, 'Server'); assert.equal(lists.ban(temp).reason, 'Banned by an operator.');
  assert.deepEqual(lists.banEntries().map(e => e.name), ['Perm', 'Temp']);
  await lists.save();
  const saved = readJson(dir, 'banned-players.json');
  assert.deepEqual(saved.map(e => e.name), ['Perm', 'Temp'], 'expired ban pruned');
  assert.deepEqual(saved[1], { uuid: temp, name: 'Temp', created: '2026-11-08 12:00:00 +0000', source: 'Server', expires: '2026-11-08 13:00:00 +0000', reason: 'Banned by an operator.' });
  assert.equal(saved[0].expires, 'forever');
  now += 3600_000;
  assert.equal(lists.ban(temp), null);
  const reloaded = await new AdminLists(dir, { now: () => now }).load();
  assert.equal(reloaded.ban(perm).reason, 'Cheating'); assert.equal(reloaded.ban(temp), null);
  await reloaded.save();
  assert.deepEqual(readJson(dir, 'banned-players.json').map(e => e.name), ['Perm']);
});

test('banned-ips.json is reported unsupported and not enforced', async () => {
  const dir = tempDir();
  write(dir, 'banned-ips.json', [{ ip: '127.0.0.1', created: '2026-11-08 12:00:00 +0000', source: 'Server', expires: 'forever', reason: 'x' }]);
  const lists = await new AdminLists(dir).load();
  const entry = lists.report.find(e => e.key === 'banned-ips.json');
  assert.equal(entry.status, 'unsupported'); assert.match(entry.note, /loopback/);
  assert.match(formatReport([entry])[0], /^unsupported banned-ips\.json=1 entries: IP bans need trusted client IP forwarding/);
  write(dir, 'banned-ips.json', '[]');
  assert.deepEqual((await lists.load()).report, [], 'an empty list is fine');
});

test('a malformed whitelist.json is reported, left alone, then replaced with a .bak on change', async () => {
  const dir = tempDir(), broken = '[{"uuid": "abc", "name": "Alex"},', file = path.join(dir, 'whitelist.json');
  write(dir, 'whitelist.json', broken);
  const lists = await new AdminLists(dir).load();
  assert.deepEqual(lists.report.map(e => [e.key, e.status]), [['whitelist.json', 'invalid']]);
  assert.match(formatReport(lists.report)[0], /^invalid whitelist\.json: malformed JSON/);
  assert.deepEqual(lists.whitelistEntries(), []);
  await lists.save();
  assert.equal(fs.readFileSync(file, 'utf8'), broken, 'unchanged list is not written');
  const id = randomUUID();
  lists.addWhitelist({ id, name: 'Alex' });
  await lists.save();
  assert.deepEqual(readJson(dir, 'whitelist.json'), [{ uuid: id, name: 'Alex' }]);
  assert.equal(fs.readFileSync(file + '.bak', 'utf8'), broken);
  lists.addWhitelist({ id: randomUUID(), name: 'Bob' });
  await lists.save();
  assert.equal(fs.readFileSync(file + '.bak', 'utf8'), broken, 'the backup is made once');
  write(dir, 'ops.json', '{"not": "an array"}');
  assert.equal(statusOf((await lists.load()).report, 'ops.json'), 'invalid');
});

test('saves are atomic, private, and serialized to the latest state', async () => {
  const dir = tempDir(), ids = Array.from({ length: 5 }, () => randomUUID());
  const lists = await new AdminLists(dir).load();
  lists.addWhitelist({ id: ids[0], name: 'P0' });
  const first = lists.save();
  lists.addWhitelist({ id: ids[1], name: 'P1' }); lists.addOp({ id: ids[1], name: 'P1' }, 2);
  const second = lists.save();
  lists.addWhitelist({ id: ids[2], name: 'P2' });
  const third = lists.save();
  await Promise.all([first, second, third]);
  assert.deepEqual(readJson(dir, 'whitelist.json').map(e => e.name), ['P0', 'P1', 'P2']);
  assert.deepEqual(readJson(dir, 'ops.json'), [{ uuid: ids[1], name: 'P1', level: 2 }]);
  assert.ok(!fs.existsSync(path.join(dir, 'banned-players.json')), 'unchanged lists are not written');
  await Promise.all(ids.slice(3).map((id, i) => { lists.addBan({ id, name: 'B' + i }); return lists.save(); }));
  assert.deepEqual(readJson(dir, 'banned-players.json').map(e => e.name), ['B0', 'B1']);
  const files = fs.readdirSync(dir);
  assert.deepEqual(files.filter(f => f.endsWith('.tmp')), []);
  for (const f of files) assert.equal(fs.statSync(path.join(dir, f)).mode & 0o777, 0o600, f);
  const reloaded = await new AdminLists(dir).load();
  assert.deepEqual(reloaded.whitelistEntries().map(e => e.id), ids.slice(0, 3));
  assert.deepEqual(reloaded.report, []);
});
