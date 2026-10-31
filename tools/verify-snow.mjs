// Records snow and ice facts from the unchanged original classes
// (tools/probes/SnowProbe.java) in public/research/snow-reference.json;
// src/snow.test.js checks the browser port against it. Needs the same JDK, client JAR and library
// JARs as tools/verify-inventory.mjs. The probe allocates World/WorldInfo/WorldProvider
// without constructors (sun.misc.Unsafe), so it needs no LWJGL, Gson or Netty.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'snow-probe');
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
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/SnowProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'SnowProbe'],{maxBuffer:1<<26});
const facts=JSON.parse(stdout);
assert.equal(facts.freeze.rows.length,5*4*6*3);assert.equal(facts.snowAt.rows.length,3*4*14*3);assert.equal(facts.bounds.length,16);
assert.equal(facts.tick.length,2);assert.ok(facts.tick[0].events.length>20&&facts.tick[1].events.length>0);assert.equal(facts.populate.length,2);assert.ok(facts.populate[0].events.length>50);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ahb:'World',ahu:'BiomeGenBase',aij:'BiomeGenSnow',aji:'Block',ajn:'Blocks',alp:'BlockIce',anm:'BlockSnowBlock',ann:'BlockSnow',amo:'BlockPackedIce',alh:'BlockGrass',aec:'ItemSnow',abh:'ItemBlock',ady:'ItemSpade',aqz:'ChunkProviderGenerate',mt:'WorldServer',blt:'EntityRenderer',awt:'Material',aib:'WorldChunkManager'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on a fake World (allocated without constructors, like the weather probe). Evidence kinds: probe = executed original classes; bytecode = transcribed from javap only. biomes: [id, name, getFloatTemperature(5,40,5), rainfall, canSpawnLightningBolt, getEnableSnow] (probe). blocks: [block id, getLightOpacity, renderAsNormalBlock, isOpaqueCube, slipperiness, getTickRandomly, Material.blocksMovement, Material.isLiquid, hardness] (probe). bounds: [meta, collision box, selection box] of BlockSnow, relative to the block, null when there is none (probe). freeze.rows: [biome, block light, block case, neighbour pattern, canBlockFreeze(noWaterAdj false), canBlockFreeze(true), isBlockFreezable (r), isBlockFreezableNaturally (s)] over block cases [air, still water 0, flowing water 0, flowing water 1, still water 7, ice] and patterns [all four neighbours water, three water and one stone, none]; freeze.ys: [y, canBlockFreeze(false) on still water, canSnowAt(true) on still water, canSnowAt(false) on still water, canSnowAt(true) on air over stone] (probe). snowAt.rows: [biome, block light, below index, cell index, canSnowAt(true), canSnowAt(false), BlockSnow.canPlaceBlockAt] (probe). melt: block id (and metadata) a snow layer or ice at each block light 0-15 becomes after updateTick (probe). neighbor: block a snow layer becomes when onNeighborBlockChange runs over each block below (probe). tick: WorldServer.func_147456_g (mt.g) per chunk per tick, the loop transcribed from bytecode (bytecode) with canBlockFreeze/canSnowAt/updateTick the original classes (probe); events are [tick, block id, x, y, z, meta]. populate: the final freeze/snow pass of ChunkProviderGenerate.populate (aqz.a), loop from bytecode, rules from the probe. terrain: the fixture columns [ground y, surface block, pond, leaf y, glass y], pond cells are still water from pondFloor+1 to pondTop; outside the 32 x 32 area is stone up to y 30. Lights: two sources with light falling by manhattan distance.',
 ...facts};
await writeFile(path.join(root,'../public/research/snow-reference.json'),JSON.stringify(reference)+'\n');
console.log('freeze',facts.freeze.rows.length,'snowAt',facts.snowAt.rows.length,'tick',facts.tick.map(t=>t.events.length).join(','),'populate',facts.populate.map(t=>t.events.length).join(','));
