// Batch 66 mpbooks: the client half of note blocks and jukeboxes over a connection (server-music.js).
//   `aux` event 1005 (S28, RenderGlobal.playAuxSFX -> playRecord): data is the record's original item id, 0 stops the record at that jukebox. A record sets the "Now playing" line.
//   `musicEvent` k 'note' (S24 on a note block): the client world repeats BlockNote.onBlockEventReceived, so the sound note.<instrument> (volume 3) and the note particle play here too.
import { INSTRUMENT_SOUNDS, notePitch } from '../note-blocks.js';
import { DISC_ORIGINAL_FIRST, DISC_FIRST, DISC_COUNT } from '../note-jukebox-content.js';

const finite = (...v) => v.every(Number.isFinite);
/** hooks: play(discItem | null, x, y, z). Returns true when the event was a record event. */
export function recordAux(e, { play }) {
  if (e?.id !== 1005 || !finite(e.x, e.y, e.z) || !Number.isInteger(e.data)) return false;
  const i = e.data - DISC_ORIGINAL_FIRST;
  play(i >= 0 && i < DISC_COUNT ? DISC_FIRST + i : null, e.x, e.y, e.z);
  return true;
}
/** hooks: sound(name, x, y, z, volume, pitch), particle(name, x, y, z, vx, vy, vz). */
export function noteEvent(e, { sound, particle }) {
  if (e?.k !== 'note' || !finite(e.x, e.y, e.z) || !Number.isInteger(e.instrument) || !Number.isInteger(e.note) || e.note < 0 || e.note > 24) return false;
  sound(`note.${INSTRUMENT_SOUNDS[e.instrument] ?? 'harp'}`, e.x + 0.5, e.y + 0.5, e.z + 0.5, 3, notePitch(e.note));
  particle('note', e.x + 0.5, e.y + 1.2, e.z + 0.5, e.note / 24, 0, 0);
  return true;
}
