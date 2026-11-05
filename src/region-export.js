import { saveEnderSlots } from './chest-blocks.js';
import { writeCommandBlock } from "./command-block.js";
import { writeNoteTile } from "./note-blocks.js";
import { writeJukeboxTile } from "./jukebox.js";
// Browser -> Java 1.7.10 Anvil snapshot. The ZIP also retains the exact browser save.
import { World } from './world.js';
import { lightOpacity } from './lighting.js';
import { Chunk } from './chunk-store.js';
import { toOriginal } from './block-registry.js';
import { chunkToNbt } from './chunk-nbt.js';
import { encodeRegionChunk, writeRegion, regionAddress } from './region-file.js';
import { encodeCompressedNbt } from './nbt-compression.js';
import { NBT } from './nbt.js';
import { ORIGINAL_ITEMS } from './region-import.js';
import { FALLING_Y_OFFSET } from './falling.js';
import { TNT_Y_OFFSET } from './explosion.js';
import { Experience } from './experience.js';
import { splitRuntime } from './chunk-runtime.js';
import { populationBlockMapperReady } from './population-world.js';
import { streamedWorldType } from './java-world.js';
import { structureDataFiles } from './structure-data.js';
import { villageDocument } from './village.js';
const tag=(type,value)=>({type,value}), comp=value=>tag(NBT.COMPOUND,new Map(Object.entries(value))), list=(type,items)=>tag(NBT.LIST,{elementType:items.length?type:NBT.END,items});
const byte=v=>tag(NBT.BYTE,(v<<24)>>24), short=v=>tag(NBT.SHORT,v), int=v=>tag(NBT.INT,v), str=v=>tag(NBT.STRING,v), float=v=>tag(NBT.FLOAT,v), long=v=>tag(NBT.LONG,BigInt(Math.trunc(v)));
const reverse=new Map();
for(const [k,id] of Object.entries(ORIGINAL_ITEMS)) {const [o,damage]=k.split(':').map(Number);if(!reverse.has(id)||damage===undefined)reverse.set(id,{id:o,damage});}
function stackNbt(s,slot,report,original=false) {
 if(!s)return null;const o=original?s:reverse.get(s.id);
 if(!o){report.unmappedItems++;return null;}
 const entry={id:short(o.id),Count:byte(s.count),Damage:short(o.damage??s.damage??0)};
 if(slot!==undefined)entry.Slot=byte(slot>127?slot-256:slot);
 const enchantList=values=>list(NBT.COMPOUND,values.map(e=>new Map([['id',short(e.id)],['lvl',short(e.lvl)]])));
 const tagEntries={};
 if(Array.isArray(s.enchantments))tagEntries.ench=enchantList(s.enchantments);
 const stored=s.storedEnchantments??(s.stored?.length?s.stored:undefined);
 if(Array.isArray(stored))tagEntries.StoredEnchantments=enchantList(stored);
 if(Number.isInteger(s.repairCost))tagEntries.RepairCost=int(s.repairCost);
 const display={};
 if(typeof s.displayName==='string')display.Name=str(s.displayName);
 if(Number.isInteger(s.color)&&s.color>=0&&s.color<=0xffffff)display.color=int(s.color);
 if(Object.keys(display).length)tagEntries.display=comp(display);
 if(typeof s.unbreakable==='boolean')tagEntries.Unbreakable=byte(s.unbreakable?1:0);
 if(Object.keys(tagEntries).length)entry.tag=comp(tagEntries);
 return new Map(Object.entries(entry));
}
const inventory=(items,report)=>list(NBT.COMPOUND,(items??[]).flatMap((s,i)=>{const n=stackNbt(s,i,report);return n?[n]:[];}));
const NAMES={enderman:'Enderman',pig:'Pig',cow:'Cow',mooshroom:'MushroomCow',snow_golem:'SnowMan',sheep:'Sheep',chicken:'Chicken',wolf:'Wolf',ocelot:'Ozelot',horse:'EntityHorse',zombie:'Zombie',skeleton:'Skeleton',spider:'Spider',cave_spider:'CaveSpider',caveSpider:'CaveSpider',creeper:'Creeper',villager:'Villager',silverfish:'Silverfish',witch:'Witch',slime:'Slime',magma_cube:'LavaSlime',pigman:'PigZombie',iron_golem:'VillagerGolem',squid:'Squid',bat:'Bat'};
function entity(e,name,ox,oz) {
 return {id:str(name),Pos:list(NBT.DOUBLE,[e.x+ox,e.posY??e.y,e.z+oz]),Motion:list(NBT.DOUBLE,e.motion??[e.vx??e.mx??0,e.vy??e.my??0,e.vz??e.mz??0]),
 Rotation:list(NBT.FLOAT,e.rotation??(name==='Player'?[(Math.PI-(e.yaw??0))*180/Math.PI,-(e.pitch??0)*180/Math.PI]:[e.rotationYaw??(-(e.yaw??0)*180/Math.PI+0),e.rotationPitch??0])),FallDistance:float(e.fallDistance??0),Fire:short(e.fire??-1),Air:short(e.air??300),OnGround:byte(e.onGround?1:0),Dimension:int(0),Invulnerable:byte(0),PortalCooldown:int(0)};
}
// Shared TileEntity.writeToNBT used by region export and /testforblock.
export function writeContainerTile(name,e,x,y,z,{report={unmappedItems:0},dropper=false}={}) {
 const n={id:str(name==='chests'?'Chest':name==='dispensers'?(dropper?'Dropper':'Trap'):name==='hoppers'?'Hopper':name==='brewing'?'Cauldron':'Furnace'),x:int(x),y:int(y),z:int(z),Items:inventory(e.items,report)};
 if(name==='furnaces'){n.BurnTime=short(e.burn??0);n.CookTime=short(e.cook??0);}
 if(name==='brewing')n.BrewTime=short(e.brewTime??0);
 if(name==='hoppers'){n.TransferCooldown=int(e.cooldown??0);if(e.name)n.CustomName=str(e.name);}
 return new Map(Object.entries(n));
}
function payload(state,ox,oz,report,world=null) {
 const entities=[],tiles=[],ticks=[];
 for(const wrapped of state.entities??[]) {const e=wrapped.value,name=NAMES[e.type];if(!name){report.unsupportedEntities++;continue;}
  const n=entity(e,name,ox,oz);Object.assign(n,{HealF:float(e.health??20),Health:short(Math.ceil(e.health??20)),HurtTime:short(0),DeathTime:short(0),AttackTime:short(0),Age:int(e.growingAge??0),InLove:int(e.love??0)});
  // EntityLiving.writeEntityToNBT: CustomName / CustomNameVisible (only when named), PersistenceRequired and Leashed with its Leash compound (a knot's X/Y/Z, or the holder's UUID).
  if(e.customName){n.CustomName=str(e.customName);n.CustomNameVisible=byte(e.customNameVisible?1:0);}
  n.PersistenceRequired=byte(e.persistent?1:0);n.Leashed=byte(e.leash?1:0);
  if(e.leash?.knot)n.Leash=comp({X:int(e.leash.knot.x+ox),Y:int(e.leash.knot.y),Z:int(e.leash.knot.z+oz)});
  else if(e.leash)n.Leash=comp({UUIDMost:long(0),UUIDLeast:long(0)});
  if(e.type==='sheep'){n.Color=byte(e.color??0);n.Sheared=byte(e.sheared?1:0);}
  // EntityTameable and EntityWolf.writeEntityToNBT: Sitting, Angry, CollarColor and OwnerUUID (the single player's own id, or Owner left out for a wild wolf).
  if(e.type==='wolf'){n.Sitting=byte(e.sitting?1:0);n.Angry=byte(e.angry?1:0);n.CollarColor=byte(e.collar??14);n.OwnerUUID=str(e.owner?(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(e.owner)?e.owner:'00000000-0000-0000-0000-000000000000'):'');}
  // EntityTameable and EntityOcelot.writeEntityToNBT: Sitting, OwnerUUID and CatType.
  if(e.type==='ocelot'){n.Sitting=byte(e.sitting?1:0);n.CatType=int(e.catType??0);n.OwnerUUID=str(e.owner?(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(e.owner)?e.owner:'00000000-0000-0000-0000-000000000000'):'');}
  // EntityHorse.writeEntityToNBT (horse.js writeNbt): Type, Variant, Temper, Tame, flags, Saddle/Armor items and the attribute list.
  if(e.type==='horse'&&e.horse){const h=e.horse,att=(Name,Base)=>comp({Name:str(Name),Base:tag(NBT.DOUBLE,Base)}),it=id=>comp({id:short(id),Count:byte(1),Damage:short(0)});
   Object.assign(n,{Type:int(h.type),Variant:int(h.variant),Temper:int(h.temper),Tame:byte(h.tame?1:0),Bred:byte(h.bred?1:0),ChestedHorse:byte(h.chested?1:0),HasReproduced:byte(h.reproduced?1:0),EatingHaystack:byte(0),
    OwnerUUID:str(h.owner?'00000000-0000-0000-0000-000000000000':''),Attributes:list(NBT.COMPOUND,[att('generic.maxHealth',h.maxHealth),att('generic.movementSpeed',h.speed),att('horse.jumpStrength',h.jump)])});
   if(h.saddled)n.SaddleItem=it(329);if(h.armor)n.ArmorItem=it(416+h.armor);
   if(h.chested&&Array.isArray(h.items))n.Items=list(NBT.COMPOUND,h.items.map((st,i)=>i>=2?stackNbt(st,i,report):null).filter(Boolean));}
  // EntityVillager.writeEntityToNBT: Profession, Riches and Offers.Recipes (MerchantRecipe: buy, optional buyB, sell, uses, maxUses, in original item ids); EntityAgeable's Age is written above, InLove is EntityAnimal's.
  if(e.type==='villager'){n.Profession=int(e.profession??0);n.Riches=int(e.riches??0);delete n.InLove;
   if(Array.isArray(e.offers)){const bare=x=>{if(!x)return null;const c={...x};for(const k of ['enchantments','storedEnchantments'])if(Array.isArray(c[k])&&!c[k].length)delete c[k];return stackNbt(c,undefined,report,true);};
    n.Offers=comp({Recipes:list(NBT.COMPOUND,e.offers.map(r=>{const m=new Map([['buy',tag(NBT.COMPOUND,bare(r.buy))],['sell',tag(NBT.COMPOUND,bare(r.sell))],['uses',int(r.uses??0)],['maxUses',int(r.maxUses??7)]]);if(r.buyB)m.set('buyB',tag(NBT.COMPOUND,bare(r.buyB)));return m;}))});}}
  // EntityZombie.writeEntityToNBT: IsBaby (only for a child), IsVillager (only for a zombie villager), ConversionTime (-1 when not curing) and CanBreakDoors. A zombie has no Age or InLove.
  if(e.type==='zombie'){delete n.Age;delete n.InLove;if((e.growingAge??0)<0)n.IsBaby=byte(1);if(e.villager)n.IsVillager=byte(1);n.ConversionTime=int(Number.isInteger(e.conversionTime)?e.conversionTime:-1);n.CanBreakDoors=byte(0);}
  // EntitySlime.writeEntityToNBT: Size (size - 1); a slime has no Age or InLove.
  if(e.type==='slime'||e.type==='magma_cube'){n.Size=int((e.size??1)-1);delete n.Age;delete n.InLove;}
  // EntityPigZombie.writeEntityToNBT: the short Anger (1.7.10 has no HurtBy tag), then EntityLiving's Equipment (slot 0 is the held sword) and DropChances (0.085 each); no Age or InLove.
  if(e.type==='pigman'){delete n.Age;delete n.InLove;n.Anger=short(e.angerLevel??0);const sword=e.held?stackNbt(e.held,undefined,report):null;n.Equipment=list(NBT.COMPOUND,[0,1,2,3,4].map(i=>i===0&&sword?sword:new Map()));n.DropChances=list(NBT.FLOAT,[0,1,2,3,4].map(()=>Math.fround(0.085)));n.CanPickUpLoot=byte(0);n.CanBreakDoors=byte(0);n.IsBaby=byte(0);n.IsVillager=byte(0);n.ConversionTime=int(-1);}
  // EntityEnderman.writeEntityToNBT: carried and carriedData as shorts (original block id and metadata; Age and InLove do not apply).
  if(e.type==='enderman'){delete n.Age;delete n.InLove;n.carried=short(e.carried??0);n.carriedData=short(e.carriedData??0);}
  // EntityBat.writeEntityToNBT: BatFlags (bit 1 = hanging); neither a squid nor a bat is an EntityAgeable.
  if(e.type==='squid'||e.type==='bat'){delete n.Age;delete n.InLove;if(e.type==='bat')n.BatFlags=byte(e.batHanging?1:0);}
  // EntityIronGolem.writeEntityToNBT: PlayerCreated (EntityAgeable's fields do not apply to a golem).
  if(e.type==='iron_golem'){n.PlayerCreated=byte(e.playerCreated?1:0);delete n.Age;delete n.InLove;}
  // EntityLivingBase.writeEntityToNBT: ActiveEffects (Id, Amplifier, Duration, Ambient) for the effects this build models on mobs.
  if(e.effects?.length&&['zombie','villager','iron_golem'].includes(e.type))n.ActiveEffects=list(NBT.COMPOUND,e.effects.map(x=>new Map([['Id',byte(x.id)],['Amplifier',byte(x.amplifier??0)],['Duration',int(x.duration)],['Ambient',byte(0)]])));
  entities.push(new Map(Object.entries(n)));
 }
 for(const {value:e} of state.drops??[]) {const item=stackNbt(e.stack,undefined,report);if(!item)continue;entities.push(new Map(Object.entries({...entity({...e,posY:e.y+.125},'Item',ox,oz),Item:tag(NBT.COMPOUND,item),Age:short(e.age??0),PickupDelay:short(e.delay??0),Health:short(5)})));}
 for(const {value:e} of state.tnt??[])entities.push(new Map(Object.entries({...entity({...e,posY:e.y+TNT_Y_OFFSET},'PrimedTnt',ox,oz),Fuse:byte(e.fuse)})));
 for(const {value:e} of state.xpOrbs??[])entities.push(new Map(Object.entries({...entity({...e,posY:e.y+.25},'XPOrb',ox,oz),Health:short(e.health??5),Age:short(e.age??0),Value:short(e.value??1)})));
 for(const {value:e} of state.falling??[]) {const o=toOriginal(e.block,e.meta);entities.push(new Map(Object.entries({...entity({...e,posY:e.y+FALLING_Y_OFFSET},'FallingSand',ox,oz),TileID:int(o[0]),Data:byte(o[1]),Time:byte(e.ticks&255),DropItem:byte(1)})));}
 for(const {value:e} of state.carts??[]) {const items=(e.items??[]).map(s=>stackNbt(s,s.slot,report,true)).filter(Boolean),n=entity(e,e.type===0?'MinecartRideable':'MinecartChest',ox,oz);if(e.type!==0)n.Items=list(NBT.COMPOUND,items);if(e.customName)n.CustomName=str(e.customName);entities.push(new Map(Object.entries(n)));}
 // EntityHanging.writeEntityToNBT: Direction (0 south, 1 west, 2 north, 3 east) and the legacy Dir byte (2, 1, 0, 3), the wall block
 // as TileX/Y/Z, then EntityPainting's Motive or EntityItemFrame's Item (original id), ItemRotation and ItemDropChance (src/hanging.js).
 for(const {value:e} of state.hanging??[]) {const base=entity({x:e.x,y:e.y,z:e.z,rotationYaw:e.yaw,rotationPitch:0},e.kind==='painting'?'Painting':'ItemFrame',ox,oz);
  const n={...base,Direction:byte(e.dir),Dir:byte([2,1,0,3][e.dir]),TileX:int(e.tx+ox),TileY:int(e.ty),TileZ:int(e.tz+oz)};
  if(e.kind==='painting')n.Motive=str(e.art);
  else{const item=e.item?stackNbt(e.item,undefined,report):null;if(item)n.Item=tag(NBT.COMPOUND,item);n.ItemRotation=byte(e.rotation??0);n.ItemDropChance=float(e.dropChance??1);}
  entities.push(new Map(Object.entries(n)));}
 for(const name of ['projectiles','arrows'])report.unsupportedEntities+=(state[name]??[]).length;
 for(const name of ['chests','furnaces','dispensers','hoppers','brewing'])for(const [k,e] of Object.entries(state[name]??{})) {
  const [x,y,z]=k.split(',').map(Number);tiles.push(writeContainerTile(name,e,x+ox,y,z+oz,{report,dropper:world?.get(x,y,z)===132}));
 }
 for(const {value:e} of state.commandBlocks??[])tiles.push(writeCommandBlock(e,e.x+ox,e.y,e.z+oz));
 // TileEntityNote (Music) and TileEntityJukebox (RecordPlayer): the note byte, the Record int and the RecordItem stack.
 for(const {value:e} of state.musicTiles??[])tiles.push(e.kind==='note'?writeNoteTile(e,e.x+ox,e.y,e.z+oz):writeJukeboxTile(e,e.x+ox,e.y,e.z+oz));
 // TileEntitySign.writeToNBT: Text1-Text4 (signs.js).
 for(const {value:e} of state.signs??[])tiles.push(new Map(Object.entries({id:str('Sign'),x:int(e.x+ox),y:int(e.y),z:int(e.z+oz),Text1:str(e.text?.[0]??''),Text2:str(e.text?.[1]??''),Text3:str(e.text?.[2]??''),Text4:str(e.text?.[3]??'')})));
 for(const {value:e} of state.spawners??[]) {const n={id:str('MobSpawner'),x:int(e.x+ox),y:int(e.y),z:int(e.z+oz)};for(const [k,v] of Object.entries(e))if(!['x','y','z'].includes(k))n[k]=typeof v==='string'?str(v):short(v);tiles.push(new Map(Object.entries(n)));}
 // TileEntityPiston.writeToNBT: blockId, blockData, facing, progress, extending (original ids; renderHead is not saved by Java).
 for(const w of state.pistons??[]){const e=w.value??w;tiles.push(new Map(Object.entries({id:str('Piston'),x:int(e.x+ox),y:int(e.y),z:int(e.z+oz),blockId:int(e.block),blockData:int(e.meta),facing:int(e.facing),progress:float(e.progress??0),extending:byte(e.extending?1:0)})));}
 for(const name of ['fluidTicks','fireTicks','fallingTicks'])for(const {value:e} of state[name]??[]) {const o=toOriginal(e.block,0,{flowing:name==='fluidTicks'});if(o)ticks.push(new Map(Object.entries({i:int(o[0]),x:int(e.x+ox),y:int(e.y),z:int(e.z+oz),t:int(Math.max(-2147483648,Math.min(2147483647,e.delay))),p:int(0)})));}
 return {entities,tileEntities:tiles,tileTicks:ticks};
}
// TileEntityEndPortal (id Airportal) has no fields besides x, y, z.
const endPortalTiles=(p,cells)=>{for(const [x,y,z] of cells)p.tileEntities.push(new Map(Object.entries({id:str('Airportal'),x:int(x),y:int(y),z:int(z)})));return p;};
function levelNbt(record,w,report) {
 const p=record.player??{},pos=record.position??w.spawn(),xp=new Experience(record.experience),creative=record.mode!=='survival'&&record.mode!=='adventure',gameType=creative?1:record.mode==='adventure'?2:0;
 const player={...entity(pos,'Player',w.originX??0,w.originZ??0),Health:short(p.health??20),HealF:float(p.health??20),foodLevel:int(p.food??20),foodSaturationLevel:float(p.saturation??5),foodExhaustionLevel:float(p.exhaustion??0),foodTickTimer:int(p.timer??0),XpLevel:int(xp.level),XpP:float(xp.progress),XpTotal:int(xp.total),Score:int(xp.score),SelectedItemSlot:int(p.current??0),playerGameType:int(gameType),SleepTimer:short(0),Sleeping:byte(0),abilities:comp({invulnerable:byte(creative?1:0),flying:byte(0),mayfly:byte(creative?1:0),instabuild:byte(creative?1:0),mayBuild:byte(gameType===2?0:1),flySpeed:float(.05),walkSpeed:float(.1)})};
 delete player.id;
 const items=(p.slots??[]).flatMap((s,i)=>{const n=stackNbt(s,i,report);return n?[n]:[];});
 (p.armor??[]).forEach((s,i)=>{const n=stackNbt(s,100+i,report);if(n)items.push(n);});player.Inventory=list(NBT.COMPOUND,items);
 // InventoryEnderChest.saveInventoryToNBT: EnderItems, slots 0-26 (chest-blocks.js).
 player.EnderItems=list(NBT.COMPOUND,saveEnderSlots(p.enderItems).flatMap(({slot,stack})=>{const n=stackNbt(stack,slot,report);return n?[n]:[];}));
 const data={version:int(19133),initialized:byte(1),RandomSeed:tag(NBT.LONG,w.javaSeed??BigInt(w.numericSeed)),generatorName:str(record.biome==='javaStreamed'?streamedWorldType(record.worldType):record.biome==='javaLargeBiomes'?'largeBiomes':record.biome==='javaAmplified'?'amplified':'default'),generatorVersion:int(1),generatorOptions:str(''),MapFeatures:byte(1),LevelName:str(record.name??'Blockworld'),GameType:int(gameType),hardcore:byte(0),allowCommands:byte(creative?1:0),Time:long(p.time??0),DayTime:long(p.time??0),LastPlayed:long(record.updated??0),SizeOnDisk:long(0),SpawnX:int(Math.floor(pos.x+(w.originX??0))),SpawnY:int(Math.floor(pos.y)),SpawnZ:int(Math.floor(pos.z+(w.originZ??0))),Difficulty:byte(2),Player:comp(player)};
 for(const name of ['rainTime','thunderTime'])data[name]=int(record.weather?.[name]??0);
 for(const name of ['raining','thundering'])data[name]=byte(record.weather?.[name]?1:0);
 return {name:'',tag:comp({Data:comp(data)})};
}
// Uncompressed ZIP entries; each MCA already contains zlib-compressed NBT.
export function zipFiles(files) {
 const encoder=new TextEncoder(),parts=[],directory=[];let offset=0;
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 for(const [name,bytes] of files) {
  const path=encoder.encode(name),sum=crc(bytes),header=new Uint8Array(30+path.length),v=new DataView(header.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);v.setUint32(14,sum,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,path.length,true);header.set(path,30);
  const central=new Uint8Array(46+path.length),d=new DataView(central.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,0x21,true);d.setUint32(16,sum,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,path.length,true);d.setUint32(42,offset,true);central.set(path,46);
  parts.push(header,bytes);directory.push(central);offset+=header.length+bytes.length;
 }
 const end=new Uint8Array(22),v=new DataView(end.buffer),size=directory.reduce((n,b)=>n+b.length,0);
 v.setUint32(0,0x06054b50,true);v.setUint16(8,directory.length,true);v.setUint16(10,directory.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
 const out=new Uint8Array(offset+size+22);let i=0;for(const b of [...parts,...directory,end]){out.set(b,i);i+=b.length;}return out;
}
export async function exportJavaSave(record,{world=null,onProgress=()=>{},maxChunks=4096}={}) {
 await populationBlockMapperReady;
 const w=world??new World(record.seed,record.biome,record.generationVersion??1,record.worldType);
 if(!world)w.restore(record.edits??[]);
 const ox=w.originX??0,oz=w.originZ??0,owned=new Set([...w.chunks.keys(),...w.chunkEdits.keys()]);
 const {columns}=splitRuntime(record),runtime=new Map(columns.map(c=>[`${c.x},${c.z}`,c.state]));
 for(const k of runtime.keys())owned.add(k);
 for(const [k,hex] of Object.entries(record.populatedColumns?.cells??{})) {const [x,z]=k.split(',').map(Number),mask=BigInt('0x'+hex);for(let i=0;i<64;i++)if(mask&(1n<<BigInt(i)))owned.add(`${x*8+(i>>3)},${z*8+(i&7)}`);}
 if(owned.size>maxChunks)throw new Error(`Java export is limited to ${maxChunks} columns per download (${owned.size} requested)`);
 const report={format:'Java 1.7.10 Anvil snapshot',columns:owned.size,unmappedItems:0,unsupportedEntities:0,notes:[
 'Unzip this directory under the Java 1.7.10 saves directory. blockworld.json is the complete browser backup.',
 'Provided columns are marked terrain-populated. Java generates outside them using the seed; border features can differ from browser population.',
 'LightPopulated is false: Java must rebuild light. Village records are written to data/villages.dat; AI/RNG state, player status effects and cross-system tick order are not converted.',
 'Thrown projectiles and arrows are counted as unsupported entities. Other entities use supported position/motion/health/basic age fields; advanced fields use native defaults.',
 'Browser legacy landscapes export their finite area; Java generates default terrain outside it.'
 ]}, regions=new Map();let count=0;
 const farms=new Map(record.farms??[]),fluidCells=new Set((record.fluidTicks?.entries??[]).map(e=>`${e.x},${e.y},${e.z}:${e.block}`));
 for(const k of [...owned].sort((a,b)=>{const [x,z]=a.split(',').map(Number),[u,v]=b.split(',').map(Number);return x-u||z-v;})) {
  const [cx,cz]=k.split(',').map(Number),source=w.chunks.get(k),generated=source?null:w.generateTerrainChunk(cx,cz),blocks=source?.blocks??generated.blocks,meta=source?.meta??generated.metadata,ids=new Int16Array(65536),metadata=new Uint8Array(65536),heights=new Int32Array(256),portals=[];
  for(let lx=0;lx<16;lx++)for(let lz=0;lz<16;lz++)for(let y=0;y<w.height;y++) {const i=(lx*16+lz)*w.height+y,v=w.chunkEdits.get(k)?.get((lx*16+lz)*256+y),id=v===undefined?blocks[i]:v%4096&255,m=v===undefined?meta[i]:(v%4096)>>8,x=cx*16+lx,z=cz*16+lz,key=`${x},${y},${z}`;
   const o=toOriginal(id,m,{flowing:fluidCells.has(key+':'+id),moisture:farms.get(key),facing:record.player?.chests?.[key]?.facing,lit:(record.player?.furnaces?.[key]?.burn??0)>0});if(!o)throw new Error(`Unmapped block ${id}`);ids[(lx*16+lz)*256+y]=o[0];metadata[(lx*16+lz)*256+y]=o[1];if(id===149)portals.push([x+ox,y,z+oz]);if(lightOpacity(id)>0)heights[lx+lz*16]=y+1;}
  const chunk=Chunk.fromGeneration(ids,metadata,cx+ox/16,cz+oz/16);chunk.isTerrainPopulated=true;chunk.isLightPopulated=false;chunk.inhabitedTime=typeof record.inhabited==='number'?record.inhabited:0;
  for(let x=0;x<16;x++)for(let z=0;z<16;z++) {chunk.biomes[x+z*16]=w.biomeAt?.(cx*16+x,cz*16+z)?.id??1;chunk.heightMap[x+z*16]=heights[x+z*16];}
  const document=chunkToNbt(chunk,{lastUpdate:BigInt(record.player?.time??0),...endPortalTiles(payload(runtime.get(k)??{},ox,oz,report,w),portals)}),a=regionAddress(chunk.x,chunk.z),rk=`${a.regionX},${a.regionZ}`;
  if(!regions.has(rk))regions.set(rk,[]);regions.get(rk).push(await encodeRegionChunk(document,{x:a.x,z:a.z,timestamp:Math.floor((record.updated??0)/1000)}));
  onProgress(++count,owned.size);if(count%8===0)await new Promise(r=>setTimeout(r,0));
 }
 const files=new Map();for(const [k,entries] of regions){const [x,z]=k.split(',');files.set(`region/r.${x}.${z}.mca`,writeRegion(entries));}
 files.set('level.dat',await encodeCompressedNbt(levelNbt(record,w,report)));
 // Structure starts: v14/v15 rerun the four range-8 searches over the exported native chunks; imported data/*.dat is merged (native precedence).
 {const {files:sd,report:sr}=await structureDataFiles({record,seed:w.javaSeed??record.seed,generationVersion:record.generationVersion??w.generationVersion,chunks:[...owned].map(k=>{const [x,z]=k.split(',').map(Number);return [x+ox/16,z+oz/16];})});
  for(const [n,b] of sd)files.set(n,b);if(sd.size)report.structureData=sr;else report.notes.push('Structure starts are not saved for this generation version; Java regenerates them from the seed.');}
 // data/villages.dat (VillageCollection "villages"): live village records, shifted by the export origin like entity positions.
 if(record.villages?.villages?.length){const sh=(v)=>({...v,c:[v.c[0]+ox,v.c[1],v.c[2]+oz],ac:[v.ac[0]+ox,v.ac[1],v.ac[2]+oz],doors:v.doors.map(d=>[d[0]+ox,d[1],d[2]+oz,d[3],d[4],d[5],...d.slice(6)])});
  files.set('data/villages.dat',await encodeCompressedNbt(villageDocument({...record.villages,villages:record.villages.villages.map(sh)})));}
 const {chunked,runtimeChunked,editSequence,...backup}=record,encode=new TextEncoder();
 files.set('blockworld.json',encode.encode(JSON.stringify({...backup,format:'blockworld',version:1})));
 files.set('conversion-notes.json',encode.encode(JSON.stringify(report,null,2)));
 return {files,report,zip:zipFiles(files)};
}
