"""Start/stop only our injected Node fixture; reuse the installed Chrome and Playwright."""
import json,os,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class FixtureServer:
 def __enter__(self):
  self.process=subprocess.Popen(['node','tests/fixture-server.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
  line=self.process.stdout.readline()
  if not line:raise AssertionError(self.process.stderr.read())
  ready=json.loads(line);assert ready['ready'];self.url=ready['url']+'/';return self
 def command(self,**command):
  self.process.stdin.write(json.dumps(command)+'\n');self.process.stdin.flush();ack=json.loads(self.process.stdout.readline());assert ack['ack']==command['command']
 def __exit__(self,*args):
  if self.process.poll() is None:
   self.process.stdin.write('{"command":"stop"}\n');self.process.stdin.flush()
   try:self.process.wait(timeout=10)
   except subprocess.TimeoutExpired:self.process.terminate();self.process.wait(timeout=10)
  self.process.stdin.close();self.process.stdout.close();self.process.stderr.close()

def report(filename,checks):
 output={'status':'passed','version':json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version'],'checks':checks,'count':len(checks),'environment':'isolated mocked providers; no real charge, model invocation, bank account or income','checkedAt':time.strftime('%Y-%m-%dT%H:%M:%S')}
 (ROOT/'artifacts').mkdir(exist_ok=True);(ROOT/'artifacts'/filename).write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'status':'passed','checks':len(checks)}))
