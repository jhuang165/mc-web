// Drives the unchanged GuiScreenBook (bfe) of the 1.7.10 client JAR headlessly (tools/probes/BookGuiProbe.java: the real
// FontRenderer with ascii.png and glyph_sizes.bin, test doubles for Minecraft, TextureManager, LWJGL and the net handler) and
// records page text, indicator, cursor blink, key handling, sign flow, button rules and the MC|BEdit / MC|BSign stacks in
// public/research/book-gui-reference.json; src/book-gui.test.js replays it against src/books.js. Same prerequisites as verify-book.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'book-gui-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-'].map(library));
const classes=path.join(out,'classes'),probe=path.join(out,'probe');await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','assets/minecraft/font/glyph_sizes.bin','assets/minecraft/textures/font/ascii.png','-d',classes],{maxBuffer:1<<24});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['CatalogueProbe','MobMoveProbe','BookProbe','BookGuiProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/lwjgl-doubles/org/lwjgl/input/Keyboard.java'),path.join(root,'probes/lwjgl-doubles/org/lwjgl/opengl/GL11.java')]);
const {stdout}=await exec('java',['-Djava.awt.headless=true','-cp',cp,'BookGuiProbe',classes],{maxBuffer:1<<28});
const rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const gui=rows.filter(r=>r.case==='gui'),wrap=rows.filter(r=>r.case==='wrapUnicode');
assert.ok(gui.length>=30,'gui scenarios');assert.ok(wrap.length>=60,'wrapUnicode');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={bfe:'GuiScreenBook',bff:'GuiButtonNextPage',bdw:'GuiScreen',bbu:'FontRenderer',iz:'C17PacketCustomPayload'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged GuiScreenBook driven through keyTyped / actionPerformed / updateScreen / drawScreen (tools/probes/BookGuiProbe.java). Real FontRenderer reading ascii.png and glyph_sizes.bin; test doubles for Minecraft (displayGuiScreen, font, texture manager, net handler), LWJGL (Keyboard, GL11) and the button drawing; drawScreen records the drawTexturedModalRect blit and the drawString / drawSplitString calls. Sent packets are decoded with the original PacketBuffer.readItemStackFromBuffer. The page arrows (bff) are read from bytecode. ctrl+V reads the AWT clipboard, so pasting is probed through the private pageInsertIntoCurrent(String) it calls.',
 counts:{gui:gui.length,wrapUnicode:wrap.length},gui,wrapUnicode:wrap};
await writeFile(path.join(root,'../public/research/book-gui-reference.json'),JSON.stringify(reference)+'\n');
console.log('book gui reference: gui='+gui.length+' wrapUnicode='+wrap.length);
