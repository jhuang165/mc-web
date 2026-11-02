import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong, MapGenCaves, MapGenRavine } from "./mapgen.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { WorldGenDungeons, dungeonEnchantedBook, bookCandidates, DUNGEON_LOOT, BOOK_ENCHANTMENTS } from "./dungeon-generator.js";
const ref = JSON.parse(readFileSync(new URL("../public/research/dungeon-reference.json",import.meta.url)));
const solid = new Map(ref.config.materials);
const mod = (a,b) => ((a % b) + b) % b;
class Fixture {
  constructor(r) {
    this.name = r.fixture; [this.x,this.y,this.z] = r.pos;
    const random = new JavaRandom(r.seed); this.rx = random.nextInt(2)+2; this.rz = random.nextInt(2)+2;
    this.chunks = new Map(); this.edits = new Map(); this.tiles = new Map(); this.writes = []; this.calls = createHash("sha1"); this.callCount = 0;
  }
  call(...args) {
    this.callCount++; const bytes = Buffer.alloc(args.length*4);
    args.forEach((v,i)=>bytes.writeInt32LE(v,i*4)); this.calls.update(bytes);
  }
  getBlock(x,y,z) {
    this.call(0,x,y,z);
    if (y<0 || y>=256 || x< -30000000 || x>=30000000 || z< -30000000 || z>=30000000) return 0;
    const key = `${x},${y},${z}`; if (this.edits.has(key)) return this.edits.get(key);
    if (this.name === "natural") return this.chunks.get(`${x>>4},${z>>4}`)[((x&15)*16+(z&15))*256+y];
    const dx=x-this.x, dy=y-this.y, dz=z-this.z;
    let tunnel = dy>=0 && dy<=1 && dz===0 && dx<=0;
    if (this.name === "solid") tunnel=false;
    if (this.name === "manyDoors") tunnel=dy>=0 && dy<=1;
    if (this.name === "fiveDoors") tunnel=dy>=0 && dy<=1 && dx=== -this.rx-1 && Math.abs(dz)<=2;
    if (this.name === "sixDoors") tunnel=dy>=0 && dy<=1 && dx=== -this.rx-1 && dz>= -2 && dz<=3;
    let id = tunnel ? 0 : 1;
    if (this.name === "floorHole" && dy=== -1 && dx=== -this.rx-1 && dz=== -this.rz-1) id=0;
    if (this.name === "roofHole" && dy===4 && dx===0 && dz===0) id=0;
    if (this.name === "unsupported" && dy=== -2 && mod(dx+dz,3)===0) id=0;
    if (this.name === "water" && dy===2) id=9;
    if (this.name === "plants" && dy===2 && mod(dx+dz,4)===0) id=31;
    return id;
  }
  isSolid(id) { return solid.get(id); }
  isAirBlock(x,y,z) { this.call(1,x,y,z); return this.getBlock(x,y,z)===0; }
  setBlock(x,y,z,id,meta,flags) {
    this.call(2,x,y,z,id,meta,flags);
    if (y<0 || y>=256 || x< -30000000 || x>=30000000 || z< -30000000 || z>=30000000) return false;
    const key = `${x},${y},${z}`;
    this.edits.set(key,id); this.writes.push([x,y,z,id,meta,flags]); this.tiles.delete(key);
    if (id===54 && this.name!=="missingChest") {
      const tile = {size:27, slots:Array(27).fill(null), writes:[]};
      tile.setSlot=(i,stack)=>{tile.slots[i]=stack;tile.writes.push([i,stack]);}; this.tiles.set(key,tile);
    }
    if (id===52 && this.name!=="missingSpawner") {
      const tile = {name:"Pig"}; tile.setEntityName=name=>{tile.name=name;}; this.tiles.set(key,tile);
    }
    return true;
  }
  setBlockToAir(x,y,z) { this.call(3,x,y,z); return this.setBlock(x,y,z,0,0,3); }
  getTileEntity(x,y,z) { this.call(4,x,y,z); return this.tiles.get(`${x},${y},${z}`); }
}
test("GEN-04 dungeon: unchanged loot weights, enchantment level ranges, compatibility and native candidate map order",()=>{
  assert.equal(ref.config.enchantability,1);
  assert.deepEqual(DUNGEON_LOOT,ref.config.loot);
  assert.deepEqual(BOOK_ENCHANTMENTS,ref.config.enchantments);
  for (const r of ref.records.filter(r=>r.kind==="candidates"))
    assert.deepEqual(bookCandidates(r.level).map(e=>[e.id,e.level]),r.values,`level ${r.level}`);
});
test("GEN-04 dungeon: exact native level30 enchanted-book tags and RNG",()=>{
  for (const r of ref.records.filter(r=>r.kind==="book")) {
    const random = new JavaRandom(r.seed);
    assert.deepEqual(dungeonEnchantedBook(random),r.stack,`seed ${r.seed}`);
    assert.equal(randomLong(random).toString(),r.nextLong,`seed ${r.seed}`);
  }
});
function replay(r) {
  const w = new Fixture(r), random = new JavaRandom(r.seed), label=JSON.stringify([r.fixture,r.seed,r.pos]);
  if (r.fixture === "natural") {
    const terrain = new ChunkProviderGenerate(BigInt(r.worldSeed),"default",new BiomeTerrainState());
    const topAt = (x,z)=>terrain.biomeState.topBlock(terrain.manager.biomeAt(x,z));
    const caves=new MapGenCaves(BigInt(r.worldSeed),terrain.manager,topAt), ravines=new MapGenRavine(BigInt(r.worldSeed),terrain.manager,topAt);
    for (const [x,z,sha1] of r.inputs) {
      const {blocks}=terrain.provideChunk(x,z);caves.generate(x,z,blocks);ravines.generate(x,z,blocks);
      const bytes=Buffer.alloc(blocks.length*2);blocks.forEach((v,i)=>bytes.writeUInt16LE(v,i*2));
      assert.equal(createHash("sha1").update(bytes).digest("hex"),sha1,`input ${r.worldSeed} ${x},${z}`);
      w.chunks.set(`${x},${z}`,blocks);
    }
  }
  assert.equal(new WorldGenDungeons().generate(w,random,...r.pos),r.result,label);
  assert.deepEqual(w.writes,r.writes,label);
  const tiles = [...w.tiles].map(([key,t])=>t.slots ? [key,"chest",t.slots,t.writes] : [key,"spawner",t.name]);
  assert.deepEqual(tiles,r.tiles,label);
  assert.equal(w.callCount,r.callCount,label);
  assert.equal(w.calls.digest("hex"),r.callSha1,label);
  assert.equal(randomLong(random).toString(),r.nextLong,label);
}
test("GEN-04 dungeon: room validation/carving, ordered block/air/tile calls, loot slots/NBT, spawner and RNG",()=>{
  const records = ref.records.filter(r=>r.kind==="dungeon" && r.fixture!=="natural");
  for (const r of records) replay(r);
  for (const fixture of ["solid","manyDoors","sixDoors","floorHole","roofHole"])
    assert.ok(records.some(r=>r.fixture===fixture && !r.result && r.writes.length===0),fixture);
  assert.ok(records.some(r=>r.fixture==="fiveDoors" && r.result));
  for (const mob of ["Skeleton","Zombie","Spider"])
    assert.ok(records.some(r=>r.tiles.some(t=>t[1]==="spawner" && t[2]===mob)),mob);
  assert.ok(records.some(r=>r.tiles.some(t=>t[1]==="chest" && t[3].some(([,s])=>s[0]===403))));
  assert.ok(records.some(r=>r.tiles.some(t=>t[1]==="chest" && new Set(t[3].map(([i])=>i)).size<t[3].length)));
  // y1 rooms: the floor at y0 has no solid block below (y-1 reads air), so the
  // whole floor is removed instead of becoming cobblestone/mossy cobblestone.
  const low = records.filter(r=>r.pos[1]===1);
  assert.equal(low.length,8);
  for (const r of low) {
    assert.ok(r.result);
    const floor = r.writes.filter(w=>w[1]===0);
    assert.ok(floor.length>0 && floor.every(w=>w[3]===0 && w[5]===3));
  }
  for (const r of records.filter(r=>r.pos[1]===0 || r.pos[1]===252 || Math.abs(r.pos[0])>=29999999))
    assert.ok(!r.result && r.writes.length===0);
});

test("GEN-04 dungeon: accepted/rejected rooms across unchanged native terrain/surface/cave/ravine chunks",()=>{
  const records=ref.records.filter(r=>r.fixture==="natural");
  assert.equal(records.length,12);assert.equal(records.filter(r=>r.result).length,6);
  for (const r of records) replay(r);
});
