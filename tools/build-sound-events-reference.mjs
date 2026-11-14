// node tools/build-sound-events-reference.mjs — writes public/research/sound-events-reference.json: every sound event name the
// unchanged 1.7.10 client classes pass around (bytecode-read with `javap -c -p -s`, no game code runs, no audio device).
// Each row is an `ldc` string constant that looks like a sounds.json event name (or a name prefix that is concatenated at run time),
// with its class and method (SRG names from tools/research/joined-1.7.10.srg), what consumes it (a playSound-family call, a `return`
// from a getLivingSound-style getter, a constructor or a field), the instructions between the constant and the call (the volume and
// pitch expression) and, inside a switch (RenderGlobal.playAuxSFX), the case ids. Block.SoundType rows list the name, volume and
// pitch of every `new SoundType(name, v, p)` so the step.* and dig.* events they build are derivable.
// Needs a JDK and the 1.7.10 client JAR (MC_RESEARCH or tools/research, SHA-1 e80d9b3b...). sounds.json (SHA-1 fce0bb3e...) is
// read from $MC_SOUNDS_JSON, the launcher's assets/objects or resources.download.minecraft.net, and only its event names are kept.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdtemp,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const sha1=b=>createHash('sha1').update(b).digest('hex');
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar');
assert.equal(sha1(await readFile(jar)),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const SOUNDS_SHA1='fce0bb3e14ade7b292a7c1d5fa785533d8106d82';
async function soundsJson(){
  const cands=[process.env.MC_SOUNDS_JSON,path.join(os.homedir(),'Library/Application Support/minecraft/assets/objects',SOUNDS_SHA1.slice(0,2),SOUNDS_SHA1),path.join(os.homedir(),'.minecraft/assets/objects',SOUNDS_SHA1.slice(0,2),SOUNDS_SHA1)].filter(Boolean);
  for(const c of cands)if(await exists(c)){const b=await readFile(c);if(sha1(b)===SOUNDS_SHA1)return b;}
  const r=await fetch(`https://resources.download.minecraft.net/${SOUNDS_SHA1.slice(0,2)}/${SOUNDS_SHA1}`);const b=Buffer.from(await r.arrayBuffer());
  assert.equal(sha1(b),SOUNDS_SHA1);return b;
}
const sounds=JSON.parse(await soundsJson());
// sounds.json's first segments, plus damage (the Thorns sound, damage.thorns, is not a sounds.json event).
const prefixes=[...new Set([...Object.keys(sounds).map(k=>k.split('.')[0]),'damage'])].sort();
const soundLike=new RegExp(`^(${prefixes.join('|')})\\.[a-z0-9_.]*$`);
// SRG maps: class obf -> name, "cls/method desc" -> name.
const srg=(await readFile(path.join(research,'joined-1.7.10.srg'),'utf8')).split('\n');
const cls=new Map(),meth=new Map();
for(const l of srg){const p=l.split(' ');if(p[0]==='CL:')cls.set(p[1],p[2].split('/').pop());else if(p[0]==='MD:'){const [c,m]=[p[1].slice(0,p[1].lastIndexOf('/')),p[1].slice(p[1].lastIndexOf('/')+1)];meth.set(`${c}/${m}${p[2]}`,p[3].split('/').pop());}}
const tmp=await mkdtemp(path.join(os.tmpdir(),'snd-ev-'));
let text;
try{
  await exec('unzip',['-q','-o',jar,'*.class','-d',tmp],{maxBuffer:1<<24});
  const {stdout:list}=await exec('sh',['-c',`cd '${tmp}' && ls *.class`],{maxBuffer:1<<24});
  const names=list.split('\n').filter(Boolean).map(n=>n.replace(/\.class$/,'')).sort();
  const parts=[];
  for(let i=0;i<names.length;i+=300)parts.push((await exec('javap',['-c','-p','-s','-cp',tmp,...names.slice(i,i+300)],{maxBuffer:1<<30})).stdout);
  text=parts.join('\n');
}finally{await rm(tmp,{recursive:true,force:true});}
const nameOf=c=>cls.get(c)||c;
const rows=[],soundTypes=[];
let cur='',method=null,body=[],inSwitch=false;
const flush=()=>{if(!method)return;analyse();method=null;body=[];};
const sinkRe=/\(([^)]*)\)/;
function analyse(){
  const ins=body.filter(x=>x.case===undefined);
  // case table: target pc -> case ids (lookupswitch and tableswitch entries are in `body` as case rows)
  const caseAt=new Map();
  for(const c of body)if(c.case!==undefined)caseAt.set(c.target,[...(caseAt.get(c.target)||[]),c.case]);
  const targets=[...caseAt.keys()].sort((a,b)=>a-b);
  for(let i=0;i<ins.length;i++){
    const m=/^ldc\w*\s+#\d+\s+\/\/ String (.*)$/.exec(ins[i].text);if(!m)continue;
    const value=m[1];if(!soundLike.test(value))continue;
    let role='constant',call=null,window=[];
    for(let j=i+1;j<ins.length&&j<i+40;j++){
      const t=ins[j].text,op=t.split(/\s+/)[0];
      if(/^(areturn)$/.test(op)){role='return';break;}
      if(/^(putfield|putstatic)$/.test(op)){role='store';call=t.replace(/^.*\/\/ Field /,'');break;}
      if(/^invoke/.test(op)){
        const mm=/\/\/ (?:Interface)?Method (.*)$/.exec(t);const ref=mm?mm[1]:'';
        const d=/(\([^)]*\)\S*)$/.exec(ref);const desc=d?d[1]:'';
        if(/StringBuilder|java\/lang\/String\./.test(ref)){role='concat';window.push('+');continue;}
        if(/\[Ljava\/lang\/Object;/.test(desc)){role='lang';break;}
        if(/Ljava\/lang\/String;/.test(desc.split(')')[0])||/<init>/.test(ref)){role='call';const owner=/^"?[^:"]*\./.test(ref)?ref.replace(/^"?([^.:"]+)\..*/,'$1'):cur;call={owner:nameOf(owner),method:ref.replace(/:.*$/,'').replace(/^.*\./,'').replace(/"/g,''),desc,raw:ref};break;}
        window.push(op==='invokevirtual'&&/nextFloat|nextInt|nextDouble/.test(ref)?'rand.'+ref.replace(/:.*$/,'').replace(/^.*\./,''):'call');
        continue;
      }
      if(/^ldc/.test(op)){const f=/\/\/ (float|double|int) (\S+)$/.exec(t);window.push(f?f[2]:'ldc');}
      else if(/^(fmul|fadd|fsub|fdiv|dmul|dadd|imul|iadd|isub)$/.test(op))window.push(op);
      else if(/^(fconst_|dconst_|iconst_|bipush|sipush)/.test(op))window.push(t.replace(/^\w+\s*/,'')||op);
    }
    if(role==='return'&&/^func_145825_b|^func_70005_c_/.test(meth.get(`${cur}/${method.name}${method.desc}`)||''))role='lang';
    let cases;if(caseAt.size){const pc=ins[i].pc;const prior=targets.filter(x=>x<=pc);if(prior.length)cases=caseAt.get(prior[prior.length-1]);}
    const key=`${cur}/${method.name}${method.desc}`;
    const row={event:value,class:nameOf(cur),obf:cur,method:meth.get(key)||method.name,desc:method.desc,role};
    if(call)row.call=typeof call==='string'?call:call.owner+'.'+call.method+call.desc;
    if(role==='call'&&call&&typeof call!=='string')row.callRaw=call.raw;
    if(window.length)row.args=window.join(' ');
    if(cases)row.cases=cases;
    rows.push(row);
  }
  // Block.SoundType constructors: ldc name, ldc volume, ldc pitch, invokespecial SoundType.<init>(String,F,F)
  for(let i=0;i<ins.length;i++){
    const m=/^ldc\w*\s+#\d+\s+\/\/ String (\S*)$/.exec(ins[i].text);if(!m||soundLike.test(m[1]))continue;
    const a=ins[i+1]?.text,b=ins[i+2]?.text,c=ins[i+3]?.text;
    const fm=x=>/\/\/ float (\S+)$/.exec(x||'')?.[1]??(/^fconst_(\d)/.exec(x||'')?.[1]+'f');
    if(c&&/invokespecial.*Method (\w+)\."<init>":\(Ljava\/lang\/String;FF\)V/.test(c)&&/^ldc|^fconst/.test(a)&&/^ldc|^fconst/.test(b)){
      const owner=/Method (\w+)\./.exec(c)[1];if(/^Block\$/.test(nameOf(owner)))soundTypes.push({name:m[1],volume:fm(a),pitch:fm(b),class:nameOf(cur),obf:cur});
    }
  }
}
for(const line of text.split('\n')){
  let m;
  if((m=/^(?:public |final |abstract |protected |private )*(?:class|interface|enum) (\S+)/.exec(line))){flush();cur=m[1].replace(/<.*/,'');continue;}
  if((m=/^  (?:[a-z]+ )*(?:[\w$.<>\[\]]+ )?("?[\w$<>]+"?)\(.*\)(?: throws .*)?;$/.exec(line))||/^  static \{\};/.test(line)){
    flush();method={name:m?m[1].replace(/"/g,''):'<clinit>',desc:''};continue;
  }
  if(!method)continue;
  if((m=/^    descriptor: (\S+)/.exec(line))){method.desc=m[1];continue;}
  if(/^\s+\d+: (lookupswitch|tableswitch)/.test(line))inSwitch=true;
  else if(inSwitch&&/^\s+\}/.test(line))inSwitch=false;
  if(inSwitch&&(m=/^\s+(-?\d+): (\d+)$/.exec(line))){body.push({pc:-1,text:'case',case:+m[1],target:+m[2]});continue;}
  if(inSwitch&&(m=/^\s+default: /.exec(line)))continue;
  if((m=/^\s+(\d+): (.*)$/.exec(line))){body.push({pc:+m[1],text:m[2]});continue;}
}
flush();

const types=[...new Map(soundTypes.map(t=>[t.name+'|'+t.volume+'|'+t.pitch+'|'+t.obf,t])).values()];
const events=[...new Set(rows.filter(r=>r.role!=='lang').map(r=>r.event))].sort();
const defined=Object.keys(sounds).sort();
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',soundsJsonSha1:SOUNDS_SHA1,
  generator:'tools/build-sound-events-reference.mjs',
  note:'Every ldc string constant of the 1.7.10 client that matches a sounds.json event name or prefix. role: call = the next String-taking call (playSound family), return = a getLivingSound-style getter, concat = a name prefix built at run time, store = a field, constant = anything else. args = the instructions between the constant and the call.',
  soundsJsonEvents:defined,
  eventNames:events,
  notInSoundsJson:events.filter(e=>!sounds[e]&&!e.endsWith('.')),
  soundsJsonNeverNamed:defined.filter(e=>!events.includes(e)),
  soundTypes:types.sort((x,y)=>x.name<y.name?-1:1),
  rows:rows.sort((x,y)=>x.event<y.event?-1:x.event>y.event?1:(x.class+x.method)<(y.class+y.method)?-1:1)};
await writeFile(path.join(root,'../public/research/sound-events-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(`sound-events-reference.json: ${rows.length} rows, ${events.length} names, ${types.length} SoundType rows, ${reference.notInSoundsJson.length} names not in sounds.json, ${reference.soundsJsonNeverNamed.length} sounds.json events never named`);
