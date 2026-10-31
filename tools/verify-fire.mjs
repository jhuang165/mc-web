// Records 1.7.10 fire facts from the unchanged original classes
// (tools/probes/FireProbe.java) in public/research/fire-reference.json;
// src/fire.test.js checks the browser port against it. Needs the same JDK, client JAR and library
// JARs as tools/verify-inventory.mjs. The probe allocates World/WorldInfo/WorldProvider
// without constructors (sun.misc.Unsafe), so it needs no LWJGL, Gson or Netty.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'fire-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/FireProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'FireProbe'],{maxBuffer:1<<26});
const facts=JSON.parse(stdout);
assert.equal(facts.ticks.length,56);assert.equal(facts.place.length,160);assert.equal(facts.lava.length,72);assert.equal(facts.bolts.length,96);assert.equal(facts.burning.length,6);assert.equal(facts.render.fixtures.length,256);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={alb:'BlockFire',ant:'BlockStaticLiquid',acw:'ItemFlintAndSteel',xh:'EntityLightningBolt',ahb:'World',aji:'Block',awt:'Material',sa:'Entity',blm:'RenderBlocks',bmh:'Tessellator',mt:'WorldServer'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on a World subclass whose blocks live in a map (World allocated without its constructor). ids are 1.7.10 block ids. table rows: [id, chanceToEncourageFire, abilityToCatchFire, material.getCanBurn, material.isReplaceable, material.blocksMovement, material.isLiquid, lightOpacity, lightValue, doesBlockHaveSolidTopSurface (meta 0)]. cells are flat [x, y, z, id, meta] fixtures replayed in order. ticks: BlockFire.updateTick on seeded fixtures (Random seed in "seed"), live fires ticked round-robin in (x, y, z) order, a step is [x, y, z, ops, next nextInt(1000000)]; ops are "s,x,y,z,id,meta" setBlock, "a,x,y,z" setBlockToAir, "m,x,y,z,meta" setBlockMetadataWithNotify, "t,x,y,z,delay" scheduleBlockUpdate. Biome 21 is a jungle (isBlockHighHumidity), biome 1 plains. place: canPlaceBlockAt, onNeighborBlockChange (neighbour), onBlockAdded for a fire at (4, 4, 4) among six neighbours, then the next nextInt(1000000) of Random(seed). lava: BlockStaticLiquid.updateTick of still lava at (4, 4, 4) 24 times from Random(seed). bolts: EntityLightningBolt (xh) constructed server side with the first Entity.rand draw seeded (boltVertex, boltLivingTime, constructor ops) then h() until dead. burning: World.isBoundingBoxBurning over boxes contracted by 0.001 [minX, minY, minZ, maxX, maxY, maxZ, burning]. render: RenderBlocks.renderBlockFire vertices [x, y, z, u, v, brightness] with stub icons whose rectangles are in "icons" ([u0, u1, v0, v1] for layer 0 and 1); the render world reports brightness 0x00a000b0 + (blockLight << 4), so fire (light 15) gives 0x00a001a0. Not run: Entity.moveEntity (needs a populated world), WorldServer random ticks and tickUpdates (bytecode only, see public/research/fire.md).',
 ...facts};
await writeFile(path.join(root,'../public/research/fire-reference.json'),JSON.stringify(reference)+'\n');
console.log('ticks',facts.ticks.reduce((n,t)=>n+t.steps.length,0),'place',facts.place.length,'lava',facts.lava.length,'bolts',facts.bolts.length,'render',facts.render.fixtures.length);
