// Batch 42 (tilesync): the tile entity descriptions that follow a chunk resend.
//
// PlayerManager.PlayerInstance.sendChunkUpdate (mr.b, bytecode-read): at 64 changed cells it sends the chunk packet (gx, ground-up false, the changed
// section mask) and then, for every masked section, asks WorldServer for the tile entities inside the section's 16 x 16 x 16 box (mt.a(IIIIII))
// and sends TileEntity.getDescriptionPacket (aor.m()) of each one that has a packet (mr.a(aor)). The same method sends that packet for the one changed
// cell of an S23/S22 update when the block has a tile entity (aji.u(), mr.b's other two branches). Executed with tools/probes/TileDescriptionProbe.java
// against the unchanged jar (public/research/tile-description-reference.json): only six tile entity classes describe themselves,
//   TileEntitySign (apm)            S33PacketUpdateSign (ii): x y z and the four lines
//   TileEntitySkull (apn)           S35PacketUpdateTileEntity (gf) action 4: SkullType, Rot (+ ExtraType)
//   TileEntityMobSpawner (apj)      S35 action 1: the spawner NBT (EntityId, delays, counts, ranges, SpawnData)
//   TileEntityBeacon (aoq)          S35 action 3: Primary, Secondary, Levels
//   TileEntityCommandBlock (aox)    S35 action 2: Command, SuccessCount, CustomName, TrackOutput
//   TileEntityFlowerPot (apf)       S35 action 5: Item, Data
// Chests, furnaces, dispensers, hoppers, brewing stands, note blocks, jukeboxes, enchanting tables, comparators, daylight sensors and the rest send
// nothing (their m() is null), so a resend leaves the client's own copy of them alone.
//
// Here the port's wire form is `chunks[i].tiles`: [{ kind, x, y, z, ... }] built by describeTiles from the server's stores and applied on the
// replica by applyTiles. There is no command block in this port, so that description is not produced.
import { SIGN_POST, WALL_SIGN, isSign, SIGN_LINES, MAX_LINE } from "./signs.js";
import { SKULL } from "./skull.js";
import { BEACON } from "./pyramid.js";
import { MOB_SPAWNER, FLOWER_POT } from "./world.js";
import { spawnerJSON } from "./mob-spawner.js";
import { potContents, setPotContents } from "./stone-utility.js";

export { SIGN_POST, WALL_SIGN };
const cellIn = (t, cx, cz, mask) => (t.x >> 4) === cx && (t.z >> 4) === cz && (mask >> (t.y >> 4) & 1) === 1;
const line = (s) => String(s ?? "").slice(0, MAX_LINE);

// `stores`: { world, signs?, skulls?, beacons?, spawners? } (Signs, Skulls, Beacons, MobSpawners). A tile counts only where its block is still there
// (a tile entity goes with its block). Order follows each store, signs first, as the packets of a section would.
export function describeTiles(stores, cx, cz, mask) {
  const { world } = stores, out = [];
  for (const t of stores.signs?.tiles.values() ?? []) if (cellIn(t, cx, cz, mask) && isSign(world.get(t.x, t.y, t.z))) out.push({ kind: "sign", x: t.x, y: t.y, z: t.z, text: Array.from({ length: SIGN_LINES }, (_, i) => line(t.text?.[i])) });
  for (const t of stores.skulls?.tiles.values() ?? []) if (cellIn(t, cx, cz, mask) && world.get(t.x, t.y, t.z) === SKULL) out.push({ kind: "skull", x: t.x, y: t.y, z: t.z, type: t.type & 7, rot: t.rot & 15, owner: t.owner || "" });
  for (const s of stores.spawners?.values() ?? []) if (cellIn(s, cx, cz, mask) && world.get(s.x, s.y, s.z) === MOB_SPAWNER) out.push({ kind: "spawner", x: s.x, y: s.y, z: s.z, nbt: spawnerJSON(s) });
  for (const t of stores.beacons?.tiles.values() ?? []) if (cellIn(t, cx, cz, mask) && world.get(t.x, t.y, t.z) === BEACON) out.push({ kind: "beacon", x: t.x, y: t.y, z: t.z, primary: t.primary, secondary: t.secondary, levels: t.levels });
  // Flower pots keep their plant on the world (world.pots, else implied by the block metadata).
  for (let x = cx * 16; x < cx * 16 + 16; x++) for (let z = cz * 16; z < cz * 16 + 16; z++) for (let sy = 0; sy < 16; sy++) {
    if (!(mask >> sy & 1)) continue;
    for (let y = sy * 16; y < sy * 16 + 16; y++) if (world.get(x, y, z) === FLOWER_POT) {
      const c = potContents(world, x, y, z);
      out.push({ kind: "pot", x, y, z, id: c?.id ?? 0, damage: c?.damage ?? 0 });
    }
  }
  return out;
}

// The replica's side of S33 / S35: each description updates the client's tile entity at its cell when the client world holds the matching block
// (TileEntity.onDataPacket reads into the existing tile entity). Bad entries are skipped. Returns the number applied.
export function applyTiles(list, stores) {
  const { world } = stores;
  let n = 0;
  for (const t of Array.isArray(list) ? list : []) {
    if (!t || ![t.x, t.y, t.z].every(Number.isInteger)) continue;
    const { x, y, z } = t, block = world.get(x, y, z);
    if (t.kind === "sign" && isSign(block) && stores.signs && Array.isArray(t.text)) {
      const tile = stores.signs.tile(x, y, z) ?? stores.signs.create(x, y, z);
      tile.text = Array.from({ length: SIGN_LINES }, (_, i) => line(t.text[i]));
      tile.editable = false; // S33 func_145839... sets the lines and the tile is not editable on a client
      n++;
    } else if (t.kind === "skull" && block === SKULL && stores.skulls) {
      stores.skulls.create(x, y, z, t.type | 0, t.rot | 0, typeof t.owner === "string" ? t.owner : "");
      n++;
    } else if (t.kind === "spawner" && block === MOB_SPAWNER && stores.spawners && t.nbt && typeof t.nbt === "object") {
      stores.spawners.add({ x, y, z, ...t.nbt });
      n++;
    } else if (t.kind === "beacon" && block === BEACON && stores.beacons) {
      const tile = stores.beacons.ensure(x, y, z);
      tile.primary = t.primary | 0; tile.secondary = t.secondary | 0; tile.levels = Number.isInteger(t.levels) ? t.levels : -1;
      n++;
    } else if (t.kind === "pot" && block === FLOWER_POT) {
      setPotContents(world, x, y, z, t.id ? { id: t.id, damage: t.damage | 0 } : null);
      n++;
    }
  }
  return n;
}
