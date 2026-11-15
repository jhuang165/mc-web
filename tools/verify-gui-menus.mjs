// Runs initGui, updateScreen, actionPerformed and drawScreen (text only) of the unchanged 1.7.10 menu screens headlessly
// (tools/probes/GuiMenusProbe.java + Scenarios.java: a Minecraft subclass built without its constructor, the real GameSettings, the real
// FontRenderer reading ascii.png and glyph_sizes.bin, the real GuiButton lists; test doubles only for the TextureManager and the LWJGL
// GL11 / Sys / GLContext / Project classes in tools/probes/gui-doubles) and writes public/research/gui-menus-reference.json.
// src/gui-menus-b75.test.js replays the records against the port's screens (menus.js, server-list-gui.js, ...).
// Needs a JDK and minecraft-1.7.10.jar in tools/research (or MC_RESEARCH); the library jars as in verify-book-gui.mjs plus lwjgl-2.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'guimenus-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-'].map(library));
const lwjglJar=await library('lwjgl-2');
const classes=path.join(out,'classes'),probe=path.join(out,'probe'),lwjgl=path.join(out,'lwjgl');
await rm(out,{recursive:true,force:true});for(const d of [classes,probe,lwjgl])await mkdir(d,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','assets/minecraft/font/glyph_sizes.bin','assets/minecraft/textures/font/ascii.png','assets/minecraft/texts/splashes.txt','-d',classes],{maxBuffer:1<<24});
// The LWJGL jar is sealed, so its classes are used unpacked next to the doubles (the doubles come first on the class path).
await exec('unzip',['-q','-o',lwjglJar,'org/*','-d',lwjgl],{maxBuffer:1<<24});
const cp=[probe,classes,lwjgl,...libs].join(path.delimiter);
const doubles=['org/lwjgl/opengl/GL11.java','org/lwjgl/opengl/GLContext.java','org/lwjgl/Sys.java','org/lwjgl/util/glu/Project.java'].map(f=>path.join(root,'probes/gui-doubles',f));
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/GuiMenusProbe.java'),path.join(root,'probes/Scenarios.java'),...doubles],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-Djava.awt.headless=true','-cp',cp,'GuiMenusProbe',classes],{maxBuffer:1<<28});
const rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const failed=rows.filter(r=>r.error);
assert.equal(failed.length,0,'probe errors: '+JSON.stringify(failed.map(r=>[r.screen,r.error]).slice(0,3)));
assert.ok(rows.length>=100,'scenario rows');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={bdc:'GuiGameOver',bcw:'GuiYesNo',bcu:'GuiConfirmOpenLink',bdp:'GuiIngameMenu',bdm:'GuiOptions',bef:'GuiVideoSettings',bec:'GuiScreenOptionsSounds',bew:'GuiControls',bcs:'ScreenChatOptions',bdz:'GuiShareToLan',bdv:'GuiRenameWorld',bee:'GuiMainMenu',bdi:'GuiSleepMP',bdb:'GuiCreateWorld',bdx:'GuiSelectWorld',bfz:'GuiMultiplayer',bgf:'GuiScreenResourcePacks',bdj:'GuiLanguage',bdg:'GuiScreenAddServer',bde:'GuiScreenServerList',bdf:'GuiDisconnected',bdh:'GuiErrorScreen',bdt:'GuiScreenWorking'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged menu screens run through initGui / updateScreen / actionPerformed / drawScreen (tools/probes/GuiMenusProbe.java). Real GameSettings and FontRenderer; text drawn is recorded at the drawString / drawSplitString calls (list entries and widgets that draw through the button list are not drawn). Executed, not bytecode-read.',
 counts:{rows:rows.length},rows};
await writeFile(path.join(root,'../public/research/gui-menus-reference.json'),JSON.stringify(reference)+'\n');
console.log('gui menus reference: rows='+rows.length);
