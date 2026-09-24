"""Contract/regression tests; fake Workbench, not an actual user installation."""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from bridge_core import WorkbenchReadAdapter, BridgeError
from capability_core import CapabilityEngine, SEARCH_ID, EXPORT_ID
from bridge_server import make_handler


class FakeWorkbench(BaseHTTPRequestHandler):
    state = {'version': '0.2.0', 'head': 'abc1234', 'dirty': False, 'content': '# source\nRoom and porch.', 'query': 'room'}
    def do_GET(self):
        u = urlsplit(self.path)
        q = parse_qs(u.query)
        s = self.state
        if u.path == '/api/bootstrap':
            data = {'version': s['version'], 'roots': [{'id':'static','path':'/SENSITIVE/HOME'}], 'session_token':'SENSITIVE-TOKEN'}
        elif u.path == '/api/repos':
            data = {'repos': [{'root_id':'static','relative_path':'room-repo','name':'room-repo','head':s['head'], 'dirty':s['dirty'], 'detached':False,'path':'/SENSITIVE/HOME/room-repo'}]}
        elif u.path == '/api/creator/sources':
            if q.get('root_id') != ['static'] or q.get('repo_path') != ['room-repo']:
                self.send_error(404);return
            text = s['content']
            hits = [{'root_id':'static','repo_path':'room-repo','source_path':'README.md','line':2,
                     'snippet':text,'file_sha256':hashlib.sha256(text.encode()).hexdigest(),
                     'head':s['head'], 'dirty':s['dirty']}] if s['query'] in q.get('query',[''])[0].lower() else []
            data = {'root_id':'static','repo_path':'room-repo','query':q['query'][0], 'hits':hits,'truncated':False,'files_examined':1,'source_kind':'local_worktree','authority':'none'}
        elif u.path == '/api/objects/inspect':
            data={'kind':'file','preview':s['content'],'size':len(s['content']), 'preview_truncated':False}
        else:
            self.send_error(404);return
        raw=json.dumps(data).encode()
        self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def log_message(self, *args): pass


class TestCapability(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.wb=ThreadingHTTPServer(('127.0.0.1',0),FakeWorkbench)
        cls.wb_thread=threading.Thread(target=cls.wb.serve_forever,daemon=True);cls.wb_thread.start()
        cls.adapter=WorkbenchReadAdapter(cls.wb.server_port)
        cls.engine=CapabilityEngine(cls.adapter,Path(cls.tmp.name))
        cls.room=ThreadingHTTPServer(('127.0.0.1',0),make_handler(cls.adapter,cls.engine))
        cls.room_thread=threading.Thread(target=cls.room.serve_forever,daemon=True);cls.room_thread.start()
        cls.url=f'http://127.0.0.1:{cls.room.server_port}'
    @classmethod
    def tearDownClass(cls):
        cls.room.shutdown();cls.wb.shutdown();cls.room.server_close();cls.wb.server_close();cls.tmp.cleanup()
    def setUp(self):
        FakeWorkbench.state={'version':'0.2.0','head':'abc1234','dirty':False,'content':'# source\nRoom and porch.', 'query':'room'}
        self.engine.pending.clear()
    def get(self,path,params=None,headers=None):
        url=self.url+path+(('?'+urlencode(params)) if params else '')
        with urlopen(Request(url,headers=headers or {})) as response:return json.load(response)
    def post(self,path,body,headers=None):
        h={'Content-Type':'application/json','X-Room-Action':'explicit-user-confirm'}
        h.update(headers or {})
        with urlopen(Request(self.url+path,data=json.dumps(body).encode(),headers=h,method='POST')) as response:return json.load(response)
    def prepare(self,operationId,inputs):
        return self.post('/api/room/capabilities/prepare', {'operationId':operationId,'inputs':inputs})
    def execute(self,p):
        return self.post('/api/room/capabilities/execute',{'ticket':p['ticket'],'approvedInputSha256':p['inputSha256'],'approval':'I approve this exact operation'})

    def test_descriptor_presence_is_not_execution_and_explicit_confirmation(self):
        d=self.get('/api/room/capabilities');self.assertEqual(len(d['capabilities']),2)
        self.assertNotIn('SENSITIVE-',str(d))
        before_outbox=len(list(self.engine.outbox.glob('*.md')) if self.engine.outbox.exists() else [])
        p=self.prepare(EXPORT_ID,{'title':'Porch note','content':'A new local trace','source':'static://song/example'})
        self.assertEqual(p['status'],'prepared-not-executed')
        self.assertEqual(len(list(self.engine.outbox.glob('*.md')) if self.engine.outbox.exists() else []), before_outbox)
        with self.assertRaises(HTTPError) as e:self.post('/api/room/capabilities/execute',{'ticket':p['ticket'],'approvedInputSha256':'bad','approval':'I approve this exact operation'})
        self.assertEqual(e.exception.code,403)
        with self.assertRaises(HTTPError) as e:self.execute(p)
        self.assertEqual(e.exception.code,410)

    def test_local_artifact_effect_receipt_replay_and_reentry(self):
        p=self.prepare(EXPORT_ID,{'title':'Porch note','content':'A new local trace','source':'static://song/example'})
        r=self.execute(p)
        self.assertEqual(r['disposition'],'completed')
        self.assertEqual(r['owner'],'the-static-collective/ROroomOM')
        path=self.engine.outbox/r['artifact']['filename']
        self.assertTrue(path.is_file())
        self.assertIn('A new local trace',path.read_text())
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),r['artifact']['sha256'])
        self.assertEqual(self.get('/api/room/capabilities/receipt',{'id':r['receiptId']}),r)
        with self.assertRaises(HTTPError) as e:self.execute(p)
        self.assertEqual(e.exception.code,410)
        self.assertEqual(sum(1 for f in self.engine.outbox.glob('*.md') if r['receiptId'] in f.name), 1)

    def test_workbench_project_native_search_and_changed_result_refusal(self):
        payload={'root_id':'static','repo_path':'room-repo','query':'room'}
        p=self.prepare(SEARCH_ID,payload)
        self.assertEqual(p['preview']['hitCount'],1)
        r=self.execute(p)
        self.assertEqual(r['disposition'],'completed')
        self.assertEqual(r['result']['hits'][0]['source_path'],'README.md')
        self.assertEqual(r['resultSha256'],p['preview']['resultSha256'])
        self.assertNotIn('SENSITIVE-TOKEN',str(r))
        p=self.prepare(SEARCH_ID,payload)
        FakeWorkbench.state['content']='Changed source and no longer identical'
        refused=self.execute(p)
        self.assertEqual(refused['disposition'],'refused')
        self.assertIn('changed',refused['reason'])
        self.assertEqual(self.get('/api/room/capabilities/receipt',{'id':refused['receiptId']})['disposition'],'refused')

    def test_dirty_version_and_unavailable_workbench(self):
        FakeWorkbench.state['dirty']=True
        with self.assertRaises(HTTPError) as e:self.prepare(SEARCH_ID,{'root_id':'static','repo_path':'room-repo','query':'room'})
        self.assertEqual(e.exception.code,409)
        FakeWorkbench.state['dirty']=False
        FakeWorkbench.state['version']='x.y'
        with self.assertRaises(HTTPError) as e:self.prepare(SEARCH_ID,{'root_id':'static','repo_path':'room-repo','query':'room'})
        self.assertEqual(e.exception.code,409)
        p=self.prepare(EXPORT_ID,{'title':'offline creation','content':'Works without Workbench'})
        self.assertEqual(self.execute(p)['disposition'],'completed')

    def test_http_cross_site_unknown_route_and_path_protection(self):
        with self.assertRaises(HTTPError) as e:self.post('/api/room/capabilities/prepare',{'operationId':EXPORT_ID,'inputs':{'title':'a','content':'b'}},headers={'Origin':'http://evil.test'})
        self.assertEqual(e.exception.code,403)
        with self.assertRaises(HTTPError) as e:self.post('/api/room/capabilities/prepare',{'operationId':EXPORT_ID,'inputs':{'title':'a','content':'b'}},headers={'Sec-Fetch-Site':'cross-site'})
        self.assertEqual(e.exception.code,403)
        with self.assertRaises(HTTPError) as e:self.post('/api/room/capabilities/prepare',{'operationId':'shell.exec','inputs':{'command':'rm -rf /'}})
        self.assertEqual(e.exception.code,400)
        with self.assertRaises(HTTPError) as e:self.post('/api/objects/inspect',{})
        self.assertEqual(e.exception.code,405)
        with self.assertRaises(HTTPError) as e:self.get('/api/room/capabilities',headers={'Host':'evil.test'})
        self.assertEqual(e.exception.code,403)
        with self.assertRaises(HTTPError) as e:self.get('/api/room/capabilities/receipt',{'id':'../x'})
        self.assertEqual(e.exception.code,400)

    def test_browser_offline_and_capability_workflow(self):
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            page=browser.new_page(viewport={'width':1160,'height':800})
            errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
            page.set_content((ROOT/'static-room.html').read_text())
            self.assertEqual(page.locator('#room005-deck').count(),1)
            page.select_option('#room005-kind',EXPORT_ID)
            page.fill('#room005-title','Scene receipt')
            page.fill('#room005-content','A source-linked scene draft to persist.')
            # Test-only HTTP transport: browser itself cannot navigate to loopback in this sandbox.
            def api(path,body,verb):
                try:
                    return self.post(path,body) if verb=='POST' else self.get(path,body)
                except HTTPError as exc:
                    return {'__error':json.loads(exc.read()).get('detail','HTTP error')}
            page.expose_function('testRoomApi',api)
            page.evaluate('''()=>{
              room005Post=async function(path,body){let r=await testRoomApi(path,body,'POST');if(r.__error)throw Error(r.__error);return r};
              room005Get=async function(path,body){let r=await testRoomApi(path,body||{},'GET');if(r.__error)throw Error(r.__error);return r};
            }''')
            page.click('#room005-prepare')
            self.assertIn('NOT executed',page.locator('#room005-status').inner_text())
            self.assertTrue(page.locator('#room005-execute').is_disabled())
            page.check('#room005-approval')
            page.click('#room005-execute')
            self.assertIn('COMPLETED',page.locator('#room005-status').inner_text())
            self.assertIn('scene-receipt.md',page.locator('#room005-outcome').inner_text())
            receipt_id=page.locator('#room005-receipt-id').input_value()
            self.assertEqual(len(receipt_id),32)
            page.click('#room005-inspect-receipt')
            self.assertIn('Retrieved from local receipt store',page.locator('#room005-status').inner_text())
            # Project a project-native read receipt into the Room without promoting source authority.
            page.select_option('#room005-kind',SEARCH_ID)
            page.click('#room005-load')
            page.select_option('#room005-repo',label='static / room-repo @ abc1234')
            page.fill('#room005-query','room')
            page.click('#room005-prepare')
            self.assertIn('hitCount',page.locator('#room005-preview').inner_text())
            page.check('#room005-approval')
            page.click('#room005-execute')
            self.assertIn('COMPLETED',page.locator('#room005-status').inner_text())
            page.click('#room005-pin-result')
            self.assertIn('Search · room-repo · room',page.locator('#screen h1').inner_text())
            self.assertIn('README.md:2',page.locator('[data-draft="trace"]').input_value())
            # A re-render should not consume the saved local Room field.
            page.locator('.left [data-view="sources"]').click()
            self.assertEqual(page.locator('#room005-deck').count(),1)
            mobile=browser.new_page(viewport={'width':390,'height':844})
            mobile.set_content((ROOT/'static-room.html').read_text())
            self.assertTrue(mobile.locator('body').evaluate('(el)=>el.scrollWidth<=innerWidth+1'))
            self.assertFalse(errs, errs)
            browser.close()


if __name__ == '__main__': unittest.main(verbosity=2)
