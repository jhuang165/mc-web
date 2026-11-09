import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfileSession } from './profile.js';
import { PLAYER_NAME, setPlayerName } from './player-name.js';
import { createCommandHost } from './command-host.js';
import { deathMessage } from './death-messages.js';

const account = { id: 'test-id', name: 'ProfileUser', email: 'profile@example.org', skin: null };
test('a remembered token alone cannot enter play; restore must verify it with the account server', async () => {
  let verified = false;
  const api = { session: 'synthetic-session', me: async () => { if (!verified) throw Error('Invalid session'); return account; } };
  const profile = new ProfileSession(api);
  assert.equal(profile.authenticated, false);
  assert.equal(await profile.check(), false);
  verified = true;
  assert.equal(await profile.check(), true);
  assert.equal(profile.account.name, account.name);
  assert.equal(profile.checking, false);
});

test('registration and sign-in use a verified response; sign-out clears authentication even during an outage', async () => {
  const calls = [];
  const api = { session: null,
    register: async (...args) => { calls.push(args); api.session = 'synthetic-session'; return account; },
    signIn: async () => { api.session = 'synthetic-session'; return account; },
    signOut: async () => { throw Error('offline'); }, remember: token => { api.session = token; } };
  const profile = new ProfileSession(api);
  await profile.register('ProfileUser', 'profile@example.org', 'synthetic password');
  assert.equal(profile.authenticated, true);
  assert.deepEqual(calls[0], ['ProfileUser', 'profile@example.org', 'synthetic password']);
  await profile.signOut(); assert.equal(profile.authenticated, false);
  await profile.signIn('ProfileUser', 'synthetic password'); assert.equal(profile.authenticated, true);
  assert.throws(() => profile.accept({ id: 'x', name: '<script>' }), /Invalid account/);
});

test('verified profile names are read live by existing command hosts and player messages', () => {
  const host = createCommandHost({});
  try {
    setPlayerName('ProfileUser');
    assert.equal(PLAYER_NAME, 'ProfileUser'); assert.equal(host.name, 'ProfileUser');
    assert.match(deathMessage('fall'), /ProfileUser/);
    setPlayerName('RenamedUser'); assert.equal(host.name, 'RenamedUser');
    setPlayerName('<invalid>'); assert.equal(host.name, 'Player');
  } finally { setPlayerName(null); }
});
