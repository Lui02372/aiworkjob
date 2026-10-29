export const TOOLS = ['ChatGPT','Claude','Canva','Midjourney','Runway','CapCut','Make','n8n','Cursor','Figma'];
export const CATEGORIES = ['전체','콘텐츠·마케팅','디자인','영상','자동화·개발','리서치·데이터'];
export const SKILLS = ['콘텐츠 작성','디지털 마케팅','그래픽 디자인','영상 편집','웹 개발','업무 자동화','리서치','데이터 분석'];
export const LEVELS = ['입문','실무','전문'];
export const COUNTRIES = ['South Korea','United States','United Kingdom','Canada','Australia','Japan','Germany'];
export const TOOL_LINKS = {ChatGPT:'https://chatgpt.com/',Claude:'https://claude.ai/',Canva:'https://www.canva.com/',Midjourney:'https://www.midjourney.com/',Runway:'https://app.runwayml.com/',CapCut:'https://www.capcut.com/',Make:'https://www.make.com/',n8n:'https://n8n.io/workflows/',Cursor:'https://cursor.com/',Figma:'https://www.figma.com/'};
export const TRACKS = {
  '콘텐츠·마케팅':{skills:['콘텐츠 작성','디지털 마케팅'],tools:['ChatGPT','Claude','Canva'],keywords:['content','marketing','copywriter','seo','social media','growth'],output:'캠페인 페이지',steps:['공고의 담당 업무와 경력 요건 확인','공개 가능한 브랜드 자료와 AI 사용 범위 확인','캠페인 목표·문구·화면 구성안 작성','원문 사실관계와 이미지 권리를 검토한 뒤 납품']},
  '디자인':{skills:['그래픽 디자인'],tools:['Figma','Canva','Midjourney'],keywords:['designer','design','graphic','visual','creative'],output:'디자인 시안 페이지',steps:['브랜드 가이드와 디자인 요구사항 확인','레퍼런스·이미지 사용 권리 확인','시안 제작과 모바일 화면 검토','원본 파일·수정 범위·사용권 안내와 함께 납품']},
  '영상':{skills:['영상 편집'],tools:['Runway','CapCut'],keywords:['video','editor','motion','animation'],output:'영상 스토리보드',steps:['영상 목적·길이·화면 비율 확인','촬영본·음원·AI 사용 권한 확인','장면별 구성과 자막 초안 작성','최종 영상과 편집 원본을 함께 검수']},
  '자동화·개발':{skills:['웹 개발','업무 자동화'],tools:['Cursor','Claude','n8n','Make'],keywords:['engineer','developer','software','automation','full stack','frontend','front-end','python','javascript','react'],output:'웹·앱 화면 시안',steps:['필수 기술·업무 범위·근무조건 확인','AI 사용 및 고객 데이터 처리 범위 확인','화면·데이터 흐름 구현과 기능 테스트','배포 주소·소스·운영 안내를 확인하고 납품']},
  '리서치·데이터':{skills:['리서치','데이터 분석'],tools:['Claude','ChatGPT'],keywords:['research','analyst','data','evaluation','annotat','trainer','label','scientist'],output:'리서치 브리핑 페이지',steps:['도메인 전문성과 요구 경력 확인','외부 AI 도구 사용 허용 여부를 의뢰인에게 확인','공식 출처 수집과 근거별 검증','검토한 결과·출처·불확실성을 함께 전달']}
};
export const SOURCE_LINKS = [
  {name:'Himalayas',url:'https://himalayas.app/',detail:'실제 원격 공고 연동',connected:true},
  {name:'위시켓',url:'https://www.wishket.com/project/',detail:'국내 외주 직접 찾기',connected:false},
  {name:'원티드',url:'https://www.wanted.co.kr/',detail:'국내 채용 · API 인증 필요',connected:false},
  {name:'고용24',url:'https://www.work24.go.kr/',detail:'국내 채용 · API 심사 필요',connected:false}
];
