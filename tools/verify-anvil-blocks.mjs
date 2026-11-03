// Probe unchanged BlockAnvil, BlockFalling and EntityFallingBlock records.
// Requires the pinned 1.7.10 JAR, JDK and probe libraries; writes the fixture
// replayed by src/anvil-blocks.test.js.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false),researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'anvil-block-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24}),hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library)),classes=path.join(out,'classes');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/AnvilBlockProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'AnvilBlockProbe'],{maxBuffer:1<<25}),rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse),block=rows.find(r=>r.kind==='block'),falls=rows.filter(r=>r.kind==='fall');
assert.ok(block);assert.equal(falls.length,720);assert.equal(block.id,145);assert.equal(block.renderType,35);assert.equal(block.hardness,5);
const srg=await readFile(path.join(research,'joined-1.7.10.srg'),'utf8'),hashClass=async id=>createHash('sha256').update((await exec('unzip',['-p',jar,id+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',srgSha256:createHash('sha256').update(srg).digest('hex'),method:'Unchanged original BlockAnvil registry object at id 145, its bounds/collision selection metadata mutator and damageDropped/render methods, plus unchanged BlockAnvil.onStartFalling and EntityFallingBlock.fall(float) over 720 controlled-distance/seed cases. World is a minimal BlockAccess/World double; fall target list is empty, so entity damage dispatch amount is inspected in class bytecode and hooked in the live JavaScript manager separately. No render engine/tessellator or full WorldServer update loop is instantiated.',classes:{ajb:{name:'BlockAnvil',sha256:await hashClass('ajb')},akx:{name:'BlockFalling',sha256:await hashClass('akx')},xj:{name:'EntityFallingBlock',sha256:await hashClass('xj')},aji:{name:'Block',sha256:await hashClass('aji')}},block,falls};
const file=path.join(root,'../public/research/anvil-blocks-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Original anvil records: ${falls.length} falling cases plus block metadata, ${ (await readFile(file)).length } bytes`);
