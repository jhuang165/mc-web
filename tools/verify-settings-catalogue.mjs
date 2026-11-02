// Inventory original GameSettings options, defaults, key bindings, sound categories and option-screen layouts. Requires local JDK/client JAR, joined-1.7.10.srg and Guava/log4j-api/commons-lang3/Gson libraries.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'settings-catalogue-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','gson-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
const mappings=await readFile(path.join(research,'joined-1.7.10.srg'),'utf8');
const classMap=new Map([...mappings.matchAll(/^CL: (\S+) (\S+)$/gm)].map(m=>[m[1],m[2]]));
const fieldMap=new Map([...mappings.matchAll(/^FD: (\S+)\/(\S+) \S+\/(\S+)$/gm)].map(m=>[m[1]+'/'+m[2],m[3]]));
const mc=name=>classMap.get(name)??name,fd=(cls,f)=>fieldMap.get(cls+'/'+f)??null;

// Native execution: unchanged static initializers + GameSettings(null, absentFile).
const stubs=(await readdir(path.join(root,'probes/stubs'),{recursive:true})).filter(n=>n.endsWith('.java')).sort().map(n=>path.join(root,'probes/stubs',n));
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/CatalogueProbe.java'),path.join(root,'probes/SettingsProbe.java'),...stubs]);
const {stdout}=await exec('java',['-Djava.awt.headless=true','-cp',cp,'SettingsProbe',out],{maxBuffer:1<<24});
const records=stdout.trim().split('\n').map(JSON.parse);
const byKind=kind=>records.filter(r=>r.kind===kind).map(({kind,...r})=>r);

// Bytecode reading: save/load order and screen widget order.
async function methods(cls){
 const text=(await exec('javap',['-p','-c','-constants','-classpath',jar,cls],{maxBuffer:1<<26})).stdout;
 const result=new Map();let current=null;
 for(const line of text.split('\n')){
  if(/^  \S.*\);$/.test(line)||/^  static \{\};$/.test(line)){current=line.trim();result.set(current,[]);}
  else if(current)result.get(current).push(line);
 }
 return result;
}
const gs=await methods('bbj');
const body=sig=>{const m=gs.get(sig);assert(m,'missing '+sig);return m.join('\n');};
const saveBody=body('public void b();'),loadBody=body('public void a();');
const saveOrder=[];
{
 let key=null;
 for(const line of saveBody.split('\n')){
  let m=line.match(/ldc\s+#\d+\s+\/\/ String (\w+):$/);
  if(m){key=m[1];continue;}
  m=line.match(/ldc\s+#\d+\s+\/\/ String (key_|soundCategory_)$/);
  if(m){saveOrder.push({key:m[1]+'*',field:null,note:m[1]==='key_'?'one line per keyBindings entry: key_<description>:<keycode>':'one line per SoundCategory: soundCategory_<name>:<volume>'});continue;}
  m=line.match(/getfield\s+#\d+\s+\/\/ Field (\w+):/);
  if(m&&key){saveOrder.push({key,field:m[1]});key=null;}
 }
}
const saveKeys=new Set(saveOrder.map(r=>r.key));
const loadOrder=[];
{
 let key=null;
 for(const line of loadBody.split('\n')){
  const m=line.match(/ldc\s+#\d+\s+\/\/ String (\w+_?)$/);
  if(m&&(saveKeys.has(m[1])||saveKeys.has(m[1]+'*'))){key=m[1];continue;}
  const p=line.match(/putfield\s+#\d+\s+\/\/ Field (\w+):/);
  if(p&&key){if(!loadOrder.some(r=>r.key===key))loadOrder.push({key,field:p[1]});key=null;}
 }
}
const loadStarWild=[...loadBody.matchAll(/String (key_|soundCategory_)\n/g)].map(m=>m[1]);
assert.deepEqual(loadStarWild,['key_','soundCategory_']);
const loadSimple=loadOrder.map(r=>r.key),saveSimple=saveOrder.filter(r=>!r.key.endsWith('*')).map(r=>r.key);
for(const r of [...saveOrder,...loadOrder])r.srgField=r.field?fd('bbj',r.field):null;
const fieldToKey=new Map(saveOrder.filter(r=>r.field).map(r=>[r.field,r.key]));
// ao is read via three branches (true/false/int); fov/other keys keep the first putfield.
assert(saveSimple.length>=50);

const fieldsRecord=byKind('gameSettingsFields')[0].fields;
const settingsFields=Object.entries(fieldsRecord).map(([obf,value])=>({obfField:obf,srgField:fd('bbj',obf),optionsKey:fieldToKey.get(obf)??null,defaultValue:value}));
const options=byKind('option').map(o=>({...o,mappedConstant:fd('bbm',o.name)??o.name}));
const keyBindings=byKind('keyBinding'),hotbar=byKind('hotbarKey'),keyFields=byKind('keyField').map(r=>({...r,srgField:fd('bbj',r.field)}));
// The probe constructs two GameSettings (64-bit and 32-bit JVM flag), so the static registration list holds two identical runs.
const registrationAll=byKind('keyRegistration');
assert.equal(registrationAll.length,keyBindings.length*2);
const keyRegistrationOrder=registrationAll.slice(0,keyBindings.length);
assert.deepEqual(registrationAll.slice(keyBindings.length).map(r=>r.description),keyRegistrationOrder.map(r=>r.description));
const soundCategories=byKind('soundCategory');
const valueSetNames={aP:'GUI_SCALES',aQ:'PARTICLES',aR:'AMBIENT_OCCLUSION',aS:'STREAM_COMPRESSION',aT:'STREAM_CHAT_ENABLED',aU:'STREAM_CHAT_USER_FILTER',aV:'STREAM_MIC_TOGGLE_BEHAVIOR'};
const valueSets=byKind('valueSet').map(r=>({...r,srgField:fd('bbj',r.field),role:valueSetNames[r.field]}));
const enums=byKind('enum').map(r=>({...r,mappedClass:mc(r.class)}));
const screenArrays=byKind('screenArray').map(r=>({...r,mappedClass:mc(r.class),srgField:fd(r.class,r.field)}));

// Widget order for each settings screen: ordered string constants and constructed widget classes in initGui (b()).
const screenClasses=['bdm','bef','bcs','bec','bew','bdj','bea','bgf'];
const screenLayouts=[];
for(const cls of screenClasses){
 const m=await methods(cls);
 const init=[...m].find(([sig])=>sig==='public void b();'||sig==='public void c();');
 const events=[];
 if(init)for(const line of init[1]){
  let x=line.match(/ldc\s+#\d+\s+\/\/ String (.+)$/);
  if(x){events.push({string:x[1]});continue;}
  x=line.match(/\bnew\s+#\d+\s+\/\/ class (\S+)$/);
  if(x){const n=mc(x[1]);if(/\/(Gui|ScreenChat)/.test(n)||/GuiOption/.test(n))events.push({widget:n});continue;}
  x=line.match(/invokestatic\s+#\d+\s+\/\/ Method (?:bbm\.values|net\/minecraft\S+\.values)/);
  if(x)events.push({call:'Options.values'});
 }
 const draw=[...m].find(([sig])=>sig==='public void a(int, int, float);');
 const drawn=draw?[...draw[1].join('\n').matchAll(/ldc\s+#\d+\s+\/\/ String (.+)$/gm)].map(r=>r[1]):[];
 screenLayouts.push({class:cls,mappedClass:mc(cls),initMethod:init?init[0]:null,initEvents:events,drawStrings:drawn});
}

// Display-string and cycle constants read from getKeyBinding (c) and setOptionValue (a(Options,int)); not executed (needs I18n/GL).
const strings=sig=>[...new Set([...body(sig).matchAll(/ldc\s+#\d+\s+\/\/ String (.+)$/gm)].map(m=>m[1]))];
const optionDisplayStrings=strings('public java.lang.String c(bbm);'),optionCycleStrings=strings('public void a(bbm, int);');
assert(optionDisplayStrings.includes('options.graphics.fancy')&&optionDisplayStrings.includes('options.graphics.fast'));

// Mouse look and sound gain constants (bytecode-read, not executed): EntityRenderer (blt) updateRenderer d()
// and updateCameraAndRender b(float), MouseFilter (qm), Entity.setAngles (sa.c(FF)), SoundManager (btj),
// and the smoothCamera toggle in Minecraft.runTick (bao).
const code=(cls,ms,sig)=>{const m=ms.get(sig);assert(m,`missing ${cls} ${sig}`);return m.join('\n');};
const numbers=text=>[...text.matchAll(/\/\/ (float|double) (-?[\d.E-]+)[fd]$/gm)].map(m=>Number(m[2]));
const ops=text=>[...text.matchAll(/^\s+\d+: (\w+)/gm)].map(m=>m[1]);
const blt=await methods('blt'),qm=await methods('qm'),sa=await methods('sa'),btj=await methods('btj'),bao=await methods('bao');
const tick=code('blt',blt,'public void d();'),render=code('blt',blt,'public void b(float);');
const smoothTick=tick.slice(tick.indexOf('bbj.aB:Z'),tick.lastIndexOf('Method qm.a:(FF)F'));
assert.deepEqual(numbers(smoothTick),[0.6,0.2,8,0.05,0.05]);
assert.match(render,/bbj\.b:Z\n\s+\d+: ifeq\s+\d+\n\s+\d+: iconst_m1/);
const mouseRead=render.slice(render.indexOf('Method bbg.c:()V'),render.indexOf('Method qi.b:()V',render.indexOf('Method bbg.c:()V')));
assert.deepEqual(numbers(mouseRead),[0.6,0.2,8]);
assert.equal((mouseRead.match(/Method bjk\.c:\(FF\)V/g)||[]).length,2);
const filter=code('qm',qm,'public float a(float, float);'),angles=code('sa',sa,'public void c(float, float);');
assert.deepEqual(numbers(filter),[0.5]);
assert.deepEqual(numbers(angles),[0.15,0.15,-90,-90,90,90]);
assert.deepEqual(ops(angles).filter(o=>o==='dadd'||o==='dsub'),['dadd','dsub']);
const catVolume=code('btj',btj,'private float a(w);'),normVolume=code('btj',btj,'private float a(bst, bti, w);'),normPitch=code('btj',btj,'private float a(bst, bti);'),play=code('btj',btj,'public void c(bst);');
assert.match(catVolume,/getstatic\s+#\d+\s+\/\/ Field w\.a:Lw;\n\s+\d+: if_acmpne\s+\d+\n\s+\d+: fconst_1/);
assert.deepEqual(ops(normVolume).filter(o=>/^d(const|mul)/.test(o)),['dmul','dmul','dconst_0','dconst_1']);
assert.deepEqual(numbers(normPitch),[0.5,2]);
assert.deepEqual(numbers(play),[16]);
assert.match(play,/float 16\.0f\n\s+\d+: fstore\s+5\n\s+\d+: fload\s+4\n\s+\d+: fconst_1\n\s+\d+: fcmpl\n\s+\d+: ifle\s+\d+\n\s+\d+: fload\s+5\n\s+\d+: fload\s+4\n\s+\d+: fmul/);
const toggles=[...bao].filter(([,lines])=>lines.some(l=>/putfield\s+#\d+\s+\/\/ Field bbj\.aB:Z/.test(l)));
assert.equal(toggles.length,1);
assert.match(toggles[0][1].join('\n'),/Field bbj\.al:Lbal;\n\s+\d+: invokevirtual\s+#\d+\s+\/\/ Method bal\.f:\(\)Z\n\s+\d+: ifeq[\s\S]{0,400}putfield\s+#\d+\s+\/\/ Field bbj\.aB:Z/);
const f8Checks=[...bao.values()].flat().filter(l=>/bipush\s+66$/.test(l)).length;
const controls={
 mouseLook:{sensitivityCurve:{scale:0.6,offset:0.2,cubeFactor:8},smoothFilterFactor:0.05,invertMultiplier:-1,setAnglesDegreesPerUnit:0.15,pitchClamp:[-90,90],yawAdds:true,pitchSubtracts:true,
  mouseFilterHalf:numbers(filter)[0],mouseFilterOps:ops(filter),smoothCameraToggle:{method:toggles[0][0],keyField:fd('bbj','al'),lwjglF8Checks:f8Checks}},
 sound:{categoryVolumeMasterIsOne:true,normalizedVolumeClamp:[0,1],normalizedPitchClamp:numbers(normPitch),attenuationDistance:16,attenuationDistanceScalesAboveVolume:1},
};
// en_US.lang (in the client JAR) strings for options, key bindings, sound categories and value sets.
const langText=(await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout;
const langAll=new Map(langText.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const langKeys=[...new Set([...options.map(o=>o.translationKey),...keyBindings.map(k=>k.description),...keyBindings.map(k=>k.category),...soundCategories.map(c=>'soundCategory.'+c.key),...valueSets.flatMap(v=>v.values),...optionDisplayStrings,...optionCycleStrings,...screenLayouts.flatMap(s=>s.initEvents.map(e=>e.string).filter(Boolean))])].filter(k=>langAll.has(k)).sort();
const lang=Object.fromEntries(langKeys.map(k=>[k,langAll.get(k)]));
assert.equal(lang['options.invertMouse'],'Invert Mouse');
assert.equal(lang['key.smoothCamera'],'Toggle Cinematic Camera');
const providers=['bbj','bbm','bal','w','rd','zb','bef','bcs','bdm','bew','bec','bdj','bea','bgf','blt','qm','sa','btj','bao'];
const classHashes=Object.fromEntries(await Promise.all(providers.map(async c=>[c,{mappedName:mc(c),sha256:createHash('sha256').update(await readFile(path.join(classes,c+'.class'))).digest('hex')}])));
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',mappingSha256:createHash('sha256').update(mappings).digest('hex'),classes:classHashes,
 method:'Native-executed: GameSettings.Options enum static initialization (ordinal/name/translation key/flags/min/max/step and the slider normalize/denormalize/snap methods), the unchanged GameSettings constructor headlessly with a null Minecraft instance and an absent options file (so loadOptions finds no file and every field keeps its constructor default; no log output), all constructor-created KeyBindings in the keyBindings, hotbar and static registration lists, SoundCategory constants and constructed volumes, GameSettings private string value arrays, EnumDifficulty and EnumChatVisibility constants, and the static option arrays of GuiVideoSettings, ScreenChatOptions, GuiOptions and GuiControls. Bytecode-read (javap, not executed): saveOptions/loadOptions key order and field binding, and the ordered string constants/widget classes in each option screen initGui and draw method. No GUI constructors, GL, audio, I18n/lang resources or Minecraft instance run, so localized display strings, the English controls-screen sort order (category and description are sorted by localized text), widget coordinates, and per-click cycling arithmetic are not executed. Enumeration is not whole-feature verification.',
 options,renderDistanceByJvm:byKind('renderDistanceByJvm')[0],gameSettingsFields:settingsFields,valueSets,enums,soundCategories,keyBindings,hotbarKeys:hotbar,keyFields,keyRegistrationOrder,keyCategoryHashSet:byKind('keyCategories')[0].hashSetIterationOrder,
 screenArrays,screenLayouts,optionsFile:{saveOrder,loadOrder},optionDisplayStrings,optionCycleStrings,
 controlsMethod:'Bytecode-read (javap, not executed): EntityRenderer.updateRenderer smooth-camera filter constants, updateCameraAndRender sensitivity curve/invert sign/two setAngles calls, MouseFilter.smooth, Entity.setAngles constants and add/subtract, SoundManager getSoundCategoryVolume/getNormalizedVolume/getNormalizedPitch clamps and the playSound attenuation distance, and the single smoothCamera toggle in Minecraft (keyBindSmoothCamera, LWJGL F8 checks counted). The sound library attenuation curve is outside the JAR. lang holds en_US.lang values from the JAR for the keys referenced above.',
 controls,lang};
assert.equal(options.length,options.at(-1).ordinal+1);
await writeFile(path.join(root,'../public/research/settings-reference.json'),JSON.stringify(reference,null,2)+'\n');
console.log(JSON.stringify({options:options.length,float:options.filter(o=>o.isFloat).length,boolean:options.filter(o=>o.isBoolean).length,keyBindings:keyBindings.length,hotbar:hotbar.length,soundCategories:soundCategories.length,screens:screenLayouts.length,saveKeys:saveSimple.length,loadKeys:loadSimple.length}));
