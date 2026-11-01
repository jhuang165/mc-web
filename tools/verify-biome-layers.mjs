// Records the unchanged 1.7.10 Overworld biome layers (GenLayer.initializeAllBiomeGenerators), the biome table
// and WorldChunkManager; see BiomeLayerProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'biome-layer-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/BiomeLayerProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'BiomeLayerProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
// MCP class names from joined-1.7.10.srg when it sits beside the JAR.
const srg=path.join(research,'joined-1.7.10.srg'),mcp={};
if(await exists(srg))for(const m of (await readFile(srg,'utf8')).matchAll(/^CL: (\S+) \S+\/(\S+)$/gm))mcp[m[1]]=m[2];
const used=new Set(['axn','axl','ahu','ahm','ahw','aib','ahy','ahz','agt','axa','aik','ail','ain']);
for(const r of records)if(r.kind==='graph')for(const n of r.nodes)used.add(n.class);
const biomes=records.find(r=>r.kind==='biomes');for(const b of biomes.biomes)used.add(b.class);
const {stderr:version}=await exec('java',['-XshowSettings:properties','-version']);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={};for(const c of [...used].sort())names[c]=mcp[c]||null;
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.keys(names).map(async c=>[c,{name:names[c],sha256:await digest(c)}]))),
 method:'Unchanged GenLayer.initializeAllBiomeGenerators (axn.a(long, WorldType)) and WorldChunkManager(long, WorldType) after Block.registerBlocks, on the probe JVM ('+(String(version).match(/java\.version = (\S+)/)?.[1]||'unknown')+'). IntCache.resetIntCache runs before every getInts and the result is copied. biomes: every non-null BiomeGenBase.getBiomeGenArray entry (list index, biomeID, name, class, temperature, rainfall, rootHeight, heightVariation, getTempCategory ordinal, isSnowyBiome j(), getEnableSnow d(), instanceof BiomeGenMesa, getIntRainfall, [topBlock id, field_150604_aj], [fillerBlock id, field_76754_C]) and the static field letter of each biome. graph: the layer objects in depth-first order from the river mix (parent field first, then the class\'s own GenLayer fields by name), each with its base seed, GenLayerEdge mode ordinal, world seed after init and getInts(-6, -6, 12, 12). ints: getInts [x, z, w, h, values] of the river mix (mix) and voronoi zoom (voronoi). manager: getBiomesForGeneration, getBiomeGenAt(x, z, w, h, cache), getBiomeGenAt(x, z), getRainfall, areBiomesViable and findBiomePosition over getBiomesToSpawnIn with new Random(seed + i) (result and the next nextLong).',
 records};
await writeFile(path.join(root,'../public/research/biome-layers-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original biome layer records:',records.length,'biomes:',biomes.biomes.length,'graph nodes:',records.filter(r=>r.kind==='graph').map(r=>r.nodes.length).join('/'));
