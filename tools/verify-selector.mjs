// Replays tools/probes/SelectorProbe.java against the unchanged 1.7.10 JAR (PlayerSelector ad, MathHelper qh) and records
// public/research/selector-reference.json, replayed by src/command-selector.test.js. Needs a JDK and the pinned client JAR.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'selector-probe'),classes=path.join(out,'classes'),probe=path.join(out,'probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const cp=classes;
await exec('javac',['-nowarn','-encoding','UTF-8','-cp',cp,'-d',probe,path.join(root,'probes/SelectorProbe.java')],{maxBuffer:1<<24});

const lines=[];
for(const t of ['@p','@a','@r','@f','@e','@P','@p[]','@p[r=5]','@p[ r=5]','@p[r=5,]','@p[r=5,,m=1]','@p[name=Foo_Bar-1]','@p[name=!x]','@p[name=a b]','@p[name=ä]','@p[r=5][m=1]','@p[x=1]x','p','@','@pa','@p[','@p]','@p[a=!]','@p[team=!red]','@p[r=-1]','@p[r==5]','@a[r=5]','@a[]','@A','@p[x=1;y=2]','@p[score_a=1,score_b_min=2]','@p@p',' @p','@p '])lines.push('token\t'+t);
for(const t of ['p','a','r'])lines.push('defaults\t'+t);
for(const t of ['','5','5,6','5,6,7','5,6,7,8','5,6,7,8,9','1,2,3,4,x=5','1,2,r=3','x=1','x=1,y=2','x=1,x=2','1,x=2','x=2,1','-1,-2,-3,-4','!1','1,,3','1,2,3,4,5,6','r=5,m=1','r=5,,m=1','r=5,m','m=1,r','name=Foo,team=red','name=!Foo,team=!red','name=!','name=','team=','a=-','a=--1','a=!!1','a=-!1','a=1-2','a=_x','score_a=5','score_a_min=3','score_a=5,score_a_min=3','score_=1','score_a=x','score__min=1','score_x_min=','score_x=-0','score_a=99999999999','score_a_min_min=2','l=5,lm=3,c=-2','5,,7','5,6,7,8,r=2,x=9',',',',,',',x=1','1,x','x=1,2','R=5','X=1','x= 1','x=1 ','x=1;','x=é','r=5,m=-1','c=0','c=','c=+1'])lines.push('args\t'+t);
for(const v of ['','0','5','-5','+5','-0','+0','007','-007','1.5','1e3','0x10','5 ',' 5','2147483647','2147483648','-2147483648','-2147483649','99999999999999999999','!1','-','+','a','--1','1_0','null'])for(const d of [-1,0,1,2147483647])lines.push(`int\t${v}\t${d}`);
const run=spawn('java',['-cp',`${probe}:${cp}`,'SelectorProbe'],{cwd:out});let buf='',err='';run.stdout.on('data',d=>buf+=d);run.stderr.on('data',d=>err+=d);
run.stdin.end(lines.join('\n')+'\n');await new Promise(r=>run.on('close',r));if(err)throw new Error(err);
const records=buf.split('\n').filter(Boolean).map(l=>JSON.parse(l));assert.equal(records.length,lines.length);
const ref={source:'tools/verify-selector.mjs / tools/probes/SelectorProbe.java against minecraft-1.7.10.jar (ad PlayerSelector, qh MathHelper)',records};
await writeFile(path.join(root,'../public/research/selector-reference.json'),JSON.stringify(ref,null,1)+'\n');
await rm(out,{recursive:true,force:true});
console.log(`selector-reference.json: ${records.length} records`);
