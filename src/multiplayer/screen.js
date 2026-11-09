import { MULTIPLAYER_URL, PROTOCOL, BUILD_ID, serverUrl, validName } from './protocol.js';
import { convertGuiCanvas } from '../gui-anaglyph.js';
import { skinCanvas, canvasPng, drawSkinPreview, PREVIEW_WIDTH, PREVIEW_HEIGHT } from '../skin.js';

// The gun server's address as plain HTTP(S), for its /status (server/guns-server.js).
export function statusUrl(address) {
  const url = new URL(serverUrl(address));
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '/status'; url.search = '';
  return url.href;
}
// What a /status answer means for this tab: null when it can join, else the reason it cannot.
export function statusProblem(status, pack) {
  if (status.protocol !== PROTOCOL) return 'The server runs a different protocol. Reload the game.';
  if (status.build !== 'any' && status.build !== BUILD_ID) return 'The server runs a different game build. Reload the game.';
  if (pack && status.pack !== pack) return 'Your gun pack differs from the server\'s.';
  if (status.players >= status.maxPlayers) return 'The server is full.';
  return null;
}

// The gun server's join screen. It signs in with the website account (profile.js ProfileSession): the server checks the session
// with the profile service and takes the account's name, so there is no separate multiplayer password. It intentionally doesn't
// pretend to discover Java LAN servers. It uses the game's existing bitmap-font GUI widgets.
// session: ProfileSession; connect({ url, session }) joins; signIn() opens the account screen; fetchStatus(url) -> JSON;
// pack() -> this tab's weapon-rules fingerprint (or null before the packs load).
export function multiplayerScreen({ back, connect, session, signIn, defaults = {}, fetchStatus = defaultStatus, pack = async () => null }) {
  const values = { url: defaults.url || MULTIPLAYER_URL };
  let busy = false, error = '', note = '', status = null, statusFor = null;
  const run = async (g, work) => {
    if (busy) return;
    busy = true; error = ''; note = ''; g.build();
    try { await work(); }
    catch (e) { error = String(e.message).slice(0, 85); }
    busy = false; g.build();
  };
  const refresh = async (g) => {
    const address = values.url; statusFor = address; status = { checking: true }; g?.build();
    let next;
    try {
      const [answer, fingerprint] = await Promise.all([fetchStatus(statusUrl(address)), pack().catch(() => null)]);
      next = { ...answer, problem: statusProblem(answer, fingerprint) };
    } catch (e) { next = { offline: true, problem: e.message.startsWith('Use a') || e.message.startsWith('This HTTPS') ? e.message : 'Can\'t reach the server.' }; }
    if (statusFor === address) { status = next; g?.build(); }
  };
  const screen = {
    id: 'multiplayer',
    escape: () => { if (!busy) back(); },
    init(g, w, h) {
      if (!screen.checked) { screen.checked = true; void refresh(g); }
      const x = Math.floor(w / 2) - 150, top = Math.max(24, Math.floor(h / 2) - 70);
      g.text('Multiplayer', w / 2, 12, { center: true });
      const account = session.authenticated ? session.account : null;
      g.text(account ? `Signed in as ${account.name}` : 'Sign in with your account to join.', w / 2, top, { center: true, color: account ? 0xffffff : 0xaaaaaa });
      g.text('Server address', x, top + 18, { color: 0xaaaaaa });
      g.field({ x, y: top + 28, w: 300, h: 16 }, { value: values.url, maxLength: 200, label: 'Server address', input: value => { values.url = value.trim(); status = null; } });
      const line = status?.checking ? 'Checking the server…' : status?.offline ? status.problem
        : status ? `${String(status.motd ?? 'Gun server').slice(0, 40)} · ${status.players}/${status.maxPlayers} players` : 'Press Refresh to check the server.';
      g.text(line, w / 2, top + 52, { center: true, color: status?.offline ? 0xff7777 : 0xaaaaaa });
      if (status?.problem && !status.offline) g.text(status.problem, w / 2, top + 64, { center: true, color: 0xff7777 });
      g.text(error || note || (busy ? 'Connecting…' : ''), w / 2, top + 80, { center: true, color: error ? 0xff7777 : 0xaaaaaa });
      if (!account) g.button({ x, y: top + 96, w: 300, h: 20 }, 'Sign In…', signIn, { enabled: !busy });
      else g.button({ x, y: top + 96, w: 300, h: 20 }, busy ? 'Connecting…' : 'Join Server', () => run(g, async () => {
        note = 'Connecting and downloading terrain…'; g.build();
        await connect({ url: serverUrl(values.url), session: session.api.session });
      }), { enabled: !busy && !!values.url });
      g.button({ x, y: top + 120, w: 148, h: 20 }, 'Refresh', () => void refresh(g), { enabled: !busy && !status?.checking });
      g.button({ x: x + 152, y: top + 120, w: 148, h: 20 }, 'Cancel', back, { enabled: !busy });
    },
  };
  return screen;
}
async function defaultStatus(url) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('status ' + response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}

// Name and skin for the signed-in account. A chosen PNG is previewed locally
// (normalized as 1.7.10 reads skins) before Save Skin uploads it.
export function profileScreen({ api, back, steve, loadSkin, changed = () => {}, signOut = null }) {
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
      if (!api.account) { back(); return; }
      if (!loaded) { loaded = true; void loadSkin(api.account.skin).then(c => { current = c; g.build(); }); }
      const x = Math.floor(w / 2) - 150, top = Math.max(24, Math.floor(h / 2) - 80);
      g.text('Name and Skin', w / 2, 12, { center: true });
      if (signOut && api.account.email) g.text(api.account.email.length > 44 ? api.account.email.slice(0, 41) + '…' : api.account.email, w / 2, 24, { center: true, color: 0xaaaaaa });
      const box = g.image('mc-skin-preview', x, top, PREVIEW_WIDTH * 3, PREVIEW_HEIGHT * 3);
      const canvas = document.createElement('canvas');
      canvas.width = PREVIEW_WIDTH; canvas.height = PREVIEW_HEIGHT;
      canvas.style.cssText = 'width:100%;height:100%;image-rendering:pixelated';
      box.style.background = 'rgba(0,0,0,.35)';
      box.append(canvas);
      const skin = pending ?? current ?? steve;
      if (skin && (skin.naturalWidth ?? skin.width)) { drawSkinPreview(canvas.getContext('2d'), skin); convertGuiCanvas(canvas); } // Steve may still be loading; the skin is a texture, so it is converted under 3D Anaglyph
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
        changed(await api.uploadSkin(await canvasPng(pending))); current = pending; pending = null; note = signOut ? 'Skin saved.' : 'Skin saved. Other players see it now.';
      }), { enabled: !busy && !!pending });
      g.button({ x: rx + 92, y: top + 78, w: 88, h: 20 }, 'Use Default', () => run(g, async () => {
        changed(await api.clearSkin()); current = pending = null; note = 'Using the default skin.';
      }), { enabled: !busy && (!!current || !!pending) });
      g.text(error || note || (busy ? 'Saving…' : '64 × 32 or 64 × 64 PNG; 1.7.10 uses the top half.'), w / 2, top + 116, { center: true, color: error ? 0xff7777 : 0xaaaaaa });
      if (signOut) {
        g.button({ x, y: top + 134, w: 148, h: 20 }, 'Sign Out', () => run(g, signOut), { enabled: !busy });
        g.button({ x: x + 152, y: top + 134, w: 148, h: 20 }, 'Done', back, { enabled: !busy });
      } else g.button({ x: x + 77, y: top + 134, w: 146, h: 20 }, 'Done', back, { enabled: !busy });
    },
  };
}
