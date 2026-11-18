"""Local stand-in for the DiT360 Hugging Face Space, speaking the same Gradio
queue protocol, so the text-to-360 flow can be tested without spending the
Space's small free GPU quota. A prompt containing "quota" gets the Space's real
quota error; anything else gets public/env/china_garden.jpg after a short wait.
  python3 tools/fake_dit360.py 8099
"""
import json, sys, time, pathlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
IMG = pathlib.Path(__file__).resolve().parent.parent / 'public/env/china_garden.jpg'
jobs = {}

class H(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'content-type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST')

    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()

    def json(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200); self.cors()
        self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        req = json.loads(self.rfile.read(n))
        jobs[req['session_hash']] = req
        print('join', req['fn_index'], req['data'], flush=True)
        self.json({'event_id': 'fake-' + req['session_hash']})

    def do_GET(self):
        if self.path.startswith('/config'):
            return self.json({'dependencies': [{'api_name': 'load_example', 'id': 0}, {'api_name': 'infer', 'id': 2}]})
        if self.path.startswith('/file/'):
            body = IMG.read_bytes()
            self.send_response(200); self.cors()
            self.send_header('Content-Type', 'image/jpeg'); self.send_header('Content-Length', str(len(body)))
            self.end_headers(); self.wfile.write(body); return
        if self.path.startswith('/gradio_api/queue/data'):
            sh = self.path.split('session_hash=')[1]
            req = jobs.get(sh, {'data': ['']})
            self.send_response(200); self.cors(); self.send_header('Content-Type', 'text/event-stream'); self.end_headers()
            def ev(o):
                self.wfile.write(f'data: {json.dumps(o)}\n\n'.encode()); self.wfile.flush()
            ev({'msg': 'estimation', 'rank': 0, 'queue_size': 1})
            time.sleep(1)
            ev({'msg': 'process_starts'})
            time.sleep(3)
            if 'quota' in req['data'][0]:
                ev({'msg': 'process_completed', 'success': False, 'output': {'error': 'You have exceeded your ZeroGPU quota (60s requested vs. 21s left). Try again in 23:48:34.', 'title': 'ZeroGPU quota exceeded'}})
            else:
                ev({'msg': 'process_completed', 'success': True, 'output': {'data': [{'path': '/tmp/x.webp', 'url': f'http://localhost:{PORT}/file/out.jpg'}]}})
            ev({'msg': 'close_stream'})
            return
        self.send_response(404); self.end_headers()

ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
