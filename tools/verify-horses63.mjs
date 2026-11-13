// Records batch 63 horse evidence from the unchanged 1.7.10 classes (tools/probes/Horses63Probe.java) in public/research/horses63-reference.json;
// src/horses2-b63.test.js replays it. spawn: EntityHorse.onSpawnWithEgg over seeds and herds (types 3 and 4 never roll). chestCat: BlockChest.func_149951_m and
// onBlockActivated with real sitting EntityOcelot objects over single, double and mixed chests. Needs a JDK, the pinned client JAR and the usual library JARs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'horses63-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-buffer-','netty-common-','netty-codec-','netty-transport-4','netty-handler-4','netty-resolver-4','gson-','commons-io-','commons-codec-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
const src=n=>path.join(root,'probes',n+'.java');
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','VillagerProbe','ServerPlayerProbe','HorseRearProbe','OcelotProbe','Horses63Probe'].map(src)]);
const {stdout}=await exec('java',['-cp',cp,'Horses63Probe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
assert.equal(pick('spawn').length,4000);assert.equal(pick('herd').length,300);assert.equal(pick('spawnTypes').length,1);assert.equal(pick('chestCat').length,2*4*12);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Unchanged wi (EntityHorse), ajx (BlockChest), wn (EntityOcelot) after Block/Item registration. spawn and herd: wi.a(sy) onSpawnWithEgg with null group data and with the previous horse\'s group (rows [type, variant, age, maxHealth, speed, jump, next Random draw]). chestCat: ajx.m (func_149951_m) and ajx.a onBlockActivated on the OcelotProbe world double (block, tile entity and entity-list queries) with real wn objects set sitting by wn.k(); ajx.o is unchanged. src/horses2-b63.test.js replays it.',
 spawn:pick('spawn'),herd:pick('herd'),spawnTypes:pick('spawnTypes')[0],chestCat:pick('chestCat')};
await writeFile(path.join(root,'../public/research/horses63-reference.json'),JSON.stringify(reference)+'\n');
console.log('horses63 reference: spawn=4000 herd=300 chestCat=96',JSON.stringify(reference.spawnTypes));
