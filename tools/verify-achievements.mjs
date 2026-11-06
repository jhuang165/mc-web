// Records the unchanged AchievementList (pc), Achievement (pb) and exploreAllBiomes set (ahu.n); see probes/AchievementProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'achievement-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/AchievementProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'AchievementProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
const expect={achievement:33,bounds:1,biomes:1};
for(const [c,n] of Object.entries(expect))assert.equal(count(c),n,`records of ${c}`);
assert.equal(records.length,35,'no stray records');
const lang={};
for(const line of (await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout.split('\n')){
 const i=line.indexOf('=');if(i>0&&/^(achievement\.|chat\.type\.achievement|gui\.achievements|gui\.done|stats\.|gui\.stats)/.test(line))lang[line.slice(0,i)]=line.slice(i+1).replace(/\r$/,'');
}
for(const r of records.filter(r=>r.case==='achievement')){assert.ok(lang['achievement.'+r.id.replace(/^achievement\./,'')],'name '+r.id);assert.ok(lang[r.descKey]!==undefined,'desc '+r.descKey);}
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={pc:'AchievementList',pb:'Achievement',pq:'StatFileWriter',pg:'StatisticsFile',beh:'GuiAchievement',bei:'GuiAchievements',mw:'EntityPlayerMP',yz:'EntityPlayer',aax:'SlotCrafting',aak:'SlotFurnace',xk:'EntityItem',ahu:'BiomeGenBase'};
// Bytecode-read constants (javap -c -p of beh and bei in the unchanged JAR); values are literals in the class files.
const toast={durationMs:3000,hintDelayMs:2500,hintProgressCap:0.5,width:160,height:32,slideHeight:36,textureU:96,textureV:202,iconX:8,iconY:8,titleX:30,titleY:7,nameY:18,titleColor:0xFFFFFF00,nameColor:0xFFFFFFFF,hintDescWidth:120,
 progress:'d=(now-start)/3000; e=d*2; if(e>1)e=2-e; e=1-e*4; if(e<0)e=0; offset=-int(e^4*36)'};
const screen={frameWidth:256,frameHeight:202,spacing:24,minOffset:-112,maxOffset:-77,viewX:8,viewY:17,viewWidth:224,viewHeight:155,contentX:16,contentY:17,zoomMin:1,zoomMax:2,zoomStep:0.25,easing:0.85,snapDistanceSquared:4,tileSize:16,tileBias:288,
 initialScroll:'x=openInventory.column*24-141/2-12; y=openInventory.row*24-141/2',doneButton:{dx:24,dy:74,width:80,height:20},titleColor:0x404040,nodeSize:22,frameSize:26,tooltipWidthMin:120,
 linkColors:{unlocked:0xFFA0A0A0,canUnlock:0xFF00FF00,locked:0xFF000000},nodeBrightness:{unlocked:0.75,canUnlock:1,depth1to2:0.3,depth3:0.2,depth4:0.1}};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'AchievementProbe loads the unchanged AchievementList (pc) and reads every Achievement (pb) by reflection: id (ph.e), column/row (pb.a/b), icon ItemStack (pb.d) item id and damage, parent (pb.c), special (pb.g), independent flag (ph.f), description key. bounds are pc.a..d. biomes is the exploreAllBiomes set ahu.n by biome name (ahu.af). toast and screen are literals read from beh/bei bytecode. lang is en_US.lang from the JAR.',
 toast,screen,lang,records};
await writeFile(path.join(root,'../public/research/achievements-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original achievement records:',records.length,'bytes:',JSON.stringify(reference).length);
