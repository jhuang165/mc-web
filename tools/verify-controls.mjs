// Replays tools/probes/ControlsProbe.java against the unchanged 1.7.10 client JAR and LWJGL 2 and records the key bindings,
// the KeyBinding hash, Keyboard.getKeyName, the default options.txt and loadOptions results, plus the javap-read GuiControls /
// GuiKeyBindingList layout and the Minecraft.runTick F-key table, into public/research/controls-reference.json (replayed by
// src/keybindings.test.js). Needs a JDK, the pinned client JAR, LWJGL 2.9.x (1.7.10 ships 2.9.1) and the GameSettings libraries.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'controls-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const lwjgl=await library('lwjgl-2.9');
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','gson-','netty-all-'].map(library));
const classes=path.join(out,'classes'),probe=path.join(out,'probe');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
// LWJGL comes first so its real Keyboard/LWJGLException win over the verifier-only stubs.
const cp=[lwjgl,probe,classes,...libs].join(path.delimiter);
const stubs=(await readdir(path.join(root,'probes/stubs'),{recursive:true})).filter(n=>n.endsWith('.java')&&!n.includes('lwjgl')).sort().map(n=>path.join(root,'probes/stubs',n));
await exec('javac',['-nowarn','-encoding','UTF-8','-cp',cp,'-d',probe,path.join(root,'probes/ControlsProbe.java'),...stubs],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-Djava.awt.headless=true','-cp',cp,'ControlsProbe',path.join(out,'run')],{maxBuffer:1<<26});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const one=c=>{const r=records.filter(x=>x.case===c);assert.equal(r.length,1,c);const {case:_,...rest}=r[0];return rest;};
const bindings=records.filter(r=>r.case==='binding').map(({case:_,...r})=>r);
assert.equal(bindings.length,32);

const javap=async c=>(await exec('javap',['-p','-c','-constants','-cp',classes,c],{maxBuffer:1<<26})).stdout;
// GuiControls (bew): Done 200 and Reset Keys 201 at w/2 - 155 (+160), h - 29, 150 x 20; option widgets at w/2 - 155 + i%2*160,
// 18 + 24*(i>>1); the title at w/2, 8; Reset Keys enabled while any key differs; a click while editing binds -100 + button;
// Escape (1) binds 0; keyTyped stores Minecraft.getSystemTime in field g, which dispatchKeypresses (bao.aa) waits 20 ms on.
const controls=await javap('bew');
for(const re of [/sipush\s+200/,/sipush\s+201/,/sipush\s+155/,/bipush\s+29\n/,/sipush\s+150/,/String controls\.resetAll/,/String controls\.title/,/bipush\s+18\n/,/bipush\s+24\n/,/bipush\s+-100/,/bipush\s+8\n/])assert.match(controls,re);
// KeyEntry (bev): key button 75 x 18 at x + 105, reset 50 x 18 at x + 190 (enabled when not default), the label at
// x + 90 - maxLabelWidth; "> " WHITE / YELLOW / " <" while editing, RED when another binding shares a non-zero code.
const entry=await javap('bev');
for(const re of [/bipush\s+75/,/bipush\s+50/,/sipush\s+190/,/bipush\s+105/,/bipush\s+90/,/String >/,/String  </,/String controls\.reset\n/])assert.match(entry,re);
// GuiKeyBindingList (bes): top 63, bottom h - 32, slot 20; scroll bar at super + 15 and list width super + 32.
const list=await javap('bes');
for(const re of [/bipush\s+63/,/bipush\s+32/,/bipush\s+20/,/bipush\s+15/])assert.match(list,re);
// Minecraft.runTick (bao.p) key events: F4 (62) entityRenderer.deactivateShader, Escape (1) the game menu, F3 (61) +
// S (31) / T (20) refreshResources, + F (33) RENDER_DISTANCE +-1 with shift, + A (30) renderGlobal.loadRenderers, + H (35)
// advancedItemTooltips with saveOptions, + B (48) RenderManager.debugBoundingBox, + P (25) pauseOnLostFocus with saveOptions,
// F1 (59) hideGUI, F3 (61) showDebugInfo (shift for the profiler chart); key.togglePerspective / key.smoothCamera through isPressed.
// The F3 + C (46) crash after 6000 ms is also there. Only with no screen open; dispatchKeypresses (bao.aa) runs first in every screen.
const mc=await javap('bao');
for(const re of [/bipush\s+62\n\s+\d+: if_icmpne/,/bipush\s+31\n\s+\d+: if_icmpne/,/bipush\s+20\n\s+\d+: if_icmpne/,/bipush\s+33\n\s+\d+: if_icmpne/,/bipush\s+30\n\s+\d+: if_icmpne/,/bipush\s+35\n\s+\d+: if_icmpne/,/bipush\s+48\n\s+\d+: if_icmpne/,/bipush\s+25\n\s+\d+: if_icmpne/,/bipush\s+59\n\s+\d+: if_icmpne/,/Field bnn\.p:Z/,/long 6000l/,/Display\.sync/,/String Not ready to start streaming yet!/])assert.match(mc,re);
// EntityRenderer (blt): hideGUI gates the hand, both selection outlines and GuiIngame (drawn anyway while a screen is open).
const renderer=await javap('blt');
assert.equal([...renderer.matchAll(/Field bbj\.av:Z/g)].length,4);

const lang={};
for(const line of (await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout.split('\n')){
 const i=line.indexOf('=');if(i>0&&/^(key\.|controls\.|options\.(framerateLimit|vsync|anaglyph|invertMouse|sensitivity|touchscreen))/.test(line))lang[line.slice(0,i)]=line.slice(i+1).replace(/\r$/,'');
}
const {stdout:lwjglList}=await exec('unzip',['-l',lwjgl],{maxBuffer:1<<24});assert.match(lwjglList,/org\/lwjgl\/input\/Keyboard\.class/);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',lwjgl:path.basename(lwjgl),
 classes:{bal:'KeyBinding',bbj:'GameSettings',bbm:'GameSettings$Options',bew:'GuiControls',bes:'GuiKeyBindingList',bev:'GuiKeyBindingList$KeyEntry',beu:'GuiKeyBindingList$CategoryEntry',bao:'Minecraft',blt:'EntityRenderer',pz:'IntHashMap',bnn:'RenderManager'},
 method:'ControlsProbe constructs GameSettings headlessly and calls KeyBinding.setKeyBindState/onTick/isPressed/getIsKeyPressed, GameSettings.setOptionKeyBinding, setOptionValue(RENDER_DISTANCE), setOptionFloatValue(FRAMERATE_LIMIT), saveOptions and loadOptions, and LWJGL Keyboard.getKeyName/getKeyIndex. Layout constants and the runTick key table are javap-read and asserted above.',
 guiControls:{title:{x:'w/2',y:8},options:{array:['INVERT_MOUSE','SENSITIVITY','TOUCHSCREEN'],x:'w/2 - 155 + (i % 2) * 160',y:'18 + 24 * (i >> 1)',w:150,h:20},
  done:{id:200,x:'w/2 - 155',y:'h - 29',w:150,h:20},resetAll:{id:201,x:'w/2 - 155 + 160',y:'h - 29',w:150,h:20,enabled:'any key code differs from its default',action:'setKeyCode(default) for every binding then resetKeyBindingArrayAndHash; no saveOptions'},
  list:{top:63,bottom:'h - 32',slotHeight:20,scrollBarX:'super + 15',listWidth:'super + 32'},
  keyEntry:{label:{x:'x + 90 - maxLabelWidth',y:'y + slotHeight / 2 - FONT_HEIGHT / 2',color:0xFFFFFF},key:{x:'x + 105',w:75,h:18},reset:{x:'x + 190',w:50,h:18,enabled:'keyCode != default'},editing:'§f> §e<name>§f <',conflict:'§c<name> when keyCode != 0 and another binding has the same code'},
  editing:{mouse:'mouseClicked while a binding is selected: setOptionKeyBinding(binding, -100 + button)',key:'keyTyped: Escape (1) binds 0 (NONE), any other key binds its code; time stored for the 20 ms dispatchKeypresses guard'}},
 runTick:{whenNoScreen:{1:'displayInGameMenu',59:'F1 hideGUI toggle',61:'F3 showDebugInfo toggle on key down; showDebugProfilerChart = shift held','61+31':'F3+S refreshResources','61+20':'F3+T refreshResources','61+33':'F3+F setOptionValue(RENDER_DISTANCE, shift ? -1 : 1) (no RENDER_DISTANCE branch in 1.7.10, so only saveOptions)','61+30':'F3+A renderGlobal.loadRenderers','61+35':'F3+H advancedItemTooltips toggle + saveOptions','61+48':'F3+B RenderManager.debugBoundingBox toggle','61+25':'F3+P pauseOnLostFocus toggle + saveOptions','61+46':'F3+C held 6000 ms: manually triggered debug crash'},
  always:{62:'F4 entityRenderer.deactivateShader (also with a screen open)','key.screenshot':'dispatchKeypresses: ScreenShotHelper.saveScreenshot','key.fullscreen':'dispatchKeypresses: toggleFullscreen','key.streamStartStop':'dispatchKeypresses: stop, confirm start, GuiStreamUnavailable or "Not ready to start streaming yet!"','key.streamPauseUnpause':'pause/unpause while broadcasting','key.streamCommercial':'request commercial while broadcasting','key.streamToggleMic':'mic toggle on press and release'},
  afterEvents:['key.hotbar.1-9 isPressed: currentItem','key.inventory isPressed: GuiInventory (or riding-horse inventory)','key.drop isPressed: dropOneItem(ctrl)','key.chat isPressed and chat not hidden: GuiChat','key.command isPressed, no screen, chat not hidden: GuiChat("/")','key.use held while using an item; key.attack / key.use / key.pickItem isPressed: click actions','key.use held: rightClickMouse repeat when rightClickDelayTimer is 0','key.attack held with no screen: sendClickBlockToController'],
  framerate:'runGameLoop: Display.sync(getLimitFramerate()) when getLimitFramerate() < FRAMERATE_LIMIT max (260); getLimitFramerate is 30 with no world and a screen open, else GameSettings.limitFramerate',
  hideGUI:'EntityRenderer: GuiIngame is drawn when !hideGUI or a screen is open; renderHand, the selection outline (in and out of water) skip while hideGUI'},
 lang,records};
await writeFile(path.join(root,'../public/research/controls-reference.json'),JSON.stringify(reference)+'\n');
console.log('Controls records:',records.length);
