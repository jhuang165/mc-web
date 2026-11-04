// Records unchanged PotionHelper (aen), Potion (rv), PotionEffect (rw), ItemPotion (adp) and TileEntityBrewingStand (aov);
// see probes/PotionFxProbe.java. Writes public/research/potion-fx-reference.json, replayed by src/potions.test.js and src/brewing.test.js.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'potion-fx-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=(await Promise.all(['guava-','log4j-api-','commons-lang3-','commons-io-','authlib-','gson-','commons-codec-','jopt-simple-','trove-'].map(p=>library(p).catch(()=>null)))).filter(Boolean);
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
// Only LWJGL 3 is normally installed; the client classes reference LWJGL 2 types in signatures, so stub them for class loading/verification.
const stubs={'org.lwjgl.LWJGLException':'Exception','org.lwjgl.opengl.OpenGLException':'RuntimeException','org.lwjgl.opengl.DisplayMode':'|public DisplayMode(int w,int h){}'};
const stubDir=path.join(out,'stubs');await rm(stubDir,{recursive:true,force:true});const stubFiles=[];
for(const [name,spec] of Object.entries(stubs)){const [base,body='']=spec.split('|');const parts=name.split('.'),cls=parts.pop(),dir=path.join(stubDir,...parts);await mkdir(dir,{recursive:true});const file=path.join(dir,cls+'.java');await writeFile(file,`package ${parts.join('.')};public class ${cls}${base?' extends '+base:''}{${body}}\n`);stubFiles.push(file);}
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...stubFiles,path.join(root,'probes/PotionFxProbe.java')],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'PotionFxProbe'],{maxBuffer:1<<28});
if(process.env.PROBE_DEBUG)console.error(stderr);
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const by=c=>records.filter(r=>r.case===c);
for(const c of ['nightVision','fogColor','lightmap','detection','splashBreak','blindnessFog','portalTimer','warpScale'])assert.equal(by(c).length,1,`records of ${c}`);
assert.equal(records.length,8,'no stray records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={blt:'EntityRenderer',bma:'RenderGlobal',ahb:'World',blk:'EntityPlayerSP',zo:'EntityPotion'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityRenderer/RenderGlobal/World classes driven by probes/PotionFxProbe.java: nightVision (getNightVisionBrightness), fogColor (updateFogColor), lightmap (updateLightmap), detection (getClosestVulnerablePlayer), splashBreak (playAuxSFX 2002). blindnessFog, portalTimer and warpScale are bytecode-formula replays (kind replay).',
 records};
await writeFile(path.join(root,'../public/research/potion-fx-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original potion-fx records:',records.length,'bytes:',JSON.stringify(reference).length);
