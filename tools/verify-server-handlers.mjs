// Records Book and Quill / Written Book facts (ItemWritableBook, ItemEditableBook, RecipeBookCloning, FontRenderer widths,
// GuiScreenBook) from the unchanged original classes (tools/probes/BookProbe.java) in public/research/book-reference.json;
// src/books.test.js checks the browser port against it. Needs the same JDK, client JAR and library JARs as tools/verify-inventory.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'server-handlers-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','assets/minecraft/textures/font/ascii.png','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['CatalogueProbe','MobMoveProbe','BookProbe','ServerHandlersProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/netty-doubles/io/netty/util/AttributeKey.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'ServerHandlersProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l.replace(/[\u0000-\u001f]/g,c=>"\\u"+c.charCodeAt(0).toString(16).padStart(4,"0"))));
const pick=name=>lines.filter(l=>l.case===name);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={nh:'NetHandlerPlayServer',oi:'ServerConfigurationManager',ael:'ItemWritableBook',aem:'ItemEditableBook',jm:'C10PacketCreativeInventoryAction'};
const cases=['book','creative','chat','held','sign','placement','digging','useEntity'];
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged NetHandlerPlayServer driven by tools/probes/ServerHandlersProbe.java with test doubles for the server, world, player entity, item-in-world manager and network manager (see that file). Inventory, items, NBT and packet codec are the original classes.',
 ...Object.fromEntries(cases.map(k=>[k,pick(k)]))};
await writeFile(path.join(root,'../public/research/server-handlers-reference.json'),JSON.stringify(reference)+'\n');
console.log('server handlers:',cases.map(k=>k+'='+pick(k).length).join(' '));
