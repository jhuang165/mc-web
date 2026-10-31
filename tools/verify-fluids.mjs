// Replays seeded water and lava scenarios through the unchanged original
// BlockDynamicLiquid / BlockStaticLiquid / BlockLiquid classes
// (tools/probes/FluidProbe.java, with a minimal World test double) and through
// src/fluids.js, checks both agree for every tick, and writes
// public/research/fluids-reference.json and lava-reference.json for
// src/fluids.test.js and src/lava.test.js. Needs the same JDK, client JAR and library JARs as
// tools/verify-shadows.mjs.
import {execFile,spawn} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {SCENARIOS,LAVA_SCENARIOS,replay,compare} from './fluid-scenarios.mjs';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'fluid-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/FluidProbe.java')]);
const ALL=[...SCENARIOS,...LAVA_SCENARIOS];
const input=ALL.map(s=>`scenario ${s.name} ${s.dims.join(' ')} ${s.ticks} ${s.rseed??0} ${s.nether?1:0}\ngrid ${s.grid}\n${s.events.map(e=>`event ${e.join(' ')}`).join('\n')}${s.events.length?'\n':''}`).join('');
const child=spawn('java',['-cp',cp,'FluidProbe'],{stdio:['pipe','pipe','inherit']});
let stdout='';child.stdout.on('data',d=>stdout+=d);child.stdin.end(input);
await new Promise((res,rej)=>child.on('close',c=>c===0?res():rej(new Error('java exited '+c))));
const lines=stdout.trim().split('\n').map(l=>JSON.parse(l)),{percent,blocks}=lines.shift();
assert.equal(lines.length,ALL.length);
let ticks=0,flows=0,fizzes=0;
for(const [i,original] of lines.entries()){
 const s=ALL[i],mine=replay(s);
 compare(s,original,mine,percent);ticks+=s.ticks;flows+=original.flows.length;fizzes+=original.fizz.length;
}
const water=lines.slice(0,SCENARIOS.length),lava=lines.slice(SCENARIOS.length);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={akr:'BlockDynamicLiquid',ant:'BlockStaticLiquid',alw:'BlockLiquid'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original akr/ant/alw run against a minimal World test double (SetBlock, scheduled-tick list with a HashSet and 1000 ticks per tick, neighbour notification in x-1,x+1,y-1,y+1,z-1,z+1 order). Per tick: a 31x+char hash of the block-and-level grid; at the end: BlockLiquid.getFlowVector and getFlowDirection of every water cell.',
 percent,scenarios:SCENARIOS.map((s,i)=>({...s,hashes:water[i].hashes,final:water[i].grid,pending:water[i].pending,flows:water[i].flows}))};
await writeFile(path.join(root,'../public/research/fluids-reference.json'),JSON.stringify(reference)+'\n');
// Lava: also the sounds (tick, x, y, z, name, volume, pitch) and the world Random's next int after the run.
const lavaReference={target:reference.target,clientSha1:reference.clientSha1,classes:reference.classes,
 method:reference.method+' The double carries the world Random (ahb.s, seeded per scenario), WorldProvider.hasNoSky/isHellWorld (aqo.f/g) and records ahb.a(x,y,z,sound,volume,pitch) calls; each scenario also records every sound and the Random\'s next int after the last tick. Scenarios named nether-* run with both provider flags set.',
 blocks,percent,scenarios:LAVA_SCENARIOS.map((s,i)=>({...s,hashes:lava[i].hashes,final:lava[i].grid,pending:lava[i].pending,flows:lava[i].flows,fizz:lava[i].fizz,rng:lava[i].rng}))};
await writeFile(path.join(root,'../public/research/lava-reference.json'),JSON.stringify(lavaReference)+'\n');
console.log(`PASS: ${ALL.length} scenarios (${LAVA_SCENARIOS.length} with lava), ${ticks} ticks, ${flows} flow vectors, ${fizzes} fizz sounds identical to the original classes.`);
