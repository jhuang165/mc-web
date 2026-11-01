// Extract original registries and Creative subtypes. Same local JDK/JAR requirements as verify-creative.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'catalogue-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/CatalogueProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'CatalogueProbe'],{maxBuffer:1<<24});
const records=stdout.trim().split('\n').map(line=>JSON.parse(line));
const items=records.filter(r=>r.kind==='item').map(({kind,...r})=>r).sort((a,b)=>a.id-b.id);
const blocks=records.filter(r=>r.kind==='block').map(({kind,...r})=>r).sort((a,b)=>a.id-b.id);
const searchEnchantedBooks=records.find(r=>r.kind==='searchEnchantedBooks').variants;
const byKind=kind=>records.filter(r=>r.kind===kind).map(({kind,...r})=>r);
const entities=byKind('entity'),biomes=byKind('biome'),gamerules=byKind('gamerule');
assert.deepEqual([items.length,blocks.length,entities.length,biomes.length,gamerules.length],[315,171,57,61,9], 'Pinned vanilla registration counts');
for(const entries of [entities,biomes])assert.equal(new Set(entries.map(r=>r.id)).size,entries.length);
assert.equal(new Set(gamerules.map(r=>r.name)).size,gamerules.length);
assert(entities.length && biomes.length && gamerules.length);
const base=JSON.parse(await readFile(path.join(root,'../public/research/block-registry-1.7.10.json')));
assert.deepEqual(blocks.map(({id,name})=>({id,name:name.replace(/^minecraft:/,'')})),base.blocks);
assert.equal(new Set(items.map(i=>i.id)).size,items.length);
assert(items.every(i=>i.name && i.stackLimit>0));
const creative=JSON.parse(await readFile(path.join(root,'../public/research/creative-reference.json')));
const search=items.flatMap(i=>i.variants).concat(searchEnchantedBooks).map(s=>[s.id,s.damage,s.count]);
assert.deepEqual(search,creative.tabs[5].items,'Inventory must reproduce the independent original search-tab reference');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={adb:'Item',aji:'Block',abt:'CreativeTabs',aft:'Enchantment',acm:'ItemEnchantedBook',cw:'RegistryNamespaced',add:'ItemStack',sg:'EntityList',ahu:'BiomeGenBase',agy:'GameRules'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original Block/Item registration and subtype methods. Icon arrays initialized with a null-returning register, without swallowed failures. Items include technical registrations with no Creative tab; variants reproduce the original Creative search walk. Additional search enchanted books retain native NBT text, unlike the older Creative reference. Block variants are getSubBlocks item-stack damage, NOT a list of valid world metadata states. Every raw 4-bit world metadata value must still be audited. EntityList complete numeric ID map read by reflection, including abstract registrations. BiomeGenBase complete non-null registry slots retain both slot ID and declared biomeID (not always equal). GameRules constructor default keys/values enumerated. No world behavior or browser equivalence is executed.',
 items,blocks,searchEnchantedBooks,entities,biomes,gamerules};
await writeFile(path.join(root,'../public/research/content-registry-reference.json'),JSON.stringify(reference,null,2)+'\n');
console.log(`${items.length} item registrations, ${blocks.length} block registrations, ${search.length} search entries (including ${searchEnchantedBooks.length} NBT books)`);
console.log(`${entities.length} entity IDs, ${biomes.length} biome IDs, ${gamerules.length} default gamerules`);
