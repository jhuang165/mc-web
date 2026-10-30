#!/usr/bin/env python3
"""Configure only this project for Claude Code and Codex; never edit global settings."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LOADER="import os,runpy;from pathlib import Path;p=Path(os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd());p=p if (p/'tools/memory_bridge.py').is_file() else p/'game';runpy.run_path(str(p/'tools/memory_bridge.py'),run_name='__main__')"
def configure(folder):
    folder=Path(folder);mcp=folder/'.mcp.json';data=json.loads(mcp.read_text()) if mcp.exists() else {};data.setdefault('mcpServers',{})['mc-web-memory']={'type':'stdio','command':'python3','args':['-c',LOADER]};mcp.write_text(json.dumps(data,indent=2)+'\n')
    cfg=folder/'.codex/config.toml';cfg.parent.mkdir(exist_ok=True);text=cfg.read_text() if cfg.exists() else ''
    entry='[mcp_servers.mc-web-memory]\ncommand = "python3"\nargs = ['+json.dumps(str(ROOT/'tools/memory_bridge.py'))+']\ncwd = '+json.dumps(str(ROOT))+'\nstartup_timeout_sec = 10\ntool_timeout_sec = 30\n'
    text=re.sub(r'(?ms)^\[mcp_servers\.mc-web-memory\]\n.*?(?=^\[|\Z)','',text);cfg.write_text(text.rstrip()+'\n\n'+entry)
    print('Configured project MCP:',folder)
if __name__=='__main__':
    configure(ROOT)
    if ROOT.name=='game' and (ROOT.parent/'game').resolve()==ROOT and (ROOT.parent/'.git').exists():configure(ROOT.parent)
