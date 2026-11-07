// Records the batch 18 EntityAIMoveThroughVillage evidence (door choice, visited list, navigator door flag, path fallback draws) from the
// unchanged 1.7.10 classes into public/research/mob-doors-reference.json; src/mob-doors.test.js replays it. See probes/MoveThroughVillageProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mob-doors-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','MoveThroughVillageProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'MoveThroughVillageProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const count=c=>records.filter(r=>r.case===c).length;
assert.equal(records.length,(2*2+1)*2*2*2*3);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={us:'EntityAIMoveThroughVillage',vy:'VillageDoorInfo',vz:'Village',wc:'VillageCollection',yq:'EntityZombie',vv:'PathNavigate'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged us on a zombie in the VillageLiveProbe flat-world double with a 12-door village. 20 rounds per record: shouldExecute, startExecuting, continueExecuting, resetTask. A round is [shouldExecute, door chosen (vy.a,b,c), canBreakDoors after a(), path end, canBreakDoors after c(), noPath after c(), continueExecuting, canBreakDoors after d(), visited list]. Even rounds teleport the zombie next to the door before b()/d() (third rounds stay put). variant 0/1 open ground, 2 the zombie walled into a stone cell; rebuild replaces the village door objects with equal-coordinate clones in round 3. next: nextInt(1e6) of the entity Random.',
 records};
await writeFile(path.join(root,'../public/research/mob-doors-reference.json'),JSON.stringify(reference)+'\n');
console.log('Mob door records:',records.length,'bytes:',JSON.stringify(reference).length);
