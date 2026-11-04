// Village records: VillageCollection (wc), Village (vz), VillageDoorInfo (vy) and VillageAggressor (wa) of 1.7.10.
// The classes are pure; the world supplies a host:
//   rand            java.util.Random-like world.rand ({nextInt(n)})
//   isWoodenDoor(x,y,z) / doorFacing(x,y,z) (BlockDoor.func_149090_g & 3) / canSeeSky(x,y,z)
//   hasSolidTop(x,y,z) (World.doesBlockHaveSolidTopSurface) / isNormalCube(x,y,z)
//   countEntities(kind, x0,y0,z0, x1,y1,z1) with kind "villager" | "golem" (bounding boxes intersecting the box)
//   spawnGolem(x,y,z) -> spawns EntityIronGolem with setPosition(x,y,z)
//   playerPosition(name) -> {x,y,z} | null  (the online player entity by name)
// Native evidence: public/research/village-live-reference.json (tools/verify-village.mjs). See public/research/village.md.
import { NBT } from "./nbt.js";
import { compoundTag } from "./structure-nbt.js";

const trunc = (v) => Math.trunc(v);
const distSq = (ax, ay, az, bx, by, bz) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by) + (az - bz) * (az - bz);
export const REPUTATION_MIN = -30, REPUTATION_MAX = 10, REPUTATION_AGGRESSIVE = -15, MATING_SEASON_TICKS = 3600;

export class VillageDoorInfo {
  constructor(x, y, z, insideX, insideZ, tick) {
    this.x = x; this.y = y; this.z = z; this.insideX = insideX; this.insideZ = insideZ;
    this.lastActivity = tick; this.detached = false; this.restriction = 0;
  }
  distSqTo(x, y, z) { return distSq(x, y, z, this.x, this.y, this.z); }                          // vy.b
  distSqToInside(x, y, z) { return distSq(x, y, z, this.x + this.insideX, this.y, this.z + this.insideZ); } // vy.c
  get insidePointX() { return this.x + this.insideX; }
  get insidePointZ() { return this.z + this.insideZ; }
  isInside(x, z) { return (x - this.x) * this.insideX + (z - this.z) * this.insideZ >= 0; }          // vy.a(II)
  resetRestriction() { this.restriction = 0; }
  incrementRestriction() { ++this.restriction; }
  get restrictionCount() { return this.restriction; }
}

export class Village {
  constructor(host) {
    this.host = host;
    this.doors = [];
    this.centerHelper = [0, 0, 0]; this.center = [0, 0, 0]; this.radius = 0;
    this.lastAddDoorTimestamp = 0; this.tickCounter = 0; this.numVillagers = 0; this.noBreedTicks = 0;
    this.reputation = new Map(); this.aggressors = []; this.numGolems = 0;
  }
  tick(t) {
    this.tickCounter = t;
    this.removeDeadAndOutOfRangeDoors();
    this.removeDeadAndOldAggressors();
    if (t % 20 === 0) this.updateNumVillagers();
    if (t % 30 === 0) this.updateNumGolems();
    const allowed = trunc(this.numVillagers / 10);
    if (this.numGolems < allowed && this.doors.length > 20 && this.host.rand.nextInt(7000) === 0) {
      const [cx, cy, cz] = this.center;
      const pos = this.findRandomSpawnPos(cx, cy, cz, 2, 4, 2);
      if (pos) { this.host.spawnGolem(pos[0], pos[1], pos[2]); ++this.numGolems; }
    }
  }
  box() { const [x, y, z] = this.center, r = this.radius; return [x - r, y - 4, z - r, x + r, y + 4, z + r]; }
  updateNumGolems() { this.numGolems = this.host.countEntities("golem", ...this.box()); }
  updateNumVillagers() {
    this.numVillagers = this.host.countEntities("villager", ...this.box());
    if (this.numVillagers === 0) this.reputation.clear();
  }
  findRandomSpawnPos(x, y, z, dx, dy, dz) {
    const rand = this.host.rand;
    for (let i = 0; i < 10; i++) {
      const px = x + rand.nextInt(16) - 8, py = y + rand.nextInt(6) - 3, pz = z + rand.nextInt(16) - 8;
      if (this.isInRange(px, py, pz) && this.isAreaClear(px, py, pz, dx, dy, dz)) return [px, py, pz];
    }
    return null;
  }
  isAreaClear(x, y, z, dx, dy, dz) {
    if (!this.host.hasSolidTop(x, y - 1, z)) return false;
    const sx = x - trunc(dx / 2), sz = z - trunc(dz / 2);
    for (let i = sx; i < sx + dx; i++) for (let j = y; j < y + dy; j++) for (let k = sz; k < sz + dz; k++) if (this.host.isNormalCube(i, j, k)) return false;
    return true;
  }
  isInRange(x, y, z) { return distSq(x, y, z, ...this.center) < Math.fround(this.radius * this.radius); }
  doorsList() { return this.doors; }
  nearestDoor(x, y, z) {                       // vz.b(III)
    let best = null, bd = 2147483647;
    for (const d of this.doors) { const s = d.distSqTo(x, y, z); if (s < bd) { best = d; bd = s; } }
    return best;
  }
  nearestDoorUnrestricted(x, y, z) {           // vz.c(III)
    let best = null, bd = 2147483647;
    for (const d of this.doors) {
      const s = d.distSqTo(x, y, z), cost = s > 256 ? s * 1000 : d.restrictionCount;
      if (cost < bd) { best = d; bd = cost; }
    }
    return best;
  }
  doorAt(x, y, z) {                            // vz.e(III)
    if (distSq(x, y, z, ...this.center) > this.radius * this.radius) return null;
    for (const d of this.doors) if (d.x === x && d.z === z && Math.abs(d.y - y) <= 1) return d;
    return null;
  }
  addDoor(door) {                              // vz.a(vy)
    this.doors.push(door);
    this.centerHelper[0] += door.x; this.centerHelper[1] += door.y; this.centerHelper[2] += door.z;
    this.recalculate();
    this.lastAddDoorTimestamp = door.lastActivity;
  }
  isAnnihilated() { return this.doors.length === 0; }
  recalculate() {                              // vz.n
    const n = this.doors.length;
    if (n === 0) { this.center = [0, 0, 0]; this.radius = 0; return; }
    this.center = this.centerHelper.map((v) => trunc(v / n));
    let max = 0;
    for (const d of this.doors) max = Math.max(max, d.distSqTo(...this.center));
    this.radius = Math.max(32, trunc(Math.sqrt(max)) + 1);
  }
  removeDeadAndOutOfRangeDoors() {             // vz.m
    let changed = false;
    const flag = this.host.rand.nextInt(50) === 0;
    for (let i = 0; i < this.doors.length;) {
      const d = this.doors[i];
      if (flag) d.resetRestriction();
      if (!this.host.isWoodenDoor(d.x, d.y, d.z) || Math.abs(this.tickCounter - d.lastActivity) > 1200) {
        this.centerHelper[0] -= d.x; this.centerHelper[1] -= d.y; this.centerHelper[2] -= d.z;
        changed = true; d.detached = true; this.doors.splice(i, 1);
      } else i++;
    }
    if (changed) this.recalculate();
  }
  // Reputation
  playerReputation(name) { return this.reputation.get(name) ?? 0; }
  changeReputation(name, delta) {
    const v = Math.min(REPUTATION_MAX, Math.max(REPUTATION_MIN, this.playerReputation(name) + delta));
    this.reputation.set(name, v);
    return v;
  }
  isPlayerReputationTooLow(name) { return this.playerReputation(name) <= REPUTATION_AGGRESSIVE; }
  changeAllReputations(delta) { for (const name of this.reputation.keys()) this.changeReputation(name, delta); }
  endMatingSeason() { this.noBreedTicks = this.tickCounter; }
  isMatingSeason() { return this.noBreedTicks === 0 || this.tickCounter - this.noBreedTicks >= MATING_SEASON_TICKS; }
  // Aggressors (VillageAggressor: entity + tick)
  addOrRenewAggressor(entity) {
    for (const a of this.aggressors) if (a.entity === entity) { a.tick = this.tickCounter; return; }
    this.aggressors.push({ entity, tick: this.tickCounter });
  }
  findNearestAggressor(self) {
    let best = null, bd = Infinity;
    for (const a of this.aggressors) { const s = self.distSqTo(a.entity); if (s <= bd) { best = a.entity; bd = s; } }
    return best;
  }
  findNearestTargetPlayer(self) {
    let best = null, bd = Infinity;
    for (const name of this.reputation.keys()) {
      if (!this.isPlayerReputationTooLow(name)) continue;
      const p = this.host.playerEntity?.(name);
      if (p) { const s = self.distSqTo(p); if (s <= bd) { best = p; bd = s; } }
    }
    return best;
  }
  removeDeadAndOldAggressors() {
    this.aggressors = this.aggressors.filter((a) => !a.entity.dead && Math.abs(this.tickCounter - a.tick) <= 300);
  }
  // Persistence (Village.writeVillageDataToNBT)
  toJSON() {
    return { pop: this.numVillagers, radius: this.radius, golems: this.numGolems, stable: this.lastAddDoorTimestamp, tick: this.tickCounter,
      mtick: this.noBreedTicks, c: [...this.center], ac: [...this.centerHelper],
      doors: this.doors.map((d) => [d.x, d.y, d.z, d.insideX, d.insideZ, d.lastActivity]),
      players: [...this.reputation].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)) };
  }
  static fromJSON(host, j) {
    const v = new Village(host);
    v.numVillagers = j.pop | 0; v.radius = j.radius | 0; v.numGolems = j.golems | 0; v.lastAddDoorTimestamp = j.stable | 0; v.tickCounter = j.tick | 0;
    v.noBreedTicks = j.mtick | 0; v.center = [...j.c]; v.centerHelper = [...j.ac];
    for (const [x, y, z, ix, iz, ts] of j.doors) v.doors.push(new VillageDoorInfo(x, y, z, ix, iz, ts));
    for (const [n, s] of j.players) v.reputation.set(n, s);
    return v;
  }
}

export class VillageCollection {
  constructor(host) { this.host = host; this.positions = []; this.newDoors = []; this.villages = []; this.tickCounter = 0; this.dirty = false; }
  addVillagerPosition(x, y, z) {
    if (this.positions.length > 64) return;
    if (!this.positions.some((p) => p[0] === x && p[1] === y && p[2] === z)) this.positions.push([x, y, z]);
  }
  tick() {
    ++this.tickCounter;
    for (const v of this.villages) v.tick(this.tickCounter);
    this.removeAnnihilatedVillages();
    this.dropOldestVillagerPosition();
    this.addNewDoorsToVillageOrCreateVillage();
    if (this.tickCounter % 400 === 0) this.dirty = true;
  }
  removeAnnihilatedVillages() {
    for (let i = 0; i < this.villages.length;) if (this.villages[i].isAnnihilated()) { this.villages.splice(i, 1); this.dirty = true; } else i++;
  }
  findNearestVillage(x, y, z, extra) {
    let best = null, bd = 3.4028234663852886e38;
    for (const v of this.villages) {
      const s = distSq(x, y, z, ...v.center);
      if (s >= bd) continue;
      const r = extra + v.radius;
      if (s > r * r) continue;
      best = v; bd = s;
    }
    return best;
  }
  dropOldestVillagerPosition() { if (this.positions.length) this.scan(this.positions.shift()); }
  addNewDoorsToVillageOrCreateVillage() {
    for (const door of this.newDoors) {
      let found = false;
      for (const v of this.villages) {
        const s = trunc(distSq(door.x, door.y, door.z, ...v.center)), r = 32 + v.radius;
        if (s > r * r) continue;
        v.addDoor(door); found = true; break;
      }
      if (found) continue;
      const v = new Village(this.host);
      v.addDoor(door);
      this.villages.push(v); this.dirty = true;
    }
    this.newDoors.length = 0;
  }
  scan([px, py, pz]) {
    const h = this.host;
    for (let x = px - 16; x < px + 16; x++) for (let y = py - 4; y < py + 4; y++) for (let z = pz - 16; z < pz + 16; z++) {
      if (!h.isWoodenDoor(x, y, z)) continue;
      const door = this.doorAt(x, y, z);
      if (!door) this.addNewDoor(x, y, z); else door.lastActivity = this.tickCounter;
    }
  }
  doorAt(x, y, z) {
    for (const d of this.newDoors) if (d.x === x && d.z === z && Math.abs(d.y - y) <= 1) return d;
    for (const v of this.villages) { const d = v.doorAt(x, y, z); if (d) return d; }
    return null;
  }
  addNewDoor(x, y, z) {
    const h = this.host, facing = h.doorFacing(x, y, z);
    let count = 0;
    const along = facing === 0 || facing === 2;
    for (let k = -5; k < 0; k++) if (along ? h.canSeeSky(x + k, y, z) : h.canSeeSky(x, y, z + k)) count--;
    for (let k = 1; k <= 5; k++) if (along ? h.canSeeSky(x + k, y, z) : h.canSeeSky(x, y, z + k)) count++;
    if (count === 0) return;
    const inside = count > 0 ? -2 : 2;
    this.newDoors.push(along ? new VillageDoorInfo(x, y, z, inside, 0, this.tickCounter) : new VillageDoorInfo(x, y, z, 0, inside, this.tickCounter));
  }
  // Persistence: browser save (plain object) and Java data/villages.dat (villageDocument)
  toJSON() { return { tick: this.tickCounter, villages: this.villages.map((v) => v.toJSON()) }; }
  loadJSON(j) {
    this.villages = []; this.positions = []; this.newDoors = [];
    this.tickCounter = j?.tick | 0;
    for (const v of j?.villages ?? []) this.villages.push(Village.fromJSON(this.host, v));
  }
}

const tInt = (value) => ({ type: NBT.INT, value: value | 0 });
const tString = (value) => ({ type: NBT.STRING, value });
const tList = (items) => ({ type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: items.map((t) => t.value) } });

// WorldSavedData "villages": data { Villages: [..], Tick }. Village NBT as Village.writeVillageDataToNBT.
export function villagesToNbt(json) {
  const villages = (json?.villages ?? []).map((v) => compoundTag([
    ["PopSize", tInt(v.pop)], ["Radius", tInt(v.radius)], ["Golems", tInt(v.golems)], ["Stable", tInt(v.stable)], ["Tick", tInt(v.tick)], ["MTick", tInt(v.mtick)],
    ["CX", tInt(v.c[0])], ["CY", tInt(v.c[1])], ["CZ", tInt(v.c[2])], ["ACX", tInt(v.ac[0])], ["ACY", tInt(v.ac[1])], ["ACZ", tInt(v.ac[2])],
    ["Doors", tList(v.doors.map(([x, y, z, ix, iz, ts]) => compoundTag([["X", tInt(x)], ["Y", tInt(y)], ["Z", tInt(z)], ["IDX", tInt(ix)], ["IDZ", tInt(iz)], ["TS", tInt(ts)]])))],
    ["Players", tList(v.players.map(([n, s]) => compoundTag([["Name", tString(n)], ["S", tInt(s)]])))],
  ]));
  return compoundTag([["Villages", tList(villages)], ["Tick", tInt(json?.tick ?? 0)]]);
}
export const villageDocument = (json) => ({ name: "", tag: compoundTag([["data", villagesToNbt(json)]]) });

export function villagesFromNbt(data) {
  const m = data.value, int = (map, k) => map.get(k)?.value ?? 0, out = { tick: int(m, "Tick"), villages: [] };
  for (const v of m.get("Villages")?.value?.items ?? []) {
    out.villages.push({ pop: int(v, "PopSize"), radius: int(v, "Radius"), golems: int(v, "Golems"), stable: int(v, "Stable"), tick: int(v, "Tick"), mtick: int(v, "MTick"),
      c: [int(v, "CX"), int(v, "CY"), int(v, "CZ")], ac: [int(v, "ACX"), int(v, "ACY"), int(v, "ACZ")],
      doors: (v.get("Doors")?.value?.items ?? []).map((d) => ["X", "Y", "Z", "IDX", "IDZ", "TS"].map((k) => int(d, k))),
      players: (v.get("Players")?.value?.items ?? []).map((p) => [p.get("Name")?.value ?? "", int(p, "S")]) });
  }
  return out;
}
