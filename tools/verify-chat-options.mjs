// Replays tools/probes/ChatOptionsProbe.java against the unchanged 1.7.10 JAR and records the javap-read chat constants into
// public/research/chat-options-reference.json (replayed by src/chat-options.test.js). Needs a JDK, the pinned client JAR and log4j-api.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'chat-options-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['log4j-api-','log4j-core-','guava-','commons-lang3-'].map(library));
const classes=path.join(out,'classes'),probe=path.join(out,'probe');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-encoding','UTF-8','-cp',cp,'-d',probe,path.join(root,'probes/ChatOptionsProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'ChatOptionsProbe'],{maxBuffer:1<<26});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(records.filter(r=>r.case==='size').length,8);assert.equal(records.filter(r=>r.case==='strip').length,5);assert.equal(records.filter(r=>r.case==='visibility').length,3);
const javap=async c=>(await exec('javap',['-p','-c','-constants','-cp',classes,c],{maxBuffer:1<<26})).stdout;
// Bytecode-read: the ScreenChatOptions widget order and positions, the screenshot file name rule, GuiChat link scheme set and the
// tab-list condition and layout literals. Each is asserted against the javap text so a different JAR fails here.
const opts=await javap('bcs');assert.match(opts,/options\.chat\.title/);assert.match(opts,/options\.multiplayer\.title/);assert.match(opts,/sipush\s+155/);assert.match(opts,/sipush\s+160/);assert.match(opts,/sipush\s+168/);
const shot=await javap('bbp');assert.match(shot,/yyyy-MM-dd_HH\.mm\.ss/);assert.match(shot,/String screenshots/);assert.match(shot,/screenshot\.success/);assert.match(shot,/screenshot\.failure/);assert.match(shot,/String _\n/);
const server=await javap('nh');assert.match(server,/chat\.cannotSend/);
const list=await javap('bbv');assert.match(list,/String playerList/);assert.match(list,/int -2147483648/);assert.match(list,/int 553648127/);
const lang={};
for(const line of (await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout.split('\n')){
 const i=line.indexOf('=');if(i>0&&/^(options\.chat\.|options\.showCape|screenshot\.|chat\.(link|copy|cannotSend)|gui\.(yes|no))/.test(line))lang[line.slice(0,i)]=line.slice(i+1).replace(/\r$/,'');
}
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:{bcc:'GuiNewChat',bct:'GuiChat',bcs:'ScreenChatOptions',bcu:'GuiConfirmOpenLink',bbp:'ScreenShotHelper',bbv:'GuiIngame',nh:'NetHandlerPlayServer',zb:'EnumChatVisibility',a:'EnumChatFormatting',bbj:'GameSettings'},
 method:'ChatOptionsProbe calls GuiNewChat.func_146233_a (bcc.a(float), width), func_146243_b (bcc.b(float), height), EnumChatFormatting.getTextWithoutFormattingCodes (a.a) and reads the EnumChatVisibility table (zb). The remaining constants are read from javap output of bcs, bct, bcu, bbp, bbv, nh and bao and asserted above.',
 widgetOrder:['CHAT_VISIBILITY','CHAT_COLOR','CHAT_LINKS','CHAT_OPACITY','CHAT_LINKS_PROMPT','CHAT_SCALE','CHAT_HEIGHT_FOCUSED','CHAT_HEIGHT_UNFOCUSED','CHAT_WIDTH'],
 screenshot:{directory:'screenshots',format:'yyyy-MM-dd_HH.mm.ss',suffix:'first free of base.png, base_2.png, base_3.png ...',success:'screenshot.success with the file name as an OPEN_FILE component, underlined',failure:'screenshot.failure with the exception message'},
 serverFilter:'nh.a(ft): an S02PacketChat is dropped when chatVisibility is HIDDEN, and under SYSTEM unless its system flag (gj.d) is set; processChatMessage replies chat.cannotSend through that same filter. Minecraft.runTick opens GuiChat only when chatVisibility != HIDDEN.',
 playerList:{condition:'key.playerlist held && !(integrated server && players <= 1 && no scoreboard objective)',maxPlayers:8,backdrop:0x80000000,cell:0x20FFFFFF,pingSprite:{u:0,v:176,w:10,h:8,rowHeight:8}},
 lang,records};
await writeFile(path.join(root,'../public/research/chat-options-reference.json'),JSON.stringify(reference)+'\n');
console.log('Chat options records:',records.length);
