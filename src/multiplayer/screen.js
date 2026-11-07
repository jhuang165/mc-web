import { DEFAULT_SERVER } from './protocol.js';

// Browser-server connection form; intentionally doesn't pretend to discover
// Java LAN servers. It uses the game's existing bitmap-font GUI widgets.
export function multiplayerScreen({ back, connect, defaults = {} }) {
  const values = { url: defaults.url || DEFAULT_SERVER, name: defaults.name || 'Player', token: '' };
  let busy = false, error = '';
  const screen = {
    id: 'multiplayer',
    escape: () => { if (!busy) back(); },
    init(g, w, h) {
      const x = Math.floor(w / 2) - 150, top = Math.max(28, Math.floor(h / 2) - 96);
      g.text('Multiplayer', w / 2, 12, { center: true });
      g.text('ledoge0 · shared Creative world · 128 × 128 blocks', w / 2, top, { center: true, color: 0xaaaaaa });
      const fields = [['url', 'Server address', 512], ['name', 'Player name', 16], ['token', 'Server key', 128]];
      fields.forEach(([key, label, maxLength], index) => {
        const y = top + 22 + index * 36;
        g.text(label, x, y, { color: 0xaaaaaa });
        g.field({ x, y: y + 11, w: 300, h: 20 }, { value: values[key], maxLength, label, input: value => { values[key] = value; } });
      });
      g.text(error || (busy ? 'Connecting and downloading terrain…' : 'Server key is supplied by the world owner.'), w / 2, top + 137, { center: true, color: error ? 0xff7777 : 0xaaaaaa });
      g.button({ x, y: top + 154, w: 146, h: 20 }, busy ? 'Connecting…' : 'Join Server', async () => {
        if (busy) return;
        busy = true; error = ''; g.build();
        try { await connect({ ...values }); }
        catch (e) { error = String(e.message).slice(0, 85); busy = false; g.build(); }
      }, { enabled: !busy });
      g.button({ x: x + 154, y: top + 154, w: 146, h: 20 }, 'Cancel', back, { enabled: !busy });
    },
  };
  return screen;
}
