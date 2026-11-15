// Runs tools/probes/TileNamesProbe.java on the unchanged 1.7.10 tile entity classes (CustomName read/write/flag, InventoryLargeChest naming) and
// writes public/research/tile-names-reference.json, replayed by src/tilenames-b74.test.js. Needs the pinned JAR (tools/research or MC_RESEARCH), a JDK
// and the 1.7.10 libraries (libs-1.7.10 next to the JAR, or MC_PROBE_LIBS).
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
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
const libDir=path.join(research,'libs-1.7.10'),libs=(process.env.MC_PROBE_LIBS?process.env.MC_PROBE_LIBS.split(path.delimiter):(await readdir(libDir)).filter(f=>/^(log4j-api|log4j-core|guava|commons-lang3|gson|commons-io)-/.test(f)).map(f=>path.join(libDir,f)));
const out=path.join(research,'tile-names-probe'),classes=path.join(out,'classes'),probe=path.join(out,'probe');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/TileNamesProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'TileNamesProbe'],{maxBuffer:1<<26}),records=stdout.split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(records.length,11);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',method:'Unchanged TileEntityChest (aow), Dispenser (apb), Dropper (apc), EnchantmentTable (apd), Furnace (apg), Hopper (api), BrewingStand (aov) and InventoryLargeChest (ra) driven by reflection: name and hasCustomInventoryName before and after setCustomName, CustomName in writeToNBT, readFromNBT with a string, a wrong-typed tag and an empty name.',records};
await writeFile(path.join(root,'../public/research/tile-names-reference.json'),JSON.stringify(reference)+'\n');
console.log(`Tile name records: ${records.length}`);
