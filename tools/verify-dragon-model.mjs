// Replays the unchanged 1.7.10 ModelDragon (biq) headlessly through a stub GL11 and writes public/research/dragon-model-reference.json; see probes/DragonModelProbe.java and public/research/dragon.md.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'dragon-model-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-','commons-io-','lwjgl-2'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const stub=path.join(out,'stub');await rm(stub,{recursive:true,force:true});await mkdir(stub,{recursive:true});
await exec('javac',['-nowarn','-d',stub,path.join(root,'probes/gl/org/lwjgl/opengl/GL11.java')],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
// the stub GL11 comes first on the class path so the model classes never reach the real LWJGL
const cp=[stub,probe,classes,jar,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['TerrainProbe','DecorationFeatureProbe','SpringProbe','EndProbe','DragonProbe','DragonModelProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-Xmx2g','-cp',cp,'DragonModelProbe'],{maxBuffer:1<<29});
if(/Exception|Caused by:/.test(stderr))throw new Error(stderr);
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
for(const [c,n] of Object.entries({boxes:12,pose:16}))assert.equal(count(c),n,`records of ${c}`);
assert.equal(records.length,28,'no stray records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={biq:'ModelDragon',bix:'ModelRenderer',bis:'ModelBox',xa:'EntityDragon'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged ModelDragon built for real; org.lwjgl.opengl.GL11 is replaced by a headless stub that keeps a float modelview stack. boxes: ModelBox corners, widths, texture offsets (read from the quads) and mirror flag per ModelRenderer, plus its constructor rotation point. pose: EntityDragon ticked with a seeded Random, then setLivingAnimations + render at four partial ticks; offsets are getMovementOffsets(0..40, partial) and calls are every display-list call [name, 16 column-major floats] in render order.',
 records};
await writeFile(path.join(root,'../public/research/dragon-model-reference.json'),JSON.stringify(reference)+'\n');
console.log('Dragon model records:',records.length,'bytes:',JSON.stringify(reference).length);
