// Records the batch 28 village fight (every mob ticked: villagers, zombies, skeletons, a golem; a moving player's scripted hits) from the unchanged
// 1.7.10 classes into public/research/village-fight-reference.json; src/village-fight.test.js replays it. See probes/VillageFightProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'village-fight-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches'),path.join(research,'libs-1.7.10')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
// Batch 32: Entity (sa) builds its Entity.rand with `new Random()` (clock seeded). Add a constant-pool Class entry SeedRandom (probes/SeedRandom.java extends
// Random and counts seeds up from a value the probe sets) and point the one `new Random; dup; invokespecial <init>` of sa.class at it: no instruction of
// Entity changes except those two operands, every other use of Random in sa keeps the java/util/Random entry.
{const file=path.join(classes,'sa.class'),buf=await readFile(file);
 const count=buf.readUInt16BE(8),utf=new Map(),classes_=new Map(),methods=new Map();let at=10,i=1;
 while(i<count){const tag=buf[at];
  if(tag===1){const len=buf.readUInt16BE(at+1);utf.set(i,buf.toString('latin1',at+3,at+3+len));at+=3+len;}
  else if(tag===3||tag===4){at+=5;}else if(tag===5||tag===6){at+=9;i++;}
  else if(tag===7){classes_.set(i,buf.readUInt16BE(at+1));at+=3;}else if(tag===8||tag===16||tag===19||tag===20){at+=3;}
  else if(tag===10){methods.set(i,at);at+=5;}else if([9,11,12,17,18].includes(tag)){at+=5;}else if(tag===15){at+=4;}else throw new Error('cp tag '+tag);
  i++;}
 const randomClass=[...classes_].find(([,n])=>utf.get(n)==='java/util/Random')[0];
 const code=Buffer.from([0xbb,randomClass>>8,randomClass&255,0x59,0xb7]);let hit=-1,found=0;for(let k=buf.indexOf(code);k>=0;k=buf.indexOf(code,k+1)){found++;hit=k;}
 assert.equal(found,1,'sa.class has one new Random');
 const method=buf.readUInt16BE(hit+5),entry=methods.get(method);
 const name=Buffer.from('SeedRandom'),add=Buffer.concat([Buffer.from([1,0,name.length]),name,Buffer.from([7,count>>8,count&255])]); // utf8 at index count, Class at count + 1
 const out2=Buffer.concat([buf.subarray(0,at),add,buf.subarray(at)]);
 out2.writeUInt16BE(count+2,8);out2.writeUInt16BE(count+1,entry+1);out2.writeUInt16BE(count+1,hit+add.length+1); // the cp entries precede `at`, so the Methodref offset is unchanged
 await writeFile(file,out2);}
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','ArmorEnchantmentProbe','SeedRandom','VillageFightProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'VillageFightProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
if(process.env.VF_DUMP){await writeFile(process.env.VF_DUMP,JSON.stringify(records)+'\n');process.exit(0);} // development aid (with VF_ONLY): every record of this run, nothing else written
const b31=records.filter(r=>r.name.startsWith('b31-')),b32=records.filter(r=>r.name.startsWith('b32-')),b33=records.filter(r=>r.name.startsWith('b33-')),b34=records.filter(r=>r.name.startsWith('b34-')),b35=records.filter(r=>r.name.startsWith('b35-')),base=records.filter(r=>!/^b3[12345]-/.test(r.name));
assert.equal(base.length,7);assert.equal(b31.length,19);assert.equal(b32.length,Number(process.env.VF_EXPECT_B32??b32.length));assert.ok(b32.length>=20,'b32 records');assert.equal(b33.length,Number(process.env.VF_EXPECT_B33??b33.length));assert.equal(b34.length,Number(process.env.VF_EXPECT_B34??b34.length));assert.equal(b35.length,Number(process.env.VF_EXPECT_B35??b35.length));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={vz:'Village',wa:'VillageAggressor',vm:'EntityAIDefendVillage',yv:'EntityVillager',wt:'EntityIronGolem',yq:'EntityZombie',yl:'EntitySkeleton',tw:'EntityAIAvoidEntity',sv:'EntityLivingBase'};
const classes_=Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}])));
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:classes_,
 method:'Unchanged classes in the VillageLiveProbe double with every mob ticked by Entity.onUpdate after the VillageCollection: entities 0,1 villagers, 2,3 zombies, 4 iron golem, 5,6 skeletons (ticked, never targeting), 7 a real EntityPlayer that is moved and whose hits are scripted. A row per tick is [[x,y,z,health,attackTarget,revengeTarget,randomDraws] per mob, [x,y,z,health] for the player],[[aggressorIndex,tick]...],reputation of the player name. Hits are [tick,accepted,victimHealthAfter]. Night; difficulty 2 (record field `difficulty`; the peaceful record runs on 0). Batch 30: World.rayTraceBlocks is the real one (sight rays), and the villagers-flee-two-zombies and peaceful records were added.',
 records:base};
const reference31={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:{...classes_,zc:{name:'EntityArrow',sha256:await digest('zc')},uq:{name:'EntityAIAttackOnCollide',sha256:await digest('uq')},vd:{name:'EntityAIArrowAttack',sha256:await digest('vd')},tz:{name:'EntityAIBreakDoor',sha256:await digest('tz')}},
 method:'Batch 31. Same double and row layout as village-fight-reference.json with the mob list set by the record field `types` (V villager, Z zombie, z zombie with CanBreakDoors, G iron golem, K skeleton with an empty hand, B skeleton holding a bow; the player has the index types.length). Mobs tick in list order and then the arrows in spawn order, an arrow spawned during the pass ticks in the same pass, and a setDead entity leaves the list after its own update. Rows carry a 4th element: the arrows whose state changed this tick, [shotIndex, x, y, z, mx, my, mz, dead]. `shots` is each arrow spawned: [tick, shooterIndex, x, y, z, mx, my, mz, yaw, pitch, damage, punch, fire] (the heading Random of an arrow cannot be seeded natively, so the replay starts each arrow from this state). `conversions` is each zombie that EntityZombie.onKillEntity spawned for a killed villager: [tick, x, y, z]; it is never ticked. Script ops added: equip idx item (setCurrentItemOrArmor(0), item 0 = empty hand) and equipmid k idx item (the same, right after entity k updates). Difficulty is the record field `difficulty`; the double fixes World.getBlockLightValue at 15 (the reinforcement site search of a Hard zombie site search finds no dark spot, its Random draws still happen).',
 records:b31};
// Batch 33: the older reference files are rewritten only with VF_REWRITE_OLD=1 (their new zombies' constructor yaw is Math.random, so a rerun changes bytes without changing anything else)
const rewriteOld=!!process.env.VF_REWRITE_OLD;
if(rewriteOld){await writeFile(path.join(root,'../public/research/village-fight-reference.json'),JSON.stringify(reference)+'\n');
await writeFile(path.join(root,'../public/research/village-fight-b31-reference.json'),JSON.stringify(reference31)+'\n');}
const reference32={target:'Minecraft Java 1.7.10',clientSha1:reference31.clientSha1,classes:{...reference31.classes,ajj:{name:'BlockDoor',sha256:await digest('ajj')},aji:{name:'Block',sha256:await digest('aji')},ahb:{name:'World',sha256:await digest('ahb')}},
 method:'Batch 32. Same double, row layout and script ops as village-fight-b31-reference.json, plus: Entity.rand of every entity built after the mobs (arrows, converted villagers, reinforcements) is a SeedRandom seeded from the record (`shots[i][13]`, `zombies[j][5]`), so arrow start headings, damage and the extra zombies draws are derived, not copied; the Entity.rand of the initial zombies is also seeded (SeedRandom replaces the single `new Random` in sa.class at load: bytecode patch of the constant pool, no behaviour change). `bases` is each zombie spawnReinforcements attribute (nextDouble*0.1 drawn in its constructor, or the record `reinforce` value). Rows carry a 5th element: the extra zombies [x,y,z,health,attackTarget,revengeTarget,draws] in spawn order (index types.length+1+k). `zombies` is [tick, 1 for a conversion or 0 for a reinforcement, x, y, z, seed, isVillager]. Record fields `blocks` (fill specs [x0,y0,z0,x1,y1,z1,id,meta] applied before the run on the flat y=-1 floor), `water` (the real World water methods answer for liquid cells), `light` (World.getBlockLightValue) and `reinforce` describe the arena variant.',
 records:b32};
if(rewriteOld)await writeFile(path.join(root,'../public/research/village-fight-b32-reference.json'),JSON.stringify(reference32)+'\n');
const reference33={target:'Minecraft Java 1.7.10',clientSha1:reference31.clientSha1,classes:{...reference32.classes,ans:{name:'BlockStairs',sha256:await digest('ans')},als:{name:'BlockLadder',sha256:await digest('als')},aoe:{name:'BlockTrapDoor',sha256:await digest('aoe')},ala:{name:'BlockFenceGate',sha256:await digest('ala')},ant:{name:'BlockStaticLiquid',sha256:await digest('ant')},alp:{name:'BlockIce',sha256:await digest('alp')},amo:{name:'BlockPackedIce',sha256:await digest('amo')},ano:{name:'BlockSoulSand',sha256:await digest('ano')},aok:{name:'BlockWeb',sha256:await digest('aok')}},
 method:'Batch 33. Same double, row layout, script ops and record fields as village-fight-b32-reference.json, plus: the third element of a `pos` row is the mob start height (a raised platform), and `move idx x z [y]` may set a height. Arenas: ascending, upside-down and descending stairs, ladders (up and down), trapdoors (closed, open, top half), a fence line with a closed or open gate, a lava pool (real liquid physics), mobs thrown into lava, ice, packed ice, soul sand and cobweb.',
 records:b33};
if(rewriteOld)await writeFile(path.join(root,'../public/research/village-fight-b33-reference.json'),JSON.stringify(reference33)+'\n');
// Batch 34: records whose blocks are read through the real ChunkCache (ahr) over real Chunks (apx, apz): the finding of the records is that the cache does NOT bound the search (ayg.a static reads entity.worldObj; the cache serves only the swimming start loop), so far walls still seal a target.
const reference34={target:'Minecraft Java 1.7.10',clientSha1:reference31.clientSha1,classes:{...reference33.classes,ahr:{name:'ChunkCache',sha256:await digest('ahr')},apx:{name:'Chunk',sha256:await digest('apx')},apz:{name:'ExtendedBlockStorage',sha256:await digest('apz')},ayg:{name:'PathFinder',sha256:await digest('ayg')},vv:{name:'PathNavigate',sha256:await digest('vv')},aoi:{name:'BlockWall',sha256:await digest('aoi')},akz:{name:'BlockFence',sha256:await digest('akz')},mt:{name:'WorldServer',sha256:await digest('mt')},ms:{name:'ChunkProviderServer',sha256:await digest('ms')}},
 method:'Batch 34. Same double, row layout, script ops and record fields as village-fight-b33-reference.json, plus: World.getEntityPathToXYZ / getPathEntityToEntity build the real ChunkCache the native way (radius (int)(followRange + 8) around the mob for a block, + 16 for an entity), over real Chunk objects filled from the arena cells; y < 0 (the probe floor) and chunks without a block read as air (record field `chunkCache`). `unloaded` is a list of [chunkX, chunkZ] the ChunkProviderServer model has not loaded: World.checkChunksExist is false over them and World.spawnEntityInWorld refuses a non-player entity in them (the zombie is not added to the world, so its `zombies` entry and row do not exist). A zombie built by a scripted hit gets its equipment packet skipped like a swap.',
 records:b34};
if(rewriteOld)await writeFile(path.join(root,'../public/research/village-fight-b34-reference.json'),JSON.stringify(reference34)+'\n');
// Batch 35: records carry `searches` ([tick, points the native PathFinder created, 1 if it returned a path] for every search); `follow` sets the zombies' generic.followRange.
const reference35={target:'Minecraft Java 1.7.10',clientSha1:reference31.clientSha1,classes:reference34.classes,
 method:'Batch 35. Same double, row layout, script ops and record fields as village-fight-b34-reference.json, plus: `searches` lists every native path search in order as [tick, number of PathPoints the PathFinder created (the size of its IntHashMap), 1 when it returned a path]; stacked stone storeys joined by one-block step ramps (a zombie only targets within 4 blocks vertically, so villagers and zombies stand on neighbouring storeys), a seven-storey tower, and zombies whose generic.followRange is set to 80, 100 and 130 (record field `follow`; EntityZombie.onSpawnWithEgg gives Hard zombies (40 + bonus) * (1 + d0)) hunting a sealed villager on flat ground.',
 records:b35};
await writeFile(path.join(root,'../public/research/village-fight-b35-reference.json'),JSON.stringify(reference35)+'\n');
console.log('Fight records:',base.length,'+',b31.length,'bytes:',JSON.stringify(reference).length,JSON.stringify(reference31).length);
