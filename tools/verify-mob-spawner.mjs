// Records unchanged MobSpawnerBaseLogic (via TileEntityMobSpawner) and EntityCaveSpider; see MobSpawnerProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mob-spawner-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
// authlib supplies GameProfile for the EntityPlayer constructor signature used by the probe player.
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/MobSpawnerProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'MobSpawnerProbe'],{maxBuffer:1<<27});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(records.length,33);
// Render facts are read from the unchanged RenderCaveSpider and TileEntityMobSpawnerRenderer bytecode (LWJGL is not loaded).
const javap=async c=>(await exec('javap',['-c','-p','-constants','-cp',classes,c],{maxBuffer:1<<24})).stdout;
const bnf=await javap('bnf'),bmp=await javap('bmp');
assert.match(bnf,/textures\/entity\/spider\/cave_spider\.png/);
assert.equal((bnf.match(/ldc\s+#\d+\s+\/\/ float 0\.7f/g)||[]).length,4,'shadow *= 0.7 and glScalef(0.7, 0.7, 0.7)');
for(const k of ['float 0.4375f','float 0.4f','float -0.4f','float -30.0f','float 10.0f','float 0.5f'])assert.ok(bmp.includes(k),k);
const render={caveSpider:{texture:'textures/entity/spider/cave_spider.png',modelScale:0.7,shadowScale:0.7},
 spawnerMob:{steps:['translate(x+0.5,y,z+0.5)','translate(0,0.4,0)','rotateY((prev+(rot-prev)*partial)*10 deg)','rotateX(-30 deg)','translate(0,-0.4,0)','scale(0.4375)','renderEntity(yaw 0, pitch 0, limbSwing 0, partial)']}};
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={agq:'MobSpawnerBaseLogic',apj:'TileEntityMobSpawner',apk:'TileEntityMobSpawner$1',xy:'EntityCaveSpider',yn:'EntitySpider',yg:'EntityMob',td:'EntityCreature',sw:'EntityLiving',bnf:'RenderCaveSpider',bmp:'TileEntityMobSpawnerRenderer'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged TileEntityMobSpawner.updateEntity -> MobSpawnerBaseLogic.updateSpawner on a World double (Unsafe-allocated, WorldProviderSurface brightness table). World.rand is an identical LCG exposing its scrambled state; state is listed only on ticks that consume it. Spawner at (8,20,8); terrain: floor = stone at y<=19, encased = stone everywhere, water = water at y>=19 above a stone floor. sky = saved EnumSkyBlock.Sky value, light = getBlockLightValue for every cell. Player is a concrete EntityPlayer at feet position. Non-real cave spider scenarios register a subclass of EntityCaveSpider that seeds Entity.rand with worldSeed*1000+index and logs getCanSpawnHere; real scenarios use the original classes with outcome-deterministic light. boxes = getEntitiesWithinAABB queries [minX,minY,minZ,maxX,maxY,maxZ,count]; aux counts playAuxSFX(2004) at the spawner; blockEvents counts addBlockEvent. Client scenarios set World.isRemote and record rotation and smoke/flame particles; blockEventTick delivers receiveClientEvent(1).',
 render,records};
await writeFile(path.join(root,'../public/research/mob-spawner-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original mob spawner records:',records.length,'bytes:',JSON.stringify(reference).length);
