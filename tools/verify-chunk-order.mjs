// Records World.getEntitiesWithinAABBExcludingEntity over real chunks and EntityPlayer's arrow trigger (tools/probes/ChunkOrderProbe.java) in
// public/research/chunk-order-reference.json; src/projectiles6-b72.test.js replays it through candidate-order.js, Fireballs.pick and Arrows.collect.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'chunk-order-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-1.5'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
try{await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','EquipmentProbe','PlayerKnockbackProbe','ArrowPickupProbe','ChunkOrderProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});}
catch(e){console.error(e.stderr);throw e;}
const {stdout,stderr}=await exec('java',['-cp',cp,'ChunkOrderProbe'],{maxBuffer:1<<28});
if(process.env.PROBE_STDERR)console.error(stderr);const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(records.filter(r=>r.case==='order').length,700);assert.equal(records.filter(r=>r.case==='trigger').length,700);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ahb:'World',apx:'Chunk',ze:'EntityFireball',zc:'EntityArrow',yz:'EntityPlayer',azt:'AxisAlignedBB'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Real chunks (apx) with their 16 entity lists, filled by the real addEntity/removeEntityAtIndex, queried by the unchanged World.getEntitiesWithinAABBExcludingEntity; the re-slice after an update is updateEntityWithOptionalForce bytecode-read and composed. order: 700 scenes of 2-6 large fireballs at one distance over chunk and slice borders (and above y 256) with moves and updates, recording the candidate order and the ball getMouseOver loop picks. trigger: 700 scenes of stuck arrows around a real EntityPlayer with the EntityPlayer.onLivingUpdate trigger box (bytecode-read: riding union grown 1,0,1 else grown 1,0.5,1) calling the real EntityArrow.onCollideWithPlayer over three inventories.',records};
await writeFile(path.join(root,'../public/research/chunk-order-reference.json'),JSON.stringify(reference)+'\n');
console.log('Chunk order records:',records.length);
