// Records seeded SpawnerAnimals.findChunksForSpawning replays for slimes (swamp and slime chunk rules), ocelots (jungle), horses (plains,
// savanna), the Nether (fortress list) and the End from the unchanged 1.7.10 classes (tools/probes/SpawnReplay2Probe.java) into
// public/research/spawn-replay2-reference.json; src/spawner-replay2.test.js checks the port. Entity.rand is seeded inside
// setLocationAndAngles by thin subclasses where an outcome depends on it (see the probe). Same JDK and JARs as verify-spawn-lists.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'spawn-replay2-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','SpawnEggProbe','SpawnListProbe','SpawnReplay2Probe'].map(n=>path.join(root,'probes',n+'.java'))]);
const run=async()=>(await exec('java',['-cp',cp,'SpawnReplay2Probe'],{maxBuffer:1<<28})).stdout;
const first=await run(),second=await run();
if(first!==second){await writeFile(path.join(out,'first.txt'),first);await writeFile(path.join(out,'second.txt'),second);}
assert.ok(first===second,'the replay depends only on the seeded World.rand (see first.txt and second.txt in '+out+')');
const lines=first.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name).map(({case:_,...rest})=>rest);
const replays=lines.filter(l=>l.case==='replay').map(({case:_,...rest})=>rest);
assert.equal(replays.length,8);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aho:'SpawnerAnimals',ym:'EntitySlime',yf:'EntityMagmaCube',wi:'EntityHorse',wn:'EntityOcelot',yl:'EntitySkeleton',yd:'EntityGhast',yh:'EntityPigZombie',xx:'EntityBlaze',ya:'EntityEnderman',atd:'MapGenNetherBridge'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on a WorldServer double (tools/probes/SpawnReplay2Probe.java): the SpawnListProbe grass cells, ponds and caves, a Nether terrain (netherrack floor y 32..35, nether brick floor and a fortress box test in every third chunk, netherrack ceiling y 120..127, WorldProviderHell) and an End terrain (end stone y 60..63), world seed 99, a real WorldInfo day time so ahb.y() gives the native moon phase factor, NORMAL, 31 October, block light 0 (the slime-swamp-lit replay varies it per 4x4 column at y >= 40 with a slime-only monster list). Entity.rand is seeded with setSeed(World.rand state) inside setLocationAndAngles for EntitySlime, EntityMagmaCube, EntitySkeleton, EntityGhast and EntityHorse (the slimes also repeat their constructor draws nextInt(3) and nextInt(20)+10 first). A skeleton riding a spider keeps the unseeded Random and its gear is not recorded. Each replay records every spawnEntityInWorld (EntityList name, position, yaw, extras), the return value and the World.rand state per tick; the probe runs twice and must match.',
 replays};
await writeFile(path.join(root,'../public/research/spawn-replay2-reference.json'),JSON.stringify(reference)+'\n');
console.log('spawn replay2 reference:',replays.map(r=>r.name+' '+r.steps.reduce((n,s)=>n+s.spawned.length,0)).join(', '),'spawns');
