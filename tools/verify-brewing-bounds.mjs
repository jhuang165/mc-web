// Also records BlockGlowstone.quantityDroppedWithBonus (tools/probes/GlowstoneDropProbe.java). Records the shared bounds of the unchanged BlockBrewingStand in the order the client queries them (tools/probes/BrewingBoundsProbe.java)
// in public/research/brewing-bounds-reference.json; src/hudfx-b71.test.js replays it. Needs the pinned 1.7.10 JAR (tools/research or MC_RESEARCH),
// a JDK and guava/log4j-api/commons-lang3 JARs (MC_PROBE_LIBS lists them when they are not under the usual launcher/gradle folders).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'brewing-bounds-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/BrewingBoundsProbe.java'),path.join(root,'probes/GlowstoneDropProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'BrewingBoundsProbe'],{maxBuffer:1<<24});
const records=stdout.split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(records.length,5);
const glow=(await exec('java',['-cp',cp,'GlowstoneDropProbe'],{maxBuffer:1<<24})).stdout.split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(glow.length,801);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:{ajq:{name:'BlockBrewingStand',sha256:await digest('ajq')},aji:{name:'Block',sha256:await digest('aji')}},
 method:'aji.p() registers the blocks; the stand (id 117) is queried with a null world (its bounds queries read only the shared fields B..G): getSelectedBoundingBoxFromPool (g) and getCollisionBoundingBoxFromPool (a) before any pass, after one addCollisionBoxesToList pass (a with mask and list), and after a pass whose mask misses it. No game classes patched.',records,glowstone:glow};
const file=path.join(root,'../public/research/brewing-bounds-reference.json');await writeFile(file,JSON.stringify(reference,null,1)+'\n');
console.log(`Brewing bounds records: ${records.length}`);
