// Records unchanged BlockRedstoneWire, BlockLever, BlockPressurePlate, BlockButtonStone, BlockRedstoneRepeater,
// BlockTripWireHook and BlockTripWire plus ItemBlock/ItemReed/ItemRedstone placement; see
// tools/probes/RedstoneBlocksProbe.java. Inert: no power network is run.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'redstone-blocks-probe-run');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/RedstoneBlocksProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'RedstoneBlocksProbe'],{maxBuffer:1<<27});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
assert.deepEqual([count('facts'),count('bounds'),count('below'),count('sides'),count('activate'),count('buttonTick'),count('wireConnect')],[9,144,171,3,64,16,171]);
assert.ok(count('place')>=400);
const lang=(await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout;
const keys=/^(tile\.(notGate|lever|pressurePlate|button|diode|tripWireSource|tripWire|redstoneDust)\.name|item\.(redstone|diode|string)\.name)=/;
const names=Object.fromEntries(lang.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>keys.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classNames={ana:'BlockRedstoneWire',alv:'BlockLever',ajd:'BlockBasePressurePlate',amu:'BlockPressurePlate',ajs:'BlockButton',anx:'BlockButtonStone',akj:'BlockRedstoneDiode',anf:'BlockRedstoneRepeater',aog:'BlockTripWireHook',aof:'BlockTripWire',ads:'ItemRedstone',abh:'ItemBlock',abi:'ItemReed',aji:'Block',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(classNames).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged redstone component blocks and their placing items on a world double: a sparse cell map (stone floor only where noted); setBlock stores the cell then runs onBlockAdded as Chunk does, setBlockMetadataWithNotify stores the metadata, setBlockToAir removes the cell and is counted as removed, notifications, block events and scheduled updates are recorded as events (no power network is run), doTileDrops is off, the entity lists are empty and the player only implements EntityPlayer abstract methods. Original ids: 55 wire, 69 lever, 70 stone plate, 72 wood plate, 77 stone button, 93/94 repeater, 131 tripwire hook, 132 tripwire; items 331 redstone, 356 repeater, 287 string; levers, plates, buttons and hooks place through ItemBlock. Masks are bit m = metadata m (bit s = side/neighbour index where noted). No game classes patched',
 names,records};
await writeFile(path.join(root,'../public/research/redstone-blocks-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original redstone-block records:',records.length);
