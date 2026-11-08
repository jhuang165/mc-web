import { DEFAULT_SERVER, validName } from './protocol.js';
import { AccountApi } from './account-api.js';
import { skinCanvas, canvasPng, drawSkinPreview, PREVIEW_WIDTH, PREVIEW_HEIGHT } from '../skin.js';

// Browser-server sign-in and join; intentionally doesn't pretend to discover
// Java LAN servers. Accounts are invite-only and live on the server (server/accounts.js).
// It uses the game's existing bitmap-font GUI widgets.
export function multiplayerScreen({ back, connect, profile, defaults = {}, makeApi = url => new AccountApi(url) }) {
  const values = { url: defaults.url || DEFAULT_SERVER, name: defaults.name || '', password: '', invite: '' };
  let api = null, state = 'signedOut', busy = false, error = '', note = '', invite = '';
  const run = async (g, work) => {
    if (busy) return;
    busy = true; error = ''; note = ''; g.build();
    try { await work(); }
    catch (e) { error = String(e.message).slice(0, 85); }
    busy = false; g.build();
  };
  const useAddress = () => { if (!api || api.address !== values.url) { api = makeApi(values.url); api.address = values.url; } return api; };
  try { useAddress(); } catch { api = null; }
  const screen = {
    id: 'multiplayer',
    escape: () => { if (!busy) back(); },
    // A remembered session is checked once when the screen opens.
    async check(g) {
      if (!api?.session) return;
      state = 'checking'; g?.build();
      try { await api.me(); state = 'signedIn'; values.name = api.account.name; }
      catch (e) { state = 'signedOut'; error = api.session ? String(e.message).slice(0, 85) : ''; }
      g?.build();
    },
    get api() { return api; },
    init(g, w, h) {
      if (!screen.checked) { screen.checked = true; void screen.check(g); }
      const x = Math.floor(w / 2) - 150, top = Math.max(24, Math.floor(h / 2) - 92);
      g.text('Multiplayer', w / 2, 12, { center: true });
      const message = (y, fallback) => g.text(error || note || (busy ? 'Contacting the server…' : fallback), w / 2, y, { center: true, color: error ? 0xff7777 : 0xaaaaaa });
      if (state === 'checking') { g.text('Checking your sign-in…', w / 2, top + 40, { center: true, color: 0xaaaaaa }); g.button({ x: x + 77, y: top + 70, w: 146, h: 20 }, 'Cancel', back); return; }
      if (state === 'signedIn') {
        const a = api.account;
        g.text(`Signed in as ${a.name}${a.admin ? ' (admin)' : ''}`, w / 2, top, { center: true });
        g.text(values.url.slice(0, 50), w / 2, top + 12, { center: true, color: 0xaaaaaa });
        g.text('Shared Creative world · 128 × 128 blocks', w / 2, top + 24, { center: true, color: 0xaaaaaa });
        g.button({ x, y: top + 44, w: 300, h: 20 }, busy ? 'Connecting…' : 'Join Server', () => run(g, async () => {
          note = 'Connecting and downloading terrain…'; g.build();
          await connect({ url: values.url, session: api.session, api });
        }), { enabled: !busy });
        g.button({ x, y: top + 68, w: 148, h: 20 }, 'Name and Skin…', () => profile(api, screen), { enabled: !busy });
        g.button({ x: x + 152, y: top + 68, w: 148, h: 20 }, 'Create Invite', () => run(g, async () => {
          const { code } = await api.invite();
          invite = code; note = 'One use, valid 7 days. Send it to one friend.';
          try { await navigator.clipboard?.writeText(code); note = 'Copied. One use, valid 7 days.'; } catch {}
        }), { enabled: !busy && a.admin, reason: a.admin ? '' : 'Only admin accounts can create invites.' });
        if (invite) {
          g.text('Invite code', x, top + 94, { color: 0xaaaaaa });
          g.field({ x: x + 70, y: top + 92, w: 230, h: 14 }, { value: invite, maxLength: 11, label: 'Invite code', input: () => {} });
        }
        message(top + 114, a.admin ? 'Invite friends with a code; they choose their own name.' : 'Admins create invite codes for new friends.');
        g.button({ x, y: top + 130, w: 148, h: 20 }, 'Sign Out', () => run(g, async () => { await api.signOut(); state = 'signedOut'; invite = ''; values.password = ''; }), { enabled: !busy });
        g.button({ x: x + 152, y: top + 130, w: 148, h: 20 }, 'Cancel', back, { enabled: !busy });
        return;
      }
      const fields = [['url', 'Server address', 512], ['name', 'Name', 16], ['password', 'Password', 128], ['invite', 'Invite code (new accounts only)', 128]];
      fields.forEach(([key, label, maxLength], index) => {
        const y = top + index * 30;
        g.text(label, x, y, { color: 0xaaaaaa });
        g.field({ x, y: y + 10, w: 300, h: 16 }, { value: values[key], maxLength, label, secret: key === 'password', input: value => { values[key] = value; } });
      });
      message(top + 124, 'Ask the world owner for an invite code.');
      const check = (registering) => {
        if (!validName(values.name)) throw new Error('Names are 1–16 letters, numbers or underscores.');
        if (values.password.length < 8) throw new Error('Passwords are at least 8 characters.');
        if (registering && !values.invite.trim()) throw new Error('New accounts need an invite code.');
        return useAddress();
      };
      const done = () => { state = 'signedIn'; values.password = ''; values.invite = ''; values.name = api.account.name; };
      g.button({ x, y: top + 140, w: 98, h: 20 }, 'Log In', () => run(g, async () => { await check(false).signIn(values.name, values.password); done(); }), { enabled: !busy });
      g.button({ x: x + 101, y: top + 140, w: 98, h: 20 }, 'Create Account', () => run(g, async () => { await check(true).register(values.name, values.password, values.invite.trim()); done(); }), { enabled: !busy });
      g.button({ x: x + 202, y: top + 140, w: 98, h: 20 }, 'Cancel', back, { enabled: !busy });
    },
  };
  return screen;
}

// Name and skin for the signed-in account. A chosen PNG is previewed locally
// (normalized as 1.7.10 reads skins) before Save Skin uploads it.
export function profileScreen({ api, back, steve, loadSkin, changed = () => {} }) {
  let name = api.account.name, busy = false, error = '', note = '', pending = null, current = null, loaded = false;
  const run = async (g, work) => {
    if (busy) return;
    busy = true; error = ''; note = ''; g.build();
    try { await work(); } catch (e) { error = String(e.message).slice(0, 85); }
    busy = false; g.build();
  };
  const choose = (g) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/png';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void run(g, async () => { pending = await skinCanvas(file); note = 'Preview. Press Save Skin to use it.'; });
    };
    input.click();
  };
  return {
    id: 'multiplayer-profile',
    escape: () => { if (!busy) back(); },
    init(g, w, h) {
      if (!loaded) { loaded = true; void loadSkin(api.account.skin).then(c => { current = c; g.build(); }); }
      const x = Math.floor(w / 2) - 150, top = Math.max(24, Math.floor(h / 2) - 80);
      g.text('Name and Skin', w / 2, 12, { center: true });
      const box = g.image('mc-skin-preview', x, top, PREVIEW_WIDTH * 3, PREVIEW_HEIGHT * 3);
      const canvas = document.createElement('canvas');
      canvas.width = PREVIEW_WIDTH; canvas.height = PREVIEW_HEIGHT;
      canvas.style.cssText = 'width:100%;height:100%;image-rendering:pixelated';
      box.style.background = 'rgba(0,0,0,.35)';
      box.append(canvas);
      const skin = pending ?? current ?? steve;
      if (skin && (skin.naturalWidth ?? skin.width)) drawSkinPreview(canvas.getContext('2d'), skin); // Steve may still be loading
      g.text(pending ? 'New skin (front, back)' : current ? 'Your skin (front, back)' : 'Default skin (front, back)', x, top + 100, { color: 0xaaaaaa });
      const rx = x + 120, rw = 180;
      g.text('Name', rx, top, { color: 0xaaaaaa });
      g.field({ x: rx, y: top + 10, w: rw, h: 16 }, { value: name, maxLength: 16, label: 'Name', input: v => { name = v; } });
      g.button({ x: rx, y: top + 30, w: rw, h: 20 }, 'Save Name', () => run(g, async () => {
        if (!validName(name)) throw new Error('Names are 1–16 letters, numbers or underscores.');
        changed(await api.rename(name)); note = 'Name saved.';
      }), { enabled: !busy });
      g.button({ x: rx, y: top + 56, w: rw, h: 20 }, 'Choose PNG Skin…', () => choose(g), { enabled: !busy });
      g.button({ x: rx, y: top + 78, w: 88, h: 20 }, 'Save Skin', () => run(g, async () => {
        changed(await api.uploadSkin(await canvasPng(pending))); current = pending; pending = null; note = 'Skin saved. Other players see it now.';
      }), { enabled: !busy && !!pending });
      g.button({ x: rx + 92, y: top + 78, w: 88, h: 20 }, 'Use Default', () => run(g, async () => {
        changed(await api.clearSkin()); current = pending = null; note = 'Using the default skin.';
      }), { enabled: !busy && (!!current || !!pending) });
      g.text(error || note || (busy ? 'Saving…' : '64 × 32 or 64 × 64 PNG; 1.7.10 uses the top half.'), w / 2, top + 116, { center: true, color: error ? 0xff7777 : 0xaaaaaa });
      g.button({ x: x + 77, y: top + 134, w: 146, h: 20 }, 'Done', back, { enabled: !busy });
    },
  };
}
