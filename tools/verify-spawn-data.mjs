// Records MobSpawnerBaseLogic.a(sa) (agq: SpawnData / SpawnPotentials Properties over the written entity, then the Riding loop with EntityList.createEntityByName,
// setLocationAndAngles at the rider and Entity.mountEntity) from the pinned 1.7.10 client (tools/probes/SpawnDataProbe.java on SpawnerCartProbe's world double)
// into public/research/spawn-data-reference.json. src/spawn-data.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'spawn-data-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','PlantProbe','PlayerStepProbe','NbtProbe','MinecartProbe','MobSpawnerProbe','SpawnerCartProbe','SpawnDataProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'SpawnDataProbe'],{maxBuffer:1<<27});
const scenarios=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(scenarios.length,18);
assert.ok(scenarios.find(s=>s.name==='spider-jockey').ticks.some(t=>t.entities.length>=2),'a rider and its mount spawn together');
const javap=async c=>(await exec('javap',['-c','-p','-constants','-cp',classes,c],{maxBuffer:1<<24})).stdout;
const agq=await javap('agq');
for(const k of ['String Riding','Method sg.a:(Ljava/lang/String;Lahb;)Lsa;','Method sa.b:(DDDFF)V','Method sa.a:(Lsa;)V','Method sa.d:(Ldh;)Z','Method sa.f:(Ldh;)V'])assert.ok(agq.includes(k),k);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={agq:'MobSpawnerBaseLogic',agr:'WeightedRandomMinecart',xt:'EntityMinecartMobSpawner',sg:'EntityList',sa:'Entity'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityMinecartMobSpawner (xt) over MobSpawnerBaseLogic (agq) on SpawnerCartProbe.SW (stone floor below y=19, a player in range, LCG World.rand with a readable state). Every spawned entity is logged in spawnEntityInWorld order with EntityList id, position, rotation and ridden/riding index; exceptions are logged. The Riding loop itself is read from agq.a(sa) bytecode.',
 loop:'rider = createEntity; nbt = rider.writeToNBTOptional + every Properties key; rider.readFromNBT; spawnEntityInWorld(rider); while nbt has Riding compound: mount = createEntityByName(riding.id); if mount: mount.writeToNBTOptional + riding keys, readFromNBT, setLocationAndAngles(rider pos, yaw, pitch), spawnEntityInWorld(mount), rider.mountEntity(mount); rider = mount; nbt = riding',
 scenarios};
await writeFile(path.join(root,'../public/research/spawn-data-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${scenarios.length} scenarios, ${scenarios.reduce((n,c)=>n+c.ticks.length,0)} ticks`);
