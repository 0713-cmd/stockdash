import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { STOCK_UNIVERSE, GURU_POSITIONS, MACRO_INIT } from '../lib/data';
import {
  calcCompositeSignal, calcReverseDCF, calcFCFYield,
  calcPiotroski, calcBeneish, calcROICWACC, calcMomentum,
  calcTenBaggerScore, calcPEPercentile, calcPositionSize,
  calcPortfolioStats,
} from '../lib/calculations';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 테마 정의
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const THEMES = {
  dark: {
    label: '🌙 다크', icon: '🌙',
    vars: `
      --bg:#0b0c12;--bg2:#12131e;--bg3:#1a1b2a;--bg4:#222336;
      --text:#dde0f0;--dim:#55597a;--dim2:#8890b0;
      --line:rgba(255,255,255,0.05);--line2:rgba(255,255,255,0.10);
      --gold:#c9a84c;--gold2:#e8c87a;
      --green:#00d98a;--red:#ff3f5c;--blue:#4d9fff;--pur:#9b8fff;
      --green-bg:rgba(0,217,138,.10);--green-bd:rgba(0,217,138,.22);
      --red-bg:rgba(255,63,92,.10);--red-bd:rgba(255,63,92,.22);
      --gold-bg:rgba(201,168,76,.10);--gold-bd:rgba(201,168,76,.28);
      --pur-bg:rgba(155,143,255,.10);--pur-bd:rgba(155,143,255,.28);
      --blue-bg:rgba(77,159,255,.10);--blue-bd:rgba(77,159,255,.28);
    `,
  },
  claude: {
    label: '🟣 Claude', icon: '🟣',
    vars: `
      --bg:#0d0a1a;--bg2:#13102a;--bg3:#1e1a3a;--bg4:#2a2550;
      --text:#f0eaff;--dim:#6050a0;--dim2:#a090d0;
      --line:rgba(180,140,255,0.08);--line2:rgba(180,140,255,0.16);
      --gold:#d4a0ff;--gold2:#e8c8ff;
      --green:#7eeac0;--red:#ff7090;--blue:#90c0ff;--pur:#c084fc;
      --green-bg:rgba(126,234,192,.10);--green-bd:rgba(126,234,192,.25);
      --red-bg:rgba(255,112,144,.10);--red-bd:rgba(255,112,144,.25);
      --gold-bg:rgba(212,160,255,.10);--gold-bd:rgba(212,160,255,.28);
      --pur-bg:rgba(192,132,252,.10);--pur-bd:rgba(192,132,252,.28);
      --blue-bg:rgba(144,192,255,.10);--blue-bd:rgba(144,192,255,.28);
    `,
  },
  finance: {
    label: '📊 Finance', icon: '📊',
    vars: `
      --bg:#071015;--bg2:#0d1a22;--bg3:#122330;--bg4:#1a3040;
      --text:#c8dde8;--dim:#3a5a6a;--dim2:#6a9aaa;
      --line:rgba(100,180,220,0.07);--line2:rgba(100,180,220,0.14);
      --gold:#f0c040;--gold2:#ffe080;
      --green:#00e5a0;--red:#ff4060;--blue:#40c0ff;--pur:#8060ff;
      --green-bg:rgba(0,229,160,.10);--green-bd:rgba(0,229,160,.25);
      --red-bg:rgba(255,64,96,.10);--red-bd:rgba(255,64,96,.25);
      --gold-bg:rgba(240,192,64,.10);--gold-bd:rgba(240,192,64,.28);
      --pur-bg:rgba(128,96,255,.10);--pur-bd:rgba(128,96,255,.28);
      --blue-bg:rgba(64,192,255,.10);--blue-bd:rgba(64,192,255,.28);
    `,
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 유틸
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const fmt = (n, d = 2) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtK = n => { if (!n) return '—'; const a = Math.abs(n); if (a >= 1e12) return `$${(n/1e12).toFixed(2)}T`; if (a >= 1e9) return `$${(n/1e9).toFixed(1)}B`; return `$${(n/1e6).toFixed(0)}M`; };
const pct = (n, d = 1) => n == null ? '—' : `${n > 0 ? '+' : ''}${Number(n).toFixed(d)}%`;
const clr = n => n > 0 ? 'c-green' : n < 0 ? 'c-red' : 'c-dim2';
const sigCol  = s => ({BUY:'var(--green)',HOLD:'var(--gold)',NEUTRAL:'var(--dim2)',WAIT:'var(--red)',DANGER:'var(--red)',UNKNOWN:'var(--dim)'}[s]||'var(--dim)');
const sigBg   = s => ({BUY:'var(--green-bg)',HOLD:'var(--gold-bg)',NEUTRAL:'var(--pur-bg)',WAIT:'var(--red-bg)',DANGER:'var(--red-bg)',UNKNOWN:'var(--bg3)'}[s]||'var(--bg3)');
const sigBd   = s => ({BUY:'var(--green-bd)',HOLD:'var(--gold-bd)',NEUTRAL:'var(--pur-bd)',WAIT:'var(--red-bd)',DANGER:'var(--red-bd)',UNKNOWN:'var(--line2)'}[s]||'var(--line2)');
const sigLbl  = s => ({BUY:'매수',HOLD:'보유',NEUTRAL:'중립',WAIT:'대기',DANGER:'위험',UNKNOWN:'—'}[s]||'—');
const sigIcon = s => ({BUY:'📗',HOLD:'🟡',NEUTRAL:'⬜',WAIT:'🔴',DANGER:'⛔',UNKNOWN:'？'}[s]||'？');

function useLS(key, init) {
  const [val, setVal] = useState(init);
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try { const s = localStorage.getItem(key); if (s) setVal(JSON.parse(s)); } catch {}
  }, [key]);
  const save = useCallback(v => {
    const next = typeof v === 'function' ? v : () => v;
    setVal(prev => {
      const updated = next(prev);
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [key]);
  return [val, save];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 공통 UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SigBadge({ s, sm }) {
  const col=sigCol(s),bg=sigBg(s),bd=sigBd(s);
  return <span style={{display:'inline-flex',alignItems:'center',gap:3,padding:sm?'1px 6px':'2px 8px',borderRadius:20,fontSize:sm?9:10,fontWeight:700,background:bg,border:`1px solid ${bd}`,color:col,whiteSpace:'nowrap'}}>{sigIcon(s)} {sigLbl(s)}</span>;
}

function Chip({ label, val, col }) {
  return <span style={{display:'inline-flex',alignItems:'center',gap:3,padding:'1px 7px',borderRadius:12,fontSize:10,background:'var(--bg3)',border:'1px solid var(--line2)',color:'var(--dim2)'}}><span style={{fontSize:9}}>{label}</span><span style={{fontWeight:700,color:col||'var(--text)'}}>{val}</span></span>;
}

function UpsideBar({ cur, fair, low, high }) {
  if (!cur || !fair) return null;
  const mn=Math.min(low??fair*.65,cur*.85),mx=Math.max(high??fair*1.35,cur*1.15);
  const rng=mx-mn||1,cp=Math.max(2,Math.min(96,(cur-mn)/rng*100)),fp=Math.max(2,Math.min(96,(fair-mn)/rng*100));
  const up=(fair-cur)/cur*100,col=up>0?'var(--green)':'var(--red)';
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
      <div style={{flex:1,height:4,background:'var(--bg4)',borderRadius:2,position:'relative'}}>
        <div style={{position:'absolute',top:0,height:'100%',left:`${Math.min(cp,fp)}%`,width:`${Math.abs(fp-cp)}%`,background:col,opacity:.4,borderRadius:2}}/>
        <div style={{position:'absolute',top:-4,width:12,height:12,borderRadius:'50%',border:'2px solid var(--bg)',background:'var(--dim2)',transform:'translateX(-50%)',left:`${cp}%`}}/>
        <div style={{position:'absolute',top:-4,width:12,height:12,borderRadius:'50%',border:'2px solid var(--bg)',background:'var(--gold)',transform:'translateX(-50%)',left:`${fp}%`}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color:col,minWidth:44,textAlign:'right'}}>{pct(up)}</span>
    </div>
  );
}

function ScoreRing({ score, size=44 }) {
  const r=size/2-4,c=2*Math.PI*r,p=score/100;
  const col=score>=70?'var(--green)':score>=50?'var(--gold)':'var(--dim2)';
  return (
    <svg width={size} height={size} style={{flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg4)" strokeWidth={3}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={3}
        strokeDasharray={`${c*p} ${c*(1-p)}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        fill={col} fontSize={size>40?11:9} fontWeight="700" fontFamily="monospace">{score}</text>
    </svg>
  );
}

function MiniBar({ pct: p, col }) {
  return <div style={{height:3,background:'var(--bg4)',borderRadius:2}}><div style={{height:'100%',width:`${Math.max(0,Math.min(100,p))}%`,background:col||'var(--gold)',borderRadius:2}}/></div>;
}

function SectionTitle({ children }) {
  return <div style={{padding:'10px 16px 5px',fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--dim)'}}>{children}</div>;
}

function Row({ label, val, valCol, note, last }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',borderBottom:last?'none':'1px solid var(--line)'}}>
      <div>
        <div style={{fontSize:11,color:'var(--dim)'}}>{label}</div>
        {note&&<div style={{fontSize:9,color:'var(--dim)',marginTop:1}}>{note}</div>}
      </div>
      <span className="mono" style={{fontSize:13,fontWeight:700,color:valCol||'var(--text)'}}>{val}</span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 데이터 빌드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildStocks(prices, treasury) {
  return Object.entries(STOCK_UNIVERSE).map(([sym, s]) => {
    const p = prices[sym];
    const cur = p?.price;
    const comp = cur ? calcCompositeSignal(s, cur, treasury) : { signal:'UNKNOWN', score:'0' };
    const ten = calcTenBaggerScore(s);
    const up = cur && s.fair_value ? (s.fair_value - cur)/cur*100 : null;
    return { sym, ...s, cur, chg:p?.change, high52:p?.high52, low52:p?.low52, mktCap:p?.mktCap, trailingPE:p?.trailingPE, psr:p?.psr, comp, ten, up };
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 홈 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function HomePage({ prices, loading, macro }) {
  const m = {...MACRO_INIT, ...macro};
  const treasury = m.treasury_10y || 4.42;
  const EY = 100/22;
  const fedPremium = +(EY - treasury).toFixed(2);
  const stocks = buildStocks(prices, treasury);

  const macroRows = [
    {l:'Fed 기준금리', v:`${m.fed_rate}%`, b:'중립 2.5%', sig:m.fed_rate>4?'🔴':m.fed_rate>2.5?'🟡':'🟢', col:m.fed_rate>4?'var(--red)':'var(--gold)', note:m.fed_rate>4?'긴축':'완화'},
    {l:'Shiller CAPE', v:`${m.shiller_cape}x`, b:'평균 17x', sig:m.shiller_cape>30?'🔴':m.shiller_cape>20?'🟡':'🟢', col:m.shiller_cape>30?'var(--red)':'var(--gold)', note:`역사비 +${((m.shiller_cape/17-1)*100).toFixed(0)}%`},
    {l:'버핏 지수', v:`${m.buffett_indicator}%`, b:'경고 140%+', sig:m.buffett_indicator>150?'🔴':m.buffett_indicator>120?'🟡':'🟢', col:m.buffett_indicator>150?'var(--red)':'var(--gold)', note:m.buffett_indicator>150?'극단 고평가':'주의'},
    {l:'ISM PMI', v:`${m.ism_pmi}`, b:'기준 50', sig:m.ism_pmi<48?'🔴':m.ism_pmi<52?'🟡':'🟢', col:m.ism_pmi<50?'var(--red)':'var(--green)', note:m.ism_pmi<50?'수축권':'확장권'},
    {l:'Fed Model', v:`${fedPremium}%p`, b:'EY-국채', sig:fedPremium<0?'🔴':fedPremium<1?'🟡':'🟢', col:fedPremium<0?'var(--red)':'var(--gold)', note:`EY ${EY.toFixed(1)}% / 10Y ${treasury}%`},
    {l:'CPI(YoY)', v:`${m.cpi_yoy}%`, b:'목표 2%', sig:m.cpi_yoy>3.5?'🔴':m.cpi_yoy>2.5?'🟡':'🟢', col:m.cpi_yoy>3?'var(--red)':'var(--green)', note:m.cpi_yoy>3?'인플레 지속':'안정'},
  ];
  const redCnt = macroRows.filter(r=>r.sig==='🔴').length;
  const conclusion = redCnt>=4
    ? `⛔ 매크로 ${redCnt}/6 적신호 — 현금 40% 유지, 선별 진입`
    : redCnt>=2 ? `⚠️ 매크로 ${redCnt}/6 주의 — 리밸런싱 검토`
    : `✅ 매크로 우호적 (${redCnt}/6 적신호) — 비중 확대 가능`;

  const buys = stocks.filter(s=>s.comp.signal==='BUY'&&s.type!=='locked');
  const portStocks = stocks.filter(s=>s.type==='portfolio'||s.type==='locked');
  const watchStocks = stocks.filter(s=>s.type==='watch');
  const tenTop = [...stocks].filter(s=>s.type!=='locked').sort((a,b)=>b.ten-a.ten).slice(0,5);
  const portWithPrice = portStocks.filter(s=>s.cur&&s.up!=null);
  const avgUp = portWithPrice.length ? portWithPrice.reduce((a,s)=>a+(s.up||0),0)/portWithPrice.length : null;

  return (
    <div style={{paddingBottom:80}}>
      {/* 레짐 카드 */}
      <div style={{margin:'8px 12px',padding:'12px 14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line2)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:9,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:3}}>시장 레짐</div>
          <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{redCnt>=4?'🔴':'🟡'} {m.regime}</div>
          <div style={{fontSize:10,color:'var(--dim2)',marginTop:2}}>{m.regime_detail}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:9,color:'var(--dim)',marginBottom:3}}>포트 평균 업사이드</div>
          <div className="mono" style={{fontSize:18,fontWeight:700,color:avgUp!=null?(avgUp>0?'var(--green)':'var(--red)'):'var(--dim)'}}>{avgUp!=null?pct(avgUp):'—'}</div>
          <div style={{fontSize:9,color:'var(--dim2)',marginTop:2}}>주식:{m.stock_cash_ratio}% / 현금:{100-m.stock_cash_ratio}%</div>
        </div>
      </div>

      {/* 매크로 */}
      <SectionTitle>📡 매크로 현황</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        {macroRows.map((r,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 12px',borderBottom:i<macroRows.length-1?'1px solid var(--line)':'none'}}>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span style={{fontSize:14}}>{r.sig}</span>
              <span style={{fontSize:11,color:'var(--text)'}}>{r.l}</span>
              <span style={{fontSize:9,color:'var(--dim)'}}>({r.b})</span>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:9,color:'var(--dim2)'}}>{r.note}</span>
              <span className="mono" style={{fontSize:12,fontWeight:700,color:r.col}}>{r.v}</span>
            </div>
          </div>
        ))}
        <div style={{padding:'8px 12px',background:'var(--bg3)',fontSize:11,color:'var(--gold)',fontWeight:600}}>{conclusion}</div>
      </div>

      {/* 보유 종목 */}
      <SectionTitle>💼 보유 종목 현황</SectionTitle>
      {loading&&<div style={{padding:'8px 16px',color:'var(--dim)',fontSize:11}}>⏳ 가격 로딩 중...</div>}
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        {portStocks.map((s,i)=>(
          <div key={s.sym} style={{padding:'8px 12px',borderBottom:i<portStocks.length-1?'1px solid var(--line)':'none'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:s.type!=='locked'?3:0}}>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <span className="mono" style={{fontWeight:700,fontSize:13,color:'#fff',minWidth:50}}>{s.sym}</span>
                {s.type==='locked'
                  ? <span style={{fontSize:9,color:'var(--dim)',border:'1px solid var(--line2)',borderRadius:3,padding:'1px 5px'}}>🔒 장기</span>
                  : <SigBadge s={s.comp.signal} sm/>}
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:14,fontWeight:700,color:'#fff'}}>{s.cur?`$${fmt(s.cur)}`:loading?'⋯':'—'}</div>
                {s.chg!=null&&<div className={`mono ${clr(s.chg)}`} style={{fontSize:10}}>{s.chg>0?'▲':'▼'}{Math.abs(s.chg).toFixed(2)}%</div>}
              </div>
            </div>
            {s.type!=='locked'&&<UpsideBar cur={s.cur} fair={s.fair_value} low={s.fair_low} high={s.fair_high}/>}
            {s.type!=='locked'&&s.fair_value&&(
              <div style={{display:'flex',gap:6,marginTop:3,flexWrap:'wrap'}}>
                <span style={{fontSize:9,color:'var(--dim2)'}}>목표 <b style={{color:'var(--gold)'}}>${fmt(s.fair_value,0)}</b></span>
                {s.piotroski!=null&&<span style={{fontSize:9,color:'var(--dim2)'}}>F<b style={{color:s.piotroski>=7?'var(--green)':s.piotroski>=4?'var(--gold)':'var(--red)'}}> {s.piotroski}/9</b></span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* BUY 신호 */}
      {buys.length>0&&(
        <>
          <SectionTitle>📗 매수 신호 ({buys.length})</SectionTitle>
          <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--green-bd)',overflow:'hidden'}}>
            {buys.map((s,i)=>{
              const pos = s.cur ? calcPositionSize(parseFloat(s.comp.score||0), parseFloat(s.up||0)) : 0;
              return (
                <div key={s.sym} style={{padding:'9px 12px',borderBottom:i<buys.length-1?'1px solid var(--line)':'none'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}><span className="mono" style={{fontWeight:700,fontSize:13,color:'#fff'}}>{s.sym}</span><span style={{fontSize:10,color:'var(--dim2)'}}>{s.name}</span></div>
                    <div style={{textAlign:'right'}}><div className="mono" style={{fontSize:13,fontWeight:700,color:'#fff'}}>{s.cur?`$${fmt(s.cur)}`:loading?'⋯':'—'}</div><div style={{fontSize:10,color:'var(--green)',fontWeight:600}}>업사이드 {s.up!=null?pct(s.up):'—'}</div></div>
                  </div>
                  <UpsideBar cur={s.cur} fair={s.fair_value} low={s.fair_low} high={s.fair_high}/>
                  <div style={{display:'flex',gap:4,marginTop:4,flexWrap:'wrap'}}>
                    {s.fair_value&&<Chip label="목표" val={`$${fmt(s.fair_value,0)}`} col="var(--gold)"/>}
                    {pos>0&&<Chip label="권고" val={`${pos}%`} col="var(--green)"/>}
                    {s.cur&&<Chip label="손절(-20%)" val={`$${fmt(s.cur*.8)}`} col="var(--red)"/>}
                    {s.piotroski!=null&&<Chip label="F" val={`${s.piotroski}/9`}/>}
                  </div>
                  {s.key_oppty&&<div style={{fontSize:10,color:'var(--dim2)',marginTop:4,lineHeight:1.5}}>✅ {s.key_oppty.slice(0,65)}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
      {buys.length===0&&!loading&&<div style={{margin:'0 12px 6px',padding:'10px 14px',background:'var(--bg2)',borderRadius:10,border:'1px solid var(--line)',fontSize:11,color:'var(--dim)',textAlign:'center'}}>현재 BUY 신호 없음</div>}

      {/* 트래킹 종목 */}
      <SectionTitle>🔭 트래킹 종목 ({watchStocks.length})</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        {watchStocks.map((s,i)=>(
          <div key={s.sym} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 12px',borderBottom:i<watchStocks.length-1?'1px solid var(--line)':'none'}}>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span className="mono" style={{fontWeight:700,fontSize:12,color:'#fff',width:48,flexShrink:0}}>{s.sym}</span>
              <SigBadge s={s.comp.signal} sm/>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {s.fair_value&&<span style={{fontSize:10,color:'var(--dim2)'}}>목표 <b style={{color:'var(--gold)'}}>${fmt(s.fair_value,0)}</b></span>}
              {s.up!=null&&<span style={{fontSize:10,fontWeight:600,color:s.up>0?'var(--green)':'var(--red)'}}>{pct(s.up)}</span>}
              <span className="mono" style={{fontSize:12,fontWeight:700,color:'#fff'}}>{s.cur?`$${fmt(s.cur)}`:loading?'⋯':'—'}</span>
              {s.chg!=null&&<span className={`mono ${clr(s.chg)}`} style={{fontSize:10,minWidth:52,textAlign:'right'}}>{s.chg>0?'▲':'▼'}{Math.abs(s.chg).toFixed(2)}%</span>}
            </div>
          </div>
        ))}
      </div>

      {/* 텐베거 TOP5 */}
      <SectionTitle>🚀 텐베거 TOP5</SectionTitle>
      <div style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        {tenTop.map((s,i)=>(
          <div key={s.sym} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:i<tenTop.length-1?'1px solid var(--line)':'none'}}>
            <span style={{fontSize:10,color:'var(--dim)',width:14}}>{i+1}</span>
            <ScoreRing score={s.ten} size={38}/>
            <div style={{flex:1}}>
              <div style={{display:'flex',gap:6,alignItems:'center'}}><span className="mono" style={{fontWeight:700,fontSize:12,color:'#fff'}}>{s.sym}</span><span style={{fontSize:10,color:'var(--dim2)'}}>{s.name}</span></div>
              <div style={{fontSize:10,color:'var(--dim2)',marginTop:1}}>R40:{(s.rule_of_40||(s.gross_margin+s.rev_growth_yoy-100)|0)} · 성장+{s.rev_growth_yoy}%</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div className="mono" style={{fontSize:12,fontWeight:700,color:'#fff'}}>{s.cur?`$${fmt(s.cur)}`:loading?'⋯':'—'}</div>
              {s.up!=null&&<div style={{fontSize:10,color:s.up>0?'var(--green)':'var(--red)',fontWeight:600}}>{pct(s.up)}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 매크로 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MacroPage({ macro }) {
  const m = {...MACRO_INIT, ...macro};
  const t = m.treasury_10y||4.42;
  const EY = 100/22;
  const fed = +(EY-t).toFixed(2);
  const spGap = m.sp500&&m.sp500_dcf_fair ? ((m.sp500-m.sp500_dcf_fair)/m.sp500_dcf_fair*100).toFixed(1) : null;

  const blocks = [
    {l:'Fed 기준금리', v:`${m.fed_rate}%`, sub:'중립 2.5%', sig:m.fed_rate>4?'🔴':m.fed_rate>2.5?'🟡':'🟢', col:m.fed_rate>4?'var(--red)':'var(--gold)', detail:m.fed_rate>4?'긴축적. 고금리 장기화. 성장주 밸류에이션 압박.':'중립~완화. 위험자산 우호.'},
    {l:'Shiller CAPE', v:`${m.shiller_cape}x`, sub:'역사평균 17x', sig:m.shiller_cape>30?'🔴':m.shiller_cape>20?'🟡':'🟢', col:m.shiller_cape>30?'var(--red)':'var(--gold)', detail:`역사평균 대비 +${((m.shiller_cape/17-1)*100).toFixed(0)}%. 닷컴버블 44x 이전.`},
    {l:'버핏 지수', v:`${m.buffett_indicator}%`, sub:'경고 140%+', sig:m.buffett_indicator>150?'🔴':m.buffett_indicator>120?'🟡':'🟢', col:m.buffett_indicator>150?'var(--red)':'var(--gold)', detail:'GDP 대비 시총. 역사적 위험 구간.'},
    {l:'ISM PMI', v:`${m.ism_pmi}`, sub:'기준선 50', sig:m.ism_pmi<48?'🔴':m.ism_pmi<52?'🟡':'🟢', col:m.ism_pmi<50?'var(--red)':'var(--green)', detail:m.ism_pmi<50?'제조업 수축권. 경기 둔화 신호.':'확장권. 경기 모멘텀 우호.'},
    {l:'Fed Model', v:`${fed}%p`, sub:'EY-국채 프리미엄', sig:fed<0?'🔴':fed<1?'🟡':'🟢', col:fed<0?'var(--red)':'var(--gold)', detail:`주식EY ${EY.toFixed(1)}% vs 10Y ${t}%. 갭 ${fed}%p.`},
    {l:'CPI(YoY)', v:`${m.cpi_yoy}%`, sub:'목표 2%', sig:m.cpi_yoy>3.5?'🔴':m.cpi_yoy>2.5?'🟡':'🟢', col:m.cpi_yoy>3?'var(--red)':'var(--green)', detail:m.cpi_yoy>3?'인플레 지속. 추가 인하 어려움.':'인플레 안정권.'},
    {l:'달러(DXY)', v:`${m.dxy}`, sub:'해외매출 역풍', sig:m.dxy>103?'🔴':m.dxy>100?'🟡':'🟢', col:'var(--gold)', detail:'달러 강세 = 해외 비중 높은 기업 환차손.'},
    {l:'S&P 500 vs DCF', v:m.sp500?(m.sp500.toLocaleString()):'—', sub:m.sp500_dcf_fair?`적정 ${m.sp500_dcf_fair.toLocaleString()}`:'—', sig:spGap?(parseFloat(spGap)>5?'🔴':'🟢'):'🟡', col:'var(--gold)', detail:spGap?`DCF 대비 ${spGap}%p ${parseFloat(spGap)>0?'고평가':'저평가'}`:'데이터 없음'},
  ];

  const sectorPref = [{n:'AI·IT 인프라',s:5},{n:'사이버보안',s:4},{n:'헬스케어',s:4},{n:'클라우드 SaaS',s:3},{n:'필수소비재',s:3},{n:'임의소비재',s:2},{n:'부동산(REIT)',s:1}];

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 6px',fontSize:20,fontWeight:700,color:'#fff'}}>📡 매크로</div>
      <div style={{padding:'0 16px 8px',fontSize:11,color:'var(--dim)'}}>업데이트: {MACRO_INIT.updated} · FRED/Bloomberg</div>
      <div style={{margin:'0 12px 8px',padding:'12px 14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--gold-bd)'}}>
        <div style={{fontSize:9,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>현재 시장 레짐</div>
        <div style={{fontSize:15,fontWeight:700,color:'#fff',marginBottom:3}}>{m.regime}</div>
        <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.6}}>{m.regime_detail}<br/>권고: 주식 <b style={{color:'var(--gold)'}}>{m.stock_cash_ratio}%</b> / 현금 <b style={{color:'var(--gold)'}}>{100-m.stock_cash_ratio}%</b></div>
      </div>
      {blocks.map((b,i)=>(
        <div key={i} style={{margin:'0 12px 5px',padding:'11px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--dim)',marginBottom:3}}>{b.l}</div>
              <div className="mono" style={{fontSize:21,fontWeight:700,color:b.col}}>{b.v}</div>
              <div style={{fontSize:10,color:'var(--dim2)',marginTop:3}}>{b.detail}</div>
            </div>
            <div style={{textAlign:'right'}}><div style={{fontSize:22}}>{b.sig}</div><div style={{fontSize:9,color:'var(--dim)',marginTop:4}}>{b.sub}</div></div>
          </div>
        </div>
      ))}
      <SectionTitle>섹터 선호도</SectionTitle>
      <div style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',padding:'10px 14px'}}>
        {sectorPref.map((s,i)=>{
          const col=s.s>=4?'var(--green)':s.s>=3?'var(--gold)':'var(--red)';
          return <div key={i} style={{marginBottom:i<sectorPref.length-1?9:0}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:11,color:'var(--text)'}}>{s.n}</span><span style={{fontSize:11,color:col}}>{'★'.repeat(s.s)}{'☆'.repeat(5-s.s)}</span></div><MiniBar pct={s.s*20} col={col}/></div>;
        })}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 종목 상세
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function StockDetail({ sym, prices, macro, onBack }) {
  const s = STOCK_UNIVERSE[sym];
  if (!s) return null;
  const treasury = macro?.treasury_10y||4.42;
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

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'12px 16px 4px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontSize:11,color:'var(--dim)',cursor:'pointer',marginBottom:4}} onClick={onBack}>← 종목 목록</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span className="mono" style={{fontSize:22,fontWeight:700,color:'#fff'}}>{sym}</span>
            <SigBadge s={comp.signal}/>
          </div>
          <div style={{fontSize:11,color:'var(--dim2)',marginTop:1}}>{s.name} · {s.sector}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div className="mono" style={{fontSize:24,fontWeight:700,color:'#fff'}}>{cur?`$${fmt(cur)}`:'—'}</div>
          {p?.change!=null&&<div className={`mono ${clr(p.change)}`} style={{fontSize:11,marginTop:1}}>{p.change>0?'▲':'▼'}{Math.abs(p.change).toFixed(2)}%</div>}
        </div>
      </div>

      <div style={{margin:'6px 12px',padding:'12px 14px',background:sigBg(comp.signal),border:`1px solid ${sigBd(comp.signal)}`,borderRadius:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <SigBadge s={comp.signal}/>
          <span style={{fontSize:10,color:'var(--dim)'}}>종합점수 {comp.score}</span>
        </div>
        {s.type!=='locked'&&cur&&(
          <div style={{fontSize:12,color:'var(--text)',lineHeight:1.8}}>
            {s.fair_value&&<>목표가 <b style={{color:'var(--gold)'}}>${fmt(s.fair_value,0)}</b> ({pct(up)})<br/></>}
            {pos>0&&<>권고비중 <b style={{color:'var(--gold)'}}>{pos}%</b> · 손절 <b style={{color:'var(--red)'}}>${fmt(cur*.8)}</b><br/></>}
          </div>
        )}
        {s.type==='locked'&&<div style={{fontSize:11,color:'var(--dim2)'}}>🔒 {s.locked_note}</div>}
      </div>

      {p?.high52&&p?.low52&&cur&&(
        <div style={{margin:'4px 12px',padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)'}}>
          <div style={{fontSize:9,color:'var(--dim)',marginBottom:6}}>52주 범위</div>
          <div style={{position:'relative',height:12,marginBottom:4}}>
            <div style={{position:'absolute',top:4,left:0,right:0,height:4,background:'var(--bg4)',borderRadius:2}}/>
            <div style={{position:'absolute',top:0,left:`${Math.max(2,Math.min(96,(cur-p.low52)/(p.high52-p.low52)*100))}%`,width:12,height:12,borderRadius:'50%',background:'var(--gold)',border:'2px solid var(--bg)',transform:'translateX(-50%)'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--dim2)'}}>
            <span>${fmt(p.low52)}</span>
            <span style={{color:'var(--gold)'}}>${fmt(cur)} ({((cur-p.low52)/(p.high52-p.low52)*100).toFixed(0)}위%)</span>
            <span>${fmt(p.high52)}</span>
          </div>
        </div>
      )}

      <SectionTitle>밸류에이션</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        {[
          ['PE(TTM)', pe?`${fmt(pe,1)}x`:'N/A', pePerc?(parseFloat(pePerc)>70?'var(--red)':parseFloat(pePerc)<30?'var(--green)':'var(--gold)'):'var(--text)', pePerc?`5y 백분위 ${pePerc}%`:''],
          ['목표가(DCF)', s.fair_value?`$${fmt(s.fair_value,0)}`:'—', 'var(--gold)', dcf?.label||''],
          ['업사이드', up!=null?pct(up):'—', up>0?'var(--green)':'var(--red)', '현재가 대비'],
          ['FCF Yield', cur&&s.fcf_annual?`${((s.fcf_annual-(s.sbc_annual||0))/(cur*s.shares_out)*100).toFixed(2)}%`:'—', 'var(--text)', fcf?.premium?`국채 대비 ${fcf.premium}%p`:''],
          ['ROIC-WACC', s.roic&&s.wacc?`+${roic.spread}%p`:'—', parseFloat(roic.spread||0)>10?'var(--green)':'var(--gold)', roic.label||''],
          ['PSR', p?.psr?`${p.psr}x`:'—', 'var(--text)', ''],
        ].map(([l,v,c,n],i,a)=><Row key={i} label={l} val={v} valCol={c} note={n} last={i===a.length-1}/>)}
      </div>

      <SectionTitle>품질 지표</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        {[
          ['Piotroski F', `${s.piotroski??'—'}/9`, s.piotroski>=7?'var(--green)':s.piotroski>=4?'var(--gold)':'var(--red)','재무건전성 종합'],
          ['Beneish M', `${s.beneish_m??'—'}`, s.beneish_m!=null&&s.beneish_m<-1.78?'var(--green)':'var(--red)', s.beneish_m!=null&&s.beneish_m>-1.78?'⛔조작의심':'안전'],
          ['Altman Z', `${s.altman_z??'—'}`, s.altman_z!=null?(s.altman_z>2.99?'var(--green)':s.altman_z>1.81?'var(--gold)':'var(--red)'):'var(--dim)', ''],
          ['모멘텀(12-1M)', s.mom_12_1!=null?`${s.mom_12_1>0?'+':''}${s.mom_12_1}%`:'—', s.mom_12_1>10?'var(--green)':s.mom_12_1>0?'var(--gold)':'var(--red)','12개월-1개월 가격'],
          ['어닝 리비전', s.erv_score!=null?`${s.erv_score>0?'+':''}${s.erv_score}`:'—', s.erv_score>0.2?'var(--green)':s.erv_score>0?'var(--gold)':'var(--red)','추정EPS 상향-하향'],
        ].map(([l,v,c,n],i,a)=><Row key={i} label={l} val={v} valCol={c} note={n} last={i===a.length-1}/>)}
      </div>

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

      {(s.key_risk||s.key_oppty)&&(
        <>
          <SectionTitle>리스크 & 기회</SectionTitle>
          {s.key_risk&&<div style={{margin:'0 12px 4px',padding:'10px 12px',background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:10,fontSize:11,color:'var(--dim2)',lineHeight:1.6}}>⚠️ {s.key_risk}</div>}
          {s.key_oppty&&<div style={{margin:'0 12px 6px',padding:'10px 12px',background:'var(--green-bg)',border:'1px solid var(--green-bd)',borderRadius:10,fontSize:11,color:'var(--dim2)',lineHeight:1.6}}>✅ {s.key_oppty}</div>}
        </>
      )}

      {s.guru_cost&&(
        <>
          <SectionTitle>구루 포지션</SectionTitle>
          <div style={{margin:'0 12px 8px',padding:'12px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--gold-bd)',fontSize:12,color:'var(--text)',lineHeight:1.8}}>
            추정매수가 <b style={{color:'var(--gold)'}}>${s.guru_cost}</b> ({s.guru_cost_type})<br/>
            {cur&&<>현재 ${fmt(cur)} — <b style={{color:cur<s.guru_cost?'var(--green)':'var(--red)'}}>{cur<s.guru_cost?'구루보다 저렴':'구루보다 비쌈'} {Math.abs((cur-s.guru_cost)/s.guru_cost*100).toFixed(1)}%</b><br/></>}
            <span style={{fontSize:11,color:'var(--dim2)'}}>{s.guru_note}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 종목 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function StocksPage({ prices, loading, macro }) {
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const treasury = macro?.treasury_10y||4.42;
  const stocks = buildStocks(prices, treasury);
  const buyCnt=stocks.filter(s=>s.comp.signal==='BUY'&&s.type!=='locked').length;
  const holdCnt=stocks.filter(s=>s.comp.signal==='HOLD'&&s.type!=='locked').length;
  const waitCnt=stocks.filter(s=>['WAIT','DANGER'].includes(s.comp.signal)).length;

  if (detail) return <StockDetail sym={detail} prices={prices} macro={macro} onBack={()=>setDetail(null)}/>;

  const shown = filter==='all' ? stocks
    : filter==='portfolio' ? stocks.filter(s=>s.type==='portfolio'||s.type==='locked')
    : filter==='watch' ? stocks.filter(s=>s.type==='watch')
    : stocks.filter(s=>s.comp.signal===filter.toUpperCase());

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:20,fontWeight:700,color:'#fff'}}>📊 종목</span>
        <div style={{display:'flex',gap:5}}>
          {[['BUY',buyCnt,'var(--green)'],['HOLD',holdCnt,'var(--gold)'],['WAIT',waitCnt,'var(--red)']].map(([l,n,c])=>(
            <div key={l} style={{padding:'2px 8px',borderRadius:20,fontSize:9,fontWeight:700,color:c,background:`rgba(0,0,0,.3)`,border:`1px solid ${c}40`}}>{l} {n}</div>
          ))}
        </div>
      </div>
      <div style={{display:'flex',gap:6,padding:'0 12px 8px',overflowX:'auto',scrollbarWidth:'none'}}>
        {[['all','전체'],['portfolio','보유'],['watch','트래킹'],['BUY','📗매수'],['HOLD','🟡보유'],['WAIT','🔴대기']].map(([k,l])=>(
          <div key={k} onClick={()=>setFilter(k)} style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0,background:filter===k?'var(--gold-bg)':'var(--bg2)',border:`1px solid ${filter===k?'var(--gold-bd)':'var(--line2)'}`,color:filter===k?'var(--gold)':'var(--dim2)'}}>{l}</div>
        ))}
      </div>
      {loading&&<div style={{padding:'8px 16px',color:'var(--dim)',fontSize:11}}>⏳ 가격 로딩 중...</div>}
      {shown.map(s=>{
        if (s.type==='locked') return (
          <div key={s.sym} onClick={()=>setDetail(s.sym)} style={{margin:'0 12px 5px',padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',opacity:.7}}>
            <div><span className="mono" style={{fontWeight:700,color:'var(--dim2)'}}>{s.sym}</span><span style={{fontSize:11,color:'var(--dim)',marginLeft:8}}>{s.locked_note}</span></div>
            <span style={{fontSize:9,color:'var(--dim)',border:'1px solid var(--line2)',borderRadius:3,padding:'1px 5px'}}>🔒 예외</span>
          </div>
        );
        const bcol=sigCol(s.comp.signal);
        const guruDiff=s.guru_cost&&s.cur?(s.guru_cost-s.cur)/s.guru_cost*100:null;
        return (
          <div key={s.sym} onClick={()=>setDetail(s.sym)} style={{margin:'0 12px 5px',padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)',borderLeft:`3px solid ${bcol}`,cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
              <div>
                <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:2}}>
                  <span className="mono" style={{fontWeight:700,fontSize:14,color:'#fff'}}>{s.sym}</span>
                  <SigBadge s={s.comp.signal} sm/>
                  {s.type==='watch'&&<span style={{fontSize:8,color:'var(--dim)',border:'1px solid var(--line2)',borderRadius:2,padding:'1px 4px'}}>트래킹</span>}
                </div>
                <div style={{fontSize:10,color:'var(--dim2)'}}>{s.name} · {s.sector}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:15,fontWeight:700,color:'#fff'}}>{s.cur?`$${fmt(s.cur)}`:loading?'⋯':'—'}</div>
                {s.chg!=null&&<div className={`mono ${clr(s.chg)}`} style={{fontSize:10,marginTop:1}}>{s.chg>0?'▲':'▼'}{Math.abs(s.chg).toFixed(2)}%</div>}
              </div>
            </div>
            <UpsideBar cur={s.cur} fair={s.fair_value} low={s.fair_low} high={s.fair_high}/>
            <div style={{display:'flex',gap:5,marginTop:5,flexWrap:'wrap'}}>
              {s.fair_value&&<Chip label="목표" val={`$${fmt(s.fair_value,0)}`} col="var(--gold)"/>}
              {s.trailingPE&&<Chip label="PE" val={`${fmt(s.trailingPE,1)}x`}/>}
              {s.psr&&<Chip label="PSR" val={`${fmt(s.psr,1)}x`}/>}
              {s.piotroski!=null&&<Chip label="F" val={`${s.piotroski}/9`} col={s.piotroski>=7?'var(--green)':s.piotroski>=4?'var(--gold)':'var(--red)'}/>}
              {guruDiff!=null&&<Chip label="구루比" val={guruDiff>0?`저렴${guruDiff.toFixed(1)}%`:`비쌈${Math.abs(guruDiff).toFixed(1)}%`} col={guruDiff>0?'var(--green)':'var(--red)'}/>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 텐베거 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function TenBaggerPage({ prices }) {
  const list = Object.entries(STOCK_UNIVERSE)
    .filter(([,s])=>s.type!=='locked')
    .map(([sym,s])=>{
      const cur=prices[sym]?.price;
      const ten=calcTenBaggerScore(s);
      const r40=(s.rule_of_40||(s.gross_margin+s.rev_growth_yoy-100))|0;
      const r40Pts=r40>60?30:r40>40?22:r40>20?12:r40>0?5:0;
      const accelPts=(s.rev_growth_accel||0)>5?25:(s.rev_growth_accel||0)>2?18:(s.rev_growth_accel||0)>0?10:3;
      const tamPts=s.tam_penetration!==undefined?(s.tam_penetration<3?20:s.tam_penetration<8?14:7):8;
      const gmPts=(s.gm_trend||0)>3?15:(s.gm_trend||0)>1?10:(s.gm_trend||0)>0?5:0;
      const piotPts=s.piotroski>=8?10:s.piotroski>=6?6:s.piotroski>=4?3:0;
      return {sym,...s,cur,ten,r40,r40Pts,accelPts,tamPts,gmPts,piotPts};
    })
    .sort((a,b)=>b.ten-a.ten);

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 4px',fontSize:20,fontWeight:700,color:'#fff'}}>🚀 텐베거</div>
      <div style={{padding:'0 16px 10px',fontSize:11,color:'var(--dim)'}}>5년 내 10배 가능성 · Rule of 40 / 성장가속 / TAM / GM트렌드 / 품질 합산</div>
      {list.map((s,idx)=>{
        const col=s.ten>=70?'var(--green)':s.ten>=50?'var(--gold)':'var(--dim2)';
        const pts=[
          {l:'Rule of 40', calc:`성장${(s.rev_growth_yoy||0).toFixed(1)}%+GM${(s.gross_margin||0).toFixed(0)}%=${s.r40}`, g:s.r40Pts, m:30},
          {l:'매출성장 가속', calc:`QoQ ${(s.rev_growth_accel||0)>0?'+':''}${(s.rev_growth_accel||0).toFixed(1)}%p`, g:s.accelPts, m:25},
          {l:'TAM 침투율', calc:s.tam_penetration!=null?`${s.tam_penetration}%`:'추정 불명', g:s.tamPts, m:20},
          {l:'GM 트렌드', calc:`${(s.gm_trend||0)>0?'+':''}${(s.gm_trend||0).toFixed(1)}%p`, g:s.gmPts, m:15},
          {l:'Piotroski', calc:`${s.piotroski??'?'}/9`, g:s.piotPts, m:10},
        ];
        return (
          <div key={s.sym} style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,border:`1px solid ${s.ten>=70?'var(--green-bd)':s.ten>=50?'var(--gold-bd)':'var(--line)'}`,overflow:'hidden'}}>
            <div style={{padding:'12px 14px',display:'flex',gap:12,alignItems:'center',borderBottom:'1px solid var(--line)'}}>
              <ScoreRing score={s.ten} size={48}/>
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:3}}>
                  <span className="mono" style={{fontSize:14,fontWeight:700,color:'#fff'}}>{s.sym}</span>
                  {s.ten>=70&&<span style={{fontSize:8,padding:'1px 6px',borderRadius:10,background:'var(--pur-bg)',border:'1px solid var(--pur-bd)',color:'var(--pur)'}}>텐베거 후보</span>}
                </div>
                <div style={{fontSize:11,color:'var(--dim2)'}}>{s.name} · R40:{s.r40} · 성장+{s.rev_growth_yoy}%</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:12,fontWeight:700,color:'#fff'}}>{s.cur?`$${fmt(s.cur)}`:'—'}</div>
                <div style={{fontSize:9,color:'var(--dim)'}}>#{idx+1}</div>
              </div>
            </div>
            <div style={{padding:'10px 14px'}}>
              {pts.map((pt,j)=>(
                <div key={j} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:j<pts.length-1?'1px solid var(--line)':'none'}}>
                  <div><span style={{fontSize:11,color:'var(--text)'}}>{pt.l}</span><span style={{fontSize:10,color:'var(--dim)',marginLeft:6}}>{pt.calc}</span></div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <div style={{width:40}}><MiniBar pct={pt.g/pt.m*100} col={pt.g===pt.m?'var(--green)':pt.g>pt.m*.6?'var(--gold)':'var(--dim2)'}/></div>
                    <span className="mono" style={{fontSize:10,fontWeight:700,color:pt.g===pt.m?'var(--green)':pt.g>pt.m*.6?'var(--gold)':'var(--dim2)',minWidth:30,textAlign:'right'}}>{pt.g}/{pt.m}</span>
                  </div>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6,paddingTop:6,borderTop:'1px solid var(--line)'}}>
                <span style={{fontSize:11,fontWeight:700,color:'#fff'}}>합계</span>
                <span className="mono" style={{fontSize:11,fontWeight:700,color:col}}>{s.ten}/100</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 구루 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function GuruPage({ prices }) {
  const ast = a => ({
    NEW:{bg:'var(--green-bg)',bd:'var(--green-bd)',col:'var(--green)',l:'신규'},
    ADD:{bg:'var(--blue-bg)',bd:'var(--blue-bd)',col:'var(--blue)',l:'추가'},
    HOLD:{bg:'var(--gold-bg)',bd:'var(--gold-bd)',col:'var(--gold)',l:'보유'},
    REDUCE:{bg:'var(--pur-bg)',bd:'var(--pur-bd)',col:'var(--pur)',l:'축소'},
    SOLD:{bg:'var(--red-bg)',bd:'var(--red-bd)',col:'var(--red)',l:'매도'},
  }[a]||{bg:'var(--bg3)',bd:'var(--line2)',col:'var(--dim2)',l:a});
  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 4px',fontSize:20,fontWeight:700,color:'#fff'}}>🧠 구루</div>
      <div style={{padding:'0 16px 10px',fontSize:11,color:'var(--dim)'}}>Q1 2026 13F 기준</div>
      {GURU_POSITIONS.map(g=>(
        <div key={g.id} style={{margin:'0 12px 10px',background:'var(--bg2)',borderRadius:14,border:`1px solid ${g.tier===1?'var(--gold-bd)':'var(--line2)'}`,overflow:'hidden'}}>
          <div style={{padding:'12px 14px',borderBottom:'1px solid var(--line)',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{g.name}</div>
              <div style={{fontSize:10,color:'var(--dim2)',marginTop:1}}>{g.fund} · AUM ${g.aum_b}B · {g.updated}</div>
            </div>
            <span style={{fontSize:8,padding:'2px 8px',borderRadius:10,background:g.tier===1?'var(--gold-bg)':'var(--pur-bg)',border:`1px solid ${g.tier===1?'var(--gold-bd)':'var(--pur-bd)'}`,color:g.tier===1?'var(--gold)':'var(--pur)',fontWeight:700}}>T{g.tier}</span>
          </div>
          {g.positions.map((pos,j)=>{
            const st=ast(pos.action);
            const cur=prices[pos.sym]?.price;
            const diff=cur&&pos.cost_est?(pos.cost_est-cur)/pos.cost_est*100:null;
            return (
              <div key={j} style={{padding:'10px 14px',borderBottom:j<g.positions.length-1?'1px solid var(--line)':'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span className="mono" style={{fontWeight:700,fontSize:13,color:'#fff'}}>{pos.sym}</span>
                    <span style={{fontSize:9,padding:'1px 7px',borderRadius:10,background:st.bg,border:`1px solid ${st.bd}`,color:st.col,fontWeight:700}}>{st.l}</span>
                    {pos.cost_type==='확인값'&&<span style={{fontSize:8,color:'var(--green)'}}>✓확인</span>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    {pos.cost_est&&<div style={{fontSize:10,color:'var(--gold)'}}>추정 ${pos.cost_est}</div>}
                    {cur&&diff!=null&&<div style={{fontSize:10,fontWeight:600,color:diff>0?'var(--green)':'var(--red)',marginTop:1}}>현재 ${fmt(cur)} ({diff>0?'저렴':'비쌈'} {Math.abs(diff).toFixed(1)}%)</div>}
                  </div>
                </div>
                <div style={{fontSize:9,color:'var(--dim)',marginBottom:pos.note?3:0}}>{pos.shares}</div>
                {pos.note&&<div style={{fontSize:10,color:'var(--dim2)',lineHeight:1.5}}>{pos.note}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 포트폴리오 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PortfolioPage({ prices, trades, setTrades }) {
  const [form, setForm] = useState({sym:'',action:'매수',price:'',qty:'',note:''});
  const stats = calcPortfolioStats(trades, prices);

  const add = () => {
    if (!form.sym.trim()||!form.price||!form.qty) return;
    const t = {...form, sym:form.sym.toUpperCase().trim(), price:parseFloat(form.price), qty:parseFloat(form.qty), date:new Date().toLocaleDateString('ko-KR'), id:Date.now()};
    setTrades(prev=>[...prev, t]);
    setForm(f=>({...f,sym:'',price:'',qty:'',note:''}));
  };
  const del = id => setTrades(prev=>prev.filter(t=>t.id!==id));

  const inp = {width:'100%',background:'var(--bg3)',border:'1px solid var(--line2)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontSize:13,fontFamily:'inherit',outline:'none'};

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 8px',fontSize:20,fontWeight:700,color:'#fff'}}>💼 포트폴리오</div>

      {stats&&stats.positions.length>0&&(
        <div style={{margin:'0 12px 8px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--gold-bd)'}}>
          <div style={{fontSize:9,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>전략 수익률</div>
          <div className={`mono ${stats.total_return>=0?'c-green':'c-red'}`} style={{fontSize:26,fontWeight:700}}>{stats.total_return>=0?'+':''}{fmt(stats.total_return)}%</div>
          <div style={{fontSize:11,color:'var(--dim2)',marginTop:3}}>투자금 {fmtK(stats.total_cost)} → 현재 {fmtK(stats.total_value)}</div>
          <div style={{marginTop:10}}>
            {stats.positions.map((pos,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<stats.positions.length-1?'1px solid var(--line)':'none'}}>
                <div><span className="mono" style={{fontWeight:700,fontSize:12,color:'#fff'}}>{pos.sym}</span><span style={{fontSize:10,color:'var(--dim)',marginLeft:6}}>{pos.qty}주 @ ${fmt(pos.avg_cost)}</span></div>
                <div style={{textAlign:'right'}}>
                  <span className={`mono ${pos.pnl_pct>=0?'c-green':'c-red'}`} style={{fontSize:12,fontWeight:700}}>{pos.pnl_pct!=null?`${pos.pnl_pct>=0?'+':''}${fmt(pos.pnl_pct)}%`:'—'}</span>
                  {pos.current_price&&<div style={{fontSize:10,color:'var(--dim)',marginTop:1}}>${fmt(pos.current_price)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{margin:'0 12px 8px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)'}}>
        <div style={{fontSize:10,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:8}}>매매 기록 추가</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>종목</div><input style={inp} placeholder="GOOGL" value={form.sym} onChange={e=>setForm(f=>({...f,sym:e.target.value.toUpperCase()}))}/></div>
          <div><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>가격($)</div><input style={inp} type="number" placeholder="356" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></div>
          <div><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>수량</div><input style={inp} type="number" placeholder="5" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))}/></div>
          <div><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>구분</div><select style={inp} value={form.action} onChange={e=>setForm(f=>({...f,action:e.target.value}))}><option>매수</option><option>매도</option></select></div>
        </div>
        <input style={{...inp,marginBottom:8}} placeholder="메모 (선택)" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
        <button onClick={add} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'var(--gold)',color:'#000',fontSize:13,fontWeight:700,cursor:'pointer'}}>저장</button>
      </div>

      {trades.length>0&&(
        <>
          <SectionTitle>거래 내역 ({trades.length}건)</SectionTitle>
          {[...trades].reverse().map((t,i)=>(
            <div key={t.id||i} style={{margin:'0 12px 5px',padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span className="mono" style={{fontWeight:700,fontSize:13,color:'#fff'}}>{t.sym}</span>
                  <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:t.action==='매수'?'var(--green-bg)':'var(--red-bg)',border:`1px solid ${t.action==='매수'?'var(--green-bd)':'var(--red-bd)'}`,color:t.action==='매수'?'var(--green)':'var(--red)'}}>{t.action}</span>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:10,color:'var(--dim)'}}>{t.date}</span>
                  <button onClick={()=>del(t.id||i)} style={{background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:6,color:'var(--red)',fontSize:10,padding:'2px 7px',cursor:'pointer'}}>삭제</button>
                </div>
              </div>
              <div style={{fontSize:11,color:'var(--dim2)'}}>${fmt(t.price)} × {t.qty}주 = {fmtK(t.price*t.qty)}</div>
              {t.note&&<div style={{fontSize:10,color:'var(--dim)',marginTop:2}}>{t.note}</div>}
            </div>
          ))}
        </>
      )}
      {trades.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:'var(--dim)',fontSize:12}}>거래 기록이 없습니다. 첫 매매를 입력해보세요.</div>}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 투자일지 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function JournalPage({ prices, journal, setJournal }) {
  const [form, setForm] = useState({sym:'',price:'',reason:'',expected:''});
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const inp = {width:'100%',background:'var(--bg3)',border:'1px solid var(--line2)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontSize:13,fontFamily:'inherit',outline:'none'};

  const save = () => {
    if (!form.reason.trim()) return;
    const sym = form.sym.toUpperCase().trim();
    const stock = STOCK_UNIVERSE[sym];
    const cur = sym ? prices[sym]?.price : null;
    let analysis = null;
    if (stock && cur) {
      const comp = calcCompositeSignal(stock, cur, 4.42);
      const gd = stock.guru_cost&&cur ? ((stock.guru_cost-cur)/stock.guru_cost*100).toFixed(1) : null;
      analysis = {signal:comp.signal, ok:comp.signal==='BUY', score:comp.score, mom:stock.mom_12_1, momOk:(stock.mom_12_1||0)>5, guru:gd?(parseFloat(gd)>0?`구루보다 ${gd}% 저렴`:`구루보다 ${Math.abs(gd)}% 비쌈`):'구루 데이터 없음', risk:stock.key_risk?.slice(0,60)||'없음'};
    }
    const entry = {sym,price:form.price,reason:form.reason,expected:form.expected,date:new Date().toLocaleDateString('ko-KR'),id:Date.now(),analysis};
    setJournal(prev=>[entry,...prev]);
    setLastAnalysis(analysis);
    setForm({sym:'',price:'',reason:'',expected:''});
  };
  const del = id => setJournal(prev=>prev.filter(e=>e.id!==id));

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 8px',fontSize:20,fontWeight:700,color:'#fff'}}>📔 투자일지</div>
      <div style={{margin:'0 12px 8px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)'}}>
        <div style={{fontSize:10,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:8}}>새 기록</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>종목(선택)</div><input style={inp} placeholder="GOOGL" value={form.sym} onChange={e=>setForm(f=>({...f,sym:e.target.value.toUpperCase()}))}/></div>
          <div><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>가격($)</div><input style={inp} type="number" placeholder="356" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></div>
        </div>
        <div style={{marginBottom:8}}><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>왜 매수/매도 했는가? (필수)</div><textarea style={{...inp,resize:'vertical',minHeight:70}} placeholder="DCF 저평가 + 버크셔 신규매수 + Cloud 가속..." value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}/></div>
        <div style={{marginBottom:8}}><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>기대하는 결과</div><input style={inp} placeholder="12개월 내 $450 도달" value={form.expected} onChange={e=>setForm(f=>({...f,expected:e.target.value}))}/></div>
        <button onClick={save} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'var(--gold)',color:'#000',fontSize:13,fontWeight:700,cursor:'pointer'}}>저장 + 자동 분석</button>
      </div>

      {lastAnalysis&&(
        <div style={{margin:'0 12px 8px',padding:'12px 14px',background:'var(--gold-bg)',border:'1px solid var(--gold-bd)',borderRadius:14}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--gold)',marginBottom:8}}>📊 진입 시점 자동 분석</div>
          <div style={{fontSize:11,color:'var(--text)',lineHeight:1.9}}>
            <div>신호: <b style={{color:sigCol(lastAnalysis.signal)}}>{sigIcon(lastAnalysis.signal)} {lastAnalysis.signal} {lastAnalysis.ok?'✅ 확인':'⚠️ BUY 아님'}</b></div>
            <div>종합점수: <b style={{color:'var(--gold)'}}>{lastAnalysis.score}</b></div>
            <div>모멘텀(12-1M): <b style={{color:lastAnalysis.momOk?'var(--green)':'var(--red)'}}>{lastAnalysis.mom!=null?`${lastAnalysis.mom>0?'+':''}${lastAnalysis.mom}%`:'—'} {lastAnalysis.momOk?'✅':'⚠️'}</b></div>
            <div>구루 대비: <b style={{color:'var(--gold)'}}>{lastAnalysis.guru}</b></div>
            <div style={{marginTop:4,fontSize:10,color:'var(--red)'}}>⚠️ 주요 리스크: {lastAnalysis.risk}</div>
          </div>
        </div>
      )}

      {journal.map((e,i)=>(
        <div key={e.id||i} style={{margin:'0 12px 6px',padding:'12px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              {e.sym&&<span className="mono" style={{fontWeight:700,fontSize:13,color:'#fff'}}>{e.sym}</span>}
              {e.price&&<span style={{fontSize:10,color:'var(--dim2)'}}>${e.price}</span>}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:10,color:'var(--dim)'}}>{e.date}</span>
              <button onClick={()=>del(e.id||i)} style={{background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:6,color:'var(--red)',fontSize:10,padding:'2px 7px',cursor:'pointer'}}>삭제</button>
            </div>
          </div>
          <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.6,marginBottom:e.expected?4:0}}>{e.reason}</div>
          {e.expected&&<div style={{fontSize:10,color:'var(--gold)',marginBottom:4}}>기대: {e.expected}</div>}
          {e.analysis&&(
            <div style={{marginTop:4,padding:'7px 10px',background:'var(--bg3)',borderRadius:8,fontSize:10,color:'var(--dim2)',lineHeight:1.6}}>
              신호 <span style={{color:sigCol(e.analysis.signal)}}>{e.analysis.signal}</span> · 모멘텀 <span style={{color:e.analysis.momOk?'var(--green)':'var(--red)'}}>{e.analysis.momOk?'충족':'미달'}</span> · {e.analysis.guru}
            </div>
          )}
        </div>
      ))}
      {journal.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:'var(--dim)',fontSize:12}}>일지가 없습니다. 매매 이유를 기록해보세요.</div>}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 앱
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TABS = [
  {id:'home',icon:'🏠',label:'홈'},{id:'macro',icon:'📡',label:'매크로'},
  {id:'stocks',icon:'📊',label:'종목'},{id:'ten',icon:'🚀',label:'텐베거'},
  {id:'guru',icon:'🧠',label:'구루'},{id:'port',icon:'💼',label:'포트'},
  {id:'journal',icon:'📔',label:'일지'},
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [theme, setTheme] = useLS('stockdash_theme', 'dark');
  const [prices, setPrices] = useState({});
  const [macro, setMacro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [trades, setTrades] = useLS('stockdash_trades', []);
  const [journal, setJournal] = useLS('stockdash_journal', []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pRes, mRes] = await Promise.allSettled([
      fetch('/api/prices').then(r=>r.json()).catch(()=>null),
      fetch('/api/macro').then(r=>r.json()).catch(()=>null),
    ]);
    if (pRes.status==='fulfilled'&&pRes.value?.prices) setPrices(pRes.value.prices);
    if (mRes.status==='fulfilled'&&mRes.value?.macro) setMacro(mRes.value.macro);
    setFetchedAt(new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}));
    setLoading(false);
  }, []);

  useEffect(()=>{ fetchAll(); const id=setInterval(fetchAll,5*60*1000); return()=>clearInterval(id); },[fetchAll]);

  const cycleTheme = () => {
    const order=['dark','claude','finance'];
    setTheme(prev=>order[(order.indexOf(prev)+1)%order.length]);
  };

  const th = THEMES[theme]||THEMES.dark;

  return (
    <>
      <Head>
        <title>투자 대시보드</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <style>{`:root{${th.vars}}`}</style>
      </Head>
      <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--bg)',color:'var(--text)',fontFamily:'Pretendard,-apple-system,BlinkMacSystemFont,sans-serif'}}>
        {/* 헤더 */}
        <div style={{background:'var(--bg)',paddingTop:'env(safe-area-inset-top)',borderBottom:'1px solid var(--line)',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px 7px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--gold)'}}>📊 투자 대시보드</div>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              {fetchedAt&&<span style={{fontSize:9,color:'var(--dim)'}}>갱신 {fetchedAt}</span>}
              {loading&&<span style={{fontSize:11}}>⏳</span>}
              <button onClick={cycleTheme} style={{background:'var(--bg3)',border:'1px solid var(--line2)',borderRadius:6,fontSize:14,padding:'3px 9px',cursor:'pointer',lineHeight:1.4,color:'var(--text)'}}>{th.icon}</button>
              <button onClick={fetchAll} style={{background:'var(--bg3)',border:'1px solid var(--line2)',borderRadius:6,color:'var(--dim2)',fontSize:11,padding:'4px 9px',cursor:'pointer'}}>🔄</button>
            </div>
          </div>
        </div>
        {/* 콘텐츠 */}
        <div style={{flex:1,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom))'}}>
          {tab==='home'    &&<HomePage prices={prices} loading={loading} macro={macro}/>}
          {tab==='macro'   &&<MacroPage macro={macro}/>}
          {tab==='stocks'  &&<StocksPage prices={prices} loading={loading} macro={macro}/>}
          {tab==='ten'     &&<TenBaggerPage prices={prices}/>}
          {tab==='guru'    &&<GuruPage prices={prices}/>}
          {tab==='port'    &&<PortfolioPage prices={prices} trades={trades} setTrades={setTrades}/>}
          {tab==='journal' &&<JournalPage prices={prices} journal={journal} setJournal={setJournal}/>}
        </div>
        {/* 하단 탭 */}
        <div style={{position:'fixed',bottom:0,left:0,right:0,height:'calc(60px + env(safe-area-inset-bottom))',paddingBottom:'env(safe-area-inset-bottom)',background:'var(--bg2)',borderTop:'1px solid var(--line2)',display:'flex',alignItems:'flex-start',paddingTop:8,zIndex:100}}>
          {TABS.map(t=>(
            <div key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'pointer',padding:'3px 0',WebkitTapHighlightColor:'transparent'}}>
              <span style={{fontSize:20,lineHeight:1}}>{t.icon}</span>
              <span style={{fontSize:9,color:tab===t.id?'var(--gold)':'var(--dim)',letterSpacing:'.01em'}}>{t.label}</span>
              {tab===t.id&&<div style={{width:4,height:4,borderRadius:'50%',background:'var(--gold)',marginTop:1}}/>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
