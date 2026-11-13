// Owners of tamed wolves and ocelots on the dedicated server (batch 63 mpvehicles3). Server records carry `ownerUuid` (the owner's resume key, stamped at taming since b62) and now
// `ownerName` (the player name, the same text a pre-UUID 1.7 save keeps under `Owner`). A tamed animal with neither key (a wolf tamed in a single-player save: owner "player") used to count
// every nearest player as its owner. Now such a record is stamped once: `legacyOwner` (a server option naming the single-player save's player) when given, else the first player who is the
// nearest to it or clicks it. After that it is that player's, like any wolf tamed here.
// Native facts: 1.7.10 EntityTameable writes OwnerUUID (a UUID string); the name `Owner` is only read (owner-links.js ownerFromNbt, bytecode-read). A Java import of a legacy `Owner` name
// therefore arrives as the name's offline UUID (java-mobs.js), which is matched below by the offline UUID of the player's name (owner-links.js documents the lower-case variant for a
// dedicated offline server). A record whose owner text matches no connected player stays ownerless, as getOwner() is null for an absent owner (owner-links.js ownerPresent).
import { offlineUuid } from '../stats.js';

const OWNED = new Set(['wolf', 'ocelot']);
export const isOwned = e => OWNED.has(e?.type) && !!e.owner;
// An owned record with no owner key of any kind.
export const unkeyed = e => isOwned(e) && !(typeof e.ownerUuid === 'string' && e.ownerUuid) && !(typeof e.ownerName === 'string' && e.ownerName);

// Does player `p` own `e` (by resume key, by name, or by the offline UUID of the name an old save stored)?
export function ownedBy(e, p) {
  if (!isOwned(e) || !p) return false;
  if (typeof e.ownerUuid === 'string' && e.ownerUuid && e.ownerUuid === p.resumeKey) return true;
  const name = String(p.name ?? '').toLowerCase();
  if (typeof e.ownerName === 'string' && e.ownerName && e.ownerName.toLowerCase() === name) return true;
  if (typeof e.ownerUuid === 'string' && e.ownerUuid && name) {
    const u = e.ownerUuid.toLowerCase();
    if (u === offlineUuid(p.name) || u === offlineUuid(name)) return true;
  }
  return false;
}
// Stamp `p` as the owner (the resume key is what every other server rule compares).
export function claim(e, p) { e.ownerUuid = p.resumeKey; e.ownerName = p.name; }
// Load time: records without a key take the named single-player owner.
export function stampLegacy(entities, name) {
  if (typeof name !== 'string' || !name) return 0;
  let n = 0;
  for (const e of entities) if (unkeyed(e)) { e.ownerName = name; n++; }
  return n;
}
// The view that owns `e` among `views` (a Map of { player }), claiming a stale record for it: null when nobody here owns it. `near` is the nearest view (may be null).
export function resolveOwner(e, views, near) {
  let own = null;
  for (const v of views.values()) if (ownedBy(e, v.player)) { own = v; break; }
  if (!own && unkeyed(e) && near) own = near;
  if (own && (e.ownerUuid !== own.player.resumeKey || e.ownerName !== own.player.name)) claim(e, own.player);
  return own;
}
