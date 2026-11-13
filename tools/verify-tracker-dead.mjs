// Batch 63 (mobcopies3): the tracker's HashSet under entity deaths and spawns during a run of World.updateEntities (tools/probes/TrackerDeadProbe.java) -> public/research/tracker-dead-reference.json; src/mobcopies3-b63.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'tracker-dead-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','HorseCopyProbe','TrackerDeadProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'TrackerDeadProbe'],{maxBuffer:1<<28});

const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',javaVersion:lines[0].javaVersion,
 method:'Executed: the real World.updateEntities (ahb.h) with probe entities that die and spawn children; the IWorldAccess onEntityCreate/onEntityDestroy hook does what EntityTracker.trackEntity/untrackEntity do (a real EntityTrackerEntry in a real HashSet). Order recorded after the adds and after every tick.',
 cases:lines};
await writeFile(path.join(root,'../public/research/tracker-dead-reference.json'),JSON.stringify(reference)+'\n');
console.log('tracker-dead:',lines.map(l=>l.case+'='+l.orders.length).join(' '));
