// Batch 53 (b53dq): the flat and cube shapes RenderBlocks.renderBlockAsItem draws for a cart's display block, executed on the real 1.7.10 client classes with a stub GL11 and a stub
// IIconRegister (see tools/probes/DisplayQuadsProbe.java). src/display-quads-b53.test.js replays public/research/display-quads-reference.json.
import {execFile} from 'node:child_process';import os from 'node:os';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'displayquads-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','gson-2','commons-io-'].map(library));
const classes=path.join(out,'classes');await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
// the stub GL11 and the probe come first on the classpath; no LWJGL jar is on the classpath (org.lwjgl.LWJGLException and OpenGLException are stubbed too, and Minecraft (bao) and GameSettings (bbj) are stubs that only carry ambientOcclusion = 2).
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/displayquads/org/lwjgl/opengl/GL11.java'),path.join(root,'probes/displayquads/org/lwjgl/LWJGLException.java'),path.join(root,'probes/displayquads/org/lwjgl/opengl/OpenGLException.java'),path.join(root,'probes/displayquads/bao.java'),path.join(root,'probes/displayquads/bbj.java'),path.join(root,'probes/DisplayQuadsProbe.java')],{maxBuffer:1<<24});
const grassPng=path.join(root,'../public/media/1.7.10/colormap/grass.png'),foliagePng=path.join(root,'../public/media/1.7.10/colormap/foliage.png');
const {stdout}=await exec('java',['-Djava.awt.headless=true','-cp',cp,'DisplayQuadsProbe',grassPng,foliagePng],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.ok(records.length>=90,'probe output');
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={blm:'RenderBlocks',bmh:'Tessellator',aji:'Block'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',tag:'b53dq',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),colormaps:{grass:await sha(grassPng),foliage:await sha(foliagePng)},
 method:'RenderBlocks.renderBlockAsItem (blm.a(aji, int, float), a fresh RenderBlocks with no world, useInventoryTint on) on the unchanged client with org.lwjgl.opengl.GL11 replaced by a recording stub. calls = glTranslatef/glRotatef/glScalef/glColor4f/glEnable in order and a draw line per glDrawArrays; draws = the static Tessellator raw buffer at each draw (pos, uv, rgba bytes when the colour flag is set, signed normal bytes when set). Icons are stub rf objects registered by the real Block.registerIcons, one per name, with u and v spanning 2k..2k+1 for the k-th name; uv is the recorded u, v minus 2k (an icon fraction, v from the top) and icon the name. Brightness 1.0 unless named dim (0.5).',
 records};
await writeFile(path.join(root,'../public/research/display-quads-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${records.length} displayquads records`);
