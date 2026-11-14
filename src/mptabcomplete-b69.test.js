// Batch 69 mptabcomplete: C14 / S3A tab completion over a connection (server-tabcomplete.js, client-tabcomplete.js) and the server list's ping animation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { possibleCommandNames, possibleCommands, tabComplete, socialTabComplete, javaHashOrder } from './multiplayer/server-tabcomplete.js';
import { RemoteTabCompletion, commonPrefix, wordStart } from './multiplayer/client-tabcomplete.js';
import { ServerAdmin } from './multiplayer/server-admin.js';
import { serverListScreen } from './multiplayer/server-list-gui.js';
import { pingAnimationRow } from './multiplayer/client-ping.js';

const reference = JSON.parse(readFileSync(new URL('../public/research/tabcomplete-reference.json', import.meta.url)));
const ctx = (over = {}) => ({ sender: 'Alex', level: 4, online: ['Alex', 'Bob', 'alice'], admin: null, isOp: () => false, scoreboard: null, ...over });

test('getPossibleCommands replays the executed 1.7.10 run (names, aliases, HashMap order, permission levels)', () => {
  let checked = 0;
  for (const r of reference.records) {
    if (r.error) continue;
    const got = r.text.includes(' ') ? possibleCommands(r.text, ctx({ level: r.level, online: ['Alex'] })) : possibleCommandNames(r.level, r.text);
    assert.deepEqual(got, r.options ?? [], `level ${r.level} "${r.text}"`);
    checked++;
  }
  assert.equal(checked, reference.records.length);
});

test('argument completion has no permission check (bytecode-read, executed for level 0)', () => {
  assert.equal(reference.argumentsBranchPermissionCalls, 0);
  assert.deepEqual(tabComplete('/gamemode s', ctx({ level: 0 })), ['survival']);
  assert.deepEqual(tabComplete('/weather r', ctx({ level: 0 })), ['rain']);
  assert.deepEqual(tabComplete('/nosuch ', ctx()), []);
  assert.deepEqual(tabComplete('/TIME s', ctx()), []); // the command key is matched exactly, case-sensitive
});

test('MinecraftServer.func_71248_a: a slash text puts "/" in front of a single word only, other text completes player names', () => {
  assert.deepEqual(tabComplete('/te', ctx()), ['/tellraw', '/tell', '/testforblock', '/testfor']);
  assert.deepEqual(tabComplete('/tell A', ctx()), ['Alex', 'alice']);
  assert.deepEqual(tabComplete('hello Al', ctx()), ['Alex', 'alice']);
  assert.deepEqual(tabComplete('hello ', ctx()), ['Alex', 'Bob', 'alice']);
  assert.deepEqual(tabComplete('zzz', ctx()), []);
  assert.deepEqual(tabComplete('/', ctx({ level: 0 })), ['/msg', '/tell', '/me', '/list', '/netstat', '/?', '/kill', '/help', '/w']);
});

test('a plain player sees only level 0 commands; an operator sees the dedicated set by its level', () => {
  assert.ok(!possibleCommandNames(0, '').includes('op') && !possibleCommandNames(0, '').includes('give'));
  assert.ok(possibleCommandNames(3, 'o').includes('op') && !possibleCommandNames(3, 's').includes('stop'));
  assert.ok(possibleCommandNames(4, 's').includes('stop') && possibleCommandNames(4, 'save-').length === 3);
  assert.ok(possibleCommandNames(2, 'k').includes('kick') && !possibleCommandNames(2, 'b').length);
});

test('say, me, tell complete player names at every word; players come from every connected player', () => {
  assert.deepEqual(tabComplete('/say hi Bo', ctx()), ['Bob']);
  assert.deepEqual(tabComplete('/me waves at a', ctx()), ['Alex', 'alice']);
  assert.deepEqual(tabComplete('/w Al', ctx()), ['Alex', 'alice']);
  assert.deepEqual(tabComplete('/give B', ctx()), ['Bob']);
  assert.deepEqual(tabComplete('/tp Alex B', ctx()), ['Bob']);
  assert.deepEqual(tabComplete('/scoreboard players set B', ctx()), ['Bob']);
});

test('admin commands complete the lists the bytecode names', () => {
  const admin = new ServerAdmin({ ops: [{ uuid: 'u1', name: 'Boss', level: 4 }], banned: [{ uuid: 'u2', name: 'Griefer' }], bannedIps: [{ ip: '1.2.3.4' }], whitelist: [{ uuid: 'u3', name: 'Pal' }], profiles: [{ uuid: 'u4', name: 'Newbie' }] });
  const c = ctx({ admin, isOp: (n) => n === 'Alex' });
  assert.deepEqual(tabComplete('/op ', c), ['Bob', 'alice']); // online players who are not ops
  assert.deepEqual(tabComplete('/deop B', c), ['Boss']);
  assert.deepEqual(tabComplete('/ban A', c), ['Alex', 'alice']);
  assert.deepEqual(tabComplete('/ban Alex some reason A', c), ['Alex', 'alice']); // every word from the first on
  assert.deepEqual(tabComplete('/ban-ip B', c), ['Bob']);
  assert.deepEqual(tabComplete('/ban-ip Bob x', c), []);
  assert.deepEqual(tabComplete('/kick a', c), ['Alex', 'alice']);
  assert.deepEqual(tabComplete('/pardon G', c), ['Griefer']);
  assert.deepEqual(tabComplete('/pardon-ip 1', c), ['1.2.3.4']);
  assert.deepEqual(tabComplete('/banlist ', c), ['players', 'ips']);
  assert.deepEqual(tabComplete('/whitelist ', c), ['on', 'off', 'list', 'add', 'remove', 'reload']);
  assert.deepEqual(tabComplete('/whitelist remove ', c), ['Pal']);
  assert.deepEqual(tabComplete('/whitelist add N', c), ['Newbie']);
  assert.deepEqual(tabComplete('/whitelist list ', c), []);
});

test('socialTabComplete uses the sender level and the online players', () => {
  const players = new Map([[1, { name: 'Alex' }], [2, { name: 'Bob' }]]);
  const social = { simulation: { players, admin: null, scoreboard: null }, opLevel: (n) => (n === 'Alex' ? 4 : 0), isOp: (n) => n === 'Alex' };
  assert.ok(socialTabComplete(social, 1, '/sto').includes('/stop'));
  assert.deepEqual(socialTabComplete(social, 2, '/sto'), []);
  assert.deepEqual(socialTabComplete(social, 2, 'hi B'), ['Bob']);
  assert.deepEqual(socialTabComplete(social, 9, '/s'), []);
  assert.deepEqual(socialTabComplete(social, 1, 5), []);
});

test('javaHashOrder follows java.util.HashMap (bucket order, insertion order inside a bucket, growth)', () => {
  assert.deepEqual(javaHashOrder(['a', 'b', 'a']), ['a', 'b']);
  const keys = Array.from({ length: 40 }, (_, i) => 'k' + i);
  assert.equal(new Set(javaHashOrder(keys)).size, 40);
});

// ---- the client half: GuiChat.func_146404_p_ / func_146405_a / func_146406_a ----
const run = (completion, text, cursor, replyOptions) => {
  const sent = [], printed = [];
  const out = completion.press(text, cursor, (t) => sent.push(t), (t) => printed.push(t));
  return { out, sent, printed, reply: (options, t, c) => completion.reply(options, t, c, (x) => printed.push(x)) };
};

test('Tab sends the text before the cursor and changes nothing until the reply', () => {
  const c = new RemoteTabCompletion();
  const r = run(c, '/gamemode s more', 11);
  assert.equal(r.out, null);
  assert.deepEqual(r.sent, ['/gamemode s']);
  assert.equal(run(new RemoteTabCompletion(), '', 0).sent.length, 0); // C14 needs at least 1 character
});

test('a reply with a longer common prefix completes the word and does not start cycling', () => {
  const c = new RemoteTabCompletion();
  run(c, '/te', 3);
  assert.deepEqual(c.reply(['/tellraw', '/tell'], '/te', 3, () => {}), { text: '/tell', cursor: 5 });
  assert.equal(c.completing, false);
  // a prefix equal to the typed word (ignoring case) starts cycling at once
  const d = new RemoteTabCompletion();
  run(d, '/TE', 3);
  assert.deepEqual(d.reply(['/tellraw', '/tell', '/testfor'], '/TE', 3, () => {}), { text: '/tellraw', cursor: 8 });
  assert.equal(d.completing, true);
});

test('a single reply replaces the word; the next Tab asks again', () => {
  const c = new RemoteTabCompletion();
  run(c, 'say hi Bo', 9);
  const out = c.reply(['Bob'], 'say hi Bo', 9, () => {});
  assert.deepEqual(out, { text: 'say hi Bob', cursor: 10 });
  assert.equal(c.completing, false);
  const again = run(c, 'say hi Bob', 10);
  assert.deepEqual(again.sent, ['say hi Bob']);
});

test('several candidates without a longer prefix cycle, printing the list each time, wrapping around', () => {
  const c = new RemoteTabCompletion(), printed = [];
  c.press('/', 1, () => {}, () => {});
  let out = c.reply(['/msg', '/tell', '/me'], '/', 1, (t) => printed.push(t));
  assert.deepEqual(out, { text: '/msg', cursor: 4 });
  out = c.press(out.text, out.cursor, () => assert.fail('no request while cycling'), (t) => printed.push(t));
  assert.deepEqual(out, { text: '/tell', cursor: 5 });
  out = c.press(out.text, out.cursor, () => {}, (t) => printed.push(t));
  assert.deepEqual(out, { text: '/me', cursor: 3 });
  out = c.press(out.text, out.cursor, () => {}, (t) => printed.push(t));
  assert.deepEqual(out, { text: '/msg', cursor: 4 });
  assert.deepEqual(printed, Array(4).fill('/msg, /tell, /me'));
  c.reset();
  assert.equal(c.completing, false);
});

test('the text after the cursor stays; an unrequested or empty reply does nothing', () => {
  const c = new RemoteTabCompletion();
  assert.equal(c.reply(['x'], 'a', 1, () => {}), null); // no request pending
  run(c, 'tell Al hello', 7);
  assert.deepEqual(c.reply(['Alex'], 'tell Al hello', 7, () => {}), { text: 'tell Alex hello', cursor: 9 });
  run(c, 'zzz', 3);
  assert.equal(c.reply([], 'zzz', 3, () => {}), null);
  assert.equal(c.completing, false);
});

test('commonPrefix is StringUtils.getCommonPrefix; wordStart is the last space + 1', () => {
  assert.equal(commonPrefix(['/tellraw', '/tell']), '/tell');
  assert.equal(commonPrefix(['a', 'b']), '');
  assert.equal(commonPrefix([]), '');
  assert.equal(commonPrefix(['Alex', '']), '');
  assert.equal(wordStart('say hi Bo', 9), 7);
  assert.equal(wordStart('/te', 3), 0);
});

// ---- the server list's ping animation ----
test('the pinging sprite follows the clock without a rebuild, and stops on close', async () => {
  const sprites = [];
  const g = {
    screen: null, build() {},
    text: () => ({ style: {} }), button: () => ({ enable() {} }),
    image: () => { const s = { style: { cssText: '', backgroundPosition: '' }, isConnected: true }; sprites.push(s); return s; },
    slotList: (layout, opts) => { for (let i = 0; i < opts.count; i++) opts.entry(i, 0, {}, 0); return { scroll: 0 }; },
  };
  const screen = serverListScreen({ list: { entries: [{ name: 'A', ip: 'a:1' }, { name: 'B', ip: 'b:1' }] }, ping: () => new Promise(() => {}), show() {}, join() {}, back() {} });
  g.screen = screen;
  screen.init(g, 640, 480);
  const pinging = sprites.filter((s) => s.style.cssText.includes('background'));
  assert.equal(pinging.length, 2);
  const before = pinging.map((s) => s.style.backgroundPosition);
  await new Promise((r) => setTimeout(r, 260));
  const after = pinging.map((s) => s.style.backgroundPosition);
  assert.ok(after.every((p) => p.startsWith('calc(-10*var(--u)) calc(-')), after.join('|'));
  assert.ok(after.some((p, i) => p !== before[i] || p !== '') && after.every((p) => p !== ''));
  const t = Date.now();
  assert.match(after[0], new RegExp(`calc\\(-${176 + 8 * pingAnimationRow(t, 0)}\\*var|calc\\(-\\d+\\*var`));
  screen.close();
  const frozen = pinging.map((s) => s.style.backgroundPosition);
  await new Promise((r) => setTimeout(r, 160));
  assert.deepEqual(pinging.map((s) => s.style.backgroundPosition), frozen);
});
