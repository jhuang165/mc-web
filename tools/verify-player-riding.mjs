// Records the player's own mount in level.dat (tools/probes/PlayerRidingProbe.java) in public/research/player-riding-reference.json on the unchanged
// original classes; src/player-riding.test.js replays it. Needs the same JDK, client JAR and library JARs as tools/verify-level-dat.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'player-riding-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','netty-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','LevelDatProbe','PlayerRidingProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const lines=(await exec('java',['-cp',cp,'PlayerRidingProbe'],{maxBuffer:1<<28})).stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const records=lines.filter(l=>l.case==='playerRiding'),bad=lines.filter(l=>l.case==='playerRidingBad');
assert.equal(records.length,6,'riding records');assert.equal(bad.length,2,'bad records');
for(const r of records)assert.ok(!r.mountChunkSaved&&r.mounted,JSON.stringify(r));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sg:'EntityList',sa:'Entity',yz:'EntityPlayer',xi:'EntityBoat',xl:'EntityMinecart',wo:'EntityPig',wi:'EntityHorse'};
const classInfo=Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}])));
await writeFile(path.join(root,'../public/research/player-riding-reference.json'),JSON.stringify({target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:classInfo,
 method:'Unchanged original classes (tools/probes/PlayerRidingProbe.java). A real EntityPlayer rides each mount through Entity.mountEntity (sa.a), is written with Entity.writeToNBT (sa.e), the mount alone with writeToNBTOptional (sa.d); the load replays ServerConfigurationManager.initializeConnectionToPlayer (EntityList.createEntityFromNBT on the Riding compound, then player.mountEntity), which is bytecode-read.',records,bad})+'\n');
console.log('player riding reference:',records.length,'records',bad.length,'bad');
