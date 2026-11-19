// Batch 83 corpse83: records what a dying mob's own update still runs (tools/probes/CorpseLivingProbe.java on the SquidBatProbe and EndermanProbe
// world doubles) in public/research/corpse-living-reference.json; src/corpse83-b83.test.js replays it. Needs the same JDK and library JARs as
// tools/verify-squid-bat.mjs (MC_RESEARCH points at the directory holding minecraft-1.7.10.jar).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'corpse-living-probe');
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
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','WolfProbe','ModelProbe','SquidBatProbe','EndermanProbe','CorpseLivingProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'CorpseLivingProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
const squidCorpse=pick('squidCorpse'),enderCorpse=pick('enderCorpse'),enderChase=pick('enderChase');
assert.equal(squidCorpse.length,44);assert.equal(enderCorpse.length,1800);assert.equal(enderChase.length,4);
const reference={target:'Minecraft Java 1.7.10',tag:'b83corpse',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 83. Unchanged original classes. squidCorpse: new ws(world) on the SquidBatProbe world double (water flag), 40 full ws.h() ticks alive, then sv.g(0) (no onDeath) and 21 more ws.h() ticks; kind "air" switches the water off at the kill and adds rw(1, 15, 0) and a revenge target 92 ticks old. Rows: the squid fields, deathTime, isDead, the draws of the tick and the Random state after it (an LCG copy). enderCorpse: one ya.e() at 0 health in the EndermanProbe tick environments (seeds 0..299). enderChase: ya.e() ticks at 0 health with a far non-staring player target.',
 squidCorpse,enderCorpse,enderChase};
await writeFile(path.join(root,'../public/research/corpse-living-reference.json'),JSON.stringify(reference)+'\n');
console.log('corpse-living reference:',squidCorpse.length,'squid rows,',enderCorpse.length,'enderman rows,',enderChase.length,'chase rows');
