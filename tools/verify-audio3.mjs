// Records SoundManager.setListener, SoundManager.update / isSoundPlaying (the 20-tick playingSoundsStopTime, tickable and repeating
// sounds) and the minecart moving sounds from the unchanged original classes (tools/probes/AudioProbe3.java, which reuses
// SoundProbe.java's fake paulscode library) in public/research/audio3-reference.json; src/audio3.test.js replays it.
// Needs a JDK, the 1.7.10 client JAR (MC_RESEARCH or tools/research) and the guava, log4j-api, commons-lang3, authlib, gson and LWJGL 2 JARs
// (found under the launcher's libraries or listed in MC_PROBE_LIBS). Classes are compiled under the system temp directory,
// so the research directory is only read.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=process.env.MC_PROBE_OUT||path.join(research,'audio3-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','lwjgl-2.','gson-2.','soundsystem-','librarylwjglopenal-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/SoundProbe.java'),path.join(root,'probes/AudioProbe3.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'AudioProbe3'],{maxBuffer:1<<28});
const facts=JSON.parse(stdout);
assert.equal(facts.listener.length,40);assert.equal(facts.bookkeeping.length,3);assert.equal(facts.moving.length,160);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={btj:'SoundManager',bsm:'MovingSoundMinecart',bsn:'MovingSoundMinecartRiding',bsl:'MovingSound'};
const classDigests={};for(const [k,v] of Object.entries(names))classDigests[k]={name:v,sha256:await digest(k)};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',probe:'tools/probes/AudioProbe3.java',classes:classDigests,...facts};
await writeFile(path.join(root,'../public/research/audio3-reference.json'),JSON.stringify(reference)+'\n');
console.log(`audio3-reference.json: ${facts.listener.length} listener cases, ${facts.bookkeeping.map(b=>b.rows.length).join('+')} bookkeeping ops, ${facts.moving.length} moving-sound ticks`);
