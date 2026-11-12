// Batch 53 (digfinish): records ItemInWorldManager's dig timer on the real EntityPlayerMP (see tools/probes/DigFinishProbe.java); src/dig-finish-b53.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'dig-finish-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','log4j-core-','commons-lang3-','netty-all-','gson-','commons-io-','commons-codec-','jopt-simple-'].map(library));
const classes=path.join(out,'classes');await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs,jar].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','DigFinishProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/held/com/mojang/authlib/GameProfile.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'DigFinishProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.ok(records.length>=1000,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={mx:'ItemInWorldManager',mw:'EntityPlayerMP',aji:'Block',yz:'EntityPlayer',nh:'NetHandlerPlayServer'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Batch 53 (b53df): the PlayerDamageProbe double (real EntityPlayerMP, Survival, real inventory) owns a real ItemInWorldManager (mx) over a world double. Ops are the C07 packets of NetHandlerPlayServer: s = status 0 (mx.a(x,y,z,face)), f = status 2 (mx.a(x,y,z), then the handler resends S23 when the cell is not air), t = the server tick (mx.a()). r/ra = Block.getPlayerRelativeBlockHardness of the cell before/after the op (null for air). A step {o:"t",n,p,e,c,cur} folds n ticks: p = crack updates, e = "j:event" for non-crack events of tick j, c = the cell afterwards, cur = curblockDamage. Events: aux|2001|id = the break effect, remove|id = setBlockToAir, S23|x|y|z|id = the resend, partial|v = destroyBlockInWorldPartially. Not run: the C07 distance check and spawn protection (NetHandlerPlayServer, ported in server-handlers.js), harvest drops.',records};
await writeFile(path.join(root,'../public/research/dig-finish-reference.json'),JSON.stringify(reference)+'\n');
console.log('Dig finish records:',records.length);
