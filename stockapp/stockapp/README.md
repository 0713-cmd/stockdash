# 📊 투자 대시보드

## 필요한 것 (전부 무료)

| 서비스 | 용도 | 가입 |
|---|---|---|
| GitHub | 코드 저장 | github.com |
| Vercel | 웹 호스팅 | vercel.com (GitHub 로그인) |
| Finnhub | 세그먼트·뉴스 | finnhub.io |
| FRED | 매크로 데이터 | fred.stlouisfed.org/docs/api |

---

## 배포 순서 (20분)

### 1. Finnhub API 키 발급
1. [finnhub.io](https://finnhub.io) 접속
2. 우상단 "Get free API key" 클릭
3. 이메일 입력 → 가입 → 이메일 인증
4. 대시보드에서 API 키 복사 (예: `d0abc123xyz`)

### 2. FRED API 키 발급
1. [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html)
2. "Request API Key" → 이메일 입력
3. 이메일 인증 → 키 발급 (예: `abcdef1234567890`)

### 3. GitHub 업로드
```bash
# 이 폴더를 GitHub에 업로드
git init
git add .
git commit -m "투자 대시보드 초기 버전"
git remote add origin https://github.com/[내계정]/stockdash.git
git push -u origin main
```

### 4. Vercel 배포
1. [vercel.com](https://vercel.com) → New Project
2. GitHub 저장소 선택 → Import
3. **Environment Variables 설정** (중요!)
   - `FINNHUB_KEY` = Finnhub에서 받은 키
   - `FRED_KEY` = FRED에서 받은 키
4. Deploy 클릭 → 2분 후 완료

### 5. Vercel KV 연결 (포트폴리오 저장용)
1. Vercel 대시보드 → 내 프로젝트 → Storage 탭
2. "Create Database" → KV 선택
3. 연결 클릭 → 자동 환경변수 설정

---

## 기능 요약

### 자동 업데이트 (5분 간격)
- 전일 종가 (Yahoo Finance)
- PE / PSR / PBR 계산
- 10년 PE 히스토리 + 백분위

### 주 단위 신호
- 18개 방법론 가중 합의 → BUY/HOLD/WAIT
- Piotroski F-Score (재무 체력)
- Beneish M-Score (실적 조작 탐지)
- Altman Z-Score (파산 위험)
- 역산 DCF (Mauboussin)
- 구루 추정 매수가 대비

### 텐베거 스코어
- Rule of 40
- 매출성장 가속도
- TAM 침투율
- Gross Margin 트렌드

### 저장
- 매매 기록 (Vercel KV)
- 투자일지 / 오답노트 (Vercel KV)
- 포트폴리오 수익률 자동 계산

---

## 업데이트 방법

### 분기마다 (실적 발표 후)
`lib/data.js`에서 해당 종목의 아래 항목 수정:
- `eps_ttm` (최근 4분기 EPS 합산)
- `revenue_ttm` (최근 4분기 매출 합산)
- `piotroski`, `beneish_m`, `altman_z`
- `segments` (세그먼트별 매출 비율·성장률)
- `guru_cost`, `guru_note` (구루 포지션 변경 시)

수정 후 GitHub 푸시 → Vercel 자동 재배포
