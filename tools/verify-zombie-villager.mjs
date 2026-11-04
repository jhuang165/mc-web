// Records the unchanged EntityZombie (yq) against villagers, the zombie villager cure and the VillageCollection NBT
// through probes/ZombieVillagerProbe.java (the VillagerProbe / VillageLiveProbe world); writes
// public/research/zombie-villager-reference.json for src/zombie-villager.test.js. Needs a JDK, the pinned client JAR
// (tools/research or MC_RESEARCH) and the same libraries as verify-village.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'zombie-villager-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','ZombieVillagerProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'ZombieVillagerProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const count=c=>records.filter(r=>r.case===c).length;
const expect={facts:1,breakDoors:1,target:13,kill:1,interact:1,boost:1,convert:1,villages:1,entityNbt:6};
for(const [c,n] of Object.entries(expect))assert.equal(count(c),n,`records of ${c}`);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yq:'EntityZombie',yv:'EntityVillager',vo:'EntityAINearestAttackableTarget',uq:'EntityAIAttackOnCollide',us:'EntityAIMoveThroughVillage',ut:'EntityAIMoveTowardsRestriction',tz:'EntityAIBreakDoor',wc:'VillageCollection',vz:'Village'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged classes on the VillagerProbe / VillageLiveProbe flat-world double, see probes/ZombieVillagerProbe.java. kill rows: [difficulty 0..3, victim (0 adult villager, 1 child villager, 2 zombie), seed, zombies spawned, spawned is villager, spawned is child, victim dead, aux events, next nextInt(1e6)]. interact rows: [variant, seed, returned, stack size after, second interact, conversion ticks, converting, Weakness active, Strength [duration, amplifier], entity events, next int]. boost rows: [config, seed, boost, next int]. convert rows: [seed, child, profession, age, followRange, Nausea [duration, amplifier], default reputation flag, spawned, zombie dead, aux, next int, world Random next int]. entityNbt and villages nbt are uncompressed NBT hex.',
 records};
await writeFile(path.join(root,'../public/research/zombie-villager-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original zombie villager records:',records.length,'bytes:',JSON.stringify(reference).length);
