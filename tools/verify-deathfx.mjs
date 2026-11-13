// Records the client copy of a dying mob (sv.C onEntityUpdate's onDeathUpdate, tools/probes/DeathFxProbe.java) in public/research/deathfx-reference.json; src/deathfx-b59.test.js replays it.
// Needs the same JDK and library JARs as tools/verify-horse-copy.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'deathfx-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','HorseCopyProbe','DeathFxProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'DeathFxProbe'],{maxBuffer:1<<28});
const death=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(death.length,4);
for(const d of death){assert.equal(d.ticks.length,26);assert.equal(d.ticks.reduce((n,t)=>n+t[6].length,0),20,d.kind);}
const reference={target:'Minecraft Java 1.7.10',tag:'b59df',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 59. Unchanged sv.C (EntityLivingBase.onEntityUpdate, with EntityLiving and the entity classes above it) on a client world double (ahb.E true) with a logging Random as the copy\'s own Entity.rand and a world that records spawnParticle; zombie (yq), pig (wo), piglet (wo, age -24000), horse (wi). Each tick: [status (3 at tick 2, sv.a(byte)), x, y, z the copy has when C() runs, deathTime sv.aA, draws, particles]. src/deathfx-b59.test.js replays it.',
 death};
await writeFile(process.env.MC_DEATHFX_OUTPUT||path.join(root,'../public/research/deathfx-reference.json'),JSON.stringify(reference)+'\n');
console.log('deathfx reference: '+death.map(d=>d.kind).join(' '));
