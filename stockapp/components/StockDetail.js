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
    return `${sym}(${p?.name || s.name || sym}) 정밀분석 요청

현재가: $${p?.price ?? '?'} (${today} 기준)
PER(TTM): ${p?.trailingPE ?? 'N/A'}x / Forward PER: ${p?.forwardPE ?? 'N/A'}x
PEG: ${peg}
52주 범위: $${p?.low52 ?? '?'}~$${p?.high52 ?? '?'}
시가총액: ${p?.mktCap ? fmtK(p.mktCap) : 'N/A'}
섹터: ${p?.sector || s.sector || 'N/A'}
애널리스트 목표가: 평균 $${p?.targetMean ?? s.target_mean ?? 'N/A'} (${p?.numAnalysts ?? s.num_analysts ?? '?'}명, 등급 ${p?.recommendation ?? s.recommendation ?? 'N/A'})

역산DCF 기대값(내 계산): ${s.fair_value ? `$${s.fair_value} (범위 $${s.fair_low}~$${s.fair_high})` : '미산정'}
Piotroski F-Score: ${s.piotroski ?? 'N/A'}/9
Beneish M-Score: ${s.beneish_m ?? 'N/A'}

위 데이터를 기반으로 모부신 역산DCF 3단계 + 투자대가 10인 통합분석 + 퀀트 스코어카드를 수행해줘. 현재 시장 맥락은 최신 뉴스를 검색해서 반영해줘.`;
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
        {copied ? '✅ 복사됨 — Claude 채팅창에 붙여넣으세요' : '📋 Claude 정밀분석 프롬프트 복사'}
      </button>
      <div style={{fontSize:9,color:'var(--dim)',marginTop:5,lineHeight:1.5,textAlign:'center'}}>
        구루 10인 정성분석·최신 뉴스 반영은 자동화가 불가능합니다.<br/>버튼을 눌러 복사한 뒤 Claude에 붙여넣으면 즉시 정밀분석을 받을 수 있습니다.
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

      {/* Claude 정밀분석 프롬프트 복사 */}
      <SectionTitle>정밀분석</SectionTitle>
      <AnalysisPromptButton sym={sym} s={s} p={p}/>
    </div>
  );
}
