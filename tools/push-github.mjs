import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';import path from 'node:path';
const cwd=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(cmd,args)=>execFileSync(cmd,args,{cwd,stdio:'inherit'});
const output=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
if(output('status','--porcelain'))throw new Error('Commit reviewed changes first. This command does not stage or commit work automatically.');
const branch=output('branch','--show-current');if(!branch)throw new Error('Check out a branch before pushing.');
if(output('remote','get-url','github')!=='https://github.com/jhuang165/mc-web.git')throw new Error('Unexpected GitHub remote; inspect it before pushing.');
run('npm',['test']);run('python3',['-m','unittest','discover','-s','tools','-p','test_memory_bridge.py']);run('npm',['run','build']);run('git',['push','github','HEAD:refs/heads/'+branch]);
