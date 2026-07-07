import { useState } from 'react';
import { STOCK_UNIVERSE, METRIC_META, getUniverseStock } from '../lib/data';
import {
  calcCompositeSignal, calcReverseDCF, calcFCFYield, calcROICWACC,
  calcPEPercentile, calcPositionSize, genFinancialHistory,
} from '../lib/calculations';
import {
  fmt, fmtK, pct, clr, sigBg, sigBd, SigBadge, MiniBar, SectionTitle, Row, MetricRow, BackBtn,
} from './shared';
import { ScoreBreakdown } from './ScoreBits';
import { calcComprehensiveScore } from '../lib/calculations';
import { guruHoldersOf, macroSensitivity } from './stockUtils';

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
애널리스트 목표가: 평균 $${p?.targetMean ?? 'N/A'} (${p?.numAnalysts ?? '?'}명, 등급 ${p?.recommendation ?? 'N/A'})

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

function FinChart({ hist }) {
  if (!hist) return (
    <div style={{margin:'0 12px 6px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',fontSize:11,color:'var(--dim)'}}>
      재무 데이터 부족으로 추이를 재구성할 수 없습니다.
    </div>
  );
  const maxQRev = Math.max(...hist.quarters.map(q=>q.revenue));
  const maxARev = Math.max(...hist.annual.map(a=>Math.max(a.revenue,a.fcf,a.ocf)));
  return (
    <div style={{margin:'0 12px 6px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)'}}>
      <div style={{fontSize:10,color:'var(--dim)',marginBottom:8}}>분기별 매출 · 매출총이익률 추이 (최근 8분기)</div>
      <div style={{display:'flex',alignItems:'flex-end',gap:4,height:74,marginBottom:16}}>
        {hist.quarters.map((q,i)=>(
          <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <div style={{fontSize:8,color:'var(--dim2)'}}>{q.grossMargin.toFixed(0)}%</div>
            <div style={{width:'100%',height:Math.max(4,q.revenue/maxQRev*50),background:'var(--gold)',opacity:.45+i*0.07,borderRadius:'3px 3px 0 0'}}/>
            <div style={{fontSize:7,color:'var(--dim)'}}>{q.label}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:10,color:'var(--dim)',marginBottom:8}}>연간 매출 · 영업현금흐름 · FCF (5개년)</div>
      <div style={{display:'flex',alignItems:'flex-end',gap:8,height:80}}>
        {hist.annual.map((a,i)=>(
          <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <div style={{display:'flex',alignItems:'flex-end',gap:2,height:60}}>
              <div style={{width:6,height:Math.max(3,a.revenue/maxARev*60),background:'var(--blue)',borderRadius:2}}/>
              <div style={{width:6,height:Math.max(3,a.ocf/maxARev*60),background:'var(--green)',borderRadius:2}}/>
              <div style={{width:6,height:Math.max(3,a.fcf/maxARev*60),background:'var(--gold)',borderRadius:2}}/>
            </div>
            <div style={{fontSize:7,color:'var(--dim)'}}>{a.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:10,marginTop:8,fontSize:9,color:'var(--dim2)'}}>
        <span><span style={{display:'inline-block',width:8,height:8,background:'var(--blue)',borderRadius:2,marginRight:3}}/>매출</span>
        <span><span style={{display:'inline-block',width:8,height:8,background:'var(--green)',borderRadius:2,marginRight:3}}/>영업CF</span>
        <span><span style={{display:'inline-block',width:8,height:8,background:'var(--gold)',borderRadius:2,marginRight:3}}/>FCF</span>
      </div>
      <div style={{fontSize:9,color:'var(--dim)',marginTop:10,lineHeight:1.6}}>
        ⚠️ 실제 공시 재무제표 원본이 아니라, 현재 스냅샷(매출·마진·성장률)을 근거로 역산 재구성한 추정 추이입니다. 절대값보다 방향성(우상향/우하향) 참고용입니다.
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
  const hist = genFinancialHistory(s);
  const holders = guruHoldersOf(sym);
  const sens = macroValues ? macroSensitivity(s, macroValues) : [];
  const comprehensive = calcComprehensiveScore(s, p);

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

      {/* ★ 종합점수 브레이크다운 — 지표별 현재값·기준·획득점수 전부 공개 */}
      <ScoreBreakdown comp={comprehensive}/>

      {/* 신호 + 매수이유 요약 */}
      <div style={{margin:'6px 12px',padding:'12px 14px',background:sigBg(comp.signal),border:`1px solid ${sigBd(comp.signal)}`,borderRadius:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <SigBadge s={comp.signal}/>
          <span style={{fontSize:10,color:'var(--dim)'}}>MARS-V 전략점수 {comp.score}</span>
        </div>
        {s.type!=='locked'&&cur&&(
          <div style={{fontSize:12,color:'var(--text)',lineHeight:1.8}}>
            {s.fair_value&&<>현재가 <b>${fmt(cur)}</b> → 목표가 <b style={{color:'var(--gold)'}}>${fmt(s.fair_value,0)}</b> ({pct(up)})<br/></>}
            {pos>0&&<>권고비중 <b style={{color:'var(--gold)'}}>{pos}%</b> · 손절 <b style={{color:'var(--red)'}}>${fmt(cur*.8)}</b><br/></>}
          </div>
        )}
        {s.type==='locked'&&<div style={{fontSize:11,color:'var(--dim2)'}}>🔒 {s.locked_note}</div>}
      </div>

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
      <FinChart hist={hist}/>

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
