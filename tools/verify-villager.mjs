// Records EntityVillager, its AI task list, movement traces, sounds, drops and ModelVillager from the unchanged
// original classes (tools/probes/VillagerProbe.java on the MobMoveProbe world double) in
// public/research/villager-reference.json; src/villager.test.js replays it. Same JDK/JAR needs as verify-chicken.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'villager-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','VillagerProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'VillagerProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l.startsWith('{"case":"model"')?l.replace(/^\{"case":"model","parts":/,'{"case":"model","model":')+'}':l));
const pick=name=>lines.filter(l=>l.case===name);
const facts=pick('facts')[0],tasks=pick('tasks')[0],sounds=pick('sounds')[0],drops=pick('drops')[0],model=pick('model')[0].model,wander=pick('wander'),avoid=pick('avoid'),door=pick('door');
assert.ok(facts&&tasks&&sounds&&drops&&model);assert.equal(wander.length,3);assert.equal(avoid.length,2);assert.equal(door.length,2);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yv:'EntityVillager',rx:'EntityAgeable',td:'EntityCreature',tw:'EntityAIAvoidEntity',uy:'EntityAIOpenDoor',uc:'EntityAIDoorInteract',vc:'EntityAIWander',bik:'ModelVillager',bpa:'RenderVillager'};
const textures=['villager','farmer','librarian','priest','smith','butcher'];
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration, on a flat-world double (stone below y 0) with the real yv constructor and its real AI task lists. World.A is a real empty VillageCollection, so no village exists: the village lookup answers null and detachHome runs, and the indoors/restrict/mate/golem/play tasks never start. Each trace row is the state after Entity.onUpdate (sa.h) with Entity.rand seeded java.util.Random(seed): the living-sound roll, then onLivingUpdate with the AI. facts: constructor size, attribute bases, eye height. tasks: EntityAITasks entries in order with priority, mutex bits and numeric constructor fields. sounds/drops: getLivingSound/getHurtSound/getDeathSound, volume, pitch; dropFewItems totals. model: ModelVillager boxes. wander: AI only. avoid: a zombie double at scripted positions. door: wall at x=66 with a closed wooden door at (66,0,64), navigator target (69.5,0,64.5) at tick 0.',
 textures:Object.fromEntries(textures.slice(1).map((t,i)=>[i,t+'.png'])),defaultTexture:'villager.png',
 facts,tasks,sounds,drops,model,wander,avoid,door};
await writeFile(path.join(root,'../public/research/villager-reference.json'),JSON.stringify(reference)+'\n');
console.log('facts',JSON.stringify(facts));console.log('tasks',tasks.tasks.map(t=>t.priority+':'+t.class).join(' '));
for(const t of [...wander,...avoid,...door])console.log(t.case,t.seed,t.mode??'',[...new Set(t.ticks.map(r=>r.running))].join(' | '),'end',t.ticks.at(-1).x,t.ticks.at(-1).z,t.doorMeta?[...new Set(t.doorMeta)].join(','):'',t.aux??'');
