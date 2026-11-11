// Records the tracked non-living entities (tools/probes/TrackerItemsProbe.java: the unchanged EntityTrackerEntry with real server EntityItem,
// EntityXPOrb, EntityArrow, EntitySnowball, EntityFallingBlock and EntityTNTPrimed, and the same classes as the client's entities created
// like NetHandlerPlayClient does) plus the bytecode-read EntityTracker.addEntityToTracker table, in public/research/tracker-extras-reference.json.
// src/object-tracker.test.js replays the scenarios against the browser port. Same jar lookup as the other verify-*.mjs tools.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'tracker-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','TrackerProbe','TrackerItemsProbe','TrackerExtrasProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'TrackerExtrasProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={my:'EntityTrackerEntry',mn:'EntityTracker',bjb:'NetHandlerPlayClient',fw:'S0EPacketSpawnObject',fx:'S11PacketSpawnExperienceOrb',sa:'Entity',xk:'EntityItem',sq:'EntityXPOrb',zc:'EntityArrow',zj:'EntitySnowball',xj:'EntityFallingBlock',xw:'EntityTNTPrimed',zd:'EntityEnderEye',zf:'EntityFireworkRocket',xe:'EntityFishHook',zo:'EntityPotion',te:'DataWatcher',hw:'S1CPacketEntityMetadata'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed: the unchanged EntityTrackerEntry (my) tracking a real server entity that runs its own onUpdate on a world double, and the same class as the client entity created from the packets the way NetHandlerPlayClient does (bytecode-read handlers replicated in TrackerItemsProbe.handle) and ticked with its own onUpdate. Bytecode-read: EntityTracker.addEntityToTracker table, EntityTrackerEntry.func_151260_c spawn packets, the S12 sent after a non-mob spawn, the client handlers.',
 bytecodeRead:{
  // EntityTracker.addEntityToTracker (mn.a(sa)): range, update frequency, sendVelocityUpdates, in instanceof order
  table:[['EntityFishHook',64,5,true],['EntityArrow',64,20,false],['EntitySmallFireball',64,10,false],['EntityFireball',64,10,false],['EntitySnowball',64,10,true],['EntityEnderPearl',64,10,true],['EntityEnderEye',64,4,true],['EntityEgg',64,10,true],['EntityPotion',64,10,true],['EntityExpBottle',64,10,true],['EntityFireworkRocket',64,10,true],['EntityItem',64,20,true],['EntityMinecart',80,3,true],['EntityBoat',80,3,true],['EntitySquid',64,3,true],['EntityWither',80,3,false],['EntityBat',80,3,false],['IAnimals',80,3,true],['EntityDragon',160,3,true],['EntityTNTPrimed',160,10,true],['EntityFallingBlock',160,20,true],['EntityHanging',160,2147483647,false],['EntityXPOrb',160,20,true],['EntityEnderCrystal',256,2147483647,false]],
  spawn:'EntityTrackerEntry.func_151260_c: S0E(entity, type, data): x y z = floor(pos * 32) (not the size class rounding), pitch/yaw (int)(angle * 256 / 360), motion (clamped 3.9, (int)(m * 8000)) only when data > 0. item 2/1, arrow 60/shooter id (own id without a shooter), snowball 61/0, egg 62/0, ender pearl 65/0, eye of ender 72/0, potion 73/damage, exp bottle 75/0, firework 76/0, TNT 50/0, falling block 70/(blockId | meta << 16), fireball 63. XP orb: S11(x y z = floor(pos * 32), value). After any spawn packet that is not S0F, sendVelocityUpdates entries send S12 with the motion.',
  client:'bjb.a(fw): the entity from its constructor at pos / 32 (EntityItem and EntityXPOrb and EntityTNTPrimed constructors roll a random motion), serverPos = packet, pitch/yaw = byte * 360 / 256f, motion = setVelocity(packet / 8000) only when data > 0; bjb.a(fx): EntityXPOrb at the packet position, yaw 0. S14/S18 call Entity.setPositionAndRotation2 (no interpolation: setPosition + setRotation, then the box is lifted out of blocks 1/32 deep; EntityArrow only sets position and rotation). The client world ticks the entity with onUpdate after the packets.'},
 ...Object.fromEntries(lines.map(l=>[l.case,l]))};
await writeFile(path.join(root,'../public/research/tracker-extras-reference.json'),JSON.stringify(reference)+'\n');
console.log('tracker-extras:',lines.map(l=>l.case+'='+(l.rows?.length??0)).join(' '));
