// Records the batch 17 villager polish evidence (EntityVillager particles, the default-reputation flag, EntityAIMoveIndoors
// weather/biome/hasNoSky gates and the golem's nearbyOnly target path check) from the unchanged 1.7.10 classes into
// public/research/villager-polish-reference.json; src/villager-polish.test.js replays it. See probes/VillagerPolishProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'villager-polish-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','VillagerPolishProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'VillagerPolishProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const count=c=>records.filter(r=>r.case===c).length;
assert.equal(count('particles'),72);assert.equal(count('defaultRep'),48);assert.equal(count('moveIndoors'),1);assert.equal(count('golemReach'),128);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yv:'EntityVillager',ur:'EntityAIMoveIndoors',vo:'EntityAINearestAttackableTarget',vu:'EntityAITarget',vp:'EntityAINearestAttackableTarget$1',wt:'EntityIronGolem',vz:'Village',wc:'VillageCollection'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged classes on the VillageLiveProbe flat-world double, see probes/VillagerPolishProbe.java. particles: [status 12/13/14] handleHealthUpdate with the entity Random seeded, every spawnParticle (name|x|y|z|vx|vy|vz) and the next nextInt(1e6). defaultRep: cd() flag, bq forced to 0 each round, reputations of players A-D after each of 3 updateAITick calls, bz, bq, whether the home was detached. moveIndoors: [noSky, day, rain, biome, seed, shouldExecute, next draw] plus BiomeGenBase.canSpawnLightningBolt per biome. golemReach: vo task (nearbyOnly flag) ticked 40 times, [result, vu.b state, vu.e counter], the PathFinder end point of the golem path to the zombie and the next draw.',
 records};
await writeFile(path.join(root,'../public/research/villager-polish-reference.json'),JSON.stringify(reference)+'\n');
console.log('Villager polish records:',records.length,'bytes:',JSON.stringify(reference).length);
