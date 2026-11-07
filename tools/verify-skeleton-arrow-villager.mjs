// Records a live skeleton arrow hitting a villager (EntitySkeleton.attackEntityWithRangedAttack, EntityArrow.onUpdate, EntityLivingBase.attackEntityFrom,
// Village.addOrRenewAgressor, EntityAIDefendVillage) from the unchanged 1.7.10 classes into public/research/skeleton-arrow-villager-reference.json; src/skeleton-arrow-villager.test.js replays it. See probes/SkeletonArrowVillagerProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'villagers4-skeleton-arrow-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches'),path.join(research,'libs-1.7.10')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-1.5','netty-all-','gson-','commons-io-','commons-codec-','jopt-simple-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs,jar].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-sourcepath',path.join(root,'probes'),'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','SkeletonArrowVillagerProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'SkeletonArrowVillagerProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(records.length,52);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={vz:'Village',wa:'VillageAggressor',vm:'EntityAIDefendVillage',yv:'EntityVillager',wt:'EntityIronGolem',sv:'EntityLivingBase',zc:'EntityArrow',yl:'EntitySkeleton'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged yl.attackEntityWithRangedAttack (the shot), zc.onUpdate every tick and yv/sv.attackEntityFrom in the VillageLiveProbe double (getEntitiesWithinAABBExcludingEntity answers the live entity list); the real Village ticked by the real VillageCollection; a real EntityIronGolem whose EntityAIDefendVillage.shouldExecute is evaluated every tick after the hit. Entity 0 is the villager, 3 the skeleton. The arrow heading uses an unseedable Random, so shot.arrow is the initial state [x,y,z,mx,my,mz,yaw,pitch].',
 records};
await writeFile(path.join(root,'../public/research/skeleton-arrow-villager-reference.json'),JSON.stringify(reference)+'\n');
console.log('Skeleton arrow records:',records.length,'bytes:',JSON.stringify(reference).length);
