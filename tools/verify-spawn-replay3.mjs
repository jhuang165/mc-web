// Records round-3 seeded SpawnerAnimals.findChunksForSpawning replays (lit areas with day/night/thunder, a Nether over a real
// MapGenNetherBridge) from the unchanged 1.7.10 classes (tools/probes/SpawnReplay3Probe.java) into
// public/research/spawn-replay3-reference.json; src/spawner-replay3.test.js checks the port. Same JDK and JARs as verify-spawn-replay2.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'spawn-replay3-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
const srcs=['MobMoveProbe','SpawnEggProbe','SpawnListProbe','SpawnReplay2Probe','SpawnReplay3Probe','FortressProbe','TerrainProbe','StrongholdProbe','NetherProbe','SpringProbe'];
await exec('javac',['-nowarn','-cp',cp,'-d',probe,'-sourcepath',path.join(root,'probes'),...srcs.map(n=>path.join(root,'probes',n+'.java'))],{maxBuffer:1<<24});
const run=async()=>(await exec('java',['-cp',cp,'SpawnReplay3Probe'],{maxBuffer:1<<29})).stdout;
const first=await run(),second=await run();
if(first!==second){await writeFile(path.join(out,'first.txt'),first);await writeFile(path.join(out,'second.txt'),second);}
assert.ok(first===second,'the replay depends only on the seeded World.rand (see first.txt and second.txt in '+out+')');
const replays=first.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).filter(l=>l.case==='replay').map(({case:_,...rest})=>rest);
assert.equal(replays.length,6);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aho:'SpawnerAnimals',yg:'EntityMob',yq:'EntityZombie',xz:'EntityCreeper',yn:'EntitySpider',ya:'EntityEnderman',yp:'EntityWitch',atd:'MapGenNetherBridge',aqv:'ChunkProviderHell'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the SpawnReplay2Probe WorldServer double (tools/probes/SpawnReplay3Probe.java) with a lit fixture (saved sky light, block light, skylightSubtracted ahb.j, ahb.P() thunder, getFullBlockLightValue, the provider real lightBrightnessTable) and, in the Nether, the real MapGenNetherBridge (atd) generating its starts over the 17x17 eligible chunks (piece and structure boxes recorded) with the ChunkProviderHell.getPossibleCreatures tests atd.b / atd.d replicated from the aqv.a(sx,III) bytecode. Entity.rand is seeded (setSeed(World.rand state)) inside setLocationAndAngles for every mob that rolls on it. Each replay records every spawnEntityInWorld, the return value and the World.rand state per tick; the probe runs twice and must match.',
 replays};
await writeFile(path.join(root,'../public/research/spawn-replay3-reference.json'),JSON.stringify(reference)+'\n');
console.log('spawn replay3 reference:',replays.map(r=>r.name+' '+r.steps.reduce((n,s)=>n+s.spawned.length,0)).join(', '),'spawns');
