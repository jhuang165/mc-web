// Batch 91 console91: the DataWatcher entries a native mob carries beyond what the port's tracker packets name, as /netstat counts them.
//
// Evidence (executed, tools/probes/Console91Probe.java -> public/research/console91-reference.json):
//  * PacketBuffer.writeStringToBuffer (et.a(String)): a VarInt of the UTF-8 length, then the bytes (0 chars: 1 byte, 36 ASCII: 37, "e acute" x3: 7, one euro sign: 4, 200 chars: 202).
//  * The String setters that fill a watched string: sw.a(String) (EntityLiving custom name tag, index 10, every living class), tg.b(String) (EntityTameable owner, index 17: wolf,
//    ocelot) and wi.b(String) (EntityHorse owner, index 21). The S0F of a fresh mob already holds the empty string (1 byte); a 36 character owner makes it 36 bytes longer for
//    every class (Wolf 66 -> 102, Ocelot 59 -> 95, Horse 72 -> 108) and a 36 character name tag the same (Pig 55 -> 91).
//  * A later S1C (hw(id, dw, false)) holds only the changed entries: one changed float (index 6, health) or int (index 12, age) is 11 bytes; writing the same value again does
//    not mark the entry changed (te.b compares), so only a real change is sent.
// Bytecode-read: EntityAgeable (rx).e() runs every living update and, on the server, calls c(int) = te.b(12, age) whenever the age is not 0 (age < 0 counts up, age > 0 counts
// down), so a baby, or an adult in its breeding cooldown, changes watcher 12 on every tick; EntityLivingBase keeps the health in watcher 6 (float), EntityWolf keeps its health
// in watcher 18 too.
//
// Port choice: the port's tracker does not emit these keys, so `watchState(e)` derives them from the live mob; the dedicated server remembers per watcher the state it last "sent"
// (the spawn's) and counts one S1C with the changed entries when a message carries a packet of that mob.
const utf8 = (s) => { let n = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c < 0x80) n++; else if (c < 0x800) n += 2; else if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { n += 4; i++; } else n += 3; } return n; };
const varInt = (n) => { let s = 1; while (n >= 0x80) { n >>>= 7; s++; } return s; };
/** et.a(String): the VarInt length and the UTF-8 bytes. */
export const nativeStringBytes = (s) => { const n = utf8(String(s ?? '')); return varInt(n) + n; };

const BYTE = 2, SHORT = 3, INT = 5, FLOAT = 5; // header byte plus the value
const AGEABLE = new Set(['pig', 'cow', 'mooshroom', 'sheep', 'chicken', 'wolf', 'ocelot', 'horse', 'villager']);
// Native keys the port's own meta packets already carry (air 1, potion 7, flags 0, enderman 18, wither 20 and health, dragon health, bat 16, horse 16): not derived here.
const OWN_HEALTH = new Set(['wither', 'ender_dragon']);
/** The UUID text natively stored as the owner of a tamed wolf, ocelot or horse (a player's UUID is 36 characters). */
export const OWNER_TEXT = '00000000-0000-0000-0000-000000000000';

/**
 * The watcher entries a live port mob `e` has natively, beyond the empty defaults counted in MOB_WATCHER: [[index, bytes (header and value), signature], ...].
 * The string entries (10 name tag, 17 / 21 owner) are their full bytes (header, VarInt, text).
 */
export function watchState(e) {
  const out = [], t = e.type;
  if (!OWN_HEALTH.has(t)) out.push([6, FLOAT, e.health]);
  out.push([10, 1 + nativeStringBytes(e.customName ?? ''), e.customName ?? '']);
  if (AGEABLE.has(t)) out.push([12, INT, e.growingAge | 0]);
  else if (t === 'zombie' || t === 'pigman') out.push([12, BYTE, e.growingAge < 0 ? 1 : 0]);
  const owner = e.owner ? OWNER_TEXT : '';
  if (t === 'wolf') out.push([16, BYTE, (e.sitting ? 1 : 0) | (e.angry ? 2 : 0) | (e.owner ? 4 : 0)], [17, 1 + nativeStringBytes(owner), owner], [18, FLOAT, e.health], [19, BYTE, e.begging ? 1 : 0], [20, BYTE, e.collar ?? 14]);
  else if (t === 'ocelot') out.push([16, BYTE, (e.sitting ? 1 : 0) | (e.owner ? 4 : 0)], [17, 1 + nativeStringBytes(owner), owner], [18, BYTE, e.catType | 0]);
  else if (t === 'sheep') out.push([16, BYTE, (e.color ?? 0) | (e.sheared ? 16 : 0)]);
  else if (t === 'pig') out.push([16, BYTE, e.saddled ? 1 : 0]);
  else if (t === 'villager') out.push([16, INT, e.profession | 0]);
  else if (t === 'creeper') out.push([17, BYTE, e.powered ? 1 : 0]);
  else if (t === 'slime' || t === 'magma_cube') out.push([16, BYTE, e.size ?? 1]);
  else if (t === 'horse' && e.horse) out.push([19, BYTE, e.horse.type | 0], [20, INT, e.horse.variant | 0], [21, 1 + nativeStringBytes(owner), owner], [22, INT, e.horse.armor | 0]);
  return out;
}
/** The bytes the string entries of a state add to an S0F / first S1C over the empty strings the class table counts (each empty entry is header + 1). */
export const stringExtra = (state) => { let n = 0; for (const [i, bytes] of state) if (i === 10 || i === 17 || i === 21) n += bytes - 2; return n; };
/** The bytes of the entries of `now` that differ from `last` (both from watchState), or 0. */
export function watchDiff(last, now) {
  let n = 0;
  for (const [i, bytes, sig] of now) { const was = last.find((r) => r[0] === i); if (!was || was[2] !== sig) n += bytes; }
  return n;
}
