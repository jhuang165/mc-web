// Owner and leash links in Java NBT (batch 21). 1.7.10 facts:
//  - EntityTameable (wolf, ocelot) writes OwnerUUID, a String: the owner's UUID text, "" when wild (probed, public/research/interchange-links-reference.json,
//    `owner` records). Taming stores player.getUniqueID().toString() (bytecode-read: EntityWolf and EntityOcelot call tg.b(String) with it).
//  - EntityTameable.readEntityFromNBT reads OwnerUUID when the key exists, otherwise the pre-1.7 `Owner` name through PreYggdrasilConverter (nz.a):
//    an empty or over-16-character value is used as it is, else the profile cache or, in a single-player or offline server, UUID.nameUUIDFromBytes
//    ("OfflinePlayer:" + name). A non-empty result tames the animal (probed). Batch 24 ran nz.a on a MinecraftServer stub (InterchangeSpawnProbe,
//    interchange-spawn-reference.json `legacyOwner`/`wolfOwner`). Single player (IntegratedServer bsx.e sets online mode on) with no network gives
//    the offline UUID of the name as written; a profile already in usercache.json wins (keyed in lower case). A dedicated offline server takes the
//    lower-cased name (PlayerProfileCache builds the profile from it); an online server whose lookup fails gives "" (untamed). 17+ characters are
//    kept as the owner text; " " throws (Name and ID cannot both be blank). The port is a single-player world with no usercache: the name as written.
//  - An OwnerUUID of " " (or any non-UUID text) is kept as the owner and tames the animal: only the empty string means wild (probed `wolfOwner`).
//  - EntityHorse writes OwnerUUID always ("" when none) and reads only OwnerUUID, no legacy name (probed). Tame is its own byte.
//  - EntityLiving writes Leashed and Leash: {UUIDMost, UUIDLeast} for a living holder (the player), {X, Y, Z} for a fence knot (probed: wolf, ocelot, horse, pig).
// The port has one possible owner and holder, the local player. Export writes the player's real exported UUID (`exportPlayerUuid`, the level.dat
// Player UUID); import keeps a foreign owner string as `ownerUuid` (so it round-trips) unless it equals the player's, and a leash held by another
// UUID is dropped when the player's UUID is known, as the native first leashed tick drops it (LeashProbe `playerWrongUuid`).
import { NBT } from "./nbt.js";
import { nbtGet } from "./nbt-get.js";
import { isUuid, uuidLongs, longsUuid } from "./entity-uuid.js";
import { offlineUuid } from "./stats.js";

export const OWNED_TYPES = new Set(["wolf", "ocelot", "horse"]);
// The UUID the exported Player carries: the imported one, else the offline-mode UUID of "Player" (the one stats/<uuid>.json already uses).
export const exportPlayerUuid = (record) => (isUuid(record?.playerUuid) ? record.playerUuid.toLowerCase() : offlineUuid("Player"));

// OwnerUUID text for a record: "" for an unowned one, else the foreign owner string kept from an import, else the player's UUID.
export const ownerText = (e, ownerOwned, playerUuid) => (!ownerOwned ? "" : typeof e.ownerUuid === "string" && e.ownerUuid ? e.ownerUuid : playerUuid);

// The owner string of a tameable or horse compound (the key rules above), or "".
export function ownerFromNbt(compound, type) {
  const has = compound.get("OwnerUUID")?.type === NBT.STRING;
  let owner = has ? String(nbtGet(compound, "OwnerUUID", NBT.STRING, "")) : "";
  if (!has && type !== "horse") {
    const name = String(nbtGet(compound, "Owner", NBT.STRING, ""));
    owner = name.length === 0 || name.length > 16 ? name : offlineUuid(name);
  }
  return owner;
}
// { owner: "player", ownerUuid? } for an owned compound, else { owner: "" }. `ownerUuid` is kept as read (a foreign owner).
export function ownerFields(compound, type) {
  const text = ownerFromNbt(compound, type);
  return text ? { owner: "player", ownerUuid: text } : { owner: "" };
}

// Leash: { holder: "player", holderUuid } from UUIDMost/UUIDLeast.
export function leashHolderUuid(compound) {
  const l = nbtGet(compound, "Leash", NBT.COMPOUND);
  const most = l && nbtGet(l, "UUIDMost", NBT.LONG), least = l && nbtGet(l, "UUIDLeast", NBT.LONG);
  return most !== undefined && least !== undefined && most !== null ? longsUuid(most, least) : undefined;
}
// The Leash compound of a record held by the player.
export function playerLeashTag(playerUuid) {
  const { most, least } = uuidLongs(playerUuid);
  return new Map([["UUIDMost", { type: NBT.LONG, value: most }], ["UUIDLeast", { type: NBT.LONG, value: least }]]);
}

// Re-link imported mobs to the player once its UUID is known: an owner equal to it needs no stored string, a leash held by another UUID is dropped
// (native: the holder is looked up by UUID and the lead drops). Returns the number of leads dropped.
export function relinkMobs(mobs, playerUuid) {
  let dropped = 0;
  for (const m of Array.isArray(mobs) ? mobs : []) {
    if (m?.leash?.holderUuid !== undefined) {
      if (isUuid(playerUuid) && m.leash.holderUuid.toLowerCase() !== playerUuid.toLowerCase()) { delete m.leash; dropped++; } else delete m.leash.holderUuid;
    }
    if (typeof m?.ownerUuid === "string" && isUuid(playerUuid) && m.ownerUuid.toLowerCase() === playerUuid.toLowerCase()) delete m.ownerUuid;
  }
  return dropped;
}
