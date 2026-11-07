// Block sweep round 3 (batch 19): runs tools/probes/BlockSweep3Probe.java (unchanged 1.7.10 classes: light-dependent plant survival and ticks, seeded drop streams,
// tile-entity block boxes) and writes public/research/block-sweep3-reference.json, replayed by src/block-sweep3.test.js. Requires the pinned JAR, a JDK and probe libraries.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'block-sweep3-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24}),hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','netty-all-'].map(library)),classes=path.join(out,'classes');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/NetherBlocksProbe.java'),path.join(root,'probes/BlockSweepProbe.java'),path.join(root,'probes/BlockSweep3Tile.java'),path.join(root,'probes/BlockSweep3Probe.java')]);
const {stdout,stderr}=await exec('java',['-cp',cp,'BlockSweep3Probe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const classNames=Object.fromEntries(stderr.split('\n').filter(l=>l.startsWith('class ')).map(l=>{const [,id,name]=l.split(' ');return [id,name];}));
const ids=[...new Set(records.map(r=>r.id).filter(Boolean))];
assert.ok(records.some(r=>r.c==='lp')&&records.some(r=>r.c==='drop')&&records.some(r=>r.c==='tebox')&&records.some(r=>r.c==='teq'),'missing sections');
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',method:'tools/probes/BlockSweep3Probe.java runs the unchanged original block classes on the BlockSweepProbe/NetherBlocksProbe map-backed World double (cells, recorded EntityItem spawns, light grid with skylightSubtracted). Samples, not proof over every world state; right-click activation is not executed.',count:records.length,classes:classNames,records};
await writeFile(path.join(root,'../public/research/block-sweep3-reference.json'),JSON.stringify(reference)+'\n');
console.log(`Wrote ${records.length} block sweep records for ${ids.length} blocks.`);
