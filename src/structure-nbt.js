// Minecraft Java 1.7.10 structure persistence (GEN-05h), standalone.
// Ports MapGenStructureIO (the start/piece id registry), StructureStart.func_143021_a /
// func_143020_a, StructureComponent.func_143010_b / func_143009_a, every piece's own
// func_143012_a / func_143011_b, MapGenStructure.func_143026_a / func_143027_a and
// MapGenStructureData (data/<Name>.dat). Tags are the raw {type, value} trees of nbt.js.
//
// Compound key order: native NBTTagCompound is a java.util.HashMap, so names are written in
// HashMap iteration order. javaHashMapOrder reproduces Java 8+ buckets (the project's
// recorded JDK; Java 6/7 used a different hash spread and are not modelled).
// Nether fortress (data/Fortress.dat, start id "Fortress", the fifteen Ne* pieces): only NeBEF
// (Seed), NeSCLT/NeSCRT (Chest) and NeMT (Mob) persist fields beyond the shared id/BB/O/GD
// (bytecode-read in ats/atg..atw and probe-verified in fortress-nbt-reference.json).
import { NBT, encodeNbt, decodeNbt } from "./nbt.js";
import { encodeCompressedNbt, decodeCompressedNbt } from "./nbt-compression.js";
import { StructureBoundingBox, StructureMap } from "./structure-framework.js";
import {
  MineshaftRoom, MineshaftCorridor, MineshaftCrossing, MineshaftStairs, StructureMineshaftStart,
} from "./mineshaft-generator.js";
import {
  VillageStartPiece, VillageWell, VillagePath, VillageTorch, VillageHouse1, VillageChurch,
  VillageHouse4Garden, VillageWoodHut, VillageHall, VillageField1, VillageField2, VillageBlacksmith,
  VillageLibrary, VillageStart,
} from "./village-generator.js";
import {
  STRONGHOLD_DOORS, StrongholdStart, StrongholdStairs, StrongholdStraight, StrongholdPrison,
  StrongholdLeftTurn, StrongholdRightTurn, StrongholdRoomCrossing, StrongholdStairsStraight,
  StrongholdCrossing, StrongholdChestCorridor, StrongholdLibrary, StrongholdPortalRoom, StrongholdCorridor,
  StructureStrongholdStart,
} from "./stronghold-generator.js";
import {
  FortressStart, FortressCrossing3, FortressEnd, FortressStraight, FortressCorridor3, FortressCorridor4, FortressEntrance,
  FortressCrossing2, FortressCorridor, FortressCorridor5, FortressCorridor2, FortressNetherStalkRoom, FortressThrone,
  FortressCrossing, FortressStairs, NetherBridgeStart,
} from "./fortress.js";
import { DesertPyramid, JunglePyramid, SwampHut, StructureScatteredFeatureStart } from "./scattered-feature-generator.js";

// ---- tag constructors -------------------------------------------------------------------------
const tInt = (value) => ({ type: NBT.INT, value: value | 0 });
const tBool = (value) => ({ type: NBT.BYTE, value: value ? 1 : 0 });
const tString = (value) => ({ type: NBT.STRING, value });
const tIntArray = (values) => ({ type: NBT.INT_ARRAY, value: Int32Array.from(values) });
const tList = (elementType, items) => ({ type: NBT.LIST, value: { elementType, items } });

// String.hashCode over UTF-16 code units.
export function javaStringHash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return h;
}
// Iteration order of a java.util.HashMap<String,?> after putting `keys` in order (Java 8+): table
// index (h ^ h>>>16) & (capacity-1), insertion order inside a bucket, capacity 16 doubling past
// 0.75 load or when a ninth node chains while the table is under 64 (treeified bins are rejected).
export function javaHashMapOrder(keys) {
  let capacity = 16;
  const nodes = [];
  for (const key of keys) {
    const h = javaStringHash(key), hash = h ^ (h >>> 16);
    nodes.push({ key, hash, seq: nodes.length });
    const mask = capacity - 1;
    if (nodes.filter((n) => (n.hash & mask) === (hash & mask)).length >= 9) {
      if (capacity >= 64) throw new Error("HashMap treeified bucket not modelled");
      capacity *= 2;
    }
    if (nodes.length > capacity * 0.75) capacity *= 2;
  }
  const mask = capacity - 1;
  return nodes.sort((a, b) => (a.hash & mask) - (b.hash & mask) || a.seq - b.seq).map((n) => n.key);
}
// Compound tag from [name, tag] pairs in put() order, stored in native iteration order.
export function compoundTag(entries) {
  const byName = new Map();
  for (const [name, tag] of entries) byName.set(name, tag);
  return { type: NBT.COMPOUND, value: new Map(javaHashMapOrder([...byName.keys()]).map((k) => [k, byName.get(k)])) };
}

// ---- tag readers (NBTTagCompound accessor behaviour: missing -> 0/false/""; wrong type throws) --
function entry(map, name, type) {
  const tag = map.get(name);
  if (!tag) return undefined;
  if (tag.type !== type) throw new TypeError(`NBT tag ${name} has type ${tag.type}, expected ${type}`);
  return tag.value;
}
const getInt = (map, name) => entry(map, name, NBT.INT) ?? 0;
const getBool = (map, name) => (entry(map, name, NBT.BYTE) ?? 0) !== 0;
const getString = (map, name) => entry(map, name, NBT.STRING) ?? "";
function getBox(map, name) {
  const a = entry(map, name, NBT.INT_ARRAY);
  if (!a || a.length !== 6) throw new Error(`NBT ${name} must be a six-int bounding box`);
  return StructureBoundingBox.fromArray([...a]);
}
const boxTag = (box) => tIntArray(box.toArray());

// ---- piece registry ---------------------------------------------------------------------------
// Each entry: class, extras(piece) -> [name, tag] pairs after id/BB/O/GD, read(piece, map).
const doorName = (door) => {
  if (!STRONGHOLD_DOORS[door]) throw new RangeError(`Invalid stronghold door ${door}`);
  return STRONGHOLD_DOORS[door];
};
const readDoor = (map) => {
  const name = getString(map, "EntryDoor"), door = STRONGHOLD_DOORS.indexOf(name);
  if (door < 0) throw new Error(`No enum constant EntryDoor ${name}`);
  return door;
};
const villageBase = (p) => [["HPos", tInt(p.hpos)], ["VCount", tInt(p.villagerCount)], ["Desert", tBool(p.desert)]];
const readVillageBase = (p, m) => { p.hpos = getInt(m, "HPos"); p.villagerCount = getInt(m, "VCount"); p.desert = getBool(m, "Desert"); };
const strongholdBase = (p) => [["EntryDoor", tString(doorName(p.door))]];
const scatteredBase = (p) => [["Width", tInt(p.sizeX)], ["Height", tInt(p.sizeY)], ["Depth", tInt(p.sizeZ)], ["HPos", tInt(p.hPos)]];
const readScatteredBase = (p, m) => { p.sizeX = getInt(m, "Width"); p.sizeY = getInt(m, "Height"); p.sizeZ = getInt(m, "Depth"); p.hPos = getInt(m, "HPos"); };
const readStrongholdBase = (p, m) => { p.door = readDoor(m); };

const villagePiece = (cls, extras = () => [], read = () => {}) => ({
  cls, extras: (p) => [...villageBase(p), ...extras(p)], read: (p, m) => { readVillageBase(p, m); read(p, m); },
});
const strongholdPiece = (cls, extras = () => [], read = () => {}, init = () => {}) => ({
  cls, extras: (p) => [...strongholdBase(p), ...extras(p)], read: (p, m) => { readStrongholdBase(p, m); read(p, m); }, init,
});
const plain = (cls) => ({ cls, extras: () => [], read: () => {} });

const PIECES = {
  MSRoom: {
    cls: MineshaftRoom,
    extras: (p) => [["Entrances", tList(NBT.INT_ARRAY, p.roomsLinkedToTheRoom.map((b) => Int32Array.from(b.toArray())))]],
    read: (p, m) => {
      const list = m.get("Entrances");
      const items = list && list.type === NBT.LIST && list.value.elementType === NBT.INT_ARRAY ? list.value.items : [];
      p.roomsLinkedToTheRoom = items.map((a) => StructureBoundingBox.fromArray([...a]));
    },
  },
  MSCorridor: {
    cls: MineshaftCorridor,
    extras: (p) => [["hr", tBool(p.hasRails)], ["sc", tBool(p.hasSpiders)], ["hps", tBool(p.spawnerPlaced)], ["Num", tInt(p.sectionCount)]],
    read: (p, m) => { p.hasRails = getBool(m, "hr"); p.hasSpiders = getBool(m, "sc"); p.spawnerPlaced = getBool(m, "hps"); p.sectionCount = getInt(m, "Num"); },
  },
  MSCrossing: {
    cls: MineshaftCrossing,
    extras: (p) => [["tf", tBool(p.isMultipleFloors)], ["D", tInt(p.corridorDirection)]],
    read: (p, m) => { p.isMultipleFloors = getBool(m, "tf"); p.corridorDirection = getInt(m, "D"); },
  },
  MSStairs: plain(MineshaftStairs),

  ViStart: villagePiece(VillageStartPiece, () => [], (p) => {
    // Native keeps no Start state beyond awd's fields after a reload.
    p.manager = null; p.pieceWeights = null; p.size = 0; p.lastPiece = null; p.pendingHouses = []; p.pendingRoads = []; p.desertBiome = false;
  }),
  ViW: villagePiece(VillageWell),
  ViSR: villagePiece(VillagePath, (p) => [["Length", tInt(p.length)]], (p, m) => { p.length = getInt(m, "Length"); }),
  ViL: villagePiece(VillageTorch),
  ViBH: villagePiece(VillageHouse1),
  ViST: villagePiece(VillageChurch),
  ViSH: villagePiece(VillageHouse4Garden, (p) => [["Terrace", tBool(p.terrace)]], (p, m) => { p.terrace = getBool(m, "Terrace"); }),
  ViSmH: villagePiece(VillageWoodHut,
    (p) => [["T", tInt(p.tablePosition)], ["C", tBool(p.isTall)]],
    (p, m) => { p.tablePosition = getInt(m, "T"); p.isTall = getBool(m, "C"); }),
  ViPH: villagePiece(VillageHall),
  ViDF: villagePiece(VillageField1,
    (p) => [["CA", tInt(p.cropA)], ["CB", tInt(p.cropB)], ["CC", tInt(p.cropC)], ["CD", tInt(p.cropD)]],
    (p, m) => { p.cropA = getInt(m, "CA"); p.cropB = getInt(m, "CB"); p.cropC = getInt(m, "CC"); p.cropD = getInt(m, "CD"); }),
  ViF: villagePiece(VillageField2,
    (p) => [["CA", tInt(p.cropA)], ["CB", tInt(p.cropB)]],
    (p, m) => { p.cropA = getInt(m, "CA"); p.cropB = getInt(m, "CB"); }),
  ViS: villagePiece(VillageBlacksmith, (p) => [["Chest", tBool(p.hasMadeChest)]], (p, m) => { p.hasMadeChest = getBool(m, "Chest"); }),
  ViTRH: villagePiece(VillageLibrary),

  SHStart: strongholdPiece(StrongholdStart, (p) => [["Source", tBool(p.isStart)]], (p, m) => { p.isStart = getBool(m, "Source"); },
    (p) => { p.strongholdPieceWeight = null; p.portalRoom = null; p.pendingPieces = []; }),
  SHSD: strongholdPiece(StrongholdStairs, (p) => [["Source", tBool(p.isStart)]], (p, m) => { p.isStart = getBool(m, "Source"); }),
  SHS: strongholdPiece(StrongholdStraight,
    (p) => [["Left", tBool(p.expandsX)], ["Right", tBool(p.expandsZ)]],
    (p, m) => { p.expandsX = getBool(m, "Left"); p.expandsZ = getBool(m, "Right"); }),
  SHPH: strongholdPiece(StrongholdPrison),
  SHLT: strongholdPiece(StrongholdLeftTurn),
  SHRT: strongholdPiece(StrongholdRightTurn),
  SHRC: strongholdPiece(StrongholdRoomCrossing, (p) => [["Type", tInt(p.roomType)]], (p, m) => { p.roomType = getInt(m, "Type"); }),
  SHSSD: strongholdPiece(StrongholdStairsStraight),
  SH5C: strongholdPiece(StrongholdCrossing,
    (p) => [["leftLow", tBool(p.leftLow)], ["leftHigh", tBool(p.leftHigh)], ["rightLow", tBool(p.rightLow)], ["rightHigh", tBool(p.rightHigh)]],
    (p, m) => { p.leftLow = getBool(m, "leftLow"); p.leftHigh = getBool(m, "leftHigh"); p.rightLow = getBool(m, "rightLow"); p.rightHigh = getBool(m, "rightHigh"); }),
  SHCC: strongholdPiece(StrongholdChestCorridor, (p) => [["Chest", tBool(p.hasMadeChest)]], (p, m) => { p.hasMadeChest = getBool(m, "Chest"); }),
  SHLi: strongholdPiece(StrongholdLibrary, (p) => [["Tall", tBool(p.isLarge)]], (p, m) => { p.isLarge = getBool(m, "Tall"); }),
  SHPR: strongholdPiece(StrongholdPortalRoom, (p) => [["Mob", tBool(p.hasSpawner)]], (p, m) => { p.hasSpawner = getBool(m, "Mob"); }),
  SHFC: strongholdPiece(StrongholdCorridor, (p) => [["Steps", tInt(p.steps)]], (p, m) => { p.steps = getInt(m, "Steps"); }),

  // Nether fortress (StructureNetherBridgePieces); ats.func_143012_a/b are empty, so the rest add nothing.
  NeStart: { cls: FortressStart, extras: () => [], read: () => {},
    init: (p) => { p.lastPieceWeight = null; p.primaryWeights = []; p.secondaryWeights = []; p.pendingPieces = []; } },
  NeBCr: plain(FortressCrossing3),
  NeBEF: { cls: FortressEnd, extras: (p) => [["Seed", tInt(p.seed)]], read: (p, m) => { p.seed = getInt(m, "Seed"); } },
  NeBS: plain(FortressStraight),
  NeCCS: plain(FortressCorridor3),
  NeCTB: plain(FortressCorridor4),
  NeCE: plain(FortressEntrance),
  NeSCSC: plain(FortressCrossing2),
  NeSCLT: { cls: FortressCorridor, extras: (p) => [["Chest", tBool(p.hasChest)]], read: (p, m) => { p.hasChest = getBool(m, "Chest"); } },
  NeSC: plain(FortressCorridor5),
  NeSCRT: { cls: FortressCorridor2, extras: (p) => [["Chest", tBool(p.hasChest)]], read: (p, m) => { p.hasChest = getBool(m, "Chest"); } },
  NeCSR: plain(FortressNetherStalkRoom),
  NeMT: { cls: FortressThrone, extras: (p) => [["Mob", tBool(p.hasSpawner)]], read: (p, m) => { p.hasSpawner = getBool(m, "Mob"); } },
  NeRC: plain(FortressCrossing),
  NeSR: plain(FortressStairs),

  TeDP: {
    cls: DesertPyramid,
    extras: (p) => [...scatteredBase(p), ...[0, 1, 2, 3].map((i) => [`hasPlacedChest${i}`, tBool(p.hasPlacedChest[i])])],
    read: (p, m) => { readScatteredBase(p, m); p.hasPlacedChest = [0, 1, 2, 3].map((i) => getBool(m, `hasPlacedChest${i}`)); },
  },
  TeJP: {
    cls: JunglePyramid,
    extras: (p) => [...scatteredBase(p), ["placedMainChest", tBool(p.placedMainChest)], ["placedHiddenChest", tBool(p.placedHiddenChest)],
      ["placedTrap1", tBool(p.placedTrap1)], ["placedTrap2", tBool(p.placedTrap2)]],
    read: (p, m) => {
      readScatteredBase(p, m);
      p.placedMainChest = getBool(m, "placedMainChest"); p.placedHiddenChest = getBool(m, "placedHiddenChest");
      p.placedTrap1 = getBool(m, "placedTrap1"); p.placedTrap2 = getBool(m, "placedTrap2");
    },
  },
  TeSH: {
    cls: SwampHut,
    extras: (p) => [...scatteredBase(p), ["Witch", tBool(p.hasWitch)]],
    read: (p, m) => { readScatteredBase(p, m); p.hasWitch = getBool(m, "Witch"); },
  },
};
export const STRUCTURE_PIECE_IDS = Object.freeze(Object.keys(PIECES));
// Every id MapGenStructureIO registers now has a port (the fortress ids were the last unported ones).
export const UNSUPPORTED_PIECE_IDS = Object.freeze([]);
for (const [id, spec] of Object.entries(PIECES)) {
  if (spec.cls.saveId !== id) throw new Error(`Piece registry id ${id} differs from ${spec.cls.name}.saveId`);
}
const PIECE_BY_CLASS = new Map(Object.entries(PIECES).map(([id, spec]) => [spec.cls, id]));

export function pieceId(piece) {
  const id = PIECE_BY_CLASS.get(piece.constructor);
  if (!id) throw new Error(`Unregistered structure piece ${piece.constructor.name}`);
  return id;
}
// StructureComponent.func_143010_b (final): id, BB, O, GD, then func_143012_a.
export function pieceToNbt(piece) {
  const id = pieceId(piece), spec = PIECES[id];
  return compoundTag([["id", tString(id)], ["BB", boxTag(piece.boundingBox)], ["O", tInt(piece.coordBaseMode)], ["GD", tInt(piece.componentType)], ...spec.extras(piece)]);
}
// MapGenStructureIO.func_143032_b + StructureComponent.func_143009_a + func_143011_b. Pieces are built
// without their generator constructors (the original uses the no-argument constructor), so no Random is read.
// Like the original ("Skipping Piece with id"), an unregistered id returns null.
export function pieceFromNbt(tag) {
  if (tag.type !== NBT.COMPOUND) throw new TypeError("Structure piece NBT must be a compound");
  const m = tag.value, id = getString(m, "id"), spec = PIECES[id];
  if (!spec) return null;
  const piece = Object.create(spec.cls.prototype);
  piece.componentType = 0; piece.coordBaseMode = -1; piece.boundingBox = null;
  spec.init?.(piece);
  if (m.has("BB")) piece.boundingBox = getBox(m, "BB");
  piece.coordBaseMode = getInt(m, "O");
  piece.componentType = getInt(m, "GD");
  spec.read(piece, m);
  return piece;
}

// ---- start registry ---------------------------------------------------------------------------
export const STRUCTURE_START_CLASSES = Object.freeze({
  Mineshaft: StructureMineshaftStart, Village: VillageStart, Stronghold: StructureStrongholdStart, Temple: StructureScatteredFeatureStart,
  Fortress: NetherBridgeStart,
});
export const UNSUPPORTED_START_IDS = Object.freeze([]);
const START_BY_CLASS = new Map(Object.entries(STRUCTURE_START_CLASSES).map(([id, cls]) => [cls, id]));
// MapGenStructure.func_143025_a names, keyed by the StructurePopulation generator names.
export const STRUCTURE_DATA_NAMES = Object.freeze({ mineshaft: "Mineshaft", village: "Village", stronghold: "Stronghold", scatteredFeature: "Temple" });
// The Nether generator's data file (MapGenNetherBridge.func_143025_a); written to the shared data/ directory.
export const FORTRESS_DATA_NAME = "Fortress";

export function startId(start) {
  const id = START_BY_CLASS.get(start.constructor);
  if (!id) throw new Error(`Unregistered structure start ${start.constructor.name}`);
  return id;
}
// StructureStart.func_143021_a (+ func_143022_a: only the village adds Valid).
export function startToNbt(start) {
  const id = startId(start);
  const entries = [["id", tString(id)], ["ChunkX", tInt(start.chunkX)], ["ChunkZ", tInt(start.chunkZ)], ["BB", boxTag(start.boundingBox)],
    ["Children", tList(NBT.COMPOUND, start.components.map((c) => pieceToNbt(c).value))]];
  if (id === "Village") entries.push(["Valid", tBool(start.valid)]);
  return compoundTag(entries);
}
// MapGenStructureIO.func_143035_a + StructureStart.func_143020_a. Returns null for ids that are not registered.
export function startFromNbt(tag) {
  if (tag.type !== NBT.COMPOUND) throw new TypeError("Structure start NBT must be a compound");
  const m = tag.value, id = getString(m, "id"), cls = STRUCTURE_START_CLASSES[id];
  if (!cls) return null;
  const start = Object.create(cls.prototype);
  start.chunkX = getInt(m, "ChunkX"); start.chunkZ = getInt(m, "ChunkZ");
  start.boundingBox = m.has("BB") ? getBox(m, "BB") : null;
  start.components = [];
  const children = m.get("Children");
  if (children) {
    if (children.type !== NBT.LIST || (children.value.items.length && children.value.elementType !== NBT.COMPOUND)) throw new TypeError("Children must be a compound list");
    for (const item of children.value.items) {
      const piece = pieceFromNbt({ type: NBT.COMPOUND, value: item });
      if (piece) start.components.push(piece);
    }
  }
  if (id === "Village") start.valid = getBool(m, "Valid");
  return start;
}

// ---- MapGenStructureData ----------------------------------------------------------------------
export const structureKey = (x, z) => `[${x},${z}]`; // MapGenStructureData.func_143042_b
// Features compound: one start compound per "[x,z]" key, put in map insertion order.
export function featuresToNbt(starts) {
  return compoundTag(starts.map((s) => [structureKey(s.chunkX, s.chunkZ), startToNbt(s)]));
}
const startsOf = (source) => Array.isArray(source) ? source : source.structureMap.entries.map((e) => e.value);
// WorldSavedData file document: {"": {data: {Features}}} as MapStorage.saveData wraps it.
export function structureDataDocument(source) {
  return { name: "", tag: compoundTag([["data", compoundTag([["Features", featuresToNbt(startsOf(source))]])]]) };
}
export const encodeStructureData = (source, options) => encodeNbt(structureDataDocument(source), options);
export const encodeStructureDataDat = (source, options) => encodeCompressedNbt(structureDataDocument(source), options);

// MapGenStructure.func_143027_a: every compound under Features with ChunkX and ChunkZ is read in
// key order; unregistered ids are skipped and reported.
export function decodeStructureDataDocument(document) {
  const data = document.tag.value.get("data");
  const features = data && data.type === NBT.COMPOUND ? data.value.get("Features") : undefined;
  const starts = [], skipped = [];
  if (features && features.type === NBT.COMPOUND) {
    for (const [key, tag] of features.value) {
      if (tag.type !== NBT.COMPOUND || !tag.value.has("ChunkX") || !tag.value.has("ChunkZ")) continue;
      const start = startFromNbt(tag);
      if (start) starts.push(start); else skipped.push({ key, id: getString(tag.value, "id") });
    }
  }
  return { starts, skipped };
}
export const decodeStructureData = (bytes, options) => decodeStructureDataDocument(decodeNbt(bytes, options));
export const decodeStructureDataDat = async (bytes, options) => decodeStructureDataDocument(await decodeCompressedNbt(bytes, options));

// Put decoded starts into a generator's structure map in Features order (HashMap.put).
export function loadStructureStarts(generator, decoded) {
  for (const start of decoded.starts) generator.structureMap.set(start.chunkX, start.chunkZ, start);
  return generator;
}
// A fresh StructureMap holding the starts, as native holds after the first func_143027_a.
export function structureMapOf(decoded) {
  const map = new StructureMap();
  for (const start of decoded.starts) map.set(start.chunkX, start.chunkZ, start);
  return map;
}
