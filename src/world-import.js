// Keep the runtime payload shared between local saves and imported exports.
// Each subsystem validates its own payload on launch. Identity and the validated
// world/player fields are built by the caller rather than copied from the file.
const RUNTIME_FIELDS = [
  "position", "drops", "entities", "farms", "experience", "xpOrbs", "falling",
  "weather", "worldRandom", "projectiles", "arrows", "tnt", "fluidTicks", "fireTicks", "fallingTicks", "inhabited",
  "spawners", "minecarts", "populatedColumns",
];

const int = Number.isInteger, finite = Number.isFinite;
const stored = (v) => v.filter((e) => int(e?.id) && int(e?.lvl)).slice(0, 64).map((e) => ({ id: e.id, lvl: e.lvl }));
const SPAWNER_NUMBERS = ["Delay", "MinSpawnDelay", "MaxSpawnDelay", "SpawnCount", "MaxNearbyEntities", "RequiredPlayerRange", "SpawnRange"];
// Generated-structure state (structure-simulation.js) is rebuilt field by field: a record that is
// not the expected shape is dropped, and an export without these fields gets the generation's
// spawners and full carts on its first launch, as an older save does.
const SANITIZE = {
  // Streamed population (streaming-population.js): per-cell bitmask of columns whose generated
  // chests/animals/spawners were already handed to the live world. Bad entries just hand over again.
  populatedColumns: (v) => v && typeof v === "object" && v.version === 1 && v.cells && typeof v.cells === "object"
    ? { version: 1, cells: Object.fromEntries(Object.entries(v.cells)
      .filter(([k, hex]) => /^-?\d+,-?\d+$/.test(k) && typeof hex === "string" && /^[0-9a-f]{1,16}$/.test(hex)).slice(0, 262144)) }
    : undefined,
  spawners: (v) => Array.isArray(v)
    ? v.filter((t) => t && typeof t === "object" && [t.x, t.y, t.z].every(int)).slice(0, 4096).map((t) => ({
      x: t.x, y: t.y, z: t.z,
      ...(typeof t.EntityId === "string" ? { EntityId: t.EntityId.slice(0, 64) } : {}),
      ...Object.fromEntries(SPAWNER_NUMBERS.filter((k) => int(t[k])).map((k) => [k, t[k]])),
    }))
    : undefined,
  minecarts: (v) => v && typeof v === "object" && Array.isArray(v.carts)
    ? { version: 1, carts: v.carts.filter((c) => c && typeof c === "object" && [c.x, c.y, c.z].every(finite)).slice(0, 1024).map((c) => ({
      x: c.x, y: c.y, z: c.z,
      ...(c.type === 0 ? { type: 0, rider: c.rider === true } : c.type === 1 ? { type: 1 } : {}),
      ...(Array.isArray(c.motion) && c.motion.length === 3 && c.motion.every(finite) ? { motion: [...c.motion] } : {}),
      ...(Array.isArray(c.rotation) && c.rotation.length === 2 && c.rotation.every(finite) ? { rotation: [...c.rotation] } : {}),
      ...(finite(c.fallDistance) ? { fallDistance: c.fallDistance } : {}),
      ...(int(c.fire) ? { fire: c.fire } : {}),
      onGround: c.onGround === true,
      ...(typeof c.customName === "string" && c.customName ? { customName: c.customName.slice(0, 64) } : {}),
      items: (Array.isArray(c.items) ? c.items : [])
        .filter((it) => int(it?.slot) && it.slot >= 0 && it.slot < 27 && int(it.id) && int(it.count) && it.count > 0 && (it.damage === undefined || int(it.damage)))
        .map((it) => ({ slot: it.slot, id: it.id, damage: it.damage ?? 0, count: Math.min(64, it.count),
          ...(Array.isArray(it.stored) ? { stored: stored(it.stored) } : {}),
          ...(Array.isArray(it.enchantments) ? { enchantments: stored(it.enchantments) } : {}),
          ...(Array.isArray(it.storedEnchantments) ? { storedEnchantments: stored(it.storedEnchantments) } : {}),
          ...(Number.isInteger(it.repairCost) ? { repairCost: it.repairCost } : {}),
          ...(typeof it.displayName === 'string' ? { displayName: it.displayName.slice(0, 32767) } : {}),
          ...(typeof it.unbreakable === 'boolean' ? { unbreakable: it.unbreakable } : {}) })),
    })) }
    : undefined,
};

export function importedRuntime(data) {
  return Object.fromEntries(RUNTIME_FIELDS.filter((key) => Object.hasOwn(data, key))
    .map((key) => [key, SANITIZE[key] ? SANITIZE[key](data[key]) : data[key]])
    .filter(([, value]) => value !== undefined));
}
