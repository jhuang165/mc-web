// Records the chunk-save NBT of mob equipment (Equipment, DropChances, CanPickUpLoot, PersistenceRequired), leashes and PortalCooldown,
// written and read back by the unchanged original classes (tools/probes/MobGearNbtProbe.java on the HorseGearProbe world double), in
// public/research/mob-gear-nbt-reference.json; src/mob-gear-nbt.test.js checks java-mobs.js and the region exporter against it. Needs the same JDK, client
// JAR and library JARs as tools/verify-pig-saddle.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mob-gear-nbt-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','HorseGearProbe','LeashProbe','MobGearNbtProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'MobGearNbtProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
const cases={gear:18,leash:2,knotLoad:1};
for(const [c,n] of Object.entries(cases))assert.equal(pick(c).length,n,c);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sg:'EntityList',sa:'Entity',sw:'EntityLiving',yq:'EntityZombie',yl:'EntitySkeleton',yh:'EntityPigZombie',su:'EntityLeashKnot',ss:'EntityHanging'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the HorseGearProbe world double (tools/probes/MobGearNbtProbe.java). gear: a mob is built with its constructor at (100.5, 64, -20.25), equipped through setCurrentItemOrArmor (sw.c), its equipmentDropChances (sw.e), canPickUpLoot (sw.h), persistenceRequired (sw.bt) and Entity.timeUntilPortal (sa.am) are set, it is saved with Entity.writeToNBTOptional (sa.c), named keys of that tag may be edited, and it is loaded with EntityList.createEntityFromNBT (sg.a). nbtWritten is the first tag, nbt the loaded mob saved again (uncompressed hex), the other fields its getters (equipment rows are [original id, count, damage, [[enchantment, level]...]]). leash: the Leash compound of a zombie held by a knot and by a player, and su.d (the knot refusing to save). knotLoad: sg.a of a LeashKnot compound.',
 counts:cases,...Object.fromEntries(Object.keys(cases).map(k=>[k,pick(k)]))};
await writeFile(path.join(root,'../public/research/mob-gear-nbt-reference.json'),JSON.stringify(reference)+'\n');
console.log('mob gear nbt reference:',Object.entries(cases).map(([k,v])=>k+'='+v).join(' '));
