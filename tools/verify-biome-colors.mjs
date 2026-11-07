// Records the unchanged 1.7.10 biome colour functions and the block colour multipliers (see BiomeColorProbe.java).
// Requires the pinned client JAR, a JDK and the usual probe libraries; the colormap PNGs come from public/media.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'biome-color-probe');
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
const grassPng=path.join(root,'../public/media/1.7.10/colormap/grass.png'),foliagePng=path.join(root,'../public/media/1.7.10/colormap/foliage.png');
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/BiomeColorProbe.java')]);
const {stdout}=await exec('java',['-Djava.awt.headless=true','-cp',cp,'BiomeColorProbe',grassPng,foliagePng],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names=['ahu','aiv','aif','ail','ain','alh','alt','alw','aml','amh','aoh','ane','anz','ako','aoj','aha','agx'];
const {stderr:version}=await exec('java',['-XshowSettings:properties','-version']);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(names.map(async c=>[c,{sha256:await digest(c)}]))),
 colormaps:{grass:await sha(grassPng),foliage:await sha(foliagePng)},
 method:'BiomeGenBase getFloatTemperature/getBiomeGrassColor/getBiomeFoliageColor/getSkyColorByTemp on every registered slot at nine positions, BiomeGenSwamp grass noise on a grid, and the real Block.colorMultiplier of the tinted blocks on a synthetic scatter biome map (java.lang.reflect.Proxy IBlockAccess), after Block.registerBlocks, on the probe JVM ('+(String(version).match(/java\\.version = (\S+)/)?.[1]||'unknown')+'). The colormaps are decoded with ImageIO getRGB into aha.a(int[]) / agx.a(int[]); colours are recorded masked to 0xFFFFFF.',
 records};
await writeFile(path.join(root,'../public/research/biome-colors-reference.json'),JSON.stringify(reference)+'\n');
const c={};for(const r of records)c[r.kind]=(c[r.kind]||0)+1;
console.log('Original biome colour records:',records.length,JSON.stringify(c));
