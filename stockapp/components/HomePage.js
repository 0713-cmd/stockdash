import { useState, useEffect } from 'react';
import { MACRO_INIT, MACRO_META } from '../lib/data';
import { calcComprehensiveScore } from '../lib/calculations';
import { fmt, clr, sigCol, sigIcon, sigLbl, SectionTitle, CardGrid, computeMacroValues, levelMatch, colOf } from './shared';
import { ScoreExplainer, gradeCol } from './ScoreBits';
import { buildStocks } from './stockUtils';

// ── 컬럼 안의 종목 한 줄 ──
function ColRow({ sym, name, price, change, right, onClick, last, highlight }) {
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:7,padding:'8px 10px',borderBottom:last?'none':'1px solid var(--line)',cursor:'pointer',background:highlight?'var(--gold-bg)':'transparent'}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',gap:5,alignItems:'baseline'}}>
          <span className="mono" style={{fontWeight:700,fontSize:12,color:'var(--strong)'}}>{sym}</span>
          {change!=null&&<span className={`mono ${clr(change)}`} style={{fontSize:9}}>{change>0?'+':''}{change.toFixed(2)}%</span>}
        </div>
        <div style={{fontSize:9,color:'var(--dim)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name||''}</div>
      </div>
      <span className="mono" style={{fontSize:11,fontWeight:600,color:'var(--text)',flexShrink:0}}>{price!=null?`$${fmt(price)}`:'—'}</span>
      <span style={{minWidth:44,textAlign:'right',flexShrink:0}}>{right}</span>
    </div>
  );
}

// ── 세로 컬럼 (헤더 + 리스트 + 더보기) ──
function Column({ icon, title, sub, items, renderRow, emptyText, borderCol }) {
  const [expand, setExpand] = useState(false);
  const visible = items ? (expand ? items : items.slice(0, 15)) : null;
  return (
    <div style={{background:'var(--bg2)',border:`1px solid ${borderCol||'var(--line)'}`,borderRadius:14,overflow:'hidden',display:'flex',flexDirection:'column',alignSelf:'start'}}>
      <div style={{padding:'10px 12px',borderBottom:'1px solid var(--line2)',background:'var(--bg3)'}}>
        <div style={{fontSize:12,fontWeight:700,color:'var(--strong)'}}>{icon} {title}</div>
        {sub&&<div style={{fontSize:9,color:'var(--dim)',marginTop:2}}>{sub}</div>}
      </div>
      {!visible&&(
        <div style={{padding:'10px'}}>
          {Array.from({length:8}).map((_,i)=>(
            <div key={i} style={{height:12,background:'var(--bg3)',borderRadius:6,marginBottom:10,animation:'pulse 1.5s infinite',animationDelay:`${i*0.1}s`}}/>
          ))}
        </div>
      )}
      {visible&&visible.length===0&&<div style={{padding:'14px',fontSize:11,color:'var(--dim)',textAlign:'center'}}>{emptyText||'스크리닝 대기 중'}</div>}
      {visible&&visible.map((it,i)=>renderRow(it,i,i===visible.length-1&&!(items.length>15&&!expand)))}
      {visible&&items.length>15&&!expand&&(
        <div onClick={()=>setExpand(true)} style={{padding:'8px',textAlign:'center',fontSize:10,color:'var(--gold)',cursor:'pointer',borderTop:'1px solid var(--line)'}}>
          {items.length}개 전체 ▼
        </div>
      )}
    </div>
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

  // 매크로 신호등 한 줄
  const macroKeys = ['fed_rate','shiller_cape','buffett_indicator','ism_pmi','cpi_yoy','dxy','fed_model'];
  const macroDots = macroKeys.map(k => {
    const meta = MACRO_META[k];
    const lvl = meta ? levelMatch(meta.levels, values[k]) : null;
    return { key:k, short: meta?.short||k, col: lvl?colOf(lvl.color):'var(--dim)' };
  });
  const redCnt = macroDots.filter(d=>d.col==='var(--red)').length;

  // 내 종목 (종합점수 순 정렬)
  const myStocks = stocks.filter(s=>s.type==='portfolio'||s.type==='watch'||s.type==='locked')
    .map(s => ({ ...s, comprehensive: calcComprehensiveScore(s, prices[s.sym]) }))
    .sort((a,b)=>b.comprehensive.score-a.comprehensive.score);

  // 교집합 심볼 (금색 하이라이트용)
  const interSet = new Set();
  if (screen?.top30Comprehensive) {
    const inC = new Set(screen.top30Comprehensive.map(s=>s.symbol));
    const inM = new Set((screen.top30MarsV||[]).map(s=>s.symbol));
    const inT = new Set((screen.top30TenBagger||[]).map(s=>s.symbol));
    [...inC,...inM,...inT].forEach(sym=>{
      const c = (inC.has(sym)?1:0)+(inM.has(sym)?1:0)+(inT.has(sym)?1:0);
      if (c>=2) interSet.add(sym);
    });
  }

  // 경보
  const alerts = [];
  stocks.forEach(s=>{
    if (s.beneish_m != null && s.beneish_m > -1.78) alerts.push({sym:s.sym, msg:`Beneish M ${s.beneish_m} — 실적 조작 의심 구간`});
    if (s.cur && s.fair_value && s.cur > s.fair_value*1.25 && s.type==='portfolio') alerts.push({sym:s.sym, msg:'적정가 +25% 초과 — 익절 검토'});
  });

  return (
    <div style={{paddingBottom:80}}>
      <style>{`@keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}}`}</style>

      {/* 매크로 신호등 */}
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

      {/* 점수 산정 방식 설명 */}
      <ScoreExplainer/>
      {screenErr&&<div style={{margin:'0 12px 8px',padding:'10px 14px',background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:10,fontSize:11,color:'var(--red)'}}>⚠️ 스크리닝 실패: {screenErr}</div>}

      {/* ★ 4개 세로 컬럼: 내 종목 | 종합점수 | MARS-V | 텐베거 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(255px,1fr))',gap:10,margin:'0 12px'}}>

        {/* 컬럼 1: 내 보유·트래킹 */}
        <Column icon="💼" title="내 보유·트래킹" sub="종합점수 순 · 클릭하면 상세" borderCol="var(--line2)"
          items={myStocks}
          renderRow={(s,i,last)=>(
            <ColRow key={s.sym} sym={s.sym} name={s.name} price={s.cur} change={s.chg} last={last}
              onClick={()=>openStock(s.sym)}
              right={<span className="mono" style={{fontSize:12,fontWeight:700,color:gradeCol(s.comprehensive.grade)}}>{s.comprehensive.score}<span style={{fontSize:8,marginLeft:1}}>{s.comprehensive.grade}</span></span>}/>
          )}/>

        {/* 컬럼 2: 종합점수 TOP30 */}
        <Column icon="🏆" title="종합점수 TOP30" sub={`유니버스 ${screen?.universe_size||163}종목 · 5개 영역 100점`} borderCol="var(--gold-bd)"
          items={screen?.top30Comprehensive}
          renderRow={(s,i,last)=>(
            <ColRow key={s.symbol} sym={`${i+1}. ${s.symbol}`} name={s.name} price={s.price} change={s.change} last={last}
              highlight={interSet.has(s.symbol)}
              onClick={()=>openStock(s.symbol)}
              right={<span className="mono" style={{fontSize:12,fontWeight:700,color:gradeCol(s.comprehensive.grade)}}>{s.comprehensive.score}<span style={{fontSize:8,marginLeft:1}}>{s.comprehensive.grade}</span></span>}/>
          )}/>

        {/* 컬럼 3: MARS-V TOP30 */}
        <Column icon="🎯" title="MARS-V 전략 TOP30" sub="18개 방법론 가중합 · 정밀 데이터 종목" borderCol="var(--blue-bd)"
          items={screen?.top30MarsV}
          renderRow={(s,i,last)=>(
            <ColRow key={s.symbol} sym={`${i+1}. ${s.symbol}`} name={s.name} price={s.price} change={s.change} last={last}
              highlight={interSet.has(s.symbol)}
              onClick={()=>openStock(s.symbol)}
              right={<span style={{fontSize:9,fontWeight:700,color:sigCol(s.marsV.signal)}}>{sigIcon(s.marsV.signal)}{sigLbl(s.marsV.signal)}</span>}/>
          )}/>

        {/* 컬럼 4: 텐베거 TOP30 */}
        <Column icon="🚀" title="텐베거 TOP30" sub="5년 10배 잠재력 · R40+성장가속+TAM" borderCol="var(--pur-bd)"
          items={screen?.top30TenBagger}
          renderRow={(s,i,last)=>(
            <ColRow key={s.symbol} sym={`${i+1}. ${s.symbol}`} name={s.name} price={s.price} change={s.change} last={last}
              highlight={interSet.has(s.symbol)}
              onClick={()=>openStock(s.symbol)}
              right={<span className="mono" style={{fontSize:12,fontWeight:700,color:s.tenBagger>=70?'var(--green)':s.tenBagger>=50?'var(--gold)':'var(--dim2)'}}>{s.tenBagger}<span style={{fontSize:8,color:'var(--dim)'}}>점</span></span>}/>
          )}/>
      </div>

      {interSet.size>0&&(
        <div style={{margin:'8px 12px 0',fontSize:10,color:'var(--dim2)'}}>
          <span style={{display:'inline-block',width:10,height:10,background:'var(--gold-bg)',border:'1px solid var(--gold-bd)',borderRadius:3,marginRight:5,verticalAlign:'-1px'}}/>
          금색 배경 = 2개 이상 체계에서 동시 상위권 (이중 검증 · 신뢰도 높음)
        </div>
      )}

      {/* 경보 */}
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
