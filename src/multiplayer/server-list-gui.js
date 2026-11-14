// Batch 68 mpping: GuiMultiplayer (the saved server list), GuiScreenAddServer, GuiScreenServerList (Direct Connect) and GuiDisconnected.
// Layouts are bytecode-read from the 1.7.10 classes bfz / bge / bgc / bdg / bde / bdf (see the track note); strings come from the lang file.
import { EN_US } from '../lang-en-us.js';
import { lang, formatLang } from '../lang.js';
import { splitLines, textWidth, COLOR } from '../menu-screens.js';
import { DEFAULT_SERVER } from './protocol.js';
import { rowState, newStatus, pingServer, pingAnimationRow } from './client-ping.js';

export const tr = (key, ...args) => formatLang(lang.table ?? EN_US, key, ...args);
export const STORE_KEY = 'mc-web-servers';
const half = w => Math.trunc(w / 2);

// ServerList (servers.dat): entries {name, ip, acceptTextures: true|false|null}. The browser keeps them in localStorage; the build's one
// public server is added the first time (native starts empty), since this page has no LAN discovery.
export class ServerList {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage; this.entries = [];
    let raw = null;
    try { raw = JSON.parse(storage?.getItem(STORE_KEY) ?? 'null'); } catch { raw = null; }
    if (Array.isArray(raw)) this.entries = raw.filter(e => e && typeof e.name === 'string' && typeof e.ip === 'string').map(e => ({ name: e.name, ip: e.ip, acceptTextures: e.acceptTextures ?? null }));
    else { this.entries = [{ name: tr('selectServer.defaultName'), ip: DEFAULT_SERVER, acceptTextures: null }]; this.save(); }
  }
  save() { try { this.storage?.setItem(STORE_KEY, JSON.stringify(this.entries)); } catch { /* storage full or blocked */ } }
  add(entry) { this.entries.push({ name: entry.name, ip: entry.ip, acceptTextures: entry.acceptTextures ?? null }); this.save(); }
  set(i, entry) { this.entries[i] = { name: entry.name, ip: entry.ip, acceptTextures: entry.acceptTextures ?? null }; this.save(); }
  remove(i) { this.entries.splice(i, 1); this.save(); }
}

// A typed address becomes the WebSocket URL: ws(s):// as is, else host[:port] -> wss://host[:port]/multiplayer (ws:// for localhost).
export function addressUrl(ip) {
  const text = String(ip).trim();
  if (/^wss?:\/\//i.test(text)) return text;
  const local = /^(localhost|127\.|\[::1\])/i.test(text);
  return `${local ? 'ws' : 'wss'}://${text}${text.includes('/') ? '' : '/multiplayer'}`;
}
// GuiScreenAddServer.func_146...: Done needs a name and an address (GuiScreenAddServer.e(): both non-empty).
export const validEntry = (name, ip) => name.trim().length > 0 && ip.trim().length > 0;
export const RESOURCE_MODES = ['enabled', 'disabled', 'prompt'];
export const resourceMode = accept => (accept === true ? 'enabled' : accept === false ? 'disabled' : 'prompt');
export const nextResourceMode = accept => RESOURCE_MODES[(RESOURCE_MODES.indexOf(resourceMode(accept)) + 1) % 3];
export const modeAccept = mode => (mode === 'enabled' ? true : mode === 'disabled' ? false : null);

// bfz.b(): button rectangles, centre c, height h.
export function serverListLayout(w, h) {
  const c = half(w), b = (x, y, bw) => ({ x, y, w: bw, h: 20 });
  return {
    title: [c, 20], list: { top: 32, bottom: h - 64, slotHeight: 36, width: 305, scrollbarX: c + 154 },
    buttons: { edit: b(c - 154, h - 28, 70), delete: b(c - 74, h - 28, 70), select: b(c - 154, h - 52, 100), direct: b(c - 50, h - 52, 100), add: b(c + 4 + 50, h - 52, 100), refresh: b(c + 4, h - 28, 70), cancel: b(c + 4 + 76, h - 28, 75) },
  };
}
export function addServerLayout(w, h) {
  const c = half(w), q = Math.trunc(h / 4);
  return { title: [c, 17], nameLabel: [c - 100, 53], ipLabel: [c - 100, 94], name: { x: c - 100, y: 66, w: 200, h: 20 }, ip: { x: c - 100, y: 106, w: 200, h: 20 },
    buttons: { done: { x: c - 100, y: q + 96 + 18, w: 200, h: 20 }, cancel: { x: c - 100, y: q + 120 + 18, w: 200, h: 20 }, pack: { x: c - 100, y: q + 72, w: 200, h: 20 } } };
}
export function directLayout(w, h) {
  const c = half(w), q = Math.trunc(h / 4);
  return { title: [c, 20], label: [c - 100, 100], ip: { x: c - 100, y: 116, w: 200, h: 20 },
    buttons: { join: { x: c - 100, y: q + 96 + 12, w: 200, h: 20 }, cancel: { x: c - 100, y: q + 120 + 12, w: 200, h: 20 } } };
}
// bdf: GuiDisconnected. Title (the translated heading) at (w/2, h/2 - 50) in 0xAAAAAA, the reason's lines from h/2 - 30 white, 9 apart,
// wrapped to w - 50; one button gui.toMenu at (w/2 - 100, h/4 + 120 + 12), 200 x 20, which returns to the parent screen.
export function disconnectedLayout(w, h) {
  return { title: [half(w), half(h) - 50], messageY: half(h) - 30, wrap: w - 50, button: { x: half(w) - 100, y: Math.trunc(h / 4) + 120 + 12, w: 200, h: 20 } };
}
// Heading by phase (bjb.onDisconnect: disconnect.lost once logged in; bcy / biz: connect.failed while connecting).
export const disconnectHeading = loggedIn => (loggedIn ? 'disconnect.lost' : 'connect.failed');

export function disconnectedScreen({ headingKey, message, back }) {
  return {
    id: 'disconnected',
    escape() {}, // GuiDisconnected.keyTyped is empty
    init(g, w, h) {
      const L = disconnectedLayout(w, h);
      g.text(tr(headingKey), L.title[0], L.title[1], { center: true, color: 0xaaaaaa });
      splitLines(String(message), L.wrap).forEach((line, i) => g.text(line, L.title[0], L.messageY + 9 * i, { center: true }));
      g.button(L.button, tr('gui.toMenu'), back);
    },
  };
}

function nameFieldScreen({ id, title, layout, fields, buttons }) { return { id, escape: buttons.cancel, init: (g, w, h) => { const L = layout(w, h); g.text(title, L.title[0], L.title[1], { center: true }); fields(g, L); } }; }

export function addServerScreen({ entry, done, cancel }) {
  const v = { name: entry.name, ip: entry.ip, accept: entry.acceptTextures ?? null }; let finish;
  return nameFieldScreen({ id: 'add-server', title: tr('addServer.title'), layout: addServerLayout, buttons: { cancel },
    fields(g, L) {
      g.text(tr('addServer.enterName'), ...L.nameLabel, { color: COLOR.label });
      g.text(tr('addServer.enterIp'), ...L.ipLabel, { color: COLOR.label });
      const label = () => `${tr('addServer.resourcePack')}: ${tr('addServer.resourcePack.' + resourceMode(v.accept))}`;
      g.button(L.buttons.pack, label(), () => { v.accept = modeAccept(nextResourceMode(v.accept)); g.build(); });
      finish = g.button(L.buttons.done, tr('addServer.add'), () => { if (validEntry(v.name, v.ip)) done({ name: v.name.trim(), ip: v.ip.trim(), acceptTextures: v.accept }); });
      g.button(L.buttons.cancel, tr('gui.cancel'), cancel);
      g.field(L.name, { value: v.name, maxLength: 128, focus: true, label: tr('addServer.enterName'), input: x => { v.name = x; finish.enable(validEntry(v.name, v.ip)); } });
      g.field(L.ip, { value: v.ip, maxLength: 128, label: tr('addServer.enterIp'), input: x => { v.ip = x; finish.enable(validEntry(v.name, v.ip)); } });
      finish.enable(validEntry(v.name, v.ip));
    } });
}

export function directConnectScreen({ address = '', connect, cancel }) {
  let ip = address, join;
  return nameFieldScreen({ id: 'direct-connect', title: tr('selectServer.direct'), layout: directLayout, buttons: { cancel },
    fields(g, L) {
      g.text(tr('addServer.enterIp'), ...L.label, { color: COLOR.label });
      join = g.button(L.buttons.join, tr('selectServer.select'), () => { if (ip.trim()) connect(ip.trim()); });
      g.button(L.buttons.cancel, tr('gui.cancel'), cancel);
      g.field(L.ip, { value: ip, maxLength: 128, focus: true, label: tr('addServer.enterIp'), input: x => { ip = x; join.enable(ip.trim().length > 0); } });
      join.enable(ip.trim().length > 0);
    } });
}

const ICONS = "url('/media/1.7.10/gui/icons.png') no-repeat";
// GuiMultiplayer. `list` is a ServerList; `ping(url)` -> Promise<status> (client-ping.pingServer); `show(screen)` opens another screen;
// `join(url, entry)` leaves for the sign-in and join screen; `back()` returns to the main menu.
export function serverListScreen({ list, ping = pingServer, show, join, back }) {
  let selected = -1, scroll = 0, statuses = [], buttons = null, started = false, listUi = null, self = null, pingSprites = [], animTimer = null; // b69 mptabcomplete: pingSprites animate each frame
  const refresh = (g) => {
    statuses = list.entries.map(() => newStatus());
    list.entries.forEach((e, i) => { const st = statuses[i]; ping(addressUrl(e.ip)).then(r => { if (statuses[i] === st) { statuses[i] = r; g?.screen === self && g.build(); } }); });
  };
  const selectedEntry = () => list.entries[selected];
  const reopen = () => show(self);
  const editEntry = (g) => {
    const e = selectedEntry(); if (!e) return;
    show(addServerScreen({ entry: e, cancel: reopen, done: v => { list.set(selected, v); started = false; reopen(); } }));
  };
  const remove = () => {
    const e = selectedEntry(); if (!e) return;
    const L = { line1: tr('selectServer.deleteQuestion'), line2: `'${e.name}' ${tr('selectServer.deleteWarning')}` };
    show({ id: 'confirm', escape: reopen, init(g, w, h) {
      g.text(L.line1, half(w), 90, { center: true }); g.text(L.line2, half(w), 105, { center: true });
      g.button({ x: half(w) - 155, y: Math.trunc(h / 6) + 96, w: 150, h: 20 }, tr('selectServer.deleteButton'), () => { list.remove(selected); selected = -1; started = false; reopen(); });
      g.button({ x: half(w) + 5, y: Math.trunc(h / 6) + 96, w: 150, h: 20 }, tr('gui.cancel'), reopen);
    } });
  };
  // ServerListEntryNormal.func_148279_a redraws every frame: while a server is pinging its sprite follows Minecraft.getSystemTime (client-ping.pingAnimationRow).
  const stopAnimation = () => { if (animTimer !== null) clearInterval(animTimer); animTimer = null; };
  const startAnimation = () => { if (animTimer === null && typeof setInterval === 'function') { animTimer = setInterval(animate, 50); animTimer.unref?.(); } };
  const animate = () => {
    pingSprites = pingSprites.filter((p) => statuses[p.index] === p.st && rowState(p.st).pinging && p.sprite.isConnected !== false);
    if (!pingSprites.length) return stopAnimation();
    const t = Date.now();
    for (const p of pingSprites) p.sprite.style.backgroundPosition = `calc(${-10}*var(--u)) calc(${-(176 + 8 * pingAnimationRow(t, p.index))}*var(--u))`;
  };
  self = {
    id: 'server-list',
    escape: back,
    init(g, w, h) {
      self.g = g;
      stopAnimation(); pingSprites = [];
      if (!started) { started = true; refresh(g); }
      const L = serverListLayout(w, h);
      listUi = g.slotList(L.list, {
        count: list.entries.length, scroll, selected: i => i === selected,
        entry(i, y, parent, x) {
          const e = list.entries[i], st = statuses[i] ?? newStatus(), r = rowState(st), rowW = 305;
          g.text(e.name, x + 35, y + 1, { parent });
          splitLines(st.motd, rowW - 34).slice(0, 2).forEach((line, k) => g.text(line, x + 35, y + 12 + 9 * k, { color: COLOR.gray, parent }));
          const rt = r.rightText; if (rt) g.text(rt, x + rowW - textWidth(rt) - 15 - 2, y + 1, { color: COLOR.gray, parent });
          const sprite = g.image('', x + rowW - 15, y, 10, 8, parent), row = r.pinging ? pingAnimationRow(Date.now(), i) : r.row;
          sprite.style.cssText += `;background:${ICONS};background-size:calc(256*var(--u)) calc(256*var(--u));background-position:calc(${-(r.pinging ? 10 : 0)}*var(--u)) calc(${-(176 + 8 * row)}*var(--u));image-rendering:pixelated`;
          if (r.pinging) { pingSprites.push({ sprite, index: i, st }); startAnimation(); } // also when scrolling re-creates the rows
          sprite.title = r.hover ? (Array.isArray(r.hover) ? r.hover.join('\n') : r.hover) : r.label;
          if (st.icon) { const icon = g.image('', x, y, 32, 32, parent); icon.style.cssText += `;background:url(${st.icon}) no-repeat;background-size:100% 100%;image-rendering:pixelated`; }
        },
        click(i, double) { selected = i; for (const k of ['edit', 'delete', 'select']) buttons[k].enable(true); if (double) join(addressUrl(selectedEntry().ip), selectedEntry()); },
      });
      g.text(tr('multiplayer.title'), ...L.title, { center: true });
      const b = L.buttons;
      buttons = {
        edit: g.button(b.edit, tr('selectServer.edit'), () => editEntry(g)),
        delete: g.button(b.delete, tr('selectServer.delete'), remove),
        select: g.button(b.select, tr('selectServer.select'), () => { const e = selectedEntry(); if (e) join(addressUrl(e.ip), e); }),
        direct: g.button(b.direct, tr('selectServer.direct'), () => show(directConnectScreen({ cancel: reopen, connect: ip => join(addressUrl(ip), { name: tr('selectServer.defaultName'), ip }) }))),
        add: g.button(b.add, tr('selectServer.add'), () => show(addServerScreen({ entry: { name: tr('selectServer.defaultName'), ip: '' }, cancel: reopen, done: v => { list.add(v); started = false; reopen(); } }))),
        refresh: g.button(b.refresh, tr('selectServer.refresh'), () => { started = false; scroll = listUi?.scroll ?? 0; g.build(); }),
        cancel: g.button(b.cancel, tr('gui.cancel'), back),
      };
      for (const k of ['edit', 'delete', 'select']) buttons[k].enable(selected >= 0);
    },
    close() { scroll = listUi?.scroll ?? 0; stopAnimation(); },
  };
  return self;
}
