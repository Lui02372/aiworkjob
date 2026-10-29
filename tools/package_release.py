"""Package an explicit runtime allowlist; omit credentials, caches, and hosting identity."""
import hashlib,json,shutil,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
version=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
out=ROOT/'releases'/version
out.mkdir(parents=True,exist_ok=True)
apk=out/f'aiworkjob-{version}-android.apk'
shutil.copyfile(ROOT/'aiworkjob-debug.apk',apk)
webzip=out/f'aiworkjob-{version}-webapp.zip'
instructions='''aiworkjob 웹앱 실행 안내

1. ZIP의 압축을 모두 풉니다.
2. Node.js 24 이상을 설치합니다: https://nodejs.org/
3. Windows에서는 start-aiworkjob.bat을 실행합니다.
   다른 운영체제에서는 이 폴더에서 node server.mjs를 실행합니다.
4. http://127.0.0.1:8787 에 접속합니다.

index.html을 파일로 직접 열지 마세요. 공고 조회와 모집 상태 확인에는 서버와 인터넷이 필요합니다.
프로필과 작업은 현재 브라우저에 저장됩니다. 다른 기기에 자동 동기화되지 않습니다.
APK는 Android 8.0 이상용 개발 서명 테스트 앱입니다.
매칭 수락은 지원·채용 확정이 아니며 실제 결제·인출 기능은 연결되지 않았습니다.
'''
with zipfile.ZipFile(webzip,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name in ['package.json','server.mjs','api.mjs','start-aiworkjob.bat','README.md','aiworkjob-debug.apk']:
        z.write(ROOT/name,name)
    for path in sorted((ROOT/'web').rglob('*')):
        if path.is_file():z.write(path,path.relative_to(ROOT).as_posix())
    z.writestr('WEBAPP-START.txt',instructions.encode('utf-8-sig'))
checksums=[]
for path in [apk,webzip]:checksums.append(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}')
(out/'SHA256SUMS.txt').write_text('\n'.join(checksums)+'\n',encoding='ascii')
manifest={'version':version,'assets':[{'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [apk,webzip]],'android':{'minSdk':26,'signing':'local development debug key'},'web':{'node':'24+','start':'node server.mjs','url':'http://127.0.0.1:8787'}}
(out/'release-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'version':version,'directory':str(out),'assets':[p.name for p in out.iterdir()]},ensure_ascii=False))
