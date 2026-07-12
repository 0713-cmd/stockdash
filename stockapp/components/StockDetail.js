import { useState, useEffect } from 'react';
import { STOCK_UNIVERSE, METRIC_META, getUniverseStock } from '../lib/data';
import {
  calcCompositeSignal, calcReverseDCF, calcFCFYield, calcROICWACC,
  calcPEPercentile, calcPositionSize,
} from '../lib/calculations';
import {
  fmt, fmtK, pct, clr, sigBg, sigBd, SigBadge, MiniBar, SectionTitle, Row, MetricRow, BackBtn,
} from './shared';
import { ScoreBreakdown } from './ScoreBits';
import { calcComprehensiveScore } from '../lib/calculations';
import { guruHoldersOf, macroSensitivity } from './stockUtils';

// ── vs 섹터 중앙값 비교 (163종목 실측) ──
function SectorCompare({ s, p, pe }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let alive = true;
    import('./screenCache').then(({getScreen})=>getScreen()).then(d=>{
      if (alive && d.sectorStats) setStats(d.sectorStats);
    }).catch(()=>{});
    return ()=>{ alive=false; };
  }, []);
  const sector = s.lite ? (p?.sector || s.sector) : (s.sector || p?.sector);
  const st = stats?.[sector];
  if (!st) return null;
  const rows = [
    ['PER', pe, st.pe, 'x', true],
    ['매출성장', s.rev_growth_yoy, st.growth, '%', false],
    ['매출총이익률', s.gross_margin, st.gm, '%', false],
  ].filter(([,mine,med])=>mine!=null&&med!=null);
  if (rows.length===0) return null;
  return (
    <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',padding:'12px 14px'}}>
      <div style={{fontSize:10,fontWeight:700,color:'var(--strong)',marginBottom:8}}>vs 동종 섹터 중앙값 <span style={{fontSize:8,color:'var(--dim)',fontWeight:400}}>({sector} · 유니버스 {st.n}개 실측)</span></div>
      {rows.map(([label,mine,med,unit,lowerBetter],i)=>{
        const better = lowerBetter ? mine < med : mine > med;
        return (
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:i<rows.length-1?'1px solid var(--line)':'none',fontSize:11}}>
            <span style={{color:'var(--dim2)'}}>{label}</span>
            <span className="mono">
              <b style={{color:better?'var(--green)':'var(--red)'}}>{Number(mine).toFixed(1)}{unit}</b>
              <span style={{color:'var(--dim)',margin:'0 6px'}}>vs 섹터 {Number(med).toFixed(1)}{unit}</span>
              <span style={{fontSize:9,fontWeight:700,color:better?'var(--green)':'var(--red)'}}>{better?'우위':'열위'}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 최근 뉴스 (Finnhub — Vercel 배포 환경에서 표시) ──
function NewsSection({ sym }) {
  const [news, setNews] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/finnhub?type=news&sym=${sym}`).then(r=>r.json()).then(d=>{
      if (alive) setNews(d.news || []);
    }).catch(()=>{ if (alive) setNews([]); });
    return ()=>{ alive=false; };
  }, [sym]);
  if (!news || news.length===0) return null;
  return (
    <>
      <SectionTitle>최근 뉴스 (7일)</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        {news.map((n,i)=>(
          <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{display:'block',padding:'9px 14px',borderBottom:i<news.length-1?'1px solid var(--line)':'none',textDecoration:'none'}}>
            <div style={{fontSize:11,color:'var(--text)',lineHeight:1.5}}>{n.headline}</div>
            <div style={{fontSize:9,color:'var(--dim)',marginTop:2}}>{n.source} · {n.date}</div>
          </a>
        ))}
      </div>
    </>
  );
}

// ── 한 줄 결론 박스 (매수 판단을 한눈에) ──
function VerdictBox({ comp, comprehensive, cur, s, up, pos, guruDiff }) {
  const sig = comp.signal;
  const conf = {
    BUY:    { icon:'🟢', head:'지금 매수를 검토할 만합니다', bg:'var(--green-bg)', bd:'var(--green-bd)', col:'var(--green)' },
    HOLD:   { icon:'🟡', head:'보유 유지 — 신규 진입은 신중히', bg:'var(--gold-bg)', bd:'var(--gold-bd)', col:'var(--gold)' },
    NEUTRAL:{ icon:'🟡', head:'중립 — 뚜렷한 우위 없음', bg:'var(--gold-bg)', bd:'var(--gold-bd)', col:'var(--gold)' },
    WAIT:   { icon:'🔴', head:'지금은 대기 — 진입 조건 미충족', bg:'var(--red-bg)', bd:'var(--red-bd)', col:'var(--red)' },
    DANGER: { icon:'⛔', head:'위험 신호 — 투자 재검토 필요', bg:'var(--red-bg)', bd:'var(--red-bd)', col:'var(--red)' },
    UNKNOWN:{ icon:'⏳', head:'가격 로딩 후 판단 가능', bg:'var(--bg3)', bd:'var(--line2)', col:'var(--dim2)' },
  }[sig] || {};

  const reasons = [];
  if (up != null && up > 15 && up <= 200) reasons.push(`저평가(+${up.toFixed(0)}%)`);
  else if (up != null && up < -15) reasons.push(`고평가(${up.toFixed(0)}%)`);
  if (s.piotroski >= 7) reasons.push(`품질우수(F${s.piotroski}/9)`);
  else if (s.piotroski != null && s.piotroski < 4) reasons.push(`품질주의(F${s.piotroski}/9)`);
  if (guruDiff != null && guruDiff > 3) reasons.push('구루 매수가보다 저렴');
  else if (guruDiff != null && guruDiff < -15) reasons.push(`구루보다 ${Math.abs(guruDiff).toFixed(0)}% 비쌈`);
  if (comprehensive?.grade) reasons.push(`종합 ${comprehensive.score}점 ${comprehensive.grade}`);
  if (s.beneish_m != null && s.beneish_m > -1.78) reasons.push('⛔ 회계조작 의심');

  return (
    <div style={{margin:'6px 12px',padding:'14px 16px',background:conf.bg,border:`2px solid ${conf.bd}`,borderRadius:14}}>
      <div style={{fontSize:15,fontWeight:700,color:conf.col,marginBottom:6}}>{conf.icon} {conf.head}</div>
      {reasons.length>0&&<div style={{fontSize:11,color:'var(--text)',lineHeight:1.7,marginBottom:sig==='BUY'&&pos>0?6:0}}>이유: {reasons.join(' · ')}</div>}
      {sig==='BUY'&&cur&&(
        <div style={{fontSize:11,color:'var(--text)',lineHeight:1.7}}>
          권고: 자산의 <b style={{color:conf.col}}>{pos>0?`${pos}%`:'소액'}</b> · 손절 <b style={{color:'var(--red)'}}>${fmt(cur*0.8)}</b> (-20%)
          {s.fair_value&&<> · 목표가 <b style={{color:'var(--gold)'}}>${fmt(s.fair_value,0)}</b></>}
        </div>
      )}
    </div>
  );
}

// Claude 정밀분석 프롬프트 복사 버튼
function AnalysisPromptButton({ sym, s, p }) {
  const [copied, setCopied] = useState(false);
  const buildPrompt = () => {
    const today = new Date().toLocaleDateString('ko-KR');
    const peg = p?.trailingPE && p?.epsForward && p?.eps > 0 && p.epsForward > p.eps
      ? (p.trailingPE / ((p.epsForward - p.eps) / p.eps * 100)).toFixed(2) : 'N/A';
    const up = s.fair_value && p?.price ? ((s.fair_value - p.price)/p.price*100).toFixed(1) : null;
    return `당신은 7인 투자위원회(IC)를 지휘하는 헤지펀드 CIO입니다. 아래 ${sym}(${p?.name || s.name || sym})에 대해 다음 절차를 순서대로 수행하고, 각 역할이 서로의 주장을 반박하게 하세요. 결론을 미리 정하지 말 것.

━━ 스크리닝 통과 데이터 (${today} 기준) ━━
현재가: $${p?.price ?? '?'} · 52주: $${p?.low52 ?? '?'}~$${p?.high52 ?? '?'}
PER(TTM): ${p?.trailingPE ?? 'N/A'}x / Forward: ${p?.forwardPE ?? 'N/A'}x / PEG: ${peg}
시가총액: ${p?.mktCap ? fmtK(p.mktCap) : 'N/A'} · 섹터: ${p?.sector || s.sector || 'N/A'}
애널리스트 목표가: 평균 $${p?.targetMean ?? s.target_mean ?? 'N/A'} (${p?.numAnalysts ?? s.num_analysts ?? '?'}명, ${p?.recommendation ?? s.recommendation ?? 'N/A'})
자체 DCF 적정가: ${s.fair_value ? `$${s.fair_value} (${up>0?'+':''}${up}% 여력, 범위 $${s.fair_low}~$${s.fair_high})` : '미산정'}
Piotroski F: ${s.piotroski ?? 'N/A'}/9 · Beneish M: ${s.beneish_m ?? 'N/A'} · Altman Z: ${s.altman_z ?? 'N/A'}
ROIC ${s.roic ?? 'N/A'}% / WACC ${s.wacc ?? 'N/A'}% · 매출성장 ${s.rev_growth_yoy ?? 'N/A'}% · GM ${s.gross_margin ?? 'N/A'}%

━━ IC 절차 (반드시 이 순서·형식) ━━
① 정량 애널리스트: 위 숫자로 밸류에이션·성장·품질을 냉정히 채점. 역산DCF 3단계(현재 내재 기대치 → 그게 현실적인가 → 재평가).
② 정성 애널리스트: 해자·경영진·산업 사이클·제품 로드맵·규제. 숫자에 안 잡히는 요인. 최신 뉴스 검색해서 반영.
③ Bull(긍정론자): 가장 강한 매수 논거 3가지. 상승 시나리오 목표가와 촉매.
④ Bear(부정론자): 가장 강한 반대 논거 3가지. 하락 시나리오와 손실 트리거. Bull 주장을 직접 반박.
⑤ 리스크 매니저: 변동성·집중도·매크로 민감도. 이 종목이 틀렸을 때 얼마나 잃나. 적정 포지션 상한·손절가.
⑥ 수석(당신)의 판결: Bull vs Bear 중 누가 이겼고 왜인지 명시. 확증편향 없이.
⑦ 최종 결론: 매수/보류/회피 + 확신도(상/중/하) + 권고 비중(%) + 진입가·손절가·목표가. "지금 안 사는 게 낫다"도 유효한 결론.

논문 수준으로 근거를 대되, 마지막에 3줄 요약(TL;DR)으로 실행 가능하게 끝내세요.`;
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildPrompt());
      setCopied(true);
      setTimeout(()=>setCopied(false), 2500);
    } catch {
      // 클립보드 권한 실패 시 textarea 폴백
      const ta = document.createElement('textarea');
      ta.value = buildPrompt();
      document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(()=>setCopied(false), 2500);
    }
  };
  return (
    <div style={{margin:'0 12px 8px'}}>
      <button onClick={copy} style={{width:'100%',padding:'13px',borderRadius:12,border:'1px solid var(--gold-bd)',background:copied?'var(--green-bg)':'var(--gold-bg)',color:copied?'var(--green)':'var(--gold)',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        {copied ? '✅ 복사됨 — Claude 채팅창에 붙여넣으세요' : '🏛️ 7인 투자위원회(IC) 심층분석 프롬프트 복사'}
      </button>
      <div style={{fontSize:9,color:'var(--dim)',marginTop:5,lineHeight:1.5,textAlign:'center'}}>
        정량·정성 애널리스트 + Bull·Bear 논쟁 + 리스크매니저 + 수석판결의 7인 IC 절차.<br/>스크리닝이 넘긴 실데이터를 물고 Claude에 붙여넣으면 논문 수준 양면 검토를 받습니다.
      </div>
    </div>
  );
}

// 실제 공시 재무제표 표 (/api/financials)
function FinTable({ sym }) {
  const [fin, setFin] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let alive = true;
    setFin(null); setErr(null);
    fetch(`/api/financials?sym=${sym}`).then(r=>r.json()).then(d=>{
      if (!alive) return;
      if (d.error || !d.annual?.length) setErr(d.error || '데이터 없음');
      else setFin(d);
    }).catch(e=>{ if (alive) setErr(e.message); });
    return ()=>{ alive = false; };
  }, [sym]);

  const yoy = (cur, prev) => (cur != null && prev) ? (cur - prev) / prev * 100 : null;
  const pctCell = v => v == null ? <span style={{color:'var(--dim)'}}>—</span>
    : <span style={{color:v>0?'var(--green)':v<0?'var(--red)':'var(--dim2)',fontWeight:600}}>{v>0?'+':''}{v.toFixed(1)}%</span>;
  const th = {fontSize:9,color:'var(--dim)',textAlign:'right',padding:'5px 6px',fontWeight:600,whiteSpace:'nowrap'};
  const td = {fontSize:11,textAlign:'right',padding:'5px 6px',whiteSpace:'nowrap'};

  if (err) return (
    <div style={{margin:'0 12px 6px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',fontSize:11,color:'var(--dim)'}}>
      공시 재무 데이터를 불러오지 못했습니다 ({err}). 새로고침 후 다시 시도해보세요.
    </div>
  );
  if (!fin) return (
    <div style={{margin:'0 12px 6px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',fontSize:11,color:'var(--dim)'}}>
      ⏳ 공시 재무제표 불러오는 중...
    </div>
  );

  // ── 1년 주가 라인 ──
  const ps = fin.priceSeries || [];
  let spark = null;
  if (ps.length > 3) {
    const cs = ps.map(x=>x.c);
    const mn = Math.min(...cs), mx = Math.max(...cs);
    const rng = mx - mn || 1;
    const W = 560, H = 60;
    const pts = cs.map((c,i)=>`${(i/(cs.length-1)*W).toFixed(1)},${(H-4-(c-mn)/rng*(H-8)).toFixed(1)}`).join(' ');
    const ret1y = ((cs[cs.length-1]-cs[0])/cs[0]*100);
    spark = { pts, W, H, mn, mx, ret1y, last: cs[cs.length-1] };
  }

  // ── 리비전 요약 ──
  const rev = fin.revisions;
  const revChg = rev?.current != null && rev?.d90 != null && rev.d90 !== 0 ? (rev.current - rev.d90) / Math.abs(rev.d90) * 100 : null;

  // 최신이 맨 위
  const annual = [...fin.annual].reverse();
  // 분기: 최신 먼저, 전분기비 + (4분기 전 데이터 있으면) 전년동기비
  const qAsc = fin.quarterly;
  const quarters = qAsc.map((q,i)=>({
    ...q,
    qoq: i>0 ? yoy(q.revenue, qAsc[i-1].revenue) : null,
    yoy: i>=4 ? yoy(q.revenue, qAsc[i-4].revenue) : null,
  })).reverse();

  const fy = d => `FY${d.slice(0,4)}.${d.slice(5,7)}`;
  const qLabel = d => `${d.slice(0,4)}.${d.slice(5,7)}월 분기`;

  return (
    <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
      {/* 1년 주가 */}
      {spark&&(
        <div style={{padding:'12px 14px',borderBottom:'1px solid var(--line)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:700,color:'var(--strong)'}}>1년 주가 추이 (주간)</span>
            <span className="mono" style={{fontSize:12,fontWeight:700,color:spark.ret1y>0?'var(--green)':'var(--red)'}}>1년 {spark.ret1y>0?'+':''}{spark.ret1y.toFixed(1)}%</span>
          </div>
          <svg viewBox={`0 0 ${spark.W} ${spark.H}`} style={{width:'100%',height:60,display:'block'}} aria-hidden="true">
            <polyline points={spark.pts} fill="none" stroke={spark.ret1y>0?'var(--green)':'var(--red)'} strokeWidth="1.8"/>
          </svg>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--dim)'}}>
            <span>저점 ${fmt(spark.mn)}</span><span>현재 ${fmt(spark.last)}</span><span>고점 ${fmt(spark.mx)}</span>
          </div>
        </div>
      )}

      {/* 리비전 + 서프라이즈 + 배당 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:0,borderBottom:'1px solid var(--line)'}}>
        <div style={{padding:'10px 14px',borderRight:'1px solid var(--line)'}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--strong)',marginBottom:4}}>애널리스트 EPS 추정 변화 <span style={{fontSize:8,color:'var(--dim)',fontWeight:400}}>(당해연도)</span></div>
          {rev?.current!=null ? (
            <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.7}}>
              90일 전 ${rev.d90 ?? '—'} → 현재 <b className="mono" style={{color:revChg>0?'var(--green)':revChg<0?'var(--red)':'var(--text)'}}>${rev.current}</b>
              {revChg!=null&&<b style={{color:revChg>0?'var(--green)':'var(--red)'}}> ({revChg>0?'+':''}{revChg.toFixed(1)}%)</b>}<br/>
              최근 30일 상향 <b style={{color:'var(--green)'}}>{rev.upLast30 ?? 0}</b>건 · 하향 <b style={{color:'var(--red)'}}>{rev.downLast30 ?? 0}</b>건
              {revChg!=null&&<span style={{color:revChg>2?'var(--green)':revChg<-2?'var(--red)':'var(--dim)'}}> — {revChg>2?'상향 추세 ✅':revChg<-2?'하향 추세 ⚠️':'중립'}</span>}
            </div>
          ) : <div style={{fontSize:10,color:'var(--dim)'}}>데이터 없음</div>}
        </div>
        <div style={{padding:'10px 14px'}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--strong)',marginBottom:4}}>실적 서프라이즈 <span style={{fontSize:8,color:'var(--dim)',fontWeight:400}}>(최근 4분기, 예상 대비)</span></div>
          {fin.surprises?.length>0 ? (
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {fin.surprises.map((h,i)=>(
                <span key={i} className="mono" style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:h.surprisePct>0?'var(--green-bg)':'var(--red-bg)',border:`1px solid ${h.surprisePct>0?'var(--green-bd)':'var(--red-bd)'}`,color:h.surprisePct>0?'var(--green)':'var(--red)'}}>
                  {h.surprisePct>0?'+':''}{h.surprisePct}%
                </span>
              ))}
              <span style={{fontSize:9,color:'var(--dim2)',alignSelf:'center'}}>{fin.surprises.filter(h=>h.surprisePct>0).length}/{fin.surprises.length}분기 상회</span>
            </div>
          ) : <div style={{fontSize:10,color:'var(--dim)'}}>데이터 없음</div>}
          {fin.dividend?.yieldPct!=null&&fin.dividend.yieldPct>0&&(
            <div style={{fontSize:10,color:'var(--dim2)',marginTop:6}}>
              배당 <b className="mono" style={{color:'var(--text)'}}>{fin.dividend.yieldPct}%</b>
              {fin.dividend.rate!=null&&<> (연 ${fin.dividend.rate})</>}
              {fin.dividend.payoutRatio!=null&&<> · 배당성향 {fin.dividend.payoutRatio}%</>}
              {fin.dividend.exDate&&<> · 배당락 {fin.dividend.exDate}</>}
            </div>
          )}
        </div>
      </div>

      <div style={{padding:'12px 14px 4px',fontSize:11,fontWeight:700,color:'var(--strong)'}}>연간 실적 — 실제 공시 기준</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
          <tr style={{borderBottom:'1px solid var(--line2)'}}>
            <th style={{...th,textAlign:'left',paddingLeft:14}}>회계연도</th>
            <th style={th}>매출</th>
            <th style={th}>전년비</th>
            <th style={th}>영업CF</th>
            <th style={th}>FCF</th>
          </tr>
        </thead>
        <tbody>
          {annual.map((a,i)=>{
            const prev = annual[i+1];
            return (
              <tr key={a.date} style={{borderBottom:i<annual.length-1?'1px solid var(--line)':'none',background:i===0?'var(--bg3)':'transparent'}}>
                <td style={{...td,textAlign:'left',paddingLeft:14,color:i===0?'var(--gold)':'var(--text)',fontWeight:i===0?700:400}}>{fy(a.date)}{i===0&&' (최근)'}</td>
                <td className="mono" style={{...td,color:'var(--strong)',fontWeight:600}}>{fmtK(a.revenue)}</td>
                <td className="mono" style={td}>{pctCell(yoy(a.revenue, prev?.revenue))}</td>
                <td className="mono" style={{...td,color:'var(--text)'}}>{fmtK(a.ocf)}</td>
                <td className="mono" style={{...td,color:'var(--text)'}}>{fmtK(a.fcf)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{padding:'14px 14px 4px',fontSize:11,fontWeight:700,color:'var(--strong)',borderTop:'1px solid var(--line2)',marginTop:6}}>분기별 매출 — 실제 공시 기준</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
          <tr style={{borderBottom:'1px solid var(--line2)'}}>
            <th style={{...th,textAlign:'left',paddingLeft:14}}>분기</th>
            <th style={th}>매출</th>
            <th style={th}>전분기비</th>
            <th style={th}>전년동기비</th>
            <th style={th}>매출총이익률</th>
          </tr>
        </thead>
        <tbody>
          {quarters.map((q,i)=>(
            <tr key={q.date} style={{borderBottom:i<quarters.length-1?'1px solid var(--line)':'none',background:i===0?'var(--bg3)':'transparent'}}>
              <td style={{...td,textAlign:'left',paddingLeft:14,color:i===0?'var(--gold)':'var(--text)',fontWeight:i===0?700:400}}>{qLabel(q.date)}{i===0&&' (최근)'}</td>
              <td className="mono" style={{...td,color:'var(--strong)',fontWeight:600}}>{fmtK(q.revenue)}</td>
              <td className="mono" style={td}>{pctCell(q.qoq)}</td>
              <td className="mono" style={td}>{pctCell(q.yoy)}</td>
              <td className="mono" style={{...td,color:'var(--text)'}}>{q.grossProfit!=null&&q.revenue?`${(q.grossProfit/q.revenue*100).toFixed(1)}%`:'—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{fontSize:9,color:'var(--dim)',padding:'10px 14px',lineHeight:1.6,borderTop:'1px solid var(--line)'}}>
        ✅ Yahoo Finance 공시(10-K/10-Q) 기준 실제 수치입니다. 분기 전년동기비는 공개 범위(최근 5개 분기) 제한으로 최근 분기에만 표시될 수 있습니다.
      </div>
    </div>
  );
}

export default function StockDetail({ sym, prices, macro, macroValues, onBack }) {
  const s = getUniverseStock(sym);
  if (!s) return null;
  const treasury = macro?.treasury_10y || 4.42;
  const p = prices[sym];
  const cur = p?.price;
  const comp = cur ? calcCompositeSignal(s, cur, treasury) : {signal:'UNKNOWN',score:'0'};
  const up = cur&&s.fair_value ? (s.fair_value-cur)/cur*100 : null;
  const pe = cur&&s.eps_ttm>0 ? cur/s.eps_ttm : null;
  const pePerc = pe ? calcPEPercentile(pe, s.pe_hist_avg_5y, s.pe_hist_min_5y, s.pe_hist_max_5y) : null;
  const dcf = cur ? calcReverseDCF(s,cur) : null;
  const fcf = cur ? calcFCFYield(s,cur,treasury) : null;
  const roic = calcROICWACC(s.roic,s.wacc);
  const pos = comp.signal==='BUY'&&cur ? calcPositionSize(parseFloat(comp.score||0),parseFloat(up||0)) : 0;
  const trendCol = t=>t==='accel'?'var(--green)':t==='down'?'var(--red)':'var(--dim2)';
  const holders = guruHoldersOf(sym);
  const sens = macroValues ? macroSensitivity(s, macroValues) : [];
  const comprehensive = calcComprehensiveScore(s, p);
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'12px 16px 4px'}}>
        <BackBtn onClick={onBack}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span className="mono" style={{fontSize:22,fontWeight:700,color:'var(--strong)'}}>{sym}</span>
              <SigBadge s={comp.signal}/>
            </div>
            <div style={{fontSize:11,color:'var(--dim2)',marginTop:1}}>{p?.name || s.name} · {p?.sector || s.sector}{s.lite && ' · 유니버스 종목(가격 지표만)'}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="mono" style={{fontSize:24,fontWeight:700,color:'var(--strong)'}}>{cur?`$${fmt(cur)}`:'—'}</div>
            {p?.change!=null&&<div className={`mono ${clr(p.change)}`} style={{fontSize:11,marginTop:1}}>{p.change>0?'▲':'▼'}{Math.abs(p.change).toFixed(2)}%</div>}
          </div>
        </div>
      </div>

      {/* ★ 한 줄 결론 — 최상단에서 바로 판단 */}
      {s.type!=='locked'
        ? <VerdictBox comp={comp} comprehensive={comprehensive} cur={cur} s={s} up={up} pos={pos}
            guruDiff={s.guru_cost&&cur ? (s.guru_cost-cur)/s.guru_cost*100 : null}/>
        : <div style={{margin:'6px 12px',padding:'12px 14px',background:'var(--bg3)',border:'1px solid var(--line2)',borderRadius:14,fontSize:12,color:'var(--dim2)'}}>🔒 {s.locked_note}</div>
      }

      {/* 핵심 4칸 — 현재가/목표가/예상수익/종합점수 */}
      {(()=>{
        const tgt = s.fair_value ?? s.target_mean ?? p?.targetMean ?? null;
        const tgtSrc = s.fair_value ? 'DCF' : tgt ? '애널리스트' : null;
        let expUp = cur && tgt ? (tgt-cur)/cur*100 : null;
        if (expUp != null && expUp > 200) expUp = null;
        const cells = [
          ['현재가', cur?`$${fmt(cur)}`:'—', 'var(--strong)', p?.change!=null?`${p.change>0?'+':''}${p.change.toFixed(2)}% 오늘`:''],
          [`목표가${tgtSrc?` (${tgtSrc})`:''}`, tgt?`$${fmt(tgt,0)}`:'—', 'var(--gold)', s.target_mean&&s.fair_value?`애널리스트 $${fmt(s.target_mean,0)}`:''],
          ['예상수익', expUp!=null?`${expUp>0?'+':''}${expUp.toFixed(1)}%`:'—', expUp>0?'var(--green)':expUp<0?'var(--red)':'var(--dim)', ''],
          ['종합점수', `${comprehensive.score}점`, comprehensive.grade?.startsWith('A')?'var(--green)':comprehensive.grade?.startsWith('B')?'var(--gold)':'var(--red)', `등급 ${comprehensive.grade} · 커버리지 ${comprehensive.coverage}%`],
        ];
        return (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8,margin:'0 12px 8px'}}>
            {cells.map(([l,v,col,sub],i)=>(
              <div key={i} style={{background:'var(--bg2)',border:'1px solid var(--line)',borderRadius:12,padding:'11px 13px'}}>
                <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>{l}</div>
                <div className="mono" style={{fontSize:19,fontWeight:700,color:col,lineHeight:1.1}}>{v}</div>
                {sub&&<div style={{fontSize:9,color:'var(--dim2)',marginTop:3}}>{sub}</div>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* 종합점수 브레이크다운 — 접어두고 "더 자세히 보기" */}
      <div style={{margin:'0 12px 6px'}}>
        <div onClick={()=>setShowBreakdown(v=>!v)} style={{padding:'10px 14px',background:'var(--bg2)',border:'1px solid var(--line)',borderRadius:showBreakdown?'12px 12px 0 0':'12px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,fontWeight:700,color:'var(--text)'}}>📊 점수 산정 근거 더 자세히 보기 (지표별 현재값·기준·점수)</span>
          <span style={{fontSize:11,color:'var(--gold)'}}>{showBreakdown?'접기 ▲':'펼치기 ▼'}</span>
        </div>
      </div>
      {showBreakdown&&<ScoreBreakdown comp={comprehensive}/>}

      {/* vs 섹터 중앙값 (163종목 실측 비교) */}
      <SectorCompare s={s} p={p} pe={pe}/>

      {/* 투자 논지 요약 */}
      {(s.key_oppty||s.key_risk)&&(
        <div style={{margin:'0 12px 6px',padding:'12px 14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)'}}>
          <div style={{fontSize:10,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>투자 논지 요약</div>
          {s.key_oppty&&<div style={{fontSize:11,color:'var(--text)',lineHeight:1.6,marginBottom:6}}>✅ {s.key_oppty}</div>}
          {s.key_risk&&<div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.6}}>⚠️ {s.key_risk}</div>}
        </div>
      )}

      {/* 52주 범위 */}
      {p?.high52&&p?.low52&&cur&&(
        <div style={{margin:'0 12px 6px',padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)'}}>
          <div style={{fontSize:9,color:'var(--dim)',marginBottom:6}}>52주 범위</div>
          <div style={{position:'relative',height:12,marginBottom:4}}>
            <div style={{position:'absolute',top:4,left:0,right:0,height:4,background:'var(--bg4)',borderRadius:2}}/>
            <div style={{position:'absolute',top:0,left:`${Math.max(2,Math.min(96,(cur-p.low52)/(p.high52-p.low52)*100))}%`,width:12,height:12,borderRadius:'50%',background:'var(--gold)',border:'2px solid var(--bg)',transform:'translateX(-50%)'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--dim2)'}}>
            <span>${fmt(p.low52)}</span>
            <span style={{color:'var(--gold)'}}>${fmt(cur)} ({((cur-p.low52)/(p.high52-p.low52)*100).toFixed(0)}%)</span>
            <span>${fmt(p.high52)}</span>
          </div>
        </div>
      )}

      <SectionTitle>밸류에이션 (탭하면 지표 설명)</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        <MetricRow meta={METRIC_META.pe} label="PE(TTM)" val={pe?`${fmt(pe,1)}x`:'N/A'} value={pePerc?parseFloat(pePerc):null}
          valCol={pePerc?(parseFloat(pePerc)>70?'var(--red)':parseFloat(pePerc)<30?'var(--green)':'var(--gold)'):'var(--text)'}
          note={pePerc?`5y 백분위 ${pePerc}%`:''}/>
        <Row label="목표가(DCF)" val={s.fair_value?`$${fmt(s.fair_value,0)}`:'—'} valCol="var(--gold)" note={dcf?.label||''}/>
        <Row label="업사이드" val={up!=null?pct(up):'—'} valCol={up>0?'var(--green)':'var(--red)'} note="현재가 대비"/>
        <MetricRow meta={METRIC_META.fcf_yield} label="FCF Yield" val={cur&&s.fcf_annual?`${((s.fcf_annual-(s.sbc_annual||0))/(cur*s.shares_out)*100).toFixed(2)}%`:'—'} value={fcf?.premium?parseFloat(fcf.premium):null}
          note={fcf?.premium?`국채 대비 ${fcf.premium}%p`:''}/>
        <MetricRow meta={METRIC_META.roic_wacc} label="ROIC-WACC" val={s.roic&&s.wacc?`+${roic.spread}%p`:'—'} value={roic.spread?parseFloat(roic.spread):null}
          valCol={parseFloat(roic.spread||0)>10?'var(--green)':'var(--gold)'} note={roic.label||''}/>
        <Row label="PSR" val={p?.psr?`${p.psr}x`:'—'} last/>
      </div>

      <SectionTitle>품질 지표 (탭하면 설명)</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        <MetricRow meta={METRIC_META.piotroski} label="Piotroski F" val={`${s.piotroski??'—'}/9`} value={s.piotroski}
          valCol={s.piotroski>=7?'var(--green)':s.piotroski>=4?'var(--gold)':'var(--red)'} note="재무건전성 종합"/>
        <MetricRow meta={METRIC_META.beneish_m} label="Beneish M" val={`${s.beneish_m??'—'}`} value={s.beneish_m}
          valCol={s.beneish_m!=null&&s.beneish_m<-1.78?'var(--green)':'var(--red)'} note={s.beneish_m!=null&&s.beneish_m>-1.78?'⛔조작의심':'안전'}/>
        <MetricRow meta={METRIC_META.altman_z} label="Altman Z" val={`${s.altman_z??'—'}`} value={s.altman_z}
          valCol={s.altman_z!=null?(s.altman_z>2.99?'var(--green)':s.altman_z>1.81?'var(--gold)':'var(--red)'):'var(--dim)'}/>
        <MetricRow meta={METRIC_META.mom_12_1} label="모멘텀(12-1M)" val={s.mom_12_1!=null?`${s.mom_12_1>0?'+':''}${s.mom_12_1}%`:'—'} value={s.mom_12_1}
          valCol={s.mom_12_1>10?'var(--green)':s.mom_12_1>0?'var(--gold)':'var(--red)'} note="12개월-1개월 가격"/>
        <MetricRow meta={METRIC_META.erv_score} label="어닝 리비전" val={s.erv_score!=null?`${s.erv_score>0?'+':''}${s.erv_score}`:'—'} value={s.erv_score}
          valCol={s.erv_score>0.2?'var(--green)':s.erv_score>0?'var(--gold)':'var(--red)'} note="추정EPS 상향-하향" last/>
      </div>

      <SectionTitle>재무 추이</SectionTitle>
      <FinTable sym={sym}/>

      {s.segments?.length>0&&(
        <>
          <SectionTitle>매출 세그먼트</SectionTitle>
          <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',padding:'10px 14px'}}>
            {s.segments.map((seg,i)=>(
              <div key={i} style={{marginBottom:i<s.segments.length-1?10:0}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:11,color:'var(--text)'}}>{seg.name}</span>
                  <span style={{fontSize:11}}><span style={{color:'var(--dim2)'}}>{seg.pct}%</span><span style={{color:trendCol(seg.trend),marginLeft:8,fontWeight:600}}>{seg.growth>0?'+':''}{seg.growth.toFixed(1)}%</span></span>
                </div>
                <MiniBar pct={seg.pct} col={trendCol(seg.trend)}/>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 매크로 영향 */}
      {sens.length>0&&(
        <>
          <SectionTitle>현재 매크로 대비 영향</SectionTitle>
          <div style={{margin:'0 12px 6px',padding:'12px 14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)'}}>
            {sens.map((n,i)=><div key={i} style={{fontSize:11,color:'var(--dim2)',lineHeight:1.7,marginBottom:i<sens.length-1?4:0}}>• {n}</div>)}
          </div>
        </>
      )}

      {/* 구루 보유 여부 */}
      <SectionTitle>투자 대가 포지션</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',padding:'12px 14px'}}>
        {holders.length>0 ? holders.map((h,i)=>(
          <div key={i} style={{marginBottom:i<holders.length-1?8:0,paddingBottom:i<holders.length-1?8:0,borderBottom:i<holders.length-1?'1px solid var(--line)':'none'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,fontWeight:700,color:'var(--strong)'}}>{h.guru}</span>
              <span style={{fontSize:9,padding:'1px 7px',borderRadius:10,background:h.action==='NEW'?'var(--green-bg)':'var(--gold-bg)',border:`1px solid ${h.action==='NEW'?'var(--green-bd)':'var(--gold-bd)'}`,color:h.action==='NEW'?'var(--green)':'var(--gold)'}}>{h.action==='NEW'?'신규':h.action==='ADD'?'추가':'보유'}</span>
            </div>
            <div style={{fontSize:10,color:'var(--dim2)',marginTop:3}}>{h.note}</div>
          </div>
        )) : <div style={{fontSize:11,color:'var(--dim)'}}>추적 중인 구루 중 현재 보유자가 없습니다.</div>}
      </div>

      {s.guru_cost&&(
        <div style={{margin:'0 12px 8px',padding:'12px 14px',background:'var(--gold-bg)',borderRadius:12,border:'1px solid var(--gold-bd)',fontSize:12,color:'var(--text)',lineHeight:1.8}}>
          추정매수가 <b style={{color:'var(--gold)'}}>${s.guru_cost}</b> ({s.guru_cost_type})<br/>
          {cur&&<>현재 ${fmt(cur)} — <b style={{color:cur<s.guru_cost?'var(--green)':'var(--red)'}}>{cur<s.guru_cost?'구루보다 저렴':'구루보다 비쌈'} {Math.abs((cur-s.guru_cost)/s.guru_cost*100).toFixed(1)}%</b><br/></>}
          <span style={{fontSize:11,color:'var(--dim2)'}}>{s.guru_note}</span>
        </div>
      )}

      {/* 최근 뉴스 */}
      <NewsSection sym={sym}/>

      {/* Claude 정밀분석 프롬프트 복사 */}
      <SectionTitle>정밀분석</SectionTitle>
      <AnalysisPromptButton sym={sym} s={s} p={p}/>
    </div>
  );
}
