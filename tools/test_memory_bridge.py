import json,subprocess,sys,tempfile,unittest
from pathlib import Path
from memory_bridge import Bridge
class MemoryTests(unittest.TestCase):
 def setUp(self):self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.a=Bridge(self.root);self.b=Bridge(self.root)
 def tearDown(self):self.a.db.close();self.b.db.close();self.temp.cleanup()
 def test_shared_notes_and_revisions(self):
  note=self.a.write_note('test','codex','first');self.assertEqual(self.b.read_note('test')['content'],'first')
  with self.assertRaises(ValueError):self.b.write_note('test','claude','stale')
  self.b.write_note('test','claude','updated',note['revision']);self.assertEqual(self.a.read_note('test')['content'],'updated')
 def test_overlapping_claims_and_handoff(self):
  c=self.a.claim_work('codex','UI',['src/ui']);
  with self.assertRaises(ValueError):self.b.claim_work('claude','same',['src/ui/file.js'])
  d=self.b.claim_work('claude','other',['src/mining.js']);self.assertEqual(len(self.a.claims()),2)
  with self.assertRaises(ValueError):self.b.finish_work('claude',c['id'],'wrong owner')
  self.a.finish_work('codex',c['id'],'UI complete; tests passed');self.assertEqual(len(self.b.claims()),1)
  self.assertIn('UI complete',self.b.read_note('handoff_'+c['id'])['content'])
 def test_path_boundaries(self):
  with self.assertRaises(ValueError):self.a.write_note('../outside','codex','bad')
  with self.assertRaises(ValueError):self.a.claim_work('codex','bad',['../outside'])
 def test_expired_claim_can_be_reclaimed(self):
  c=self.a.claim_work('codex','old',['src']);self.a.db.execute('UPDATE claims SET expires=0 WHERE id=?',(c['id'],));self.assertTrue(self.b.claim_work('claude','new',['src'])['id'])
 def test_stdio_protocol(self):
  calls=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2024-11-05'}},{'jsonrpc':'2.0','id':2,'method':'tools/list'},{'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'write_note','arguments':{'name':'wire','owner':'claude','content':'roundtrip'}}}]
  result=subprocess.run([sys.executable,str(Path(__file__).with_name('memory_bridge.py')),'--root',str(self.root)],input='\n'.join(map(json.dumps,calls))+'\n',text=True,capture_output=True,check=True)
  messages=list(map(json.loads,result.stdout.splitlines()));self.assertEqual(len(messages),3);self.assertEqual(len(messages[1]['result']['tools']),6);self.assertEqual(self.a.read_note('wire')['content'],'roundtrip')
if __name__=='__main__':unittest.main()
