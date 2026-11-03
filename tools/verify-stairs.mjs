// Probe the unchanged 1.7.10 BlockStairs (ten registry objects). Requires the pinned JAR, JDK
// and probe libraries; writes the fixture replayed by src/stairs.test.js.
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
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'stairs-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/StairsProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'StairsProbe'],{maxBuffer:1<<28}),rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse),blocks=rows.filter(r=>r.kind==='block'),shapes=rows.find(r=>r.kind==='shapes'),mixed=rows.find(r=>r.kind==='mixed'),tables=rows.find(r=>r.kind==='tables'),raytraces=rows.filter(r=>r.kind==='raytrace'),placement=rows.find(r=>r.kind==='placement');
assert.equal(blocks.length,10);assert.ok(shapes&&mixed&&tables&&placement);assert.equal(raytraces.length,16);assert.equal(shapes.states.length,16);
const srg=await readFile(path.join(research,'joined-1.7.10.srg'),'utf8'),hashClass=async id=>createHash('sha256').update((await exec('unzip',['-p',jar,id+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const {renderShapes,collisionShapes}=tables;delete shapes.renderShapes;delete shapes.collisionShapes;
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',srgSha256:createHash('sha256').update(srg).digest('hex'),method:'Unchanged original BlockStairs (ans) registry objects 53, 67, 108, 109, 128, 134, 135, 136, 163 and 164: constructor-derived properties, func_150147_e / func_150145_f / func_150144_g shape methods and addCollisionBoxesToList over every neighbour configuration of the four horizontal cells (9^4 states per metadata 0-15), collisionRayTrace over deterministic rays, onBlockPlaced, onBlockPlacedBy and drops. World is a minimal World/BlockAccess double over a cell map; no renderer is instantiated.',classes:{ans:{name:'BlockStairs',sha256:await hashClass('ans')},aji:{name:'Block',sha256:await hashClass('aji')},blm:{name:'RenderBlocks',sha256:await hashClass('blm')}},blocks,neighbourOrder:shapes.neighbourOrder,neighbourCodes:shapes.neighbourCodes,renderShapes,collisionShapes,states:shapes.states,mixed:mixed.cases,raytraces,placement:{onBlockPlaced:placement.onBlockPlaced,onBlockPlacedBy:placement.onBlockPlacedBy}};
const file=path.join(root,'../public/research/stairs-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Original stairs records: ${blocks.length} blocks, ${renderShapes.length} render shapes, ${collisionShapes.length} collision shapes, ${shapes.states.length*6561} neighbour states, ${mixed.cases.length} mixed cases, ${raytraces.reduce((n,r)=>n+r.rays.length,0)} rays, ${placement.onBlockPlaced.length+placement.onBlockPlacedBy.length} placement cases, ${(await readFile(file)).length} bytes`);
