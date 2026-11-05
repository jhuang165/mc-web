// BlockNote (amj, original 25) and TileEntityNote (apl), Java 1.7.10, as a LiveRedstone behaviour of original id 25.
// Native values (the instrument table, events, sounds, particles, NBT clamp, particle colour) are replayed from
// public/research/note-jukebox-reference.json by src/note-jukebox.test.js.
import { NBT } from './nbt.js';
import { nbtGet } from './nbt-get.js';

export const NOTE_ID = 25;
export const INSTRUMENT_SOUNDS = ['harp', 'bd', 'snare', 'hat', 'bassattack'];
// TileEntityNote.triggerNote: the instrument is the Material of the block below (rock 1, sand 2, glass 3, wood 4, otherwise 0).
// Original block ids per instrument, for every id in Block.blockRegistry (probed over all 0-175, "instruments" in the reference).
const BY_INSTRUMENT = {
  1: [1, 4, 7, 14, 15, 16, 21, 23, 24, 43, 44, 45, 48, 49, 52, 56, 61, 62, 67, 70, 73, 74, 87, 98, 108, 109, 112, 113, 114, 116, 120, 121, 128, 129, 130, 139, 153, 155, 156, 158, 159, 172, 173],
  2: [12, 13, 88],
  3: [20, 89, 95, 102, 138, 160],
  4: [5, 17, 25, 47, 53, 54, 58, 63, 64, 68, 72, 84, 85, 96, 99, 100, 107, 125, 126, 134, 135, 136, 146, 151, 162, 163, 164],
};
const INSTRUMENT = new Uint8Array(256);
for (const [instrument, ids] of Object.entries(BY_INSTRUMENT)) for (const id of ids) INSTRUMENT[id] = Number(instrument);
export const instrumentBelow = (id) => (id >= 0 && id < 256 ? INSTRUMENT[id] : 0);
// BlockNote.onBlockEventReceived: the sound name by event, 2^((note - 12) / 12) as a float.
export const noteSound = (instrument) => `note.${INSTRUMENT_SOUNDS[instrument] ?? 'harp'}`;
export const notePitch = (note) => Math.fround(Math.pow(2, (note - 12) / 12));

// MathHelper.sin: the 65536-entry float table.
const SIN = new Float32Array(65536);
for (let i = 0; i < 65536; i++) SIN[i] = Math.sin((i * Math.PI * 2) / 65536);
const sin = (x) => SIN[Math.trunc(Math.fround(x * Math.fround(10430.378))) & 65535];
const f = Math.fround;
// EntityNoteFX (bkl): colour from the note fraction (the particle's x velocity, note / 24).
export function noteColour(fraction) {
  const v = f(fraction), third = f(1 / 3), two = f(2 / 3);
  const channel = (offset) => f(f(sin(f(f(f(v + offset) * f(Math.PI)) * 2)) * f(0.65)) + f(0.35));
  return [channel(0), channel(third), channel(two)];
}

const t = (type, value) => ({ type, value });
export const newNoteTile = () => ({ note: 0, powered: false });
// TileEntityNote.readFromNBT: the byte is clamped to 0-24 (a missing tag reads 0).
export function readNoteTile(tag) {
  const raw = nbtGet(tag, 'note', NBT.BYTE, 0);
  return { note: Math.max(0, Math.min(24, raw)), powered: false };
}
// TileEntityNote.writeToNBT: id Music, x, y, z, note byte (the redstone state is not saved).
export function writeNoteTile(tile, x, y, z) {
  return new Map([['id', t(NBT.STRING, 'Music')], ['x', t(NBT.INT, x)], ['y', t(NBT.INT, y)], ['z', t(NBT.INT, z)], ['note', t(NBT.BYTE, tile.note)]]);
}

// hooks: particle(name, x, y, z, vx, vy, vz), changed().
export function installNoteBlocks(redstone, { particle = () => {}, changed = () => {} } = {}) {
  const tiles = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  const tile = (x, y, z) => {
    const k = key(x, y, z);
    if (!tiles.has(k)) tiles.set(k, newNoteTile());
    return tiles.get(k);
  };
  // TileEntityNote.triggerNote: nothing plays unless the block above is air.
  const trigger = (w, x, y, z, t) => {
    if (w.getBlock(x, y + 1, z) !== 0) return;
    w.addBlockEvent(x, y, z, NOTE_ID, instrumentBelow(w.getBlock(x, y - 1, z)), t.note);
  };
  redstone.registerBehaviour(NOTE_ID, {
    onNeighborBlockChange(w, x, y, z) {
      const powered = w.isBlockIndirectlyGettingPowered(x, y, z), t = tile(x, y, z);
      if (t.powered !== powered) {
        if (powered) trigger(w, x, y, z, t);
        t.powered = powered;
      }
    },
    // BlockNote.onBlockActivated: changePitch then trigger; onBlockClicked: trigger.
    onBlockActivated(w, x, y, z) {
      const t = tile(x, y, z);
      t.note = (t.note + 1) % 25;
      trigger(w, x, y, z, t);
      changed();
      return true;
    },
    onBlockClicked(w, x, y, z) {
      trigger(w, x, y, z, tile(x, y, z));
    },
    // BlockNote.onBlockEventReceived: playSoundEffect(x + .5, y + .5, z + .5, "note.<instrument>", 3, pitch) and the note particle.
    onBlockEventReceived(w, x, y, z, event, param) {
      w.playSoundEffect(x + 0.5, y + 0.5, z + 0.5, noteSound(event), 3, notePitch(param));
      particle('note', x + 0.5, y + 1.2, z + 0.5, param / 24, 0, 0);
      return true;
    },
    breakBlock(w, x, y, z) { if (w.getBlock(x, y, z) !== NOTE_ID) tiles.delete(key(x, y, z)); },
  });
  return {
    tile,
    click: (x, y, z) => redstone.behaviours[NOTE_ID].onBlockClicked(redstone, x, y, z),
    save: () => [...tiles].filter(([k]) => { const p = k.split(',').map(Number); return !redstone.loaded?.(...p) || redstone.getBlock(...p) === NOTE_ID; }).map(([k, v]) => { const [x, y, z] = k.split(',').map(Number); return { x, y, z, note: v.note }; }),
    restore(records) { tiles.clear(); for (const e of records ?? []) if ([e.x, e.y, e.z].every(Number.isInteger)) tiles.set(key(e.x, e.y, e.z), { note: Math.max(0, Math.min(24, e.note | 0)), powered: false }); },
  };
}
