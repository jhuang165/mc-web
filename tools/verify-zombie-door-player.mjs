// Records a zombie breaking through a door to melee a real EntityPlayer (batch 22 villagers4: EntityAIMoveThroughVillage + EntityAIBreakDoor + EntityAIAttackOnCollide) from the unchanged
// 1.7.10 classes into public/research/zombie-door-player-reference.json; src/zombie-door-player.test.js replays it. See probes/ZombieDoorPlayerProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'villagers3-door-attack-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches'),path.join(research,'libs-1.7.10')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-1.5','netty-all-','gson-','commons-io-','commons-codec-','jopt-simple-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','ZombieDoorPlayerProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'ZombieDoorPlayerProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(records.length,11);assert.equal(records.filter(r=>r.hitTick>0).length,10);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={uq:'EntityAIAttackOnCollide',us:'EntityAIMoveThroughVillage',tz:'EntityAIBreakDoor',vv:'PathNavigate',yq:'EntityZombie',yv:'EntityVillager',vz:'Village'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged zombie (CanBreakDoors, EntityLiving.setAttackTarget) attacking a real EntityPlayer (an EntityPlayer subclass with 1000 health, not ticked, yOffset 0 as EntityPlayerMP sets it) 6 blocks behind the ZombieDoorWalkProbe door wall inside a stone room (x 61..70, z 45..55); the village is registered through a villager-less door position. Night. Cases (difficulty,variant,seed): Normal closed door seed 0 (300 ticks, never breaks), Easy open door seed 0, Normal open door seeds 0..2, Hard closed door seeds 0..2, Hard open door seeds 0..2 (450 ticks). A tick is [zx,zy,zz,collidedH,playerHealthLost,[playerMotionX,Y,Z],doorLowerId,doorLowerMeta,doorUpperId,tzExecuting,usExecuting,attackOnCollideExecuting,tzCounter,zombieDraws,aux events]; the record ends two ticks after the player first loses health.',
 records};
await writeFile(path.join(root,'../public/research/zombie-door-player-reference.json'),JSON.stringify(reference)+'\n');
console.log('Zombie door player records:',records.length,'bytes:',JSON.stringify(reference).length);
