// BlockJukebox (alq, original 84) with TileEntityJukebox (alr), ItemRecord (adr) and the GuiIngame record line, Java 1.7.10, as a
// LiveRedstone behaviour of original id 84. Native values are replayed from public/research/note-jukebox-reference.json by
// src/note-jukebox.test.js. The block state, the HUD line, the comparator and the ejection are the original's; the record
// itself plays through main.js (audio.js playRecord, music.js recordSound) once npm run music:fetch has installed the
// streams, which the repository does not ship (public/research/music.md).
import { NBT } from './nbt.js';
import { nbtGet } from './nbt-get.js';
import { isDisc, canonicalDisc, discIndex, discOriginal, DISC_ORIGINAL_FIRST, DISC_FIRST, DISC_COUNT, nowPlaying } from './note-jukebox-content.js';

export const JUKEBOX_ID = 84;
const f = Math.fround;

// TileEntityJukebox.writeToNBT: id RecordPlayer, x, y, z, legacy Record int and RecordItem (the stack as ItemStack.writeToNBT).
// `record` is { id (internal item), count, damage } | null; `original` converts an internal item to its original id.
export function writeJukeboxTile(tile, x, y, z, original = discOriginal) {
  const t = (type, value) => ({ type, value });
  const map = new Map([['id', t(NBT.STRING, 'RecordPlayer')], ['x', t(NBT.INT, x)], ['y', t(NBT.INT, y)], ['z', t(NBT.INT, z)]]);
  if (tile.record) {
    const id = original(tile.record.id);
    map.set('Record', t(NBT.INT, id));
    map.set('RecordItem', t(NBT.COMPOUND, new Map([['id', t(NBT.SHORT, id)], ['Count', t(NBT.BYTE, tile.record.count ?? 1)], ['Damage', t(NBT.SHORT, tile.record.damage ?? 0)]])));
  }
  return map;
}
// TileEntityJukebox.readFromNBT: RecordItem when present, otherwise a positive legacy Record int is a one-item stack of that id.
// `internal` converts an original item id to this build's item (null when it has none).
export function readJukeboxTile(tag, internal = (id) => (id >= DISC_ORIGINAL_FIRST && id < DISC_ORIGINAL_FIRST + DISC_COUNT ? DISC_FIRST + id - DISC_ORIGINAL_FIRST : null)) {
  const item = tag.get('RecordItem');
  if (item?.type === NBT.COMPOUND) {
    const id = internal(nbtGet(item.value, 'id', NBT.SHORT, 0));
    return { record: id ? { id, count: nbtGet(item.value, 'Count', NBT.BYTE, 1), damage: nbtGet(item.value, 'Damage', NBT.SHORT, 0) } : null };
  }
  const legacy = nbtGet(tag, 'Record', NBT.INT, 0), id = legacy > 0 ? internal(legacy) : null;
  return { record: id ? { id, count: 1, damage: 0 } : null };
}

// The comparator reading: ItemRecord id + 1 - record_13 id, so disc index + 1 (0 when empty or not a disc).
export const jukeboxSignal = (tile) => (tile?.record && isDisc(tile.record.id) ? discIndex(tile.record.id) + 1 : 0);

// BlockJukebox.dropRecord's item position (World.rand: three nextFloat calls).
export function ejectOffsets(rand) {
  const size = f(0.7), rest = f(f(1) - size);
  const d0 = f(rand.nextFloat() * size) + rest * 0.5;
  const d1 = f(rand.nextFloat() * size) + rest * 0.2 + 0.6;
  const d2 = f(rand.nextFloat() * size) + rest * 0.5;
  return [d0, d1, d2];
}

// hooks: play(discItem | null, x, y, z) (RenderGlobal.playRecord: stops the record at x, y, z, then plays a disc and sets its HUD line),
// spawn(stack, x, y, z) with the 10-tick pickup delay, changed().
export function installJukeboxes(redstone, { play = () => {}, spawn = () => {}, changed = () => {} } = {}) {
  const tiles = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  const tile = (x, y, z) => {
    const k = key(x, y, z);
    if (!tiles.has(k)) tiles.set(k, { record: null });
    return tiles.get(k);
  };
  // BlockJukebox.dropRecord: stop the record, empty the tile, metadata 0 (flags 2), the disc as an item entity.
  const eject = (w, x, y, z) => {
    const t = tiles.get(key(x, y, z));
    if (!t?.record) return false;
    const stack = t.record;
    play(null, x, y, z);
    t.record = null;
    w.setBlockMetadataWithNotify(x, y, z, 0, 2);
    const [d0, d1, d2] = ejectOffsets(w.rand);
    spawn({ ...stack }, x + d0, y + d1, z + d2);
    changed();
    return true;
  };
  redstone.registerBehaviour(JUKEBOX_ID, {
    // BlockJukebox.onBlockActivated: only a loaded jukebox (metadata 1) reacts, by ejecting.
    onBlockActivated(w, x, y, z) {
      if (w.getBlockMetadata(x, y, z) === 0) return false;
      eject(w, x, y, z);
      return true;
    },
    breakBlock(w, x, y, z) {
      eject(w, x, y, z);
      if (w.getBlock(x, y, z) !== JUKEBOX_ID) tiles.delete(key(x, y, z));
    },
    comparator: (w, x, y, z) => jukeboxSignal(tiles.get(key(x, y, z))),
  });
  return {
    tile,
    // ItemRecord.onItemUse on a jukebox with metadata 0: insert the disc (the caller takes it from the stack outside Creative).
    insert(x, y, z, item) {
      if (!isDisc(item) || redstone.getBlock(x, y, z) !== JUKEBOX_ID || redstone.getBlockMetadata(x, y, z) !== 0) return false;
      tile(x, y, z).record = { id: canonicalDisc(item), count: 1, damage: 0 };
      redstone.setBlockMetadataWithNotify(x, y, z, 1, 2);
      play(canonicalDisc(item), x, y, z);
      changed();
      return true;
    },
    save: () => [...tiles].filter(([k, v]) => v.record && (() => { const p = k.split(',').map(Number); return !redstone.loaded?.(...p) || redstone.getBlock(...p) === JUKEBOX_ID; })()).map(([k, v]) => { const [x, y, z] = k.split(',').map(Number); return { x, y, z, record: { ...v.record } }; }),
    restore(records) { tiles.clear(); for (const e of records ?? []) if ([e.x, e.y, e.z].every(Number.isInteger) && e.record && isDisc(e.record.id)) tiles.set(key(e.x, e.y, e.z), { record: { id: canonicalDisc(e.record.id), count: 1, damage: 0 } }); },
  };
}

// java.awt.Color.HSBtoRGB in float arithmetic: 0xAARRGGBB with alpha 255.
export function hsbToRgb(hue, saturation, brightness) {
  const h = f(hue), s = f(saturation), b = f(brightness);
  const c = (v) => Math.trunc(f(f(v * 255) + f(0.5)));
  if (s === 0) { const v = c(b); return (255 << 24) | (v << 16) | (v << 8) | v; }
  const x = f(f(h - Math.floor(h)) * 6), frac = f(x - Math.floor(x));
  const p = f(b * f(1 - s)), q = f(b * f(1 - f(s * frac))), t = f(b * f(1 - f(s * f(1 - frac))));
  const [r, g, bl] = [[b, t, p], [q, b, p], [p, b, t], [p, q, b], [t, p, b], [b, p, q]][Math.trunc(x)];
  return (255 << 24) | (c(r) << 16) | (c(g) << 8) | c(bl);
}
// GuiIngame.renderGameOverlay: the line shows for 60 ticks; alpha = f2 * 255 / 20 capped at 255, drawn only above 8; the colour
// cycles with Color.HSBtoRGB(f2 / 50, 0.7, 0.6) while a record is playing (white otherwise). f2 = recordPlayingUpFor - partialTicks.
export function recordLine(upFor, partial, isRecord = true) {
  const f2 = f(upFor - f(partial));
  let alpha = Math.trunc(f(f(f2 * 255) / 20));
  if (alpha > 255) alpha = 255;
  const rgb = isRecord ? hsbToRgb(f(f2 / 50), 0.7, 0.6) & 0xffffff : 0xffffff;
  return { alpha, rgb, visible: alpha > 8 };
}
// The HUD line: a div at the bottom centre (GuiIngame translates to (width / 2, height - 68), text centred at y -4).
export function createRecordHud(parent) {
  const el = parent.ownerDocument.createElement('div');
  el.id = 'record-hud';
  el.style.cssText = 'position:fixed;left:50%;bottom:60px;transform:translateX(-50%);pointer-events:none;white-space:nowrap;font-size:16px;text-shadow:2px 2px #3f3f3f;z-index:4;display:none';
  parent.appendChild(el);
  const state = { text: '', upFor: 0, record: false };
  const draw = (partial = 0) => {
    if (state.upFor <= 0) { el.style.display = 'none'; return; }
    const line = recordLine(state.upFor, partial, state.record);
    el.style.display = line.visible ? 'block' : 'none';
    el.style.opacity = String(line.alpha / 255);
    el.style.color = `#${line.rgb.toString(16).padStart(6, '0')}`;
    el.textContent = state.text;
  };
  return {
    // GuiIngame.setRecordPlayingMessage: the text, 60 ticks, rainbow colour.
    show(item) { state.text = nowPlaying(item); state.upFor = 60; state.record = true; draw(); },
    tick() { if (state.upFor > 0) state.upFor--; },
    frame: draw,
    state,
  };
}
