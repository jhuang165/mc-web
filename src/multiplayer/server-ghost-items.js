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

/** One pass of EntityTrackerEntry.updatePlayerEntity for each inert record of the dimension: a player in range that watches the column is dropped (once). */
export function ghostItemDrops(sim, dim, inert) {
  if (!inert.list.length) return;
  const range = clampTrackRange(64, sim.rules?.viewDistance);
  for (const d of inert.list) {
    const x = Math.floor(d.x * 32) / 32, z = Math.floor(d.z * 32) / 32; // the tracker's scaled position
    for (const p of [...sim.players.values()]) {
      if ((p.dimension | 0) !== (dim | 0) || dropped.has(p)) continue;
      if (!trackedWithin(range, x, z, p.position)) continue;
      if (sim.chunkViews?.sees && !sim.chunkViews.sees(p.id, Math.floor(d.x / 16), Math.floor(d.z / 16))) continue; // PlayerManager.isPlayerWatchingChunk
      dropped.add(p);
      sim.admin?.netStats?.write(14, S0E_FRAME + 6); // the S0E is written and counted; the S1C throws before eu.b counts it
      sim.admin?.host?.drop?.(p.id, GHOST_DROP_REASON);
    }
  }
}
