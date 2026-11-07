// Records 1.7.10 natural spawning (EnumCreatureType, every biome's four spawn lists, getMaxSpawnedInChunk, the fortress and witch hut
// lists, the eligible-chunk HashMap order, canCreatureTypeSpawnAtLocation columns and seeded SpawnerAnimals.findChunksForSpawning
// replays) from the unchanged original classes (tools/probes/SpawnListProbe.java on a WorldServer double) in
// public/research/spawn-lists-reference.json; src/spawner-animals.test.js checks the browser port against it. Needs the same JDK,
// client JAR and library JARs as verify-spawn-eggs.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'spawn-lists-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','SpawnEggProbe','SpawnListProbe'].map(n=>path.join(root,'probes',n+'.java'))]);
const run=async()=>(await exec('java',['-cp',cp,'SpawnListProbe'],{maxBuffer:1<<28})).stdout;
const first=await run(),second=await run();
if(first!==second){await writeFile(path.join(out,'first.txt'),first);await writeFile(path.join(out,'second.txt'),second);}
assert.ok(first===second,'the replay depends only on the seeded World.rand (see first.txt and second.txt in '+out+')');
const lines=first.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name).map(({case:_,...rest})=>rest);
const biomes=pick('biome'),replays=pick('replay');
assert.ok(biomes.length>=60);assert.equal(replays.length,4);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aho:'SpawnerAnimals',sx:'EnumCreatureType',ahu:'BiomeGenBase',ahx:'BiomeGenBase.SpawnListEntry',qv:'WeightedRandom',sw:'EntityLiving',td:'EntityCreature',yg:'EntityMob',wf:'EntityAnimal',wn:'EntityOcelot',ws:'EntitySquid',we:'EntityBat',ym:'EntitySlime',atd:'MapGenNetherBridge',atx:'MapGenScatteredFeature',agu:'ChunkCoordIntPair'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration. types: EnumCreatureType.values(). biomes: BiomeGenBase.getBiomeGenArray() with getSpawnableList per type as [EntityList name, weight, min, max] and getSpawningChance. entities: getMaxSpawnedInChunk from a constructed entity and the types whose creature class isAssignableFrom it. structures: MapGenNetherBridge and MapGenScatteredFeature spawn lists. order: HashMap<ChunkCoordIntPair,Boolean> key iteration filled like findChunksForSpawning for one player chunk (Java 19 HashMap, the same as Java 8). location: canCreatureTypeSpawnAtLocation down replay-terrain columns, y 46..70. replay: findChunksForSpawning(world, true, true, tick % animalsEvery == 0) per tick on a WorldServer double (stone with a grass top at y 63..66 by 8-block cell, water ponds y 50..61, fixed biome per chunk from [4,27,21,5,2,14,3,12] (no horse biome: foals roll on the unseeded entity Random), no light, full block light for EntityAnimal, 31 October, NORMAL, local difficulty 0, spawnRandomCreature from the biome list), recording every spawnEntityInWorld (EntityList name, x, y, z, yaw, extras), the return value and World.rand seed after the tick. The wet-caves replay has biome slots [134,21,134,23,134,21,134,23] (no plain swamp: slime size rolls on the unseeded entity Random) and caves (air y 30..35) under every other chunk, so bats and cave spawns occur. The probe runs twice and must match.',
 types:pick('types')[0].types,biomes,entities:pick('entities').length?pick('entities'):pick('entity'),structures:pick('structures')[0],order:pick('order'),location:pick('location'),replays};
await writeFile(path.join(root,'../public/research/spawn-lists-reference.json'),JSON.stringify(reference)+'\n');
console.log('spawn lists reference:',biomes.length,'biomes,',reference.entities.length,'entities,',replays.map(r=>r.name+' '+r.steps.reduce((n,s)=>n+s.spawned.length,0)).join(', '),'spawns');
