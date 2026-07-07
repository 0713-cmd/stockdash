import { useState, useEffect } from 'react';
import { MACRO_INIT, MACRO_META } from '../lib/data';
import { calcComprehensiveScore } from '../lib/calculations';
import { fmt, pct, clr, sigCol, sigIcon, sigLbl, SectionTitle, CardGrid, computeMacroValues, levelMatch, colOf } from './shared';
import { buildStocks } from './stockUtils';

const gradeCol = g => g?.startsWith('A') ? 'var(--green)' : g?.startsWith('B') ? 'var(--gold)' : 'var(--red)';

// ── 스켈레톤 카드 그리드 ──
function SkeletonGrid({ n = 8 }) {
  return (
    <CardGrid min={230}>
      {Array.from({length:n}).map((_,i)=>(
        <div key={i} style={{height:76,background:'var(--bg2)',border:'1px solid var(--line)',borderRadius:12,animation:'pulse 1.5s infinite',animationDelay:`${i*0.1}s`}}/>
      ))}
    </CardGrid>
  );
}

// ── 랭킹 카드 (한 줄 4개 그리드용) ──
function RankCard({ s, rank, right, onClick, highlight }) {
  return (
    <div onClick={onClick} style={{
      background:'var(--bg2)', border: highlight ? '2px solid var(--gold)' : '1px solid var(--line)',
      borderRadius:12, padding:'10px 12px', cursor:'pointer', display:'flex', flexDirection:'column', gap:5,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,alignItems:'center',minWidth:0}}>
          <span className="mono" style={{fontSize:9,color:'var(--dim)',flexShrink:0}}>#{rank}</span>
          <span className="mono" style={{fontWeight:700,fontSize:13,color:'var(--strong)'}}>{s.symbol}</span>
          {s.lite===false&&<span style={{fontSize:7,color:'var(--gold)',border:'1px solid var(--gold-bd)',borderRadius:2,padding:'0 3px',flexShrink:0}}>정밀</span>}
        </div>
        {right}
      </div>
      <div style={{fontSize:9,color:'var(--dim)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name} · {s.sector||''}</div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span className="mono" style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>${fmt(s.price)}</span>
        {s.change!=null&&<span className={`mono ${clr(s.change)}`} style={{fontSize:10}}>{s.change>0?'▲':'▼'}{Math.abs(s.change).toFixed(2)}%</span>}
      </div>
    </div>
  );
}

// ── TOP30 그리드 (기본 8개 + 더보기 30개) ──
function RankGrid({ items, renderRight, emptyText, openStock, err }) {
  const [expand, setExpand] = useState(false);
  if (err) return <div style={{margin:'0 12px',padding:'12px',background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:10,fontSize:11,color:'var(--red)'}}>⚠️ 스크리닝 실패: {err}</div>;
  if (!items) return <SkeletonGrid/>;
  if (items.length===0) return <div style={{margin:'0 12px',padding:'14px',background:'var(--bg2)',border:'1px solid var(--line)',borderRadius:10,fontSize:11,color:'var(--dim)',textAlign:'center'}}>{emptyText||'스크리닝 대기 중'}</div>;
  const visible = expand ? items : items.slice(0,8);
  return (
    <>
      <CardGrid min={230}>
        {visible.map((s,i)=><RankCard key={s.symbol} s={s} rank={i+1} right={renderRight(s)} onClick={()=>openStock(s.symbol)}/>)}
      </CardGrid>
      {!expand&&items.length>8&&(
        <div onClick={()=>setExpand(true)} style={{margin:'6px 12px 0',padding:'8px',textAlign:'center',fontSize:11,color:'var(--gold)',cursor:'pointer',background:'var(--bg2)',borderRadius:10,border:'1px solid var(--line)'}}>
          TOP {items.length}까지 더보기 ▼
        </div>
      )}
    </>
  );
}

export default function HomePage({ prices, loading, macro, openStock, openMacro, goTab }) {
  const m = {...MACRO_INIT, ...macro};
  const treasury = m.treasury_10y || 4.42;
  const values = computeMacroValues(m);
  const stocks = buildStocks(prices, treasury);

  const [screen, setScreen] = useState(null);
  const [screenErr, setScreenErr] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/screen').then(r=>r.json()).then(d=>{
      if (!alive) return;
      if (d.error) setScreenErr(d.error);
      setScreen(d);
    }).catch(e=>{ if (alive) setScreenErr(e.message); });
    return ()=>{ alive = false; };
  }, []);

  // ① 매크로 신호등 한 줄
  const macroKeys = ['fed_rate','shiller_cape','buffett_indicator','ism_pmi','cpi_yoy','dxy','fed_model'];
  const macroDots = macroKeys.map(k => {
    const meta = MACRO_META[k];
    const lvl = meta ? levelMatch(meta.levels, values[k]) : null;
    return { key:k, short: meta?.short||k, col: lvl?colOf(lvl.color):'var(--dim)' };
  });
  const redCnt = macroDots.filter(d=>d.col==='var(--red)').length;

  // ② 내 종목 3대 점수
  const myStocks = stocks.filter(s=>s.type==='portfolio'||s.type==='watch'||s.type==='locked')
    .map(s => ({ ...s, comprehensive: calcComprehensiveScore(s, prices[s.sym]) }));

  // ⑥ 교집합
  let intersection = [];
  if (screen?.top30Comprehensive) {
    const inC = new Set(screen.top30Comprehensive.map(s=>s.symbol));
    const inM = new Set((screen.top30MarsV||[]).map(s=>s.symbol));
    const inT = new Set((screen.top30TenBagger||[]).map(s=>s.symbol));
    const counts = {};
    [...inC,...inM,...inT].forEach(sym=>{ counts[sym]=(inC.has(sym)?1:0)+(inM.has(sym)?1:0)+(inT.has(sym)?1:0); });
    intersection = Object.entries(counts)
      .filter(([,c])=>c>=2)
      .map(([sym,c])=>{
        const src = screen.top30Comprehensive.find(s=>s.symbol===sym)
          || screen.top30MarsV?.find(s=>s.symbol===sym)
          || screen.top30TenBagger?.find(s=>s.symbol===sym);
        return { ...src, hitCount: c };
      })
      .sort((a,b)=>b.hitCount-a.hitCount || b.comprehensive.score-a.comprehensive.score);
  }

  // ⑦ 경보
  const alerts = [];
  stocks.forEach(s=>{
    if (s.beneish_m != null && s.beneish_m > -1.78) alerts.push({sym:s.sym, msg:`Beneish M ${s.beneish_m} — 실적 조작 의심 구간`});
    if (s.cur && s.fair_value && s.cur > s.fair_value*1.25 && s.type==='portfolio') alerts.push({sym:s.sym, msg:'적정가 +25% 초과 — 익절 검토 구간'});
  });

  return (
    <div style={{paddingBottom:80}}>
      <style>{`@keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}}`}</style>

      {/* ① 매크로 신호등 압축 */}
      <div onClick={()=>goTab('macroguru')} style={{margin:'8px 12px',padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line2)',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:9,color:'var(--dim)',marginBottom:4}}>매크로 · {m.regime} {redCnt>=4?'🔴':redCnt>=2?'🟡':'🟢'} · 주식 {m.stock_cash_ratio}% 권고</div>
          <div style={{display:'flex',gap:9}}>
            {macroDots.map(d=>(
              <div key={d.key} onClick={e=>{e.stopPropagation();openMacro(d.key);}} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:d.col}}/>
                <span style={{fontSize:7,color:'var(--dim)'}}>{d.short}</span>
              </div>
            ))}
          </div>
        </div>
        <span style={{fontSize:10,color:'var(--gold)'}}>상세 →</span>
      </div>

      {/* ② 내 종목 3대 점수 — 4열 그리드 */}
      <SectionTitle>💼 내 보유·트래킹 — 3대 점수</SectionTitle>
      <CardGrid min={230}>
        {myStocks.map(s=>(
          <div key={s.sym} onClick={()=>openStock(s.sym)} style={{background:'var(--bg2)',border:'1px solid var(--line)',borderLeft:`3px solid ${s.type==='locked'?'var(--dim)':sigCol(s.comp.signal)}`,borderRadius:12,padding:'10px 12px',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <span className="mono" style={{fontWeight:700,fontSize:13,color:'var(--strong)'}}>{s.sym}</span>
              <div style={{textAlign:'right'}}>
                <span className="mono" style={{fontSize:12,fontWeight:700,color:'var(--text)'}}>{s.cur?`$${fmt(s.cur)}`:loading?'⋯':'—'}</span>
                {s.chg!=null&&<span className={`mono ${clr(s.chg)}`} style={{fontSize:9,marginLeft:5}}>{s.chg>0?'+':''}{s.chg.toFixed(2)}%</span>}
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:10}}>
              <span>종합 <b className="mono" style={{color:gradeCol(s.comprehensive.grade)}}>{s.comprehensive.score}{s.comprehensive.grade}</b></span>
              <span style={{color:sigCol(s.comp.signal),fontWeight:700}}>{s.type==='locked'?'🔒장기':`${sigIcon(s.comp.signal)}${sigLbl(s.comp.signal)}`}</span>
              <span>텐베거 <b className="mono" style={{color:s.ten>=70?'var(--green)':s.ten>=50?'var(--gold)':'var(--dim2)'}}>{s.ten}</b></span>
            </div>
          </div>
        ))}
      </CardGrid>

      {/* ③ 종합점수 TOP30 */}
      <SectionTitle>🏆 종합점수 TOP30 — 유니버스 {screen?.universe_size||163}종목 스크리닝</SectionTitle>
      <RankGrid items={screen?.top30Comprehensive} openStock={openStock} err={screenErr}
        emptyText="스크리닝 대기 중 — 잠시 후 새로고침"
        renderRight={s=>(
          <span className="mono" style={{fontSize:13,fontWeight:700,color:gradeCol(s.comprehensive.grade),flexShrink:0}}>
            {s.comprehensive.score}<span style={{fontSize:9,marginLeft:1}}>{s.comprehensive.grade}</span>
          </span>
        )}/>

      {/* ④ MARS-V TOP30 */}
      <SectionTitle>🎯 MARS-V 전략 TOP30 — 18개 방법론 종합</SectionTitle>
      <RankGrid items={screen?.top30MarsV} openStock={openStock}
        emptyText="스크리닝 대기 중 (정밀 데이터 보유 종목만 대상)"
        renderRight={s=>(
          <span style={{fontSize:10,fontWeight:700,color:sigCol(s.marsV.signal),flexShrink:0}}>{sigIcon(s.marsV.signal)}{sigLbl(s.marsV.signal)}</span>
        )}/>

      {/* ⑤ 텐베거 TOP30 */}
      <SectionTitle>🚀 텐베거 TOP30</SectionTitle>
      <RankGrid items={screen?.top30TenBagger} openStock={openStock}
        emptyText="스크리닝 대기 중"
        renderRight={s=>(
          <span className="mono" style={{fontSize:13,fontWeight:700,color:s.tenBagger>=70?'var(--green)':s.tenBagger>=50?'var(--gold)':'var(--dim2)',flexShrink:0}}>
            {s.tenBagger}<span style={{fontSize:8,color:'var(--dim)'}}>점</span>
          </span>
        )}/>

      {/* ⑥ 교집합 하이라이트 */}
      {intersection.length>0&&(
        <>
          <SectionTitle>⭐ 이중 검증 — 2개 이상 체계 동시 상위권</SectionTitle>
          <CardGrid min={230}>
            {intersection.slice(0,8).map((s,i)=>(
              <RankCard key={s.symbol} s={s} rank={i+1} highlight onClick={()=>openStock(s.symbol)}
                right={<span style={{fontSize:9,color:'var(--gold)',fontWeight:700,flexShrink:0}}>{'⭐'.repeat(Math.min(3,s.hitCount))} {s.hitCount}중검증</span>}/>
            ))}
          </CardGrid>
        </>
      )}

      {/* ⑦ 오늘의 경보 */}
      <SectionTitle>🚨 오늘의 경보</SectionTitle>
      {alerts.length===0
        ? <div style={{margin:'0 12px 8px',padding:'10px 14px',background:'var(--green-bg)',border:'1px solid var(--green-bd)',borderRadius:10,fontSize:11,color:'var(--dim2)'}}>✅ 현재 활성 경보 없음</div>
        : (
          <CardGrid min={280}>
            {alerts.map((a,i)=>(
              <div key={i} style={{padding:'10px 14px',background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:10}}>
                <span className="mono" style={{fontSize:11,fontWeight:700,color:'var(--red)'}}>{a.sym}</span>
                <span style={{fontSize:11,color:'var(--dim2)',marginLeft:8}}>{a.msg}</span>
              </div>
            ))}
          </CardGrid>
        )
      }
      <div style={{height:10}}/>
    </div>
  );
}
