import {spawnSync} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=['-c','mcp_servers.mc-web-memory.command="python3"','-c','mcp_servers.mc-web-memory.args='+JSON.stringify([path.join(root,'tools/memory_bridge.py')]),'-c','mcp_servers.mc-web-memory.cwd='+JSON.stringify(root)];
const check=process.argv.includes('--check');args.push(...(check?['mcp','get','mc-web-memory','--json']:process.argv.slice(2)));
const result=spawnSync('codex',args,{cwd:root,stdio:'inherit'});if(result.error)throw result.error;process.exit(result.status??1);
