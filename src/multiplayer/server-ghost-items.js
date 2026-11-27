// b100 mpobjects100: what the dedicated server does with the null-item EntityItem a jukebox leaves for a ghost disc (a Record int naming no registered item).
// Executed (tools/probes/MpObjects100Probe.java, public/research/mpobjects100-reference.json): the real EntityTrackerEntry sends a watching player the S0E (item, data 1: 27 bytes
// with the id) and then the S1C of the entity's whole DataWatcher, whose slot 10 holds the stack: PacketBuffer.writeItemStackToBuffer writes the short id (0 for a null item),
// the count and the damage, then calls `stack.getItem().hasTag()` on the null item: NullPointerException. Bytecode-read: MessageSerializer (fa) has no catch, netty wraps it in an
// EncoderException, NetworkManager (ej) sends the write failure to exceptionCaught (FIRE_EXCEPTION_ON_FAILURE) which closes the channel with
// "disconnect.genericReason: Internal Exception: ...". No S40 goes out. So every player that starts tracking the item (within 64 blocks and view distance, the column sent) loses the
// connection, at the ejection or later when they come into range, until the item is gone at age 6000.
import { clampTrackRange, trackedWithin } from '../ring-events.js';
// The S0E frame size is PLAY_FRAME.clientbound[14] (net-packet-ids.js, pinned by mpobjects100-b100.test.js). Not imported: net-packet-ids.js pulls node:zlib, and this file is in the browser LAN host's bundle.
export const S0E_FRAME = 21;

export const GHOST_DROP_REASON = 'Internal Exception: io.netty.handler.codec.EncoderException: java.lang.NullPointerException';
const dropped = new WeakSet();

// b101 mpobjects101: the cadence. Bytecode-read (mn.a() = EntityTracker.updateTrackedEntities, my.a(List) = EntityTrackerEntry.updatePlayerList, my.b(List) = updatePlayerEntities,
// my.b(mw) = updatePlayerEntity, mn.a(mw) / mn.a(mw, apx) = addPlayer / sendChunkEntities): a standing item is NOT re-listed every tick. my.a(List) re-lists only on its first pass
// (the entry is created with one) or after the item moved more than 4 blocks (squared 16; an inert drop never moves). A player is tested against a standing item only when (1) the
// entry is new (every player), (2) the player's own entry moved more than 4 blocks since its last list (mn.a() then calls my.b(player) on every entry), (3) the player joined or
// changed dimension (addPlayer), or (4) the item's chunk was just sent to the player (sendChunkEntities). The tick pass models those four; a walk into range drops the player
// at the first trigger after the walk-in: the range check is unchanged, only the trigger is rarer. Executed (mpobjects101-reference.json `cadence`): a list call after the first sends nothing for a player standing in range; my.b(player) does.
const states = new WeakMap();
const stateOf = (inert) => { let s = states.get(inert); if (!s) states.set(inert, s = { pass: 0, seen: new WeakSet(), players: new WeakMap() }); return s; };

/** One tick of EntityTracker.updateTrackedEntities for each inert record of the dimension: a player the list triggers for, in range and watching the column, is dropped (once). */
export function ghostItemDrops(sim, dim, inert) {
  if (!inert.list.length) return;
  const st = stateOf(inert); st.pass++;
  const range = clampTrackRange(64, sim.rules?.viewDistance);
  const trig = new Map(); // player -> the player's own entry moved (or is new to this dimension): one decision per tick
  for (const p of sim.players.values()) {
    if ((p.dimension | 0) !== (dim | 0) || dropped.has(p)) continue;
    const ps = st.players.get(p), pos = p.position;
    const fresh = !ps || ps.pass !== st.pass - 1 || ((pos.x - ps.x) ** 2 + (pos.y - ps.y) ** 2 + (pos.z - ps.z) ** 2) > 16;
    if (fresh) st.players.set(p, { x: pos.x, y: pos.y, z: pos.z, pass: st.pass, sees: new WeakMap() });
    else ps.pass = st.pass;
    trig.set(p, fresh);
  }
  for (const d of inert.list) {
    const isNew = !st.seen.has(d); st.seen.add(d);
    const x = Math.floor(d.x * 32) / 32, z = Math.floor(d.z * 32) / 32; // the tracker's scaled position
    for (const [p, moved] of trig) {
      if (dropped.has(p)) continue;
      const watching = !sim.chunkViews?.sees || sim.chunkViews.sees(p.id, Math.floor(d.x / 16), Math.floor(d.z / 16)); // PlayerManager.isPlayerWatchingChunk
      const ps = st.players.get(p), was = ps.sees.get(d); ps.sees.set(d, watching);
      if (!(isNew || moved || (watching && !was))) continue; // no re-list this tick
      if (!trackedWithin(range, x, z, p.position) || !watching) continue;
      dropped.add(p);
      sim.admin?.netStats?.write(14, S0E_FRAME + 6); // the S0E is written and counted; the S1C throws before eu.b counts it
      sim.admin?.host?.drop?.(p.id, GHOST_DROP_REASON);
    }
  }
}
