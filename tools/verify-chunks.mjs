// Records unchanged 1.7.10 chunk storage and World block lookups; see ChunkProbe.java.
// Requires the pinned client JAR, a JDK and the usual probe libraries.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'chunk-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/ChunkProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'ChunkProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.deepEqual(records.map(r=>r.kind),['registry','nibble','nibble','nibble','section','section','section','section','chunk','chunk','chunk','blockChunk','world','keys']);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={apv:'NibbleArray',apz:'ExtendedBlockStorage',apx:'Chunk',apw:'EmptyChunk',ahb:'World',agu:'ChunkCoordIntPair',aji:'Block'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Block.registerBlocks only. Unchanged NibbleArray get/set over seeded op lists (values outside 0-15 included); ExtendedBlockStorage setExtBlock/metadata/light setters, raw LSB/MSB array writes and removeInvalidBlocks with reference/tick counts after every op; Chunk generation-array constructors (Block[]+byte[] for 64/128/256-high columns, Block[] 128-high) with section summaries, getBlock/getBlockMetadata reads including y >= 256 and the negative-y exception, setBlockMetadata results (BlockContainer cells excluded); World.getBlock/getBlockMetadata at boundary coordinates over a stub IChunkProvider (fixed chunks for chunk x/z in [-2,1], EmptyChunk elsewhere, first request logged); ChunkCoordIntPair.chunkXZ2Int and hashCode. World is allocated without its constructor; no game classes patched; no lighting, heightmap, tile entity or save code executed',
 records};
await writeFile(path.join(root,'../public/research/chunk-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original chunk records:',records.length);
