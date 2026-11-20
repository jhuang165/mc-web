// Batch 88 console88: what the dedicated server's saves write under /save-off, and the stop sequence's log lines.
//
// Evidence (bytecode-read from the unchanged 1.7.10 client jar; see .shared-memory/notes/console88-b88-track.md):
//  * MinecraftServer.u() (tick): every 900 ticks, oi.j() (ServerConfigurationManager.saveAllPlayerData: every online player's playerdata and stats, oi.b(mw), with
//    no levelSaving check), then a(true) (saveAllWorlds, silent).
//  * MinecraftServer.a(boolean) (saveAllWorlds): for each WorldServer, the "Saving chunks for level '<level-name>'/<dimension>" line unless silent, then
//    mt.a(true, null) (saveAllChunks), which returns at once when ms.e() (ChunkProviderServer.canSave = !levelSaving) is false: neither level.dat nor chunks.
//    So under /save-off the autosave and the shutdown save still write player data, and each world saves only while its own flag is off.
//  * CommandSaveAll (bh): oi.j(), then each world's levelSaving is cleared around mt.a(true, null) and restored: /save-all saves everything under /save-off too.
//    "flush" (case-sensitive) exists in 1.7.10: flushStart, mt.m() for each world with the flag cleared the same way, flushEnd.
//  * MinecraftServer.o() (stopServer): "Stopping server", nc.b() (the listening endpoints close), "Saving players", oi.j(), oi.u() (every player kicked with
//    "Server closed": NetHandlerPlayServer.c(String), an S40), "Saving worlds", a(false) (with the per-world lines), each world's mt.n() (flush), the snooper.
//    CommandStop (bt): "commands.stop.start" to the admins, then r() (running = false): the loop ends after the current tick and calls o().
//  * Dimension names (aqo.l()): aqq "Overworld", aqp "Nether", aqr "The End".
// Port choices (port-read): one save file holds every world and the player data. A world whose levelSaving flag is set keeps the part the file on disk has (the
// Overworld part is everything but `players`, `admin` and `dimensions`; the Nether is `dimensions.nether`, the End `dimensions.end`); `players` and the lists
// (`admin`, written to their own files at every change natively) are always current. With no earlier file, a world that is not saved is absent, as a missing level.
export const DIMENSION_NAMES = ['Overworld', 'Nether', 'The End'];
export const STOP_LOG = { stopping: 'Stopping server', players: 'Saving players', worlds: 'Saving worlds' };
export const STOP_KICK = 'Server closed'; // oi.u()
export const worldSaveLine = (levelName, dim) => `Saving chunks for level '${levelName}'/${DIMENSION_NAMES[dim]}`;

/** oi.j(): every online player's data into the saved players (the port's playerdata), returned in the save's shape. */
export function savePlayerData(sim) {
  for (const p of sim.players.values()) sim.savedPlayers.set(p.resumeKey, sim.savePlayer(p));
  return [...sim.savedPlayers];
}

const split = (data) => {
  if (!data || typeof data !== 'object') return [null, null, null];
  const { players, admin, dimensions, ...overworld } = data;
  return [Object.keys(overworld).length ? overworld : null, dimensions?.nether ?? null, dimensions?.end ?? null];
};

/** The file a save writes: worlds whose flag is set (`levelSaving[i]` true = saving off) keep `previous`'s part; the players and lists are current. */
export function composeSave({ current = null, previous = null, levelSaving = [false, false, false], players, admin }) {
  const now = split(current), before = split(previous);
  const [overworld, nether, end] = [0, 1, 2].map((i) => (levelSaving[i] ? before[i] : now[i]));
  const out = { ...(overworld ?? {}) };
  if (nether || end) out.dimensions = { ...(nether ? { nether } : {}), ...(end ? { end } : {}) };
  out.admin = admin; out.players = players;
  return out;
}

/**
 * What a save writes, in tick order. `force` (/save-all) saves every world whatever its flag. Otherwise (the autosave, the shutdown save) the player data is
 * always written and the worlds follow their flags. Returns { data } when nothing depends on the file on disk, else { compose(previous) }.
 */
export function planSave(sim, { force = false } = {}) {
  const flags = sim.admin.levelSaving ?? [!sim.admin.autosave, !sim.admin.autosave, !sim.admin.autosave];
  if (force || flags.every((off) => !off)) return { data: sim.save() };
  const snap = (v) => JSON.parse(JSON.stringify(v)); // the write is asynchronous: copy now, in tick order
  const current = flags.some((off) => !off) ? snap(sim.save()) : null; // sim.save() also runs the player data step
  const players = current ? current.players : snap(savePlayerData(sim)), admin = current ? current.admin : snap(sim.admin.save());
  const levelSaving = [...flags];
  return { compose: (previous) => composeSave({ current, previous, levelSaving, players, admin }) };
}
