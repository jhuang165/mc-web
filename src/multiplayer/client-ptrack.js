// b74 mptrack74: the client half of player tracking. EntityOtherPlayerMP.setPositionAndRotation2(x, y, z, yaw, pitch, 3) stores a target and 3 increments; every
// onLivingUpdate moves the copy a fraction (target - pos) / increments (the yaw by its wrapped difference) and counts one increment down (bytecode-read in b41/b43 for
// ClientEntity, `entity-tracker.js`; recalled for the player class, which shares the method). The server's rows now change position only when the shared tracker entry
// released a packet (every 2nd tick at most, `server-player-tracker.js`), so a row that differs from the held target is the packet and restarts the 3 steps.
export const PLAYER_INCREMENTS = 3;
const TAU = Math.PI * 2;
// the port's yaw and pitch are radians; the wrapped difference keeps a turn across the seam short (MathHelper.wrapAngleTo180)
const wrap = d => { d %= TAU; return d >= Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d; };

export function newInterp(row) {
  return { x: row.x, y: row.y, z: row.z, yaw: row.yaw, pitch: row.pitch, tx: row.x, ty: row.y, tz: row.z, tyaw: row.yaw, tpitch: row.pitch, inc: 0 };
}

// One client tick with this tick's row. `snap`: no interpolation (a rider keeps the mount's seat). Returns `ip` (x y z yaw pitch hold the copy's place).
export function stepInterp(ip, row, snap = false) {
  if (snap) { Object.assign(ip, newInterp(row)); return ip; }
  if (row.x !== ip.tx || row.y !== ip.ty || row.z !== ip.tz || row.yaw !== ip.tyaw || row.pitch !== ip.tpitch) {
    Object.assign(ip, { tx: row.x, ty: row.y, tz: row.z, tyaw: row.yaw, tpitch: row.pitch, inc: PLAYER_INCREMENTS });
  }
  if (ip.inc > 0) {
    const n = ip.inc;
    ip.x += (ip.tx - ip.x) / n; ip.y += (ip.ty - ip.y) / n; ip.z += (ip.tz - ip.z) / n;
    ip.yaw += wrap(ip.tyaw - ip.yaw) / n; ip.pitch += (ip.tpitch - ip.pitch) / n;
    ip.inc--;
  }
  return ip;
}
