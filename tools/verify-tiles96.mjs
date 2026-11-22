// Runs tools/probes/Tiles96Probe.java on the unchanged 1.7.10 tile entity and BlockSkull classes (TileEntity.createAndLoadEntity then writeToNBT for jukeboxes with tags,
// Damage and unregistered Record ints, hoppers, dispensers, droppers, brewing stands, chests, notes, the end portal and moving pistons; BlockSkull.breakBlock drops of raw
// types, through ItemTags2Probe's world double) and writes public/research/tiles96-reference.json, replayed by src/tiles96-b96.test.js. Needs the pinned JAR (tools/research or
// MC_RESEARCH), a JDK, the 1.7.10 libraries and a real authlib (MC_PROBE_LIBS lists library JARs, else ~/.gradle/caches or the launcher libraries are searched).
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import {mkdir,readFile,writeFile,access,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
let research;for(const dir of [process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research'),path.join(root,'../tools/research')].filter(Boolean))if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const libDir=path.join(research,'libs-1.7.10');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 if(prefix!=='authlib-'&&await exists(libDir)){const hit=(await readdir(libDir)).filter(f=>f.startsWith(prefix)&&!f.includes('sources')).sort()[0];if(hit)return path.join(libDir,hit);}
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','log4j-core-','commons-lang3-','authlib-','commons-io-','gson-'].map(library));
const out=path.join(research,'tiles96-probe'),classes=path.join(out,'classes'),probe=path.join(out,'probe');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','ItemTagsProbe','ItemTags2Probe','Tiles95Probe','Tiles96Probe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'Tiles96Probe'],{maxBuffer:1<<26}),lines=stdout.split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const registry=lines.find(l=>l.registry).registry,drops=lines.filter(l=>l.tag==='b58drop').map(({name,type,spawned})=>({name,type,spawned})),records=lines.filter(l=>l.label&&!l.error&&l.loaded!==false);
assert.ok(records.length>=60,`records ${records.length}`);assert.ok(drops.length>=7);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',method:'Unchanged tile entity classes driven through TileEntity.createAndLoadEntity (aor.c) and writeToNBT (aor.b), as tiles95-reference.json: per case the input compound `in` and the written compound `nbt`, each as {t: tag type, v: value}. `registry` is every id 1-4095 for which Item.getItemById (adb.d) is not null. `drops` are the stacks BlockSkull.breakBlock (anl.a) spawns for a tile of the given raw SkullType (item NBT text). Blocks and items are registered through aji.p() and adb.l().',registry,drops,records};
await writeFile(path.join(root,'../public/research/tiles96-reference.json'),JSON.stringify(reference)+'\n');
console.log(`Tile records: ${records.length}, drops ${drops.length}, registered items ${registry.length}`);
