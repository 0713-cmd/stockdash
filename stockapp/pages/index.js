import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { STOCK_UNIVERSE, GURU_POSITIONS, MACRO_INIT } from '../lib/data';
import {
  calcCompositeSignal, calcReverseDCF, calcFCFYield,
  calcPiotroski, calcBeneish, calcROICWACC, calcMomentum,
  calcTenBaggerScore, calcPEPercentile, calcPositionSize,
  calcPortfolioStats, checkAlerts
} from '../lib/calculations';

// ── 유틸 ─────────────────────────────────────────
const fmt = (n, d=2) => n==null?'—':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtK = n => { if(!n)return'—'; if(n>=1e12)return`$${(n/1e12).toFixed(2)}T`; if(n>=1e9)return`$${(n/1e9).toFixed(1)}B`; return`$${(n/1e6).toFixed(0)}M`; };
const pct = n => n==null?'—':`${n>0?'+':''}${fmt(n)}%`;
const clr = n => n>0?'c-green':n<0?'c-red':'c-dim2';

// ── 신호 뱃지 ────────────────────────────────────
function SignalBadge({ signal }) {
  const map = { BUY:['badge-buy','📗 매수'], HOLD:['badge-hold','🟡 보유'],
                WAIT:['badge-wait','🔴 대기'], NEUTRAL:['badge-hold','🟡 중립'],
                DANGER:['badge-danger','⛔ 위험'], UNKNOWN:['badge-lock','？'] };
  const [cls, label] = map[signal] || map.UNKNOWN;
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ── 업사이드 바 ───────────────────────────────────
function UpsideBar({ cur, fair, low, high }) {
  if(!cur||!fair) return null;
  const mn=Math.min(low??fair*.6,cur*.8), mx=Math.max(high??fair*1.4,cur*1.2);
  const range=mx-mn;
  const curP=Math.max(2,Math.min(96,(cur-mn)/range*100));
  const fairP=Math.max(2,Math.min(96,(fair-mn)/range*100));
  const up=(fair-cur)/cur*100;
  const col=up>0?'var(--green)':'var(--red)';
  return(
    <div className="upside-bar-wrap">
      <div className="upside-bar">
        <div className="upside-range" style={{left:`${Math.min(curP,fairP)}%`,width:`${Math.abs(fairP-curP)}%`,background:col,opacity:.35}}/>
        <div className="upside-dot" style={{left:`${curP}%`,background:'var(--text)'}}/>
        <div className="upside-dot" style={{left:`${fairP}%`,background:'var(--gold)'}}/>
      </div>
      <div className={`upside-pct ${up>0?'c-green':up<0?'c-red':'c-dim2'}`}>{pct(up)}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 탭 1: 매크로
// ══════════════════════════════════════════════════
function MacroPage({ macro }) {
  const m = { ...MACRO_INIT, ...macro };
  const spGap = ((m.sp500 - m.sp500_dcf_fair)/m.sp500_dcf_fair*100).toFixed(1);
  const stockBondPremium = m.treasury_10y ? (100/22 - m.treasury_10y).toFixed(2) : null;

  const regimeColor = m.stock_cash_ratio >= 60 ? 'card-gold' : 'card-red';
  const sectors = [
    { name:'AI / IT 인프라', stars:5, col:'var(--green)' },
    { name:'헬스케어', stars:4, col:'var(--green)' },
    { name:'커뮤니케이션·AI', stars:3, col:'var(--gold)' },
    { name:'필수소비재', stars:3, col:'var(--gold)' },
    { name:'임의소비재', stars:2, col:'var(--dim2)' },
    { name:'부동산(REIT)', stars:1, col:'var(--red)' },
  ];
  const events = [
    { sym:'ORCL', desc:'Q4 실적 발표', date:'오늘', urgent:true },
    { sym:'FED',  desc:'FOMC 회의', date:'7/29~30', urgent:false },
    { sym:'NTRA', desc:'Q2 실적 발표', date:'8/18', urgent:false },
  ];

  return(
    <div>
      <div className="page-title">📡 매크로</div>

      {/* 레짐 판단 */}
      <div className={`card ${regimeColor}`}>
        <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--gold)',marginBottom:6}}>현재 시장 레짐</div>
        <div style={{fontSize:18,fontWeight:700,color:'#fff',marginBottom:4}}>
          {m.stock_cash_ratio>=65?'🟢':m.stock_cash_ratio>=55?'🟡':'🔴'} {m.regime || '후기사이클'}
        </div>
        <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.6}}>
          {m.regime_detail || '금리 고점 유지 + AI 섹터 강세'}<br/>
          권고 주식/현금: <strong className="c-gold">{m.stock_cash_ratio} / {100-m.stock_cash_ratio}</strong>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid2">
        <MacroCell label="Fed 기준금리" val={`${m.fed_rate??3.75}%`} sub="Warsh 체제" col="var(--red)"/>
        <MacroCell label="10Y 국채" val={`${m.treasury_10y??4.42}%`} sub={`주식프리미엄 ${stockBondPremium??'+0.1'}%`} col="var(--red)"/>
        <MacroCell label="S&P 500" val={(m.sp500||7420).toLocaleString()} sub={`DCF 적정가 ${(m.sp500_dcf_fair||7180).toLocaleString()} (${spGap}%)`} col="var(--gold)"/>
        <MacroCell label="Shiller CAPE" val={`${m.shiller_cape??37}x`} sub="역사 평균 17x" col="var(--red)"/>
        <MacroCell label="ISM PMI" val={m.ism_pmi??48.9} sub={(m.ism_pmi??48.9)<50?"수축권":"확장권"} col={(m.ism_pmi??48.9)<50?'var(--red)':'var(--green)'}/>
        <MacroCell label="달러/원" val={(m.usd_krw??1384).toLocaleString()} sub="환차익 발생 중" col="var(--green)"/>
        <MacroCell label="버핏 지수" val={`${m.buffett_indicator??196}%`} sub="닷컴버블 초과" col="var(--red)"/>
        <MacroCell label="달러(DXY)" val={m.dxy??105} sub="해외매출 역풍" col="var(--red)"/>
      </div>

      {/* 이벤트 */}
      <div className="section-title">이번 주 이벤트</div>
      <div className="card">
        {events.map((e,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:i<events.length-1?'1px solid var(--line)':'none'}}>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <span className="mono" style={{fontWeight:700,color:'#fff',fontSize:13}}>{e.sym}</span>
              <span style={{fontSize:11,color:'var(--dim2)'}}>{e.desc}</span>
            </div>
            <span style={{fontSize:11,color:e.urgent?'var(--red)':'var(--gold)',fontWeight:e.urgent?700:400}}>
              {e.urgent?'⚠️ ':''}{e.date}
            </span>
          </div>
        ))}
      </div>

      {/* 섹터 */}
      <div className="section-title">섹터 선호도 (현 레짐 기준)</div>
      <div className="card">
        {sectors.map((s,i)=>(
          <div key={i} style={{marginBottom:i<sectors.length-1?10:0}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
              <span style={{fontSize:12,color:'var(--text)'}}>{s.name}</span>
              <span style={{fontSize:12,color:s.col}}>{'★'.repeat(s.stars)+'☆'.repeat(5-s.stars)}</span>
            </div>
            <div className="seg-bar-bg"><div className="seg-bar-fill" style={{width:`${s.stars*20}%`,background:s.col}}/></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MacroCell({ label, val, sub, col }) {
  return(
    <div className="card" style={{margin:0}}>
      <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--dim)',marginBottom:3}}>{label}</div>
      <div className="mono" style={{fontSize:20,fontWeight:700,color:col||'var(--text)'}}>{val}</div>
      <div style={{fontSize:10,color:'var(--dim2)',marginTop:2}}>{sub}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 탭 2: 종목
// ══════════════════════════════════════════════════
function StocksPage({ prices, loading, macro }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const treasury = macro?.treasury_10y || 4.42;

  const stocks = Object.entries(STOCK_UNIVERSE).map(([sym, s]) => {
    const p = prices[sym];
    const cur = p?.price;
    const composite = calcCompositeSignal(s, cur, treasury);
    const tenScore = calcTenBaggerScore(s);
    const pePerc = cur && s.eps_ttm > 0
      ? calcPEPercentile(cur/s.eps_ttm, s.pe_hist_avg_5y, s.pe_hist_min_5y, s.pe_hist_max_5y)
      : null;
    return { sym, ...s, cur, chg: p?.change, high52: p?.high52, low52: p?.low52,
             pe: cur && s.eps_ttm > 0 ? cur/s.eps_ttm : null, signal: composite.signal,
             composite, tenScore, pePerc };
  });

  const filtered = filter === 'all' ? stocks
    : filter === 'portfolio' ? stocks.filter(s=>s.type==='portfolio'||s.type==='locked')
    : stocks.filter(s=>s.signal===filter.toUpperCase());

  const buyCnt = stocks.filter(s=>s.type!=='locked'&&s.signal==='BUY').length;
  const holdCnt = stocks.filter(s=>s.type!=='locked'&&s.signal==='HOLD').length;
  const waitCnt = stocks.filter(s=>s.type!=='locked'&&(s.signal==='WAIT'||s.signal==='DANGER')).length;

  // 상관관계 경보
  const aiStocks = stocks.filter(s=>s.type==='portfolio'&&['AI 반도체','AI·클라우드','클라우드·AI','소비자 기술','클라우드·이커머스'].includes(s.sector));
  const aiConc = aiStocks.reduce((sum,s)=>sum+(s.cur||0),0)/stocks.filter(s=>s.type==='portfolio').reduce((sum,s)=>sum+(s.cur||0),0)*100;

  if (selected) {
    const s = stocks.find(x=>x.sym===selected);
    return <StockDetail stock={s} onBack={()=>setSelected(null)} treasury={treasury}/>;
  }

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 16px 8px'}}>
        <div style={{fontSize:22,fontWeight:700,color:'#fff'}}>📊 종목</div>
        <div style={{display:'flex',gap:5}}>
          {[['BUY',buyCnt,'var(--green)'],['HOLD',holdCnt,'var(--gold)'],['WAIT',waitCnt,'var(--red)']].map(([s,c,col])=>(
            <div key={s} style={{background:`${col}20`,border:`1px solid ${col}40`,borderRadius:20,padding:'3px 8px',fontSize:9,fontWeight:700,color:col}}>{s} {c}</div>
          ))}
        </div>
      </div>

      {/* 상관관계 경보 */}
      {aiConc > 50 && (
        <div className="alert alert-warn">
          <span className="alert-icon">⚠️</span>
          <div className="alert-body">
            <div className="alert-title" style={{color:'var(--red)'}}>AI섹터 집중도 높음</div>
            <div className="alert-text">빅테크·반도체 {aiConc.toFixed(0)}% 집중. 조정 시 동반 하락 가능.</div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="tab-scroll">
        {[['all','전체'],['portfolio','보유'],['BUY','🟢 매수'],['HOLD','🟡 보유'],['WAIT','🔴 대기']].map(([k,l])=>(
          <div key={k} className={`tab-chip ${filter===k?'active':''}`} onClick={()=>setFilter(k)}>{l}</div>
        ))}
      </div>

      {loading && <div className="loading"><div className="spinner"/><span>가격 로딩 중...</span></div>}

      {filtered.map(s=>{
        if(s.type==='locked') return(
          <div key={s.sym} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center',opacity:.6}}>
            <div>
              <div className="mono" style={{fontWeight:700,color:'var(--dim2)'}}>{s.sym}</div>
              <div style={{fontSize:11,color:'var(--dim)'}}>{s.locked_note}</div>
            </div>
            <span className="badge badge-lock">🔒 예외</span>
          </div>
        );

        const up = s.cur && s.fair_value ? (s.fair_value-s.cur)/s.cur*100 : null;
        const borderCol = s.signal==='BUY'?'var(--green)':s.signal==='HOLD'?'var(--gold)':s.signal==='DANGER'?'var(--red)':'var(--line)';

        return(
          <div key={s.sym} className="card" style={{borderLeft:`3px solid ${borderCol}`,cursor:'pointer'}}
               onClick={()=>setSelected(s.sym)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
              <div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span className="mono" style={{fontWeight:700,fontSize:15,color:'#fff'}}>{s.sym}</span>
                  <SignalBadge signal={s.signal}/>
                  {s.type==='watch'&&<span style={{fontSize:9,color:'var(--dim)',border:'1px solid var(--line2)',borderRadius:3,padding:'1px 5px'}}>트래킹</span>}
                </div>
                <div style={{fontSize:11,color:'var(--dim2)',marginTop:1}}>{s.name} · {s.sector}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:17,fontWeight:700,color:'#fff'}}>
                  {s.cur?`$${fmt(s.cur)}`:(loading?'..':'—')}
                </div>
                {s.chg!=null&&<div className={`mono ${clr(s.chg)}`} style={{fontSize:11,marginTop:1}}>
                  {s.chg>0?'▲':'▼'} {Math.abs(s.chg).toFixed(2)}%
                </div>}
              </div>
            </div>

            <UpsideBar cur={s.cur} fair={s.fair_value} low={s.fair_low} high={s.fair_high}/>

            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>
              {s.fair_value&&<Pill>기대값 <b className="c-gold">${fmt(s.fair_value,0)}</b></Pill>}
              {s.pe&&<Pill>PE <b>{fmt(s.pe,1)}x</b></Pill>}
              {s.pePerc!=null&&<Pill>5y <b style={{color:s.pePerc>70?'var(--red)':s.pePerc<30?'var(--green)':'var(--gold)'}}>{s.pePerc}%</b></Pill>}
              {s.piotroski!=null&&<Pill>F-Score <b className={s.piotroski>=7?'c-green':s.piotroski>=4?'c-gold':'c-red'}>{s.piotroski}/9</b></Pill>}
              {s.guru_cost&&<Pill className="c-dim">{s.guru_cost_type==='확인값'?'✓':''} 구루 ${s.guru_cost}</Pill>}
            </div>

            {/* 실적 이벤트 경보 */}
            {s.event_date&&isWithin5Days(s.event_date)&&(
              <div style={{marginTop:6,fontSize:10,color:'var(--red)',fontWeight:600}}>
                ⚠️ 실적 발표 {s.event_date} 임박 — 신규 진입 주의
              </div>
            )}
          </div>
        );
      })}

      <div style={{height:16}}/>
    </div>
  );
}

function Pill({ children }) {
  return <div style={{background:'var(--bg3)',borderRadius:6,padding:'3px 8px',fontSize:10,color:'var(--dim2)'}}>{children}</div>;
}

function isWithin5Days(dateStr) {
  if(!dateStr) return false;
  const diff = (new Date(dateStr)-new Date())/86400000;
  return diff >= 0 && diff <= 5;
}

// ── 종목 상세 ────────────────────────────────────
function StockDetail({ stock: s, onBack, treasury }) {
  if(!s) return null;
  const composite = calcCompositeSignal(s, s.cur, treasury);
  const dcf = calcReverseDCF(s, s.cur);
  const fcf = calcFCFYield(s, s.cur, treasury);
  const piot = calcPiotroski(s.piotroski);
  const ben = calcBeneish(s.beneish_m);
  const roic = calcROICWACC(s.roic, s.wacc);
  const mom = calcMomentum(s.mom_12_1);
  const pe = s.cur && s.eps_ttm > 0 ? s.cur/s.eps_ttm : null;
  const pePerc = pe ? calcPEPercentile(pe, s.pe_hist_avg_5y, s.pe_hist_min_5y, s.pe_hist_max_5y) : null;
  const posSize = composite.score > 0 ? calcPositionSize(parseFloat(composite.score), parseFloat(dcf.gap||0)) : 0;
  const up = s.cur && s.fair_value ? (s.fair_value-s.cur)/s.cur*100 : null;
  const stopLoss = s.cur ? s.cur * 0.8 : null;

  const trendIcon = t => t==='accel'?'↑ 가속':'가속'?t==='down'?'↓ 둔화':'→ 안정':'→';
  const trendCol = t => t==='accel'?'var(--green)':t==='down'?'var(--red)':'var(--dim2)';

  return(
    <div>
      {/* 헤더 */}
      <div style={{padding:'16px 16px 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontSize:11,color:'var(--dim)',cursor:'pointer',marginBottom:4}} onClick={onBack}>← 뒤로</div>
          <div className="mono" style={{fontSize:24,fontWeight:700,color:'#fff'}}>{s.sym}</div>
          <div style={{fontSize:11,color:'var(--dim2)',marginTop:1}}>{s.name} · {s.sector}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div className="mono" style={{fontSize:28,fontWeight:700,color:'#fff'}}>{s.cur?`$${fmt(s.cur)}`:'—'}</div>
          {s.chg!=null&&<div className={`mono ${clr(s.chg)}`} style={{fontSize:12,marginTop:2}}>
            {s.chg>0?'▲':'▼'} {Math.abs(s.chg).toFixed(2)}%
          </div>}
        </div>
      </div>

      {/* 핵심 판단 */}
      <div className={`card ${composite.signal==='BUY'?'card-green':composite.signal==='DANGER'?'card-red':'card-gold'}`} style={{marginTop:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <SignalBadge signal={composite.signal}/>
          <span style={{fontSize:10,color:'var(--dim)'}}>종합 점수: {composite.score}</span>
        </div>
        {composite.signal==='BUY'&&(
          <div style={{fontSize:12,color:'var(--text)',lineHeight:1.7}}>
            목표가 <strong className="c-gold">${fmt(s.fair_value,0)}</strong> (+{fmt(up)}%)<br/>
            권고 포지션: <strong className="c-gold">자산의 {posSize}%</strong><br/>
            손절 기준: <strong className="c-red">${fmt(stopLoss)} (-20%)</strong>
          </div>
        )}
        {composite.signal==='DANGER'&&(
          <div style={{fontSize:12,color:'var(--red)'}}>{composite.reason}</div>
        )}
        {['HOLD','NEUTRAL','WAIT'].includes(composite.signal)&&(
          <div style={{fontSize:12,color:'var(--text)',lineHeight:1.7}}>
            기대값: <strong className="c-gold">${fmt(s.fair_value,0)}</strong> ({pct(up)})<br/>
            {composite.signal==='WAIT'?'진입 보류 — 추가 신호 확인 필요':'보유 유지 — 급격한 변화 없음'}
          </div>
        )}
      </div>

      {/* 밸류에이션 */}
      <div className="section-title">밸류에이션</div>
      <div className="card">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <MetricItem label="PE(TTM)" val={pe?`${fmt(pe,1)}x`:'N/A'} note={pePerc?`5y 백분위 ${pePerc}%`:null} warn={pePerc>70}/>
          <MetricItem label="5y 평균 PE" val={s.pe_hist_avg_5y?`${s.pe_hist_avg_5y}x`:'—'}/>
          <MetricItem label="FCF Yield" val={s.cur&&s.fcf_annual?`${((s.fcf_annual-s.sbc_annual)/(s.cur*s.shares_out)*100).toFixed(2)}%`:'—'} note={`채권 대비 ${fmt(fcf.premium)}%p`} warn={parseFloat(fcf.premium)<0}/>
          <MetricItem label="ROIC-WACC" val={`+${roic.spread}%p`} ok={parseFloat(roic.spread)>10}/>
          <MetricItem label="주주수익률" val={s.fcf_annual&&s.sbc_annual&&s.shares_out&&s.cur?`${(((s.fcf_annual-s.sbc_annual)/(s.cur*s.shares_out))*100).toFixed(1)}%`:'—'}/>
          <MetricItem label="SBC 조정 FCF" val={s.fcf_annual&&s.sbc_annual?fmtK(s.fcf_annual-s.sbc_annual):'—'}/>
        </div>
        {dcf.gap&&(
          <div style={{marginTop:10,padding:8,background:'var(--bg3)',borderRadius:8}}>
            <div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>역산 DCF — PIE 갭</div>
            <div style={{fontSize:12,color:'var(--text)'}}>
              기대값 대비 <strong className={dcf.gap>0?'c-green':'c-red'}>{dcf.gap>0?'+':''}{dcf.gap}%</strong> {dcf.label}
            </div>
          </div>
        )}
      </div>

      {/* 품질 */}
      <div className="section-title">품질 지표 (자동 계산)</div>
      <div className="card">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <MetricItem label="Piotroski F" val={`${s.piotroski??'—'}/9`} ok={s.piotroski>=7} warn={s.piotroski<4}/>
          <MetricItem label="Beneish M" val={s.beneish_m??'—'} ok={ben.pass} warn={!ben.pass} note={ben.pass?'안전':'⛔조작의심'}/>
          <MetricItem label="Altman Z" val={s.altman_z??'—'} ok={s.altman_z>2.99} warn={s.altman_z&&s.altman_z<1.81}/>
          <MetricItem label="WACC(추정)" val={s.wacc?`${s.wacc}%`:'—'}/>
        </div>
      </div>

      {/* 모멘텀 */}
      <div className="section-title">모멘텀 신호</div>
      <div className="card">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <MetricItem label="가격모멘텀(12-1M)" val={s.mom_12_1!=null?`${s.mom_12_1>0?'+':''}${s.mom_12_1}%`:'—'} ok={s.mom_12_1>10} warn={s.mom_12_1<-10}/>
          <MetricItem label="어닝 리비전" val={s.erv_score!=null?`${s.erv_score>0?'+':''}${s.erv_score}`:'—'} ok={s.erv_score>0.2} warn={s.erv_score<-0.2}/>
        </div>
        {s.high52&&s.low52&&s.cur&&(
          <div style={{marginTop:8,fontSize:11,color:'var(--dim2)'}}>
            52주 범위: ${fmt(s.low52)} ~ ${fmt(s.high52)} · 현재 위치 {(((s.cur-s.low52)/(s.high52-s.low52))*100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* 매출 세그먼트 */}
      {s.segments&&s.segments.length>0&&(
        <>
          <div className="section-title">매출 세그먼트</div>
          <div className="card">
            {s.segments.map((seg,i)=>(
              <div key={i} style={{marginBottom:i<s.segments.length-1?10:0}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:12,color:'var(--text)'}}>{seg.name}</span>
                  <span style={{fontSize:11}}>
                    <span style={{color:'var(--dim2)'}}>{seg.pct}%</span>
                    {' · '}
                    <span style={{color:trendCol(seg.trend),fontWeight:600}}>{seg.growth>0?'+':''}{seg.growth}%</span>
                    {' '}
                    <span style={{fontSize:9,color:trendCol(seg.trend)}}>{trendIcon(seg.trend)}</span>
                  </span>
                </div>
                <div className="seg-bar-bg">
                  <div className="seg-bar-fill" style={{width:`${seg.pct}%`,background:trendCol(seg.trend)}}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 핵심 리스크·기회 */}
      {(s.key_risk||s.key_oppty)&&(
        <>
          <div className="section-title">리스크 & 기회</div>
          {s.key_risk&&<div className="alert alert-warn"><span className="alert-icon">⚠️</span><div className="alert-text">{s.key_risk}</div></div>}
          {s.key_oppty&&<div className="alert alert-green"><span className="alert-icon">✅</span><div className="alert-text">{s.key_oppty}</div></div>}
        </>
      )}

      {/* 구루 */}
      {s.guru_cost&&(
        <>
          <div className="section-title">구루 포지션</div>
          <div className="card">
            <div style={{fontSize:12,color:'var(--text)',lineHeight:1.7}}>
              추정 매수가: <strong className="c-gold">${s.guru_cost}</strong>
              <span style={{fontSize:10,color:'var(--dim)',marginLeft:4}}>({s.guru_cost_type})</span><br/>
              {s.cur&&<>현재가: ${fmt(s.cur)} <strong className={s.cur<s.guru_cost?'c-green':'c-red'}>
                ({s.cur<s.guru_cost?'구루보다 저렴':'구루보다 비쌈'} {Math.abs((s.cur-s.guru_cost)/s.guru_cost*100).toFixed(1)}%)
              </strong><br/></>}
              <span style={{fontSize:11,color:'var(--dim2)'}}>{s.guru_note}</span>
            </div>
          </div>
        </>
      )}

      <div style={{height:20}}/>
    </div>
  );
}

function MetricItem({ label, val, note, ok, warn }) {
  const valCol = ok?'var(--green)':warn?'var(--red)':'var(--text)';
  return(
    <div style={{background:'var(--bg3)',borderRadius:8,padding:'8px 10px'}}>
      <div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>{label}</div>
      <div className="mono" style={{fontSize:13,fontWeight:600,color:valCol}}>{val}</div>
      {note&&<div style={{fontSize:9,color:'var(--dim2)',marginTop:2}}>{note}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════
// 탭 3: 텐베거
// ══════════════════════════════════════════════════
function TenBaggerPage() {
  const candidates = Object.entries(STOCK_UNIVERSE)
    .filter(([,s])=>s.type!=='locked')
    .map(([sym,s])=>({sym,...s,ten_score:s.ten_bagger_score||calcTenBaggerScore(s)}))
    .sort((a,b)=>b.ten_score-a.ten_score);

  return(
    <div>
      <div className="page-title">🚀 텐베거</div>
      <div style={{padding:'0 16px 10px',fontSize:11,color:'var(--dim)'}}>
        5년 내 10배 가능성 점수 · Rule of 40 + TAM + 성장가속 + GM트렌드
      </div>

      {candidates.map((s,i)=>{
        const r40 = s.rule_of_40 || (s.gross_margin + s.rev_growth_yoy - 100);
        const col = s.ten_score>=70?'var(--green)':s.ten_score>=50?'var(--gold)':'var(--dim2)';
        const borderCol = s.ten_score>=70?'var(--green-bd)':s.ten_score>=50?'var(--gold-bd)':'var(--line)';
        return(
          <div key={s.sym} className="card" style={{borderLeft:`3px solid ${borderCol}`}}>
            <div style={{display:'flex',gap:12,marginBottom:10}}>
              {/* 점수 원 */}
              <div style={{width:54,height:54,borderRadius:'50%',border:`2px solid ${col}`,background:`${col}15`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <div className="mono" style={{fontSize:18,fontWeight:700,color:col,lineHeight:1}}>{s.ten_score}</div>
                <div style={{fontSize:8,color:col}}>점</div>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4}}>
                  <span className="mono" style={{fontSize:15,fontWeight:700,color:'#fff'}}>{s.sym}</span>
                  {s.ten_score>=70&&<span className="badge badge-ten">텐베거 후보</span>}
                  {s.ten_score>=50&&s.ten_score<70&&<span className="badge badge-hold">관심 후보</span>}
                </div>
                <div style={{fontSize:12,color:'var(--dim2)'}}>{s.name}</div>
              </div>
            </div>

            {/* 핵심 지표 */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
              <TenMetric label="Rule of 40" val={r40>0?`${r40.toFixed(0)}점`:'해당없음'} ok={r40>40}/>
              <TenMetric label="매출성장 가속" val={s.rev_growth_accel>0?`+${s.rev_growth_accel}%p`:`${s.rev_growth_accel}%p`} ok={s.rev_growth_accel>2}/>
              <TenMetric label="GM 트렌드" val={s.gm_trend>0?`+${s.gm_trend}%p`:`${s.gm_trend}%p`} ok={s.gm_trend>1}/>
              <TenMetric label="TAM 침투율" val={s.tam_penetration?`${s.tam_penetration}%`:'추정 불명'} ok={s.tam_penetration&&s.tam_penetration<5}/>
            </div>

            {s.ten_narrative&&(
              <div style={{background:'var(--bg3)',borderRadius:8,padding:8,fontSize:10,color:'var(--dim2)',lineHeight:1.6}}>
                {s.ten_narrative}
              </div>
            )}
          </div>
        );
      })}

      {/* 탈락 기준 */}
      <div className="section-title">텐베거 탈락 기준</div>
      <div className="card">
        <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.8}}>
          ❌ Rule of 40 {'< 20'} (성장+수익성 모두 약함)<br/>
          ❌ 매출성장 2분기 연속 둔화<br/>
          ❌ GM 3분기 연속 하락 (경쟁심화)<br/>
          ❌ Beneish M {'>-1.78'} (실적조작 의심)
        </div>
      </div>
      <div style={{height:16}}/>
    </div>
  );
}

function TenMetric({ label, val, ok }) {
  return(
    <div style={{background:'var(--bg3)',borderRadius:8,padding:'7px 10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:10,color:'var(--dim)'}}>{label}</span>
      <span className="mono" style={{fontSize:11,fontWeight:600,color:ok?'var(--green)':'var(--dim2)'}}>{val}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 탭 4: 구루
// ══════════════════════════════════════════════════
function GuruPage({ prices }) {
  const tierColor = t => t===1?'var(--green)':'var(--blue)';
  const actionBadge = a => {
    const m = { NEW:'badge-buy', ADD:'badge-buy', HOLD:'badge-hold', REDUCE:'badge-hold', SOLD:'badge-wait' };
    const l = { NEW:'신규', ADD:'추가', HOLD:'보유', REDUCE:'축소', SOLD:'매도' };
    return { cls: m[a]||'badge-hold', label: l[a]||a };
  };

  return(
    <div>
      <div className="page-title">🧠 구루</div>
      <div style={{padding:'0 16px 10px',fontSize:11,color:'var(--dim)'}}>Q1 2026 13F 기준 · 분기별 자동 갱신</div>

      {GURU_POSITIONS.map(g=>(
        <div key={g.id} className="card" style={{borderTop:`3px solid ${tierColor(g.tier)}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>{g.name}</div>
              <div style={{fontSize:10,color:'var(--dim2)',marginTop:1}}>{g.fund} · AUM ${g.aum_b}B</div>
            </div>
            <div style={{fontSize:8,padding:'3px 8px',borderRadius:10,background:`${tierColor(g.tier)}20`,color:tierColor(g.tier),border:`1px solid ${tierColor(g.tier)}40`,fontWeight:700}}>
              T{g.tier} · {g.updated}
            </div>
          </div>

          {g.positions.map((pos,j)=>{
            const { cls, label } = actionBadge(pos.action);
            const cur = prices[pos.sym]?.price;
            const diff = cur&&pos.cost_est ? (pos.cost_est-cur)/pos.cost_est*100 : null;
            return(
              <div key={j} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:j<g.positions.length-1?'1px solid var(--line)':'none'}}>
                <div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span className="mono" style={{fontWeight:700,fontSize:12,color:'#fff'}}>{pos.sym}</span>
                    <span className={`badge ${cls}`}>{label}</span>
                    {pos.cost_type==='확인값'&&<span style={{fontSize:8,color:'var(--green)'}}>✓확인</span>}
                  </div>
                  <div style={{fontSize:9,color:'var(--dim)',marginTop:2}}>{pos.shares}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  {pos.cost_est&&<div style={{fontSize:10,color:'var(--gold)'}}>추정 ${pos.cost_est}</div>}
                  {cur&&<div className={`mono ${diff>0?'c-green':'c-red'}`} style={{fontSize:10,marginTop:1}}>
                    현재 ${fmt(cur)} ({diff>0?'저렴':'비쌈'} {Math.abs(diff).toFixed(1)}%)
                  </div>}
                  {pos.note&&<div style={{fontSize:9,color:'var(--dim2)',marginTop:2,maxWidth:140}}>{pos.note}</div>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div style={{height:16}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 탭 5: 포트폴리오
// ══════════════════════════════════════════════════
function PortfolioPage({ prices }) {
  const [trades, setTrades] = useState([]);
  const [form, setForm] = useState({ sym:'', action:'매수', price:'', qty:'', note:'' });
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    fetch('/api/store?type=trades').then(r=>r.json()).then(d=>setTrades(d.trades||[]));
  },[]);

  const addTrade = async () => {
    if(!form.sym||!form.price||!form.qty) return;
    setLoading(true);
    const r = await fetch('/api/store?type=trades',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    const d = await r.json();
    if(d.ok) { setTrades(t=>[...t,d.trade]); setForm({sym:'',action:'매수',price:'',qty:'',note:''}); }
    setLoading(false);
  };

  const stats = calcPortfolioStats(trades, prices);

  // 상관관계 (단순화)
  const ownedSyms = [...new Set(trades.filter(t=>t.action==='매수').map(t=>t.sym))];
  const aiCount = ownedSyms.filter(s=>STOCK_UNIVERSE[s]&&['AI 반도체','AI·클라우드','클라우드·AI'].includes(STOCK_UNIVERSE[s].sector)).length;
  const highCorr = aiCount >= 3;

  return(
    <div>
      <div className="page-title">💼 포트폴리오</div>

      {stats&&(
        <>
          {/* 총 손익 */}
          <div className="card card-gold">
            <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>전략 운용 수익률</div>
            <div className="mono" style={{fontSize:24,fontWeight:700,color:stats.total_return>=0?'var(--green)':'var(--red)'}}>
              {stats.total_return>=0?'+':''}{fmt(stats.total_return)}%
            </div>
            <div style={{fontSize:12,color:'var(--dim2)',marginTop:2}}>
              투자금액 {fmtK(stats.total_cost)} → 현재 {fmtK(stats.total_value)}
            </div>
          </div>

          {highCorr&&(
            <div className="alert alert-warn">
              <span className="alert-icon">⚠️</span>
              <div className="alert-body">
                <div className="alert-title" style={{color:'var(--red)'}}>AI섹터 집중 경보</div>
                <div className="alert-text">AI·빅테크 3개 이상 동시 보유. 조정 시 동반 하락 가능.</div>
              </div>
            </div>
          )}

          {/* 종목별 */}
          {stats.positions.length>0&&(
            <div className="card">
              {stats.positions.map((pos,i)=>{
                const s = STOCK_UNIVERSE[pos.sym];
                return(
                  <div key={i} style={{display:'flex',alignItems:'center',padding:'9px 0',borderBottom:i<stats.positions.length-1?'1px solid var(--line)':'none'}}>
                    <div className="mono" style={{fontWeight:700,width:55,color:'#fff'}}>{pos.sym}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:'var(--dim2)'}}>매수 ${fmt(pos.avg_cost)} · {pos.qty}주</div>
                      <div style={{fontSize:10,color:'var(--dim)'}}>현재 {pos.current_price?`$${fmt(pos.current_price)}`:'—'}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div className={`mono ${pos.pnl_pct>=0?'c-green':'c-red'}`} style={{fontSize:13,fontWeight:700}}>
                        {pos.pnl_pct!=null?`${pos.pnl_pct>=0?'+':''}${fmt(pos.pnl_pct)}%`:'—'}
                      </div>
                      {pos.current_value&&<div style={{fontSize:10,color:'var(--dim)',marginTop:1}}>{fmtK(pos.current_value)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 매매 기록 입력 */}
      <div className="section-title">매매 기록</div>
      <div className="card">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div>
            <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>종목</div>
            <input className="input" placeholder="GOOGL" value={form.sym}
              onChange={e=>setForm(f=>({...f,sym:e.target.value.toUpperCase()}))}/>
          </div>
          <div>
            <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>구분</div>
            <select className="input" value={form.action} onChange={e=>setForm(f=>({...f,action:e.target.value}))}>
              <option>매수</option><option>매도</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>가격 ($)</div>
            <input className="input" placeholder="356" type="number" value={form.price}
              onChange={e=>setForm(f=>({...f,price:e.target.value}))}/>
          </div>
          <div>
            <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>수량</div>
            <input className="input" placeholder="5" type="number" value={form.qty}
              onChange={e=>setForm(f=>({...f,qty:e.target.value}))}/>
          </div>
        </div>
        <input className="input" placeholder="메모 (선택)" value={form.note}
          onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={{marginBottom:8}}/>
        <button className="btn btn-gold" onClick={addTrade} disabled={loading}>
          {loading?'저장 중...':'기록 저장'}
        </button>
      </div>

      {trades.length>0&&(
        <>
          <div className="section-title">최근 거래</div>
          {trades.slice().reverse().slice(0,5).map((t,i)=>(
            <div key={i} className="card" style={{padding:'10px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <div><span className="mono" style={{fontWeight:700,color:'#fff'}}>{t.sym}</span>
                  <span style={{fontSize:11,color:t.action==='매수'?'var(--green)':'var(--red)',marginLeft:8}}>{t.action}</span>
                </div>
                <div className="mono" style={{fontSize:11,color:'var(--dim)'}}>{t.date}</div>
              </div>
              <div style={{fontSize:11,color:'var(--dim2)',marginTop:3}}>
                ${fmt(t.price)} × {t.qty}주 = ${fmtK(t.price*t.qty)}
              </div>
              {t.note&&<div style={{fontSize:10,color:'var(--dim)',marginTop:2}}>{t.note}</div>}
            </div>
          ))}
        </>
      )}
      <div style={{height:16}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 탭 6: 투자일지
// ══════════════════════════════════════════════════
function JournalPage() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ sym:'', action:'매수', price:'', reason:'', expected:'' });
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    fetch('/api/store?type=journal').then(r=>r.json()).then(d=>setEntries(d.entries||[]));
  },[]);

  const addEntry = async () => {
    if(!form.sym||!form.reason) return;
    setLoading(true);
    const r = await fetch('/api/store?type=journal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    const d = await r.json();
    if(d.ok) { setEntries(e=>[d.entry,...e]); setForm({sym:'',action:'매수',price:'',reason:'',expected:''}); }
    setLoading(false);
  };

  // 통계
  const closed = entries.filter(e=>e.status==='closed');
  const wins = closed.filter(e=>e.result?.includes('수익')||e.result?.includes('+')).length;
  const winRate = closed.length>0 ? (wins/closed.length*100).toFixed(0) : null;

  return(
    <div>
      <div className="page-title">📔 투자일지</div>

      {winRate&&(
        <div className="grid2">
          <MacroCell label="승률" val={`${winRate}%`} sub={`${wins}승 ${closed.length-wins}패`} col="var(--green)"/>
          <MacroCell label="기록" val={`${entries.length}건`} sub={`완료 ${closed.length}건`} col="var(--gold)"/>
        </div>
      )}

      {/* 새 기록 */}
      <div className="section-title">새 기록 작성</div>
      <div className="card">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div>
            <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>종목</div>
            <input className="input" placeholder="GOOGL" value={form.sym}
              onChange={e=>setForm(f=>({...f,sym:e.target.value.toUpperCase()}))}/>
          </div>
          <div>
            <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>가격 ($)</div>
            <input className="input" placeholder="356" value={form.price}
              onChange={e=>setForm(f=>({...f,price:e.target.value}))}/>
          </div>
        </div>
        <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>왜 샀는가 / 팔았는가?</div>
        <textarea className="input" placeholder="DCF 저평가 + 버크셔 매수 + 클라우드 +48%..."
          value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} style={{marginBottom:8}}/>
        <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>기대하는 결과</div>
        <input className="input" placeholder="12개월 내 $450 도달" value={form.expected}
          onChange={e=>setForm(f=>({...f,expected:e.target.value}))} style={{marginBottom:8}}/>
        <button className="btn btn-gold" onClick={addEntry} disabled={loading}>
          {loading?'저장 중...':'저장 & 저장'}
        </button>
      </div>

      {/* 기존 일지 */}
      {entries.map((e,i)=>(
        <div key={i} className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span className="mono" style={{fontWeight:700,fontSize:13,color:'#fff'}}>{e.sym}</span>
              {e.price&&<span style={{fontSize:11,color:'var(--dim2)'}}>${e.price}</span>}
              <span className={`badge ${e.status==='closed'?'badge-hold':'badge-buy'}`}>
                {e.status==='closed'?'완료':'진행 중'}
              </span>
            </div>
            <div style={{fontSize:10,color:'var(--dim)'}}>{e.date}</div>
          </div>
          <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.6,marginBottom:6}}>{e.reason}</div>
          {e.expected&&<div style={{fontSize:10,color:'var(--gold)',marginBottom:6}}>기대: {e.expected}</div>}
          {e.result&&(
            <div style={{background:'var(--bg3)',borderRadius:8,padding:8,fontSize:11}}>
              <div style={{color:'var(--text)',marginBottom:4}}>결과: {e.result}</div>
              {e.analysis&&<div style={{fontSize:10,color:'var(--dim2)',lineHeight:1.5,borderTop:'1px solid var(--line)',paddingTop:4,marginTop:4}}>
                🔍 {e.analysis}
              </div>}
            </div>
          )}
        </div>
      ))}

      {entries.length===0&&(
        <div className="empty-state">
          <div className="empty-icon">📔</div>
          <div className="empty-title">아직 기록이 없습니다</div>
          <div className="empty-sub">첫 매수·매도 이유를 기록해보세요</div>
        </div>
      )}
      <div style={{height:16}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 메인 앱
// ══════════════════════════════════════════════════
const TABS = [
  { id:'macro',  icon:'🌍', label:'매크로' },
  { id:'stocks', icon:'📊', label:'종목' },
  { id:'ten',    icon:'🚀', label:'텐베거' },
  { id:'guru',   icon:'🧠', label:'구루' },
  { id:'port',   icon:'💼', label:'포트' },
  { id:'journal',icon:'📔', label:'일지' },
];

export default function App() {
  const [tab, setTab] = useState('stocks');
  const [prices, setPrices] = useState({});
  const [macro, setMacro] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);

  const fetchPrices = useCallback(async () => {
    setPriceLoading(true);
    try {
      const [pRes, mRes] = await Promise.allSettled([
        fetch('/api/prices').then(r=>r.json()),
        fetch('/api/macro').then(r=>r.json()),
      ]);
      if(pRes.status==='fulfilled') setPrices(pRes.value.prices||{});
      if(mRes.status==='fulfilled') setMacro(mRes.value.macro);
    } catch(e) { console.error(e); }
    setPriceLoading(false);
  }, []);

  useEffect(()=>{
    fetchPrices();
    const id = setInterval(fetchPrices, 5*60*1000); // 5분마다
    return ()=>clearInterval(id);
  },[fetchPrices]);

  const updatedAt = prices.GOOGL?.fetched
    ? new Date(prices.GOOGL.fetched).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})
    : null;

  return(
    <>
      <Head>
        <title>투자 대시보드</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <meta name="theme-color" content="#09090f"/>
      </Head>

      <div className="app">
        {/* 상태 바 영역 */}
        <div style={{background:'var(--bg)',paddingTop:'env(safe-area-inset-top)',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 16px 6px',borderBottom:'1px solid var(--line)'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--gold)'}}>📊 투자 대시보드</div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {updatedAt&&<span style={{fontSize:9,color:'var(--dim)'}}>갱신 {updatedAt}</span>}
              <button onClick={fetchPrices} style={{background:'var(--bg3)',border:'1px solid var(--line2)',borderRadius:6,color:'var(--dim2)',fontSize:10,padding:'3px 8px',cursor:'pointer'}}>
                {priceLoading?'⏳':'🔄'}
              </button>
            </div>
          </div>
        </div>

        {/* 페이지 영역 */}
        <div className="page-area">
          {tab==='macro'   && <MacroPage macro={macro}/>}
          {tab==='stocks'  && <StocksPage prices={prices} loading={priceLoading} macro={macro}/>}
          {tab==='ten'     && <TenBaggerPage/>}
          {tab==='guru'    && <GuruPage prices={prices}/>}
          {tab==='port'    && <PortfolioPage prices={prices}/>}
          {tab==='journal' && <JournalPage/>}
        </div>

        {/* 하단 네비게이션 */}
        <div className="bottom-nav">
          {TABS.map(t=>(
            <div key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
              {tab===t.id&&<div className="nav-active-dot"/>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
