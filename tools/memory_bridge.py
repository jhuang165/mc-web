#!/usr/bin/env python3
"""Project-scoped stdio MCP memory bridge. Python stdlib only; no network."""
import argparse, hashlib, json, os, re, sqlite3, subprocess, sys, time, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def schema(**props):
    return {'type':'object','properties':props,'additionalProperties':False}
TEXT={'type':'string'}
TOOLS=[
 ('get_context','Read the shared project handoff, latest notes, active work claims and Git status.',schema(),[]),
 ('list_notes','List shared project notes and their revision hashes.',schema(),[]),
 ('read_note','Read a named shared note before updating it.',schema(name=TEXT),['name']),
 ('write_note','Create a note or update one with its expected revision; writes only shared-memory notes.',schema(name=TEXT,owner=TEXT,content=TEXT,expected_revision=TEXT),['name','owner','content']),
 ('claim_work','Atomically claim relative file paths before editing. Overlapping live claims are rejected.',schema(owner=TEXT,summary=TEXT,paths={'type':'array','items':TEXT,'minItems':1},ttl_seconds={'type':'integer','minimum':60,'maximum':7200}),['owner','summary','paths']),
 ('finish_work','Release an owned work claim and leave a durable handoff note.',schema(owner=TEXT,claim_id=TEXT,summary=TEXT),['owner','claim_id','summary']),
]

class Bridge:
    def __init__(self,root):
        self.root=Path(root).resolve();self.memory=self.root/'.shared-memory';self.notes=self.memory/'notes';self.notes.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(self.memory/'runtime.sqlite3',timeout=15,isolation_level=None)
        self.db.execute('CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY, owner TEXT, summary TEXT, paths TEXT, expires REAL, status TEXT)')
    def note_path(self,name):
        if not isinstance(name,str) or not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,63}',name):raise ValueError('Use a lowercase note name with letters, digits, underscores or hyphens.')
        p=self.notes/(name+'.md')
        if p.is_symlink() or p.resolve().parent!=self.notes.resolve():raise ValueError('Note path must stay within shared-memory notes.')
        return p
    def read_note(self,name):
        p=self.note_path(name);content=p.read_text();return {'name':name,'content':content,'revision':hashlib.sha256(content.encode()).hexdigest()}
    def list_notes(self):
        return [{k:v for k,v in self.read_note(p.stem).items() if k!='content'} for p in sorted(self.notes.glob('*.md'),key=lambda p:p.stat().st_mtime) if not p.is_symlink()]
    def write_note(self,name,owner,content,expected_revision=None):
        if not owner or len(owner)>80 or not isinstance(content,str) or len(content.encode())>65536:raise ValueError('Owner is required (max 80 characters); content is limited to 64 KiB.')
        p=self.note_path(name);self.db.execute('BEGIN IMMEDIATE')
        try:
            if p.exists() and self.read_note(name)['revision']!=expected_revision:raise ValueError('Note changed or expected_revision missing. Read it again before updating.')
            if not p.exists() and expected_revision:raise ValueError('Expected revision supplied for a missing note.')
            temp=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');temp.write_text(content);os.replace(temp,p);self.db.execute('COMMIT')
        except Exception:self.db.execute('ROLLBACK');raise
        return self.read_note(name)
    def claims(self):
        self.db.execute("UPDATE claims SET status='expired' WHERE status='active' AND expires<=?",(time.time(),))
        return [dict(id=r[0],owner=r[1],summary=r[2],paths=json.loads(r[3]),expires=r[4]) for r in self.db.execute("SELECT id,owner,summary,paths,expires FROM claims WHERE status='active'")]
    def claim_work(self,owner,summary,paths,ttl_seconds=1800):
        if not owner or not summary or not paths or len(paths)>64:raise ValueError('Provide owner, summary and up to 64 relative paths.')
        checked=[]
        for p in paths:
            if not isinstance(p,str) or not p or Path(p).is_absolute() or '..' in Path(p).parts:raise ValueError('Claim paths must be project-relative and cannot contain ..')
            checked.append(p.rstrip('/'))
        self.db.execute('BEGIN IMMEDIATE')
        try:
            for c in self.claims():
                if any(a==b or a.startswith(b+'/') or b.startswith(a+'/') for a in checked for b in c['paths']):raise ValueError('Overlapping work is already claimed: '+json.dumps(c))
            claim=dict(id=uuid.uuid4().hex,owner=owner,summary=summary,paths=checked,expires=time.time()+max(60,min(7200,int(ttl_seconds))))
            self.db.execute("INSERT INTO claims VALUES (?,?,?,?,?,'active')",(claim['id'],owner,summary,json.dumps(checked),claim['expires']));self.db.execute('COMMIT');return claim
        except Exception:self.db.execute('ROLLBACK');raise
    def finish_work(self,owner,claim_id,summary):
        row=self.db.execute("SELECT owner,status FROM claims WHERE id=?",(claim_id,)).fetchone()
        if not row or row[0]!=owner or row[1]!='active':raise ValueError('No active claim owned by this agent.')
        note=self.write_note('handoff_'+claim_id,owner,summary)
        self.db.execute("UPDATE claims SET status='finished' WHERE id=? AND owner=?",(claim_id,owner));return note
    def get_context(self):
        def git(*args):
            try:return subprocess.check_output(['git','-C',str(self.root),*args],text=True,stderr=subprocess.DEVNULL,timeout=5).strip()
            except (OSError,subprocess.SubprocessError):return ''
        p=self.memory/'PROJECT.md'
        return {'project':p.read_text() if p.exists() else '', 'notes':[self.read_note(n['name']) for n in self.list_notes()[-8:]],'active_claims':self.claims(),'git':{'branch':git('branch','--show-current'),'commit':git('rev-parse','HEAD'),'status':git('status','--short')},'limits':'Claims coordinate this checkout only; notes sync between clones through Git. Claims are advisory, not filesystem locks.'}
    def call(self,name,args):
        if name not in {t[0] for t in TOOLS}:raise ValueError('Unknown memory tool.')
        return getattr(self,name)(**args)

def serve(bridge):
    for line in sys.stdin:
        request=None
        try:
            request=json.loads(line);method=request.get('method','');rid=request.get('id');params=request.get('params') or {}
            if rid is None:continue
            if method=='initialize':result={'protocolVersion':params.get('protocolVersion','2024-11-05'),'capabilities':{'tools':{},'resources':{}},'serverInfo':{'name':'mc-web-memory','version':'1.0.0'},'instructions':'Read get_context, claim file scopes before editing, leave a handoff with tests/results, then commit and push reviewed changes. Never store credentials in notes.'}
            elif method=='ping':result={}
            elif method=='tools/list':result={'tools':[{'name':n,'description':d,'inputSchema':dict(s,required=r),'annotations':{'readOnlyHint':n in ['get_context','list_notes','read_note'],'destructiveHint':False}} for n,d,s,r in TOOLS]}
            elif method=='tools/call':
                try:
                    value=bridge.call(params['name'],params.get('arguments',{}));result={'content':[{'type':'text','text':json.dumps(value)}],'structuredContent':value if isinstance(value,dict) else {'items':value},'isError':False}
                except Exception as e:result={'content':[{'type':'text','text':str(e)}],'isError':True}
            elif method=='resources/list':result={'resources':[{'uri':'mcweb://context','name':'Shared project context','mimeType':'application/json'}]}
            elif method=='resources/read':
                if params.get('uri')!='mcweb://context':raise ValueError('Unknown resource.')
                result={'contents':[{'uri':'mcweb://context','mimeType':'application/json','text':json.dumps(bridge.get_context())}]}
            elif method=='prompts/list':result={'prompts':[]}
            else:
                print(json.dumps({'jsonrpc':'2.0','id':rid,'error':{'code':-32601,'message':'Method not found'}}),flush=True);continue
            print(json.dumps({'jsonrpc':'2.0','id':rid,'result':result}),flush=True)
        except Exception as e:
            print(json.dumps({'jsonrpc':'2.0','id':request.get('id') if isinstance(locals().get('request'),dict) else None,'error':{'code':-32603,'message':str(e)}}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=ROOT);parser.add_argument('--context',action='store_true');args=parser.parse_args();bridge=Bridge(args.root)
    if args.context:print(json.dumps(bridge.get_context(),indent=2))
    else:serve(bridge)
