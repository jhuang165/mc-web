// Batch 42 (tilesync): the tile entity descriptions that follow a chunk resend.
//
// PlayerManager.PlayerInstance.sendChunkUpdate (mr.b, bytecode-read): at 64 changed cells it sends the chunk packet (gx, ground-up false, the changed
// section mask) and then, for every masked section, asks WorldServer for the tile entities inside the section's 16 x 16 x 16 box (mt.a(IIIIII))
// and sends TileEntity.getDescriptionPacket (aor.m()) of each one that has a packet (mr.a(aor)). The same method sends that packet for the one changed
// cell of an S23/S22 update when the block has a tile entity (aji.u(), mr.b's other two branches). Executed with tools/probes/TileDescriptionProbe.java
// against the unchanged jar (public/research/tile-description-reference.json): only six tile entity classes describe themselves,
//   TileEntitySign (apm)            S33PacketUpdateSign (ii): x y z and the four lines
//   TileEntitySkull (apn)           S35PacketUpdateTileEntity (gf) action 4: SkullType, Rot (+ the Owner profile)
//   TileEntityMobSpawner (apj)      S35 action 1: the spawner NBT (EntityId, delays, counts, ranges, SpawnData)
//   TileEntityBeacon (aoq)          S35 action 3: Primary, Secondary, Levels
//   TileEntityCommandBlock (aox)    S35 action 2: Command, SuccessCount, CustomName, TrackOutput
//   TileEntityFlowerPot (apf)       S35 action 5: Item, Data
// Chests, furnaces, dispensers, hoppers, brewing stands, note blocks, jukeboxes, enchanting tables, comparators, daylight sensors and the rest send
// nothing (their m() is null), so a resend leaves the client's own copy of them alone.
//
// Batch 43 (tileedits): the single-cell and 2 to 63 cell branches send the same descriptions (`describeCell`, riding in the tick's `tiles`), and so
// does a tile edit (sign text, skull placement, beacon picks, spawner mob; DedicatedSimulation.tileChanged).
//
// Here the port's wire form is `chunks[i].tiles`: [{ kind, x, y, z, ... }] built by describeTiles from the server's stores and applied on the
// replica by applyTiles.
//
// Batch 80 (mpcmd80): the command block description. TileEntityCommandBlock.getDescriptionPacket (aox.m, bytecode-read) is S35 action 2 with the whole writeToNBT compound,
// CommandBlockLogic.func_145758_a (agp.a(dh)): Command, SuccessCount, CustomName, LastOutput (only when not null) and TrackOutput. The client's onDataPacket is readFromNBT
// (agp.b(dh)): Command and SuccessCount always, CustomName / LastOutput / TrackOutput only when the tag is there, so a description without LastOutput keeps the old one.
import { SIGN_POST, WALL_SIGN, isSign, SIGN_LINES, MAX_LINE } from "./signs.js";
import { SKULL } from "./skull.js";
import { BEACON } from "./pyramid.js";
import { MOB_SPAWNER, FLOWER_POT } from "./world.js";
import { spawnerJSON } from "./mob-spawner.js";
import { potContents, setPotContents, validPotRecord, potKey, emptyPot } from "./stone-utility.js";
import { isChestBlock, ENDER_CHEST, newEnderTile } from "./chest-blocks.js";
import { newChest, chestFacing, writeChestFacing } from "./chest.js";
import { COMMAND_BLOCK, newCommandBlock, normalizeLastOutput } from "./command-block.js"; // b80 mpcmd80

export { SIGN_POST, WALL_SIGN };
const cellIn = (t, cx, cz, mask) => (t.x >> 4) === cx && (t.z >> 4) === cz && (mask >> (t.y >> 4) & 1) === 1;
const line = (s) => String(s ?? "").slice(0, MAX_LINE);

// The S35 action ids of the executed probe (public/research/tile-description-reference.json); the sign has its own S33 packet and no action.
export const TILE_ACTION = Object.freeze({ spawner: 1, command: 2, beacon: 3, skull: 4, pot: 5 });

const signOf = (t) => ({ kind: "sign", x: t.x, y: t.y, z: t.z, text: Array.from({ length: SIGN_LINES }, (_, i) => line(t.text?.[i])) });
const skullOf = (t) => ({ kind: "skull", action: TILE_ACTION.skull, x: t.x, y: t.y, z: t.z, type: t.type & 7, rot: t.rot & 15, owner: t.owner || "", ...(t.profile ? { profile: t.profile } : {}) });
const spawnerOf = (s) => ({ kind: "spawner", action: TILE_ACTION.spawner, x: s.x, y: s.y, z: s.z, nbt: spawnerJSON(s) });
const beaconOf = (t) => ({ kind: "beacon", action: TILE_ACTION.beacon, x: t.x, y: t.y, z: t.z, primary: t.primary, secondary: t.secondary, levels: t.levels });
// Flower pots keep their plant on the world (world.pots, else implied by the block metadata).
// b80 mpcmd80: a command block without a server record is a fresh TileEntityCommandBlock (BlockContainer.onBlockAdded), described with its defaults.
const commandOf = (t, x, y, z) => ({ kind: "command", action: TILE_ACTION.command, x, y, z, command: String(t.command ?? ""), successCount: t.successCount | 0, customName: String(t.customName ?? "@"), ...(t.lastOutput != null ? { lastOutput: t.lastOutput } : {}), trackOutput: t.trackOutput !== false });
// b81 potspacks81: TileEntityFlowerPot.getDescriptionPacket (apf.m, bytecode-read) is S35 action 5 with writeToNBT's Item and Data, and the client's
// NetHandlerPlayClient.handleUpdateTileEntity (bjb.a(gf), bytecode-read) runs readFromNBT on an apf for action 5, so the client holds the exact pair. The
// port's description is the server's pot record: id/damage (the drawn plant) plus `data` (an exact Data the plant does not name) or `item`/`data`/`stack`
// (an item the client does not draw), the same fields potNbtOf turns back into Item and Data.
const potOf = (world, x, y, z) => {
  const c = potContents(world, x, y, z), extra = {};
  if (c && Number.isInteger(c.data)) extra.data = c.data;
  if (c && Number.isInteger(c.item)) { extra.item = c.item; if (c.stack) extra.stack = { ...c.stack }; }
  if (!c && world.pots?.get(potKey(x, y, z))?.empty) { extra.empty = true; const d = world.pots.get(potKey(x, y, z)).data; if (Number.isInteger(d)) extra.data = d; } // b84 cmdfix84: an explicitly empty tile (the replica must not fall back to the metadata's plant)
  return { kind: "pot", action: TILE_ACTION.pot, x, y, z, id: c?.id ?? 0, damage: c?.damage ?? 0, ...extra };
};
// The client's side of a pot description (apf.a(dh) into the tile at the cell). A record neither drawn nor a registered item is an empty pot (Item 0).
export function applyPotTile(world, t) {
  const rec = Number.isInteger(t.item) ? { item: t.item, data: t.data, stack: t.stack } : { id: t.id, damage: t.damage | 0, ...(Number.isInteger(t.data) ? { data: t.data } : {}) };
  setPotContents(world, t.x, t.y, t.z, t.empty === true ? emptyPot(t.data) : validPotRecord(rec) ? rec : null);
}

// Batch 60 (mpcontainers2): the 1.7.10 client makes a TileEntityChest from the block alone (the chunk packet has no chest tile; facing is the block's
// metadata), so a never-opened chest is drawn closed. This port keeps a chest's facing in its tile record rather than the metadata, so the server sends
// that record as `contChest` ({ x, y, z, facing } or { ender: true }) for each chest block, and the replica makes the record the renderer draws.
const chestOf = (stores, x, y, z, block) => {
  if (block === ENDER_CHEST) return { kind: "contChest", x, y, z, ender: true };
  const c = stores.chests?.[`${x},${y},${z}`];
  return c ? { kind: "contChest", x, y, z, facing: chestFacing(stores.world, stores.chests, x, y, z) } : null; // b91 tiles91: the cell's metadata, the record as fallback
};

// The description of the one tile entity at a cell (PlayerInstance.sendChunkUpdate's changed-cell branch: getDescriptionPacket when the block has
// a tile entity), or null when the block there has none, sends none, or has no record. Batch 43 (tileedits).
export function describeCell(stores, x, y, z) {
  const { world } = stores, block = world.get(x, y, z);
  if (isSign(block)) { const t = stores.signs?.tile(x, y, z); return t ? signOf(t) : null; }
  if (block === SKULL) { const t = stores.skulls?.tile(x, y, z); return t ? skullOf(t) : null; }
  if (block === MOB_SPAWNER) { const t = stores.spawners?.get(x, y, z); return t ? spawnerOf(t) : null; }
  if (block === BEACON) { const t = stores.beacons?.get(x, y, z); return t ? beaconOf(t) : null; }
  if (block === FLOWER_POT) return potOf(world, x, y, z);
  if (block === COMMAND_BLOCK && stores.commandBlocks) return commandOf(stores.commandBlocks.get(x, y, z) ?? newCommandBlock(), x, y, z); // b80 mpcmd80
  if (isChestBlock(block) || block === ENDER_CHEST) return chestOf(stores, x, y, z, block);
  return null;
}

// The pot cells of the masked sections of a chunk. One native pass over the column's block array (`indexOf` per hit) instead of a read per cell
// (batch 42 scanned about 65,000 cells for a full mask); a world without the plain column falls back to cell reads.
function potCells(world, cx, cz, mask) {
  const col = world.chunks?.get?.(`${cx},${cz}`), out = [];
  if (col?.blocks && col.blocks.length % 256 === 0) {
    const height = col.blocks.length / 256;
    for (let i = col.blocks.indexOf(FLOWER_POT); i >= 0; i = col.blocks.indexOf(FLOWER_POT, i + 1)) {
      const y = i % height, column = (i - y) / height;
      if (mask >> (y >> 4) & 1) out.push([cx * 16 + (column >> 4), y, cz * 16 + (column & 15)]);
    }
    return out.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
  }
  for (let x = cx * 16; x < cx * 16 + 16; x++) for (let z = cz * 16; z < cz * 16 + 16; z++) for (let sy = 0; sy < 16; sy++) {
    if (!(mask >> sy & 1)) continue;
    for (let y = sy * 16; y < sy * 16 + 16; y++) if (world.get(x, y, z) === FLOWER_POT) out.push([x, y, z]);
  }
  return out;
}

// `stores`: { world, signs?, skulls?, beacons?, spawners? } (Signs, Skulls, Beacons, MobSpawners). A tile counts only where its block is still there
// (a tile entity goes with its block). Order follows each store, signs first, as the packets of a section would.
export function describeTiles(stores, cx, cz, mask) {
  const { world } = stores, out = [];
  for (const t of stores.signs?.tiles.values() ?? []) if (cellIn(t, cx, cz, mask) && isSign(world.get(t.x, t.y, t.z))) out.push(signOf(t));
  for (const t of stores.skulls?.tiles.values() ?? []) if (cellIn(t, cx, cz, mask) && world.get(t.x, t.y, t.z) === SKULL) out.push(skullOf(t));
  for (const s of stores.spawners?.values() ?? []) if (cellIn(s, cx, cz, mask) && world.get(s.x, s.y, s.z) === MOB_SPAWNER) out.push(spawnerOf(s));
  for (const t of stores.beacons?.tiles.values() ?? []) if (cellIn(t, cx, cz, mask) && world.get(t.x, t.y, t.z) === BEACON) out.push(beaconOf(t));
  for (const [x, y, z] of potCells(world, cx, cz, mask)) out.push(potOf(world, x, y, z));
  for (const { x, y, z, tile } of stores.commandBlocks?.values() ?? []) if (cellIn({ x, y, z }, cx, cz, mask) && world.get(x, y, z) === COMMAND_BLOCK) out.push(commandOf(tile, x, y, z)); // b80 mpcmd80: recorded ones (a fresh one is the client's default)
  for (const key of Object.keys(stores.chests ?? {})) {
    const [x, y, z] = key.split(",").map(Number);
    if (cellIn({ x, y, z }, cx, cz, mask) && isChestBlock(world.get(x, y, z))) out.push(chestOf(stores, x, y, z, world.get(x, y, z)));
  }
  for (const key of Object.keys(stores.enders ?? {})) {
    const [x, y, z] = key.split(",").map(Number);
    if (cellIn({ x, y, z }, cx, cz, mask) && world.get(x, y, z) === ENDER_CHEST) out.push(chestOf(stores, x, y, z, ENDER_CHEST));
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
      stores.skulls.create(x, y, z, t.type | 0, t.rot | 0, typeof t.owner === "string" ? t.owner : "", t.profile);
      n++;
    } else if (t.kind === "spawner" && block === MOB_SPAWNER && stores.spawners && t.nbt && typeof t.nbt === "object") {
      stores.spawners.add({ x, y, z, ...t.nbt });
      n++;
    } else if (t.kind === "beacon" && block === BEACON && stores.beacons) {
      const tile = stores.beacons.ensure(x, y, z);
      tile.primary = t.primary | 0; tile.secondary = t.secondary | 0; tile.levels = Number.isInteger(t.levels) ? t.levels : -1;
      n++;
    } else if (t.kind === "command" && block === COMMAND_BLOCK && stores.commandBlocks) { // b80 mpcmd80: agp.b(dh) into the client's tile
      let last;
      try { last = typeof t.lastOutput === "string" ? normalizeLastOutput(t.lastOutput) : undefined; } catch { continue; } // fk.a threw: the packet is not applied
      const tile = stores.commandBlocks.tile(x, y, z);
      tile.command = typeof t.command === "string" ? t.command : "";
      tile.successCount = Number.isInteger(t.successCount) ? t.successCount : 0;
      if (typeof t.customName === "string") tile.customName = t.customName;
      if (last !== undefined) tile.lastOutput = last;
      if (typeof t.trackOutput === "boolean") tile.trackOutput = t.trackOutput;
      n++;
    } else if (t.kind === "pot" && block === FLOWER_POT) {
      applyPotTile(world, t); // b81 potspacks81
      n++;
    } else if (t.kind === "contChest" && stores.chests && stores.enders) {
      if (t.ender && block === ENDER_CHEST) (stores.enders[`${x},${y},${z}`] ??= newEnderTile());
      else if (!t.ender && isChestBlock(block) && Number.isInteger(t.facing) && t.facing >= 2 && t.facing <= 5) {
        (stores.chests[`${x},${y},${z}`] ??= newChest(t.facing));
        writeChestFacing(world, stores.chests, x, y, z, t.facing); // b91 tiles91: the replica's cell metadata too (the server's contChest is the block's metadata of 1.7.10)
      } else continue;
      n++;
    }
  }
  return n;
}
