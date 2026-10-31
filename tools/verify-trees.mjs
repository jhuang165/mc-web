// Records oak sapling, tree growth, leaf decay and leaf drop facts from the unchanged original
// classes (tools/probes/TreeProbe.java) in public/research/trees-reference.json;
// src/trees.test.js checks the browser port against it. Needs the same JDK, client JAR and library
// JARs as tools/verify-inventory.mjs. The probe allocates World/WorldInfo/WorldProvider
// without constructors (sun.misc.Unsafe), so it needs no LWJGL, Gson or Netty.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'tree-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/TreeProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'TreeProbe'],{maxBuffer:1<<26});
const facts=JSON.parse(stdout);
assert.ok(facts.gen.rows.length>=240&&facts.gen.grown>20&&facts.gen.refused>20);
assert.ok(facts.sapling.rows.length>100&&facts.sapling.marks>5&&facts.sapling.grows>5&&facts.sapling.fails>0&&facts.sapling.lost>0);
assert.equal(facts.bonemeal.bits.length,200);assert.equal(facts.bonemeal.rows.length,120);
assert.equal(facts.decay.cube.length,4);assert.equal(facts.decay.trees.length,32);assert.equal(facts.decay.marks.length,2);assert.equal(facts.drops.length,6);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ahb:'World',aji:'Block',ajn:'Blocks',ajr:'BlockBush',ajo:'IGrowable',anj:'BlockSapling',aod:'BlockLeavesBase',alt:'BlockLeaves',aml:'BlockOldLeaf',alx:'BlockLog',amm:'BlockOldLog',arn:'WorldGenerator',arc:'WorldGenAbstractTree',asq:'WorldGenTrees',ard:'WorldGenBigTree',acj:'ItemDye',adg:'ItemLeaves',mt:'WorldServer',apx:'Chunk'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on a fake World (allocated without constructors, like the snow and weather probes), block ids as in 1.7.10 (2 grass, 3 dirt, 6 sapling, 12 sand, 17 log, 18 leaves, 60 farmland, 31 tall grass, 1 stone). Evidence kinds: probe = executed original classes; bytecode = transcribed from javap only. The fake World stores cells in a map over a flat fixture (stone below ground-3, dirt to the surface, the fixture top block at ground, air above, plus the fixture edits), returns a fixed block light, and applies Chunk.func_150807_a\'s call of the old block\'s breakBlock when a setBlock changes the block id (bytecode); leaves and saplings are subclasses that log Block.dropBlockAsItem_do stacks and take its three nextFloat calls (bytecode) because the original needs GameRules. Random is java.util.Random (a subclass with a readable seed, and a trap on the sapling\'s nextInt(10) == 0, where the original builds WorldGenBigTree, which is not ported: that tick is reported B and the run stops). gen.rows: [fixture index, seed, notify (flags 3 or 2), result, setBlock call count, sha256 of the ordered calls x,y,z,id,meta,flags, next nextInt(1000000)] for WorldGenTrees.generate(world, random, 0, ground + 1, 0) (probe); gen.example is the full call list of seed 13 on grass (probe). sapling.rows: BlockSapling.updateTick (anj.a) on a sapling at (0, ground + 1, 0), up to 80 ticks, events one character per tick (m marked by setting bit 8, g grew, f tried and the tree did not fit so the sapling was put back, d support lost and dropped, B big-tree draw, . nothing), drops [tick, item id, damage], state = sha256 of every cell that differs from the fixture (air without metadata), next = next Random value (probe). bonemeal.bits: for seeds 0 to 199 the first 40 results of func_149852_a, nextFloat() < 0.45 (probe); bonemeal.rows: func_149852_a then func_149853_b on a sapling until it grows (probe). decay.cube: BlockLeaves.updateTick on every leaf (-6..6 around the log) of a cube of leaves with the given metadata around one log, on a fresh copy each time (probe); decay.trees: a WorldGenTrees tree (notify) with all logs but the lowest keep removed through setBlockToAir (BlockLog.breakBlock marks leaves within 4), then updateTick on every leaf in x, y, z order each round until a round changes nothing, rounds = changed leaves per round (probe, with the scan order chosen here). decay.marks: BlockLeaves.breakBlock (range 1) and BlockLog.breakBlock (range 4) over a cube of leaves (probe). drops: BlockLeaves.dropBlockAsItemWithChance(world, x, y, z, meta, 1.0F, 0) called 4000 times on one Random (probe); item ids 6 sapling and 260 apple.',
 ...facts};
await writeFile(path.join(root,'../public/research/trees-reference.json'),JSON.stringify(reference)+'\n');
console.log('gen',facts.gen.rows.length,'grown',facts.gen.grown,'sapling',facts.sapling.rows.length,'marks',facts.sapling.marks,'grows',facts.sapling.grows,'fails',facts.sapling.fails,'bigs',facts.sapling.bigs,'lost',facts.sapling.lost);
