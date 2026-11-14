// Batch 69 (projectiles4): runs tools/probes/GhastPowerProbe.java and writes public/research/ghast-power-reference.json (replayed by src/projectiles4-b69.test.js). Pattern of tools/verify-blaze-ghast.mjs, which this was copied from. Original header: Records EntityBlaze, EntityGhast and the fireballs from the unchanged original classes
// (tools/probes/BlazeGhastProbe.java on the MobMoveProbe world double) in public/research/blaze-ghast-reference.json;
// src/blaze-ghast.test.js checks the browser port against it. Needs the same JDK, client JAR and library JARs as
// tools/verify-wolf.mjs (MC_RESEARCH points at the directory holding minecraft-1.7.10.jar).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'ghast-power-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/WolfProbe.java'),path.join(root,'probes/ModelProbe.java'),path.join(root,'probes/BlazeGhastProbe.java'),path.join(root,'probes/GhastPowerProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'GhastPowerProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(lines.length,7,'six ExplosionPower tags and the EntityList record');
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',method:'Batch 69 projectiles4: the unchanged EntityGhast (yd) reads ExplosionPower with readEntityFromNBT, then runs its attack AI (BlazeGhastProbe double, seed 11, a player 20 blocks away) until it fires; the spawned EntityLargeFireball power field (zg.e) is recorded. The entityList record asks EntityList (sg) for the ids and names of an egg, a snowball and a pearl.',records:lines};
await writeFile(path.join(root,'../public/research/ghast-power-reference.json'),JSON.stringify(reference)+'\n');
console.log('ghast power and entity list records:',lines.length);
