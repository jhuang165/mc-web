// PLAN-03b: classify all 171 x 16 raw block metadata values from the unchanged original classes.
// Stage 1 executes tools/probes/BlockMetadataProbe.java (native Block/ItemBlock methods, headless).
// Stage 2 reads javap bytecode of each block's own class chain to find unprobed overrides that may read
// metadata. Stage 3 classifies and writes public/research/block-metadata-reference.json.
// Needs the pinned minecraft-1.7.10.jar (MC_RESEARCH or tools/research) and a JDK.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {classify,analyzeBytecode,renderDispatch} from './block-metadata-classify.mjs';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'block-metadata-probe');
const JAR_SHA1='e80d9b3bf5085002218d4be59e668bac718abbc6';
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),JAR_SHA1);
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/PlantProbe.java'),path.join(root,'probes/BlockMetadataProbe.java'),path.join(root,'probes/BlockMetadataExtProbe.java')]);
const {stdout}=await exec('java',['-XX:-OmitStackTraceInFastThrow','-cp',cp,'BlockMetadataProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).sort((a,b)=>a.id-b.id);
const registry=JSON.parse(await readFile(path.join(root,'../public/research/content-registry-reference.json')));
assert.deepEqual(records.map(r=>r.id),registry.blocks.map(b=>b.id),'probe covers every registered block');
// Stage 2: bytecode of each block's own class chain (excluding Block itself) and inner classes.
const javap=async cls=>(await exec('javap',['-c','-p','-s','-cp',classes,cls],{maxBuffer:1<<26}).catch(()=>({stdout:''}))).stdout;
const bytecode=new Map();
const wanted=new Set(records.flatMap(r=>r.chain));
const innerList=(await exec('unzip',['-Z1',jar],{maxBuffer:1<<24})).stdout.split('\n').filter(n=>n.endsWith('.class')).map(n=>n.slice(0,-6));
for(const c of wanted){
 bytecode.set(c,await javap(c));
 for(const n of innerList)if(n.startsWith(c+'$'))bytecode.set(n,await javap(n));
}
const srg=await exists(path.join(research,'joined-1.7.10.srg'))?(await readFile(path.join(research,'joined-1.7.10.srg'),'utf8')):'';
const deobf=new Map(srg.split('\n').filter(l=>l.startsWith('CL: ')).map(l=>l.split(' ').slice(1)).map(([a,b])=>[a,b.split('/').pop()]));
const analysis=new Map(records.map(r=>[r.id,analyzeBytecode(r.chain,bytecode)]));
// RenderBlocks render-type dispatch: render methods that read world metadata are external readers of that block.
const dispatch=renderDispatch(await javap('blm'));
const blocks=classify(records,registry.blocks,analysis,deobf,dispatch);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aji:'Block',abh:'ItemBlock',adb:'Item',ahb:'World',ahl:'IBlockAccess',awv:'MapColor',azt:'AxisAlignedBB',blm:'RenderBlocks'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:JAR_SHA1,
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'tools/probes/BlockMetadataProbe.java executes unchanged original Block methods for every registered block and raw metadata 0-15 against a map-backed World double holding only that block (air elsewhere, no tile entities, no entities), icons through a naming IIconRegister proxy; exceptions are recorded, not swallowed. tools/probes/BlockMetadataExtProbe.java additionally executes every World/IBlockAccess-taking method declared in the block class chain (updateTick, breakBlock, onNeighborBlockChange, onBlockAdded, harvest/drop, activation, collision boxes and ray traces, random display ticks, colour/icon/render queries, placement checks and others) plus Block.dropBlockAsItemWithChance and Block.createStackedBlock, in four recording World doubles (iso: air around; enc: stone around; same: neighbours are the same block and metadata; role: centre metadata 0, neighbours carry the value; a method whose role outcome varies reads neighbouring copies and also runs the full matrix nb0-nb15 with the value at the centre and role1-role15 with the value around) with synthesised arguments (Random arguments and World.rand: seeds 0-2 plus all-lowest and all-highest draws; a player double holding nothing, its own item, a flower, a water bucket, a glass bottle or bone meal); outcomes are the return value, written cells and recorded side effects (scheduled ticks, block events, notifications, tile-entity queries, particles, sounds, spawned entities) and the held stack, each run twice to detect nondeterminism. Block metadata carried in an outcome (written cells, falling blocks, break effects) is compared by its class in a joint partition refinement over all blocks, so a value that only carries itself along is not distinct by its number; own-item stack damages are no distinctness evidence. Values with identical probed and executed outcomes are grouped. javap bytecode of each block class chain (and its inner classes) is read to find overrides outside the base probed surface that read metadata (World/IBlockAccess.getBlockMetadata, TileEntity.getBlockMetadata, a metadata argument, or a call to such a method, same-class calls included); such a reader counts as covered only when all of its executed fields ran without an all-value failure in all four scenarios and never queried a tile entity. Readers outside the class chain that are tied to the block are never executed and block alias claims: the RenderBlocks method of its render type when that method reads world metadata other than straight into Block.getIcon(side, meta) (javap of RenderBlocks, renderTypeReaders) and any tile entity the block creates. Categories: semantic (a conclusive probed or executed outcome differs from every lower value), alias (all outcomes identical to a lower semantic value, no exception/NONDET outcome in its group and every metadata-reading override covered), invalid (an original method throws a Java index/cast fault in game code for that value) and unclassified (anything not established). Executed samples (five random variants, six held items, four layouts) are evidence, not proof over every world state; other blocks, items and entities reading this block\'s metadata are not analysed. No browser behavior or parity is executed or claimed.',
 categories:{
  semantic:'A conclusive (non-exception, deterministic) probed or executed native outcome differs from all lower metadata values of the same block (or it is the only/canonical surface of a block whose metadata never varies in any probed or executed method and has no unexecuted metadata reader).',
  alias:'Probed and executed native outcomes are identical to a lower semantic value (aliasOf), none of them is an exception or nondeterministic, every metadata-reading override of the block class chain was executed conclusively, the block creates no tile entity and its RenderBlocks render method does not read metadata.',
  invalid:'An original method (probed or executed) throws a Java index/cast fault in game code for this value only (fault recorded in evidence).',
  unclassified:'Not established: unexecuted or inconclusive metadata readers (tile entities, RenderBlocks render methods, failures on the World/player doubles, nondeterminism), a probe-side failure, or an identical surface to a value that is itself not established.'},
 probedSurface:Object.keys(records[0].meta[0]),
 executedScenarios:['iso','enc','same','role'],
 renderTypeReaders:Object.fromEntries([...dispatch].sort((a,b)=>a[0]-b[0]).map(([t,d])=>[t,'blm.'+d.method+(d.readsMetadata?' reads-metadata':'')])),
 executedMethods:[...new Set(records.flatMap(r=>(r.ext.fields||[]).map(f=>f.m.slice(f.m.indexOf('.')+1))))].sort(),
 blocks};
await writeFile(path.join(root,'../public/research/block-metadata-reference.json'),JSON.stringify(reference)+'\n');
const tally={};for(const b of blocks)for(const v of b.values)tally[v.category]=(tally[v.category]||0)+1;
console.log(blocks.length+' blocks, '+blocks.length*16+' values',tally);
