// Batch 66 mpbooks: note blocks and jukeboxes on the dedicated server. The single-player behaviours (note-blocks.js BlockNote / TileEntityNote, jukebox.js BlockJukebox /
// TileEntityJukebox / ItemRecord) are installed on each dimension's LiveRedstone; this file adds what a connection needs.
//   * Note block: BlockNote.onBlockEventReceived (amj.a, bytecode-read) calls World.playSoundEffect(x+.5, y+.5, z+.5, "note.<instrument>", 3.0, 2^((note-12)/12)) and spawns the note
//     particle. On a WorldServer the sound is an S29 to every player under 16 * 3 blocks (mp.a(String, ...): range 16 * volume when volume > 1), and the queued block event also goes out
//     as S24 to every player of the dimension under 64 blocks (WorldServer.func_147485_a -> sendToAllNear 64.0), where the client world runs the same handler again (sound and particle).
//     Here S29 is the usual `sound` message (sim.soundsOut) and S24 is `{ type: 'musicEvent', k: 'note', x, y, z, instrument, note }`.
//   * Jukebox: ItemRecord.onItemUse / BlockJukebox.dropRecord play World.playAuxSFXAtEntity(null, 1005, x, y, z, id) / playAuxSFX(1005, x, y, z, 0): S28 within 64 blocks of the
//     jukebox, same dimension (mp.a(yz, IIIII)). The data is the record's original item id (2256 + index), 0 stops the record. It rides the existing `aux` message.
//   * The disc is spent outside Creative, an ejected disc is an item entity with a 10-tick pickup delay, and the tiles are saved inside the dimension's redstone save (`musicTiles`).
import { installNoteBlocks, NOTE_ID, noteSound, notePitch } from '../note-blocks.js';
import { installJukeboxes, JUKEBOX_ID } from '../jukebox.js';
import { isDisc, discOriginal, NOTE_BLOCK, JUKEBOX } from '../note-jukebox-content.js';
import { makeStack } from '../inventory.js';

const RANGE_SQ = 64 * 64, music = new WeakMap();
export const musicOf = redstone => music.get(redstone) ?? null;

// sendToAllNear: players of the dimension whose posX/Y/Z (feet) is under 64 blocks from the point.
export function nearPlayers(sim, dim, x, y, z) {
  const out = [];
  for (const p of sim.players.values()) {
    if ((p.dimension | 0) !== (dim | 0)) continue;
    const dx = x - p.position.x, dy = y - p.position.y, dz = z - p.position.z;
    if (dx * dx + dy * dy + dz * dz < RANGE_SQ) out.push(p);
  }
  return out;
}

/** Install the note block and jukebox behaviours on `redstone` (the dimension `dim`'s). `saved` is that dimension's saved redstone record. Idempotent. */
export function installMusic(sim, redstone, dim = 0, saved = null) {
  if (music.has(redstone)) return music.get(redstone);
  const noteBlocks = installNoteBlocks(redstone, { particle: () => {}, changed: () => {} });
  const jukeboxes = installJukeboxes(redstone, {
    play: (item, x, y, z) => { for (const p of nearPlayers(sim, dim, x, y, z)) (p.itemsOut ??= []).push({ type: 'aux', events: [{ id: 1005, x, y, z, data: item ? discOriginal(item) : 0 }] }); },
    spawn: (stack, x, y, z) => sim.items.spawn(makeStack(stack.id, stack.count ?? 1, stack.damage || 0), x, y, z, { delay: 10 }),
    changed: () => {},
  });
  // The block event: S29 and S24 instead of the single-player client's local sound and particle.
  redstone.behaviours[NOTE_ID].onBlockEventReceived = (w, x, y, z, instrument, note) => {
    // S29 now (the redstone tick runs after the tick's deliverSounds): the players of the dimension whose squared distance (eye height 1.62 above their feet) is under (16 * 3)^2.
    const sound = { name: noteSound(instrument), x: x + 0.5, y: y + 0.5, z: z + 0.5, volume: 3, pitch: notePitch(note) };
    for (const p of sim.players.values()) {
      if ((p.dimension | 0) !== (dim | 0)) continue;
      const dx = sound.x - p.position.x, dy = sound.y - (p.position.y + 1.62), dz = sound.z - p.position.z;
      if (dx * dx + dy * dy + dz * dz < 48 * 48) (p.soundsOut ??= []).push({ ...sound });
    }
    for (const p of nearPlayers(sim, dim, x, y, z)) (p.itemsOut ??= []).push({ type: 'musicEvent', k: 'note', x, y, z, instrument, note });
    return true;
  };
  const m = { noteBlocks, jukeboxes, dim, save: () => [...noteBlocks.save().map(e => ({ kind: 'note', ...e })), ...jukeboxes.save().map(e => ({ kind: 'jukebox', ...e }))] };
  const base = redstone.save.bind(redstone);
  redstone.save = () => ({ ...base(), musicTiles: m.save() });
  const records = saved?.musicTiles;
  if (Array.isArray(records)) { noteBlocks.restore(records.filter(e => e?.kind === 'note')); jukeboxes.restore(records.filter(e => e?.kind === 'jukebox')); }
  music.set(redstone, m);
  return m;
}

/**
 * A right click on a note block or jukebox. Returns true when the click was theirs.
 * BlockNote.onBlockActivated (pitch up, play) and BlockJukebox.onBlockActivated (a loaded one ejects) run unless the player sneaks with an item in hand; a disc then goes in through
 * ItemRecord.onItemUse (empty jukebox only, the disc spent outside Creative, the use statistic counted as every item use that returned true).
 */
export function serverMusicUse(sim, p, [x, y, z], block, held) {
  if (block !== NOTE_BLOCK && block !== JUKEBOX) return false;
  const m = musicOf(sim.redstone), s = p.survival;
  if (!m) return false;
  const activates = !(p.input.sneak && s.held);
  if (block === NOTE_BLOCK) return activates && sim.redstone.use(x, y, z);
  const loaded = sim.redstone.getBlockMetadata(x, y, z) !== 0;
  if (activates && loaded) return sim.redstone.use(x, y, z); // BlockJukebox.dropRecord
  if (!loaded && isDisc(held) && m.jukeboxes.insert(x, y, z, held)) {
    if (!s.creative) s.take(held);
    sim.stats.used(p, held);
    return true;
  }
  return false;
}

/** BlockNote.onBlockClicked (a Survival player starting to dig the block): the note plays without changing pitch. */
export function serverNoteClick(sim, [x, y, z]) {
  if (sim.world.get(x, y, z) === NOTE_BLOCK && musicOf(sim.redstone)) musicOf(sim.redstone).noteBlocks.click(x, y, z);
}
export { NOTE_BLOCK, JUKEBOX, JUKEBOX_ID };
