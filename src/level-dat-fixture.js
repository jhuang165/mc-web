// Test fixture: a level.dat and Player compound built with the repo's NBT writer.
import { NBT } from './nbt.js';
import { encodeCompressedNbt } from './nbt-compression.js';

export const t = (type, value) => ({ type, value });
const compound = (fields) => new Map(Object.entries(fields));
const list = (elementType, items) => t(NBT.LIST, { elementType, items });
export async function levelDatBytes({ hardcore = 0, player } = {}) {
  const data = compound({
    RandomSeed: t(NBT.LONG, 1710n), generatorName: t(NBT.STRING, 'default'), generatorVersion: t(NBT.INT, 1), generatorOptions: t(NBT.STRING, ''),
    GameType: t(NBT.INT, 0), MapFeatures: t(NBT.BYTE, 1), SpawnX: t(NBT.INT, 8), SpawnY: t(NBT.INT, 70), SpawnZ: t(NBT.INT, 8),
    Time: t(NBT.LONG, 100n), DayTime: t(NBT.LONG, 100n), LevelName: t(NBT.STRING, 'Hardcore test'), version: t(NBT.INT, 19133),
    hardcore: t(NBT.BYTE, hardcore), initialized: t(NBT.BYTE, 1), allowCommands: t(NBT.BYTE, 0),
    ...(player ? { Player: t(NBT.COMPOUND, player) } : {}),
  });
  return encodeCompressedNbt({ name: '', tag: t(NBT.COMPOUND, compound({ Data: t(NBT.COMPOUND, data) })) });
}
export const playerTag = (extra = {}) => compound({
  Pos: list(NBT.DOUBLE, [8.5, 70, 8.5]), Rotation: list(NBT.FLOAT, [0, 0]), Dimension: t(NBT.INT, 0), HealF: t(NBT.FLOAT, 20),
  playerGameType: t(NBT.INT, 1), abilities: t(NBT.COMPOUND, compound({ flying: t(NBT.BYTE, 1), mayfly: t(NBT.BYTE, 1), instabuild: t(NBT.BYTE, 1) })),
  ...extra,
});

