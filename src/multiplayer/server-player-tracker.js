import { TrackerEntry, encodeAxis, encodeY, sizeClass } from '../entity-tracker.js';

// Batch 73 streamfix73: remote players are tracked per viewer on the dedicated server, as EntityTracker does for EntityPlayerMP.
// Bytecode-read (javap -c -p on `mn` = EntityTracker and `my` = EntityTrackerEntry, the unchanged 1.7.10 jar): `mn.a(sa)` for an `mw` (EntityPlayerMP) calls
// `a(entity, 512, 2)`, i.e. addEntityToTracker(player, 512, 2, false): range 512, update frequency 2, no velocity packets; `a(sa, int, int, boolean)` first
// clamps the range to the tracker limit `e` (view-distance * 16 - 16); then every existing entry gets `my.b(player)` (updatePlayerEntity), which returns at once
// for the entry of the player itself and otherwise runs the square test on lastScaledPosition / 32 plus isPlayerWatchingChunk (tryStartWachingThis). The entry
// code is the same TrackerEntry the other trackers use (executed: public/research/tracker-reference.json). One entry per (viewer, other player).
//
// Wire (no new message name): the tick's `players` rows are the presence list. A viewer gets the full row of himself and of every player he tracks; every other
// player is reduced to `{ id, name, far: true }`, which is only the S38 player-list entry (the tab list is global natively) and creates no entity on the client
// (`RemotePlayers.sync` skips far rows, so leaving the tracked set is the S13 destroy and entering it the S0C spawn).
// Batch 74 mptrack74: positions follow the entry's cadence. One master TrackerEntry per target player (natively one entry per entity, shared by all viewers) runs
// sendLocationToAllClients every tick (frequency 2, 4/32 move threshold, look 4/256, the 60th-tick move, the 400-tick teleport resync); the position it last released
// (the S14/S15/S16/S17/S18 sum, decoded to blocks and degrees) is what the viewers' rows carry, so a row's position only changes on a tick that sent a packet. The client
// (`client-ptrack.js`) then interpolates the copy over 3 ticks as EntityOtherPlayerMP.setPositionAndRotation2 does. A riding player's row stays live (the mount moves him).
// Batch 75 mpplayerfx75 (bytecode-read, `my.a(List)`): the location block runs when `ticks % frequency == 0 || entity.isAirBorne || dataWatcher.hasChanges()`, so a jump (Entity.jump sets
// isAirBorne; NetHandlerPlayServer.processPlayer calls it when the player was on the ground and the packet is airborne with dy > 0) or a changed watched value (sneak, sprint, item in use,
// burning, invisible: flag byte 0; air 1; health 6; arrows 9; potion colour 7; absorption 17) forces the off-beat send; `advance` passes both (`jumped`, `watcherSig`). In that block the
// head packet S19 (`ht`) goes out when |headYaw byte - last head byte| >= 4 with its own baseline; a player's rotationYawHead is rotationYaw (EntityLivingBase.onLivingUpdate, the old-AI
// branch, sv.e), so the head angle equals the body yaw but its baseline differs from the look packets' (a pitch-only look refreshes the body baseline, not the head's): rows carry `head`,
// the released S19 angle. The client (bjb.a(ik), S18) sets the teleport position at y + 1/64; only a relative move packet (S14/S17) drops it again: `lift` below, in `released`.
// Deviation (honest): a player whose column the viewer no longer holds is untracked at once (natively the entry keeps the entity until the range test fails; the client copy is dropped with the column anyway).
export const PLAYER_RANGE = 512, PLAYER_FREQUENCY = 2;
const everywhere = () => true;
// the row's yaw and pitch are radians in the port's frame (javaYaw = 180 - yaw * DEG, javaPitch = -pitch * DEG); the entry works in Java degrees
const javaYawDeg = yaw => 180 - yaw * 180 / Math.PI, javaPitchDeg = pitch => -pitch * 180 / Math.PI;
// The data watcher values that mark it changed (b75): a different signature than last tick means hasChanges() is true at this tick's sendLocationToAllClients.
export function watcherSig(p) {
  const s = p.survival ?? {}, fx = s.effects;
  const colour = fx?.ordered ? [...fx.ordered()].map(e => `${e.id}.${e.amplifier}.${e.ambient ? 1 : 0}`).join('+') : '';
  return [p.input?.sneak ? 1 : 0, p.motion?.sprinting ? 1 : 0, p.itemInUse ? 1 : 0, s.fire > 0 ? 1 : 0, fx?.has?.(14) ? 1 : 0, s.health, s.absorption || 0, s.air, s.arrowCount || 0, colour, p.experience?.score ?? 0].join('|'); // b76: + the score (watcher 18, EntityPlayer.addScore from addExperience); sleeping and riding are NOT watched values
}
const spawnByte = deg => (Math.trunc(Math.fround(Math.fround(Math.fround(deg) * 256) / 360)) << 24) >> 24; // S0C: (byte)(int)(angle * 256 / 360)

export class ServerPlayerTracker {
  // `host`: { players: Map, rules } (the Simulation). `watches(pid, cx, cz)`: isPlayerWatchingChunk for viewer `pid` (the chunk view's `sees`). `fresh(pid)`: true once after the viewer's columns changed.
  constructor(host, watches = everywhere, fresh = () => false) { this.host = host; this.watches = watches; this.fresh = fresh; this.dims = new Map(); this.done = new WeakMap(); this.masters = new Map(); }
  get limit() { return this.host.rules?.trackerLimit ?? 144; }
  state(dim) { let s = this.dims.get(dim); if (!s) this.dims.set(dim, s = new Map()); return s; }

  // b74 mptrack74: the shared position entry of each player in `dim`; advanced once per server tick (per `host.ticks`; without a tick counter, once per update key).
  advance(dim, here, stamp) {
    let m = this.masters.get(dim);
    if (!m) this.masters.set(dim, m = { stamp: undefined, byId: new Map() });
    for (const id of [...m.byId.keys()]) if (!here.has(id)) m.byId.delete(id);
    if (stamp !== undefined && m.stamp === stamp) return m;
    m.stamp = stamp;
    for (const [id, target] of here) {
      const e = { id, x: target.position.x, y: target.position.y - (target.motion?.ySize ?? 0), z: target.position.z, rotationYaw: javaYawDeg(target.yaw ?? 0), rotationPitch: javaPitchDeg(target.pitch ?? 0), type: 'player' };
      e.rotationYawHead = e.rotationYaw; // sv.e: rotationYawHead = rotationYaw
      e.ridingEntity = target.mount ? (target.mount.key ?? true) : null; // b76: my.a(List) runs its riding branch (look packets only, S1B(0), `ridden` -> a teleport after the dismount)
      const sig = watcherSig(target);
      let st = m.byId.get(id);
      if (!st) {
        const entry = new TrackerEntry(e, { range: PLAYER_RANGE, frequency: PLAYER_FREQUENCY, velocity: false, limit: this.limit }, { player: null, watches: () => false });
        entry.tracked = true; // the shared entry: the viewers' own entries decide who is in the list
        m.byId.set(id, st = { entry, e, cx: encodeAxis(sizeClass(0.6), e.x), cy: encodeY(e.y), cz: encodeAxis(sizeClass(0.6), e.z), yaw: spawnByte(e.rotationYaw), pitch: spawnByte(e.rotationPitch), head: spawnByte(e.rotationYawHead), lift: 0, sig, grounded: !!target.grounded, py: target.position.y }); // S0C: the spawn packet's position
      } else Object.assign(st.e, e);
      // b75: isAirBorne (a jump: on the ground before, off it now and higher) and a changed watched value force the off-beat send
      const jumped = !!st.grounded && !target.grounded && target.position.y > st.py, changed = sig !== st.sig;
      st.grounded = !!target.grounded; st.py = target.position.y; st.sig = sig;
      st.entry.packets.length = 0;
      st.entry.sendLocation(jumped, changed);
      for (const q of st.entry.packets) {
        if (q.type === 'teleport') { st.cx = q.x; st.cy = q.y; st.cz = q.z; st.lift = 1 / 64; }
        else if (q.type === 'move' || q.type === 'moveLook') { st.cx += q.dx; st.cy += q.dy; st.cz += q.dz; st.lift = 0; }
        if (q.type === 'look' || q.type === 'moveLook' || q.type === 'teleport') { st.yaw = q.yaw; st.pitch = q.pitch; }
        if (q.type === 'head') st.head = q.head;
      }
      st.entry.packets.length = 0;
    }
    return m;
  }
  // The position fields the viewers hold for player `id` in `dim` (what the entry last released), or null.
  released(dim, id) {
    const st = this.masters.get(dim)?.byId.get(id);
    return st ? { x: st.cx / 32, y: st.cy / 32 + st.lift, z: st.cz / 32, head: Math.PI - st.head * 360 / 256 * Math.PI / 180, yaw: Math.PI - st.yaw * 360 / 256 * Math.PI / 180, pitch: -(st.pitch * 360 / 256) * Math.PI / 180, ySize: 0 } : null;
  }

  // The tracker pass of one tick for dimension `dim` (once per `key`): pid -> Set of tracked player ids.
  update(dim, key) {
    if (this.done.has(key)) return this.done.get(key);
    const s = this.state(dim), here = new Map(), out = new Map();
    for (const [id, p] of this.host.players) if ((p.dimension | 0) === dim) here.set(id, p);
    for (const id of [...s.keys()]) if (!here.has(id)) s.delete(id); // left the dimension or the server: the client rebuilt its world
    for (const [vid, viewer] of here) {
      let v = s.get(vid);
      const pos = viewer.position;
      let moved = false;
      if (!v) { s.set(vid, v = { ref: { x: pos.x, y: pos.y, z: pos.z }, entries: new Map(), view: { player: pos, watches: (cx, cz) => this.watches(vid, cx, cz), log: null } }); moved = true; }
      else if (this.fresh(vid)) moved = true; // a column was sent or unloaded: PlayerManager calls the tracker for the chunk
      else { const dx = pos.x - v.ref.x, dy = pos.y - v.ref.y, dz = pos.z - v.ref.z; if (dx * dx + dy * dy + dz * dz > 16) { v.ref = { x: pos.x, y: pos.y, z: pos.z }; moved = true; } }
      v.view.player = pos;
      for (const id of [...v.entries.keys()]) if (!here.has(id)) v.entries.delete(id);
      const tracked = new Set();
      for (const [tid, target] of here) {
        if (tid === vid) continue; // my.b(player) returns for the player's own entry
        const e = { id: tid, x: target.position.x, y: target.position.y, z: target.position.z, rotationYaw: target.yaw ?? 0, rotationPitch: target.pitch ?? 0, type: 'player' };
        let en = v.entries.get(tid);
        if (!en) { v.entries.set(tid, en = new TrackerEntry(e, { range: PLAYER_RANGE, frequency: PLAYER_FREQUENCY, velocity: false, limit: this.limit }, v.view)); en.ticks = this.host.ticks ?? 0; }
        else { en.e = e; if (moved) en.tryStart(); }
        en.sendLocation(false, false); en.packets.length = 0; // membership only: the rows carry the positions
        if (en.tracked && !this.watches(vid, Math.floor(e.x / 16), Math.floor(e.z / 16))) { en.tracked = false; en.packets.length = 0; }
        if (en.tracked) tracked.add(tid);
      }
      out.set(vid, tracked);
    }
    this.advance(dim, here, this.host.ticks); // b74 mptrack74: the shared entries run once a tick
    this.done.set(key, out);
    return out;
  }

  // The rows of `message.players` as viewer `pid` gets them: himself and the tracked players in full, the rest as player-list entries.
  // b74: a tracked player's row carries the position the shared entry last released (not his live one); a rider keeps his live row.
  rowsFor(pid, rows, tracked, dim = 0) {
    return rows.map(r => {
      if (r.id === pid) return r;
      if (!tracked?.has(r.id)) return { id: r.id, name: r.name, far: true };
      const rel = r.riding ? null : this.released(dim, r.id);
      return rel ? { ...r, ...rel } : r;
    });
  }
  messageFor(pid, message, dim = 0, key = message) {
    if (!message?.players) return message;
    const tracked = this.update(dim, key).get(pid);
    if (!tracked) return message;
    return { ...message, players: this.rowsFor(pid, message.players, tracked, dim) };
  }

  // The welcome snapshot: the same square test at the joining position (his columns are not sent yet, so a streaming join sees nobody until the first tick).
  snapshot(pid, world, dim = this.host.players.get(pid)?.dimension | 0) {
    const me = this.host.players.get(pid);
    if (!me || !world?.players) return world;
    const range = Math.min(PLAYER_RANGE, this.limit);
    const near = r => Math.abs(r.x - me.position.x) <= range && Math.abs(r.z - me.position.z) <= range && this.watches(pid, Math.floor(r.x / 16), Math.floor(r.z / 16));
    return { ...world, players: world.players.map(r => { if (r.id === pid) return r; if (!near(r)) return { id: r.id, name: r.name, far: true }; const rel = r.riding ? null : this.released(dim, r.id); return rel ? { ...r, ...rel } : r; }) };
  }
}
