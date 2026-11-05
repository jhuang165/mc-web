// Probe the unchanged BlockSign (63/68), ItemSign (323), TileEntitySign and ChatAllowedCharacters (tools/probes/SignProbe.java); writes public/research/sign-reference.json, replayed by src/signs.test.js.
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
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'sign-probe');
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
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
await writeFile(path.join(probe,'GameProfile.java'),'package com.mojang.authlib; public class GameProfile {}\n');
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(probe,'GameProfile.java'),...['MobMoveProbe','PlantProbe','DoorPaneProbe','BedProbe','SignProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});

const {stdout}=await exec('java',['-cp',cp,'SignProbe'],{maxBuffer:1<<28}),records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const count=(c,k)=>records.filter(r=>r.case===c&&(k===undefined||r.kind===k)).length;
console.log(JSON.stringify(records.reduce((a,r)=>(a[r.case+(r.kind?':'+r.kind:'')]=(a[r.case+(r.kind?':'+r.kind:'')]||0)+1,a),{})));
// Client-only classes: javap constants of GuiEditSign, ModelSign and TileEntitySignRenderer.
const javap=async(c,...a)=>(await exec('javap',['-p','-c','-constants','-cp',path.join(research,'sign-probe/classes'),...a,c],{maxBuffer:1<<24})).stdout;
const gui=await javap('bfx'),model=await javap('bhz'),rend=await javap('bmr'),net=await javap('nh');
for(const [text,hay] of [['float 93.75f',gui],['float -1.0625f',gui],['String sign.edit',gui],['float 0.6666667f',rend],['float 0.016666668f',rend],['float -0.3125f',rend],['float -0.4375f',rend],['float 0.07f',rend],['textures/entity/sign.png',rend],['float -12.0f',model],['float -14.0f',model],['String !?',net]])assert.ok(hay.includes(text),text);
const lang=(await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout;
const names=Object.fromEntries(lang.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>/^(sign\.edit|item\.sign\.name|tile\.sign\.name|gui\.done)=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classNames={ank:'BlockSign',adz:'ItemSign',apm:'TileEntitySign',t:'ChatAllowedCharacters',bfx:'GuiEditSign',bhz:'ModelSign',bmr:'TileEntitySignRenderer',nh:'NetHandlerPlayServer',jn:'C12PacketUpdateSign',aor:'TileEntity'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(classNames).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged BlockSign (63 standing, 68 wall), ItemSign (323), TileEntitySign and ChatAllowedCharacters on the BedProbe world double extended with the tile-entity map a Chunk keeps. Client GuiEditSign, ModelSign, TileEntitySignRenderer and the server NetHandlerPlayServer.processUpdateSign are verified by javap constants (below), not executed.',
 bytecode:{
  render:{scale:0.6666667,standingTranslate:[0.5,'0.75*scale',0.5],standingRotate:'-(meta*360/16)',wallRotate:{2:180,3:0,4:90,5:-90},wallTranslate:[0,-0.3125,-0.4375],boardBox:[-12,-14,-1,24,12,2],boardUV:[0,0],stickBox:[-1,-2,-1,2,14,2],stickUV:[0,14],modelScale:0.0625,textScale:'0.016666668*scale',textTranslate:[0,'0.5*scale','0.07*scale'],lineSpacing:10,lineY:'k*10-lines*5',color:0,shadow:false,maxRenderDistanceSquared:4096,editMarker:['> ',' <'],texture:'textures/entity/sign.png'},
  gui:{title:'sign.edit',titleY:40,titleColor:16777215,doneButton:{id:0,x:'w/2-100',y:'h/4+120'},model:{translate:['w/2',0,50],scale:-93.75,rotateY:180,standingTranslateY:-1.0625,wallTranslateY:-1.0625,tileOffset:[-0.5,-0.75,-0.5]},blink:'ticks/6%2==0 shows the line being edited',keys:{up:200,down:208,enter:28,numpadEnter:156,backspace:14,escape:1},maxLine:15},
  server:{overlong:'a line over 15 characters becomes !?',disallowed:'a line with any char failing ChatAllowedCharacters becomes !?',requires:'tile editable and tile editor == sender',after:'text copied, markDirty, markBlockForUpdate'}},
 names,records};
const file=path.join(root,'../public/research/sign-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Original sign records: ${records.length}, ${(await readFile(file)).length} bytes`);
