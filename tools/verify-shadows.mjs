// Records what Render.renderShadow reads from the block under a shadow
// (material, renderAsNormalBlock, bounds) for every block of this build, from
// the unchanged original classes (tools/probes/ShadowProbe.java), in
// public/research/shadow-reference.json; src/shadows.test.js checks
// takesShadow against it. Needs the same JDK, client JAR and library JARs as
// tools/verify-inventory.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'shadow-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
// Game block ID -> 1.7.10 block ID (src/world.js BLOCKS order).
const MC_BLOCKS={1:2,2:3,3:1,4:17,5:18,6:12,7:5,8:45,9:20,10:9,11:7,12:4,13:58,14:61,15:16,16:15,17:56,18:14,19:35,20:50,21:47,22:49,23:80,24:82,25:13,26:42,27:41,28:57,29:60,30:60,31:59,32:59,33:59,34:59,35:59,36:59,37:59,38:59,39:31,40:172,41:54,42:11,43:37,44:38,45:51,46:78,47:79,48:6,49:141,50:142};
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/ShadowProbe.java')]);
const ids=[...new Set(Object.values(MC_BLOCKS))];
const {stdout}=await exec('java',['-cp',cp,'ShadowProbe',...ids.map(String)],{maxBuffer:1<<24});
const byMc=Object.fromEntries(stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).map(b=>[b.id,b]));
assert.equal(Object.keys(byMc).length,ids.length);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={bno:'Render',bnn:'RenderManager',bny:'RenderItem',bnp:'RenderXPOrb',bpf:'RenderZombie',aji:'Block'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block.registerBlocks. For each game block, the mapped 1.7.10 block\'s material (air or not), renderAsNormalBlock (func_149686_d) and default bounds [minX,minY,minZ,maxX,maxY,maxZ]. Render.renderShadow skips air below the shadowed cell; func_147907_a draws only on blocks that render as normal blocks.',
 blocks:Object.fromEntries(Object.entries(MC_BLOCKS).map(([game,mc])=>[game,{mc,...byMc[mc],id:undefined}]))};
await writeFile(path.join(root,'../public/research/shadow-reference.json'),JSON.stringify(reference)+'\n');
console.log(Object.entries(reference.blocks).filter(([,b])=>!b.normal).map(([g])=>g).join(' '),'take no shadow');
