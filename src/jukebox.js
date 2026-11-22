// BlockJukebox (alq, original 84) with TileEntityJukebox (alr), ItemRecord (adr) and the GuiIngame record line, Java 1.7.10, as a
// LiveRedstone behaviour of original id 84. Native values are replayed from public/research/note-jukebox-reference.json by
// src/note-jukebox.test.js. The block state, the HUD line, the comparator and the ejection are the original's; the record
// itself plays through main.js (audio.js playRecord, music.js recordSound) once npm run music:fetch has installed the
// streams, which the repository does not ship (public/research/music.md).
import { bitmapHtml } from './bitmap-text.js';
import { font } from './font-renderer.js';
import { NBT } from './nbt.js';
import { nbtGet } from './nbt-get.js';
import { ITEM_KEYS } from './item-keys-data.js';
import { ORIGINAL_ITEMS } from './original-items.js';
import { isDisc, canonicalDisc, discIndex, discOriginal, DISC_ORIGINAL_FIRST, DISC_FIRST, DISC_COUNT, nowPlaying } from './note-jukebox-content.js';

export const JUKEBOX_ID = 84;
const f = Math.fround;

// Internal item id -> { id: original id, damage } for every item the port maps (the exporter's table, first mapping wins).
const REVERSE = new Map();
for (const [key, live] of Object.entries(ORIGINAL_ITEMS)) { const [o, damage] = key.split(':').map(Number); if (!REVERSE.has(live) || damage === undefined) REVERSE.set(live, { id: o, damage }); }
// b95 tiles95: TileEntityJukebox keeps any ItemStack (executed: a stone or a stack of three is written back as it was); discs go through discOriginal, other items through the item table.
export const jukeboxOriginal = (id) => (isDisc(id) ? { id: discOriginal(id), damage: undefined } : REVERSE.get(id) ?? null);
// TileEntityJukebox.writeToNBT: id RecordPlayer, x, y, z, legacy Record int and RecordItem (the stack as ItemStack.writeToNBT).
// `record` is { id (internal item), count, damage } | null; `original` converts an internal item to its original id (a number, or { id, damage }, or null when unmapped).
// b96 tiles96: `entryOf(stack)` (region-export's stackNbt) writes the whole stack: tag compound and the raw Damage. Without it only id, Count and Damage are written.
// A stack the port cannot draw but 1.7.10 registers keeps `rawId`; a legacy Record int naming no registered item is a stack with a null item (`ghost`), which native
// writes as Record 0 and a RecordItem with id 0, Count 1 and Damage 0 (executed, tiles96-reference.json).
export function writeJukeboxTile(tile, x, y, z, original = jukeboxOriginal, entryOf = null) {
  const t = (type, value) => ({ type, value });
  const map = new Map([['id', t(NBT.STRING, 'RecordPlayer')], ['x', t(NBT.INT, x)], ['y', t(NBT.INT, y)], ['z', t(NBT.INT, z)]]);
  const record = tile.record;
  if (record?.ghost) {
    map.set('Record', t(NBT.INT, 0));
    map.set('RecordItem', t(NBT.COMPOUND, new Map([['id', t(NBT.SHORT, 0)], ['Count', t(NBT.BYTE, record.count ?? 1)], ['Damage', t(NBT.SHORT, 0)]])));
    return map;
  }
  if (record?.rawId > 0) {
    const raw = Number.isInteger(record.rawDamage) && record.rawDamage > 0 ? record.rawDamage : 0;
    map.set('Record', t(NBT.INT, record.rawId));
    map.set('RecordItem', t(NBT.COMPOUND, new Map([['id', t(NBT.SHORT, record.rawId)], ['Count', t(NBT.BYTE, record.count ?? 1)], ['Damage', t(NBT.SHORT, raw)]])));
    return map;
  }
  const o = record ? original(record.id) : null, id = typeof o === 'number' ? o : o?.id;
  if (id) {
    const entry = entryOf?.(record);
    map.set('Record', t(NBT.INT, id));
    map.set('RecordItem', t(NBT.COMPOUND, entry ?? new Map([['id', t(NBT.SHORT, id)], ['Count', t(NBT.BYTE, record.count ?? 1)], ['Damage', t(NBT.SHORT, o?.damage ?? record.damage ?? 0)]])));
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

// b95 tiles95: the same read for any item. `convert(compound)` turns an ItemStack compound into the port's { id, count, damage } (null when the port has no such item);
// the legacy Record int is a one-item stack of that id.
// b96 tiles96 (executed): ItemStack.loadItemStackFromNBT keeps a stack whenever Item.getItemById(id) is registered, so a registered item the port cannot draw is
// kept as `{ id: 0, rawId, count, damage: 0 }` (RecordItem) and a legacy Record int is a one-item stack even when no item has that id (`ghost`, a null item:
// every int above 0 reads that way, 32768 and up included). A RecordItem naming no registered item is no stack (so Record is not consulted either).
const registered = (id) => Number.isInteger(id) && id > 0 && id in ITEM_KEYS;
export function readJukeboxStack(tag, convert) {
  const item = tag.get('RecordItem');
  if (item?.type === NBT.COMPOUND) {
    const record = convert(item.value);
    if (record) return { record };
    const raw = nbtGet(item.value, 'id', NBT.SHORT, 0);
    return { record: registered(raw) ? { id: 0, rawId: raw, count: nbtGet(item.value, 'Count', NBT.BYTE, 0), damage: 0 } : null };
  }
  const legacy = nbtGet(tag, 'Record', NBT.INT, 0);
  if (legacy <= 0) return { record: null };
  const record = legacy <= 32767 ? convert(new Map([['id', { type: NBT.SHORT, value: legacy }], ['Count', { type: NBT.BYTE, value: 1 }], ['Damage', { type: NBT.SHORT, value: 0 }]])) : null;
  if (record) return { record };
  return { record: registered(legacy) ? { id: 0, rawId: legacy, count: 1, damage: 0 } : { id: 0, ghost: true, count: 1, damage: 0 } };
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
    if ((stack.count | 0) > 0 && stack.id > 0) spawn({ ...stack }, x + d0, y + d1, z + d2); // b95 tiles95: a kept Count 0 stack has nothing to drop here (the port's item entity needs a count); b96 tiles96: nor has a stack with no port item (rawId, ghost: unproven natively, bytecode not read)
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
    // b84 cmdfix84: BlockJukebox.breakBlock's dropRecord for a block replaced outside the redstone engine (/setblock): stop the record, empty the tile, the disc as an item.
    eject: (x, y, z) => eject(redstone, x, y, z),
    // ItemRecord.onItemUse on a jukebox with metadata 0: insert the disc (the caller takes it from the stack outside Creative).
    // b96 tiles96: `stack` is the held stack; BlockJukebox.func_149926_b stores stack.copy() with its size 1, so the tag and Damage ride along.
    insert(x, y, z, item, stack = null) {
      if (!isDisc(item) || redstone.getBlock(x, y, z) !== JUKEBOX_ID || redstone.getBlockMetadata(x, y, z) !== 0) return false;
      tile(x, y, z).record = { ...(stack && stack.id === item ? stack : {}), id: canonicalDisc(item), count: 1, damage: 0 };
      redstone.setBlockMetadataWithNotify(x, y, z, 1, 2);
      play(canonicalDisc(item), x, y, z);
      changed();
      return true;
    },
    save: () => [...tiles].filter(([k, v]) => v.record && (() => { const p = k.split(',').map(Number); return !redstone.loaded?.(...p) || redstone.getBlock(...p) === JUKEBOX_ID; })()).map(([k, v]) => { const [x, y, z] = k.split(',').map(Number); return { x, y, z, record: { ...v.record } }; }),
    restore(records) { // b95 tiles95: any stack, as the tile keeps; b96 tiles96: with its tags, raw Damage and the rawId / ghost stacks
      tiles.clear();
      for (const e of records ?? []) {
        const r = e?.record;
        if (![e?.x, e?.y, e?.z].every(Number.isInteger) || !r) continue;
        const kept = (Number.isInteger(r.id) && r.id > 0) || (r.id === 0 && (r.ghost === true || (Number.isInteger(r.rawId) && r.rawId > 0)));
        if (!kept) continue;
        tiles.set(key(e.x, e.y, e.z), { record: { ...r, id: isDisc(r.id) ? canonicalDisc(r.id) : r.id, count: Number.isInteger(r.count) ? r.count : 1, damage: Number.isInteger(r.damage) ? r.damage : 0 } });
      }
    },
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
  el.id = 'record-hud'; el.className = 'mc-text';
  el.style.cssText = 'position:fixed;left:50%;bottom:calc(30*var(--u,2px));transform:translateX(-50%);pointer-events:none;white-space:nowrap;font-size:calc(8*var(--u,2px));line-height:calc(8*var(--u,2px));z-index:4;display:none';
  parent.appendChild(el);
  const state = { text: '', upFor: 0, record: false };
  const draw = (partial = 0) => {
    if (state.upFor <= 0) { el.style.display = 'none'; return; }
    const line = recordLine(state.upFor, partial, state.record);
    el.style.display = line.visible ? 'block' : 'none';
    el.style.opacity = String(line.alpha / 255);
    el.style.setProperty('--c', `#${line.rgb.toString(16).padStart(6, '0')}`); el.style.setProperty('--cs', `#${((line.rgb & 0xfcfcfc) >> 2).toString(16).padStart(6, '0')}`); // FontRenderer shadow colour
    if (el.dataset.text !== state.text + font.version) { el.dataset.text = state.text + font.version; el.innerHTML = bitmapHtml(state.text, null); }
  };
  return {
    // GuiIngame.setRecordPlayingMessage: the text, 60 ticks, rainbow colour.
    show(item) { state.text = nowPlaying(item); state.upFor = 60; state.record = true; draw(); },
    // GuiIngame.func_110326_a(text, false): the same line without the rainbow (mount.onboard).
    message(text, rainbow = false) { state.text = String(text); state.upFor = 60; state.record = !!rainbow; draw(); },
    tick() { if (state.upFor > 0) state.upFor--; },
    frame: draw,
    state,
  };
}
