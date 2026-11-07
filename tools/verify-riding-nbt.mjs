// Records the chunk-save NBT of mobs riding boats and minecarts (tools/probes/RidingNbtProbe.java) in public/research/riding-nbt-reference.json
// on the unchanged original classes; src/riding-nbt.test.js replays it. Needs the same JDK, client JAR and library JARs as tools/verify-projectile-nbt.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'riding-nbt-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','ChickenProbe','CreeperProbe','MobNbtProbe','RidingNbtProbe','VillagerProbe','VillagerOffersProbe','VillagerNbtProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const records=(await exec('java',['-cp',cp,'RidingNbtProbe'],{maxBuffer:1<<28})).stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).filter(r=>r.case==='riding');
assert.equal(records.length,4,'riding records');
const villagers=(await exec('java',['-cp',cp,'VillagerNbtProbe'],{maxBuffer:1<<28})).stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).filter(r=>r.case==='villager');
assert.equal(villagers.length,3,'villager records');
for(const r of records){assert.ok(r.riderSaved&&!r.mountAloneSaved&&r.mountMountSaved&&r.linked,JSON.stringify(r));}
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sg:'EntityList',sa:'Entity',xi:'EntityBoat',xl:'EntityMinecart',xm:'EntityMinecartChest',yq:'EntityZombie',yl:'EntitySkeleton',yn:'EntitySpider',yv:'EntityVillager',agn:'MerchantRecipe',ago:'MerchantRecipeList'};
const classInfo=Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}])));
await writeFile(path.join(root,'../public/research/riding-nbt-reference.json'),JSON.stringify({target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:classInfo,
 method:'Unchanged original classes on the HorseProbe/MobMoveProbe world double (tools/probes/RidingNbtProbe.java). Villagers (VillagerNbtProbe): an EntityVillager with real MerchantRecipe offers, written by sa.d and loaded by sg.a. Each chain is mounted with Entity.mountEntity (sa.a), the top rider is written with Entity.writeToNBTOptional (sa.d), the bottom mount alone with sa.d (false while ridden) and with writeMountToNBT (sa.c), then loaded the way AnvilChunkLoader.loadEntities does (sg.a for the rider and each Riding compound, rider.mountEntity(mount)).',records,villagers})+'\n');
console.log('riding nbt reference:',records.length,'riding and',villagers.length,'villager records');
