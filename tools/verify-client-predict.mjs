// Probe the 1.7.10 client world's own block changes for a click (tools/probes/ClientPredictProbe.java): PlayerControllerMP.onPlayerDestroyBlock's
// setBlockToAir + neighbour chain, Item.onItemUse and Block.onBlockActivated on a world with isRemote true. Requires the pinned 1.7.10 JAR, JDK and
// probe libraries; writes public/research/client-predict-reference.json, replayed by src/client-predict-b56.test.js.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false),researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'client-predict-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches'),path.join(research,'libs-1.7.10')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24}),hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library)),classes=path.join(out,'classes');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','DoorPaneProbe','BedProbe','ClientPredictProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'ClientPredictProbe'],{maxBuffer:1<<28}),records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const errors=records.filter(r=>r.error);
assert.deepEqual(errors.map(r=>r.case+':'+r.name+':'+r.error),[],'probe scenarios must not throw');
const count=c=>records.filter(r=>r.case===c).length;
assert.ok(count('break')===64&&count('use')===40&&count('activate')===30,'case counts '+JSON.stringify(records.reduce((a,r)=>(a[r.case]=(a[r.case]||0)+1,a),{})));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classNames={bje:'PlayerControllerMP',ahb:'World',aji:'Block',adb:'Item',akn:'BlockDoor',ajh:'BlockBed',abg:'ItemBed',ach:'ItemDoor'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(classNames).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged block and item classes on the DoorPaneProbe map-backed world double with ahb.E (isRemote) set TRUE: the order of PlayerControllerMP.onPlayerDestroyBlock (aux 2001, setBlockToAir flags 3, then Block.onBlockDestroyedByPlayer) is replayed call by call from the bytecode read; Item.onItemUse and Block.onBlockActivated are called directly. World.setBlock dispatches breakBlock/onBlockAdded and the six neighbour notifications in the original order (DoorPaneProbe.DW). Light is stubbed as full daylight, redstone power as unpowered, tile entities as absent. The rest of onPlayerRightClick (the activate-then-use order, the C08 send) is bytecode-read, not executed. No game classes patched',
 records};
const file=path.join(root,'../public/research/client-predict-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Client prediction records: ${records.length}, ${(await readFile(file)).length} bytes`);
