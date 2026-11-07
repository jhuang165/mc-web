// Records the batch 19 zombie door walk (EntityAIMoveThroughVillage + EntityAIBreakDoor + PathNavigate over many ticks) from the unchanged
// 1.7.10 classes into public/research/zombie-door-walk-reference.json; src/zombie-door-walk.test.js replays it. See probes/ZombieDoorWalkProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'zombie-door-walk-probe');
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
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','ZombieDoorWalkProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'ZombieDoorWalkProbe'],{maxBuffer:1<<29});
const all=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)),records=all.filter(r=>r.case==='doorWalk'),pigman=all.filter(r=>r.case==='pigmanDoors');
assert.equal(records.length,18);assert.equal(pigman.length,2);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={us:'EntityAIMoveThroughVillage',tz:'EntityAIBreakDoor',uc:'EntityAIDoorInteract',vv:'PathNavigate',yq:'EntityZombie',yh:'EntityPigZombie',sv:'EntityLivingBase'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged yq with CanBreakDoors in the VillageLiveProbe double: stone wall at x 60 (y 0..2, z -60..160) with a wooden door at (60,0..1,50) (variant 1 meta 1), roof east of it, one village registered. Night; the attack target of the zombie is an untouched villager at (88.5,0,50.5) (setAttackTarget), so AttackOnCollide paths through the door. 380 ticks of Entity.onUpdate per record; difficulty 2 and 3, 3 start cells, seeds 0..2 for the entity Random. A tick is [x,y,z,collidedHorizontally,doorLowerId,doorLowerMeta,doorUpperId,tzExecuting,usExecuting,tzCounter,entityRandomDraws (list: f for nextFloat, i<bound> for nextInt),pathLength,aux events,executing task priorities in list order].',
 records,pigman};
await writeFile(path.join(root,'../public/research/zombie-door-walk-reference.json'),JSON.stringify(reference)+'\n');
console.log('Door walk records:',records.length,'bytes:',JSON.stringify(reference).length);
