import { useState, useEffect } from 'react';
import { MACRO_INIT, MACRO_META } from '../lib/data';
import { calcComprehensiveScore } from '../lib/calculations';
import { fmt, pct, clr, sigCol, sigIcon, sigLbl, SectionTitle, computeMacroValues, levelMatch, colOf } from './shared';
import { buildStocks } from './stockUtils';

const gradeCol = g => g?.startsWith('A') ? 'var(--green)' : g?.startsWith('B') ? 'var(--gold)' : 'var(--red)';

// ── 스켈레톤 로딩 바 ──
function Skeleton({ rows = 5 }) {
  return (
    <div style={{padding:'8px 12px'}}>
      {Array.from({length: rows}).map((_,i)=>(
        <div key={i} style={{height:14,background:'var(--bg3)',borderRadius:6,marginBottom:10,opacity:1-(i*0.15),animation:'pulse 1.5s infinite'}}/>
      ))}
    </div>
  );
}

// ── TOP30 랭킹 리스트 (기본 10개 + 더보기) ──
function RankList({ items, renderRight, emptyText, openStock, borderCol }) {
  const [expand, setExpand] = useState(false);
  if (!items) return <Skeleton/>;
  if (items.length === 0) return <div style={{padding:'14px',fontSize:11,color:'var(--dim)',textAlign:'center'}}>{emptyText||'스크리닝 대기 중'}</div>;
  const visible = expand ? items : items.slice(0, 10);
  return (
    <>
      {visible.map((s, i) => (
        <div key={s.symbol} onClick={()=>openStock(s.symbol)}
          style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',borderBottom:i<visible.length-1?'1px solid var(--line)':'none',cursor:'pointer'}}>
          <span className="mono" style={{fontSize:10,color:'var(--dim)',width:18,textAlign:'right',flexShrink:0}}>{i+1}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span className="mono" style={{fontWeight:700,fontSize:12,color:'var(--strong)'}}>{s.symbol}</span>
              {s.lite===false&&<span style={{fontSize:7,color:'var(--gold)',border:'1px solid var(--gold-bd)',borderRadius:2,padding:'0 3px'}}>정밀</span>}
            </div>
            <div style={{fontSize:9,color:'var(--dim)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name} · {s.sector||''}</div>
          </div>
          <div className="mono" style={{fontSize:11,fontWeight:600,color:'var(--text)',flexShrink:0}}>${fmt(s.price)}</div>
          {renderRight(s)}
        </div>
      ))}
      {!expand && items.length > 10 && (
        <div onClick={e=>{e.stopPropagation();setExpand(true);}} style={{padding:'9px',textAlign:'center',fontSize:11,color:'var(--gold)',cursor:'pointer',borderTop:'1px solid var(--line)'}}>
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

  // ── 스크리닝 데이터 로드 ──
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
    return { key:k, short: meta?.short||k, col: lvl?colOf(lvl.color):'var(--dim)', icon: meta?.icon };
  });
  const redCnt = macroDots.filter(d=>d.col==='var(--red)').length;

  // ② 보유·트래킹 3대 점수
  const myStocks = stocks.filter(s=>s.type==='portfolio'||s.type==='watch'||s.type==='locked')
    .map(s => ({ ...s, comprehensive: calcComprehensiveScore(s, prices[s.sym]) }));

  // ⑥ 교집합 (2개 이상 리스트 동시 등장)
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
      <style>{`@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

      {/* ① 매크로 신호등 압축 */}
      <div onClick={()=>goTab('macroguru')} style={{margin:'8px 12px',padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line2)',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:9,color:'var(--dim)',marginBottom:4}}>매크로 · {m.regime} {redCnt>=4?'🔴':redCnt>=2?'🟡':'🟢'}</div>
          <div style={{display:'flex',gap:7}}>
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

      {/* ② 내 종목 3대 점수 테이블 */}
      <SectionTitle>💼 내 보유·트래킹 — 3대 점수</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        <div style={{display:'flex',padding:'6px 12px',borderBottom:'1px solid var(--line2)',fontSize:8,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.05em'}}>
          <span style={{width:52}}>종목</span>
          <span style={{flex:1,textAlign:'right'}}>현재가</span>
          <span style={{width:52,textAlign:'right'}}>등락</span>
          <span style={{width:56,textAlign:'center'}}>종합</span>
          <span style={{width:44,textAlign:'center'}}>전략</span>
          <span style={{width:36,textAlign:'right'}}>텐베거</span>
        </div>
        {myStocks.map((s,i)=>(
          <div key={s.sym} onClick={()=>openStock(s.sym)} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:i<myStocks.length-1?'1px solid var(--line)':'none',cursor:'pointer'}}>
            <span className="mono" style={{width:52,fontWeight:700,fontSize:12,color:'var(--strong)'}}>{s.sym}</span>
            <span className="mono" style={{flex:1,textAlign:'right',fontSize:11,color:'var(--text)'}}>{s.cur?`$${fmt(s.cur)}`:loading?'⋯':'—'}</span>
            <span className={`mono ${clr(s.chg)}`} style={{width:52,textAlign:'right',fontSize:10}}>{s.chg!=null?`${s.chg>0?'+':''}${s.chg.toFixed(2)}%`:'—'}</span>
            <span style={{width:56,textAlign:'center'}}>
              <span className="mono" style={{fontSize:11,fontWeight:700,color:gradeCol(s.comprehensive.grade)}}>{s.comprehensive.score}</span>
              <span style={{fontSize:8,color:gradeCol(s.comprehensive.grade),marginLeft:2}}>{s.comprehensive.grade}</span>
            </span>
            <span style={{width:44,textAlign:'center',fontSize:9,fontWeight:700,color:sigCol(s.comp.signal)}}>{s.type==='locked'?'🔒':`${sigIcon(s.comp.signal)}`}</span>
            <span className="mono" style={{width:36,textAlign:'right',fontSize:11,fontWeight:700,color:s.ten>=70?'var(--green)':s.ten>=50?'var(--gold)':'var(--dim2)'}}>{s.ten}</span>
          </div>
        ))}
      </div>

      {/* ③ 종합점수 TOP30 */}
      <SectionTitle>🏆 종합점수 TOP30 — 유니버스 {screen?.universe_size||'약 190'}종목 스크리닝</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        {screenErr && <div style={{padding:'12px',fontSize:11,color:'var(--red)'}}>⚠️ 스크리닝 실패: {screenErr}</div>}
        <RankList items={screen?.top30Comprehensive} openStock={openStock}
          emptyText="스크리닝 대기 중 — 잠시 후 새로고침"
          renderRight={s=>(
            <span style={{width:52,textAlign:'right',flexShrink:0}}>
              <span className="mono" style={{fontSize:12,fontWeight:700,color:gradeCol(s.comprehensive.grade)}}>{s.comprehensive.score}</span>
              <span style={{fontSize:9,color:gradeCol(s.comprehensive.grade),marginLeft:2}}>{s.comprehensive.grade}</span>
            </span>
          )}/>
      </div>

      {/* ④ MARS-V TOP30 */}
      <SectionTitle>🎯 MARS-V 전략 TOP30 — 18개 방법론 종합</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        <RankList items={screen?.top30MarsV} openStock={openStock}
          emptyText="스크리닝 대기 중 (정밀 데이터 보유 종목만 대상)"
          renderRight={s=>(
            <span style={{width:52,textAlign:'right',flexShrink:0,fontSize:9,fontWeight:700,color:sigCol(s.marsV.signal)}}>
              {sigIcon(s.marsV.signal)} {sigLbl(s.marsV.signal)}
            </span>
          )}/>
      </div>

      {/* ⑤ 텐베거 TOP30 */}
      <SectionTitle>🚀 텐베거 TOP30</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        <RankList items={screen?.top30TenBagger} openStock={openStock}
          emptyText="스크리닝 대기 중"
          renderRight={s=>(
            <span style={{width:52,textAlign:'right',flexShrink:0}}>
              <span className="mono" style={{fontSize:12,fontWeight:700,color:s.tenBagger>=70?'var(--green)':s.tenBagger>=50?'var(--gold)':'var(--dim2)'}}>{s.tenBagger}</span>
              <span style={{fontSize:8,color:'var(--dim)',marginLeft:1}}>점</span>
            </span>
          )}/>
      </div>

      {/* ⑥ 교집합 하이라이트 */}
      {intersection.length > 0 && (
        <>
          <SectionTitle>⭐ 이중 검증 — 2개 이상 체계에서 동시 상위권</SectionTitle>
          <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'2px solid var(--gold)',overflow:'hidden'}}>
            {intersection.slice(0,8).map((s,i)=>(
              <div key={s.symbol} onClick={()=>openStock(s.symbol)} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderBottom:i<Math.min(8,intersection.length)-1?'1px solid var(--line)':'none',cursor:'pointer'}}>
                <span style={{fontSize:13}}>{'⭐'.repeat(s.hitCount>=3?3:2)}</span>
                <div style={{flex:1,minWidth:0}}>
                  <span className="mono" style={{fontWeight:700,fontSize:13,color:'var(--strong)'}}>{s.symbol}</span>
                  <span style={{fontSize:9,color:'var(--dim)',marginLeft:6}}>{s.name}</span>
                </div>
                <span style={{fontSize:9,color:'var(--gold)',fontWeight:700}}>{s.hitCount}개 체계 검증</span>
                <span className="mono" style={{fontSize:11,fontWeight:600,color:'var(--text)'}}>${fmt(s.price)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ⑦ 오늘의 경보 */}
      <SectionTitle>🚨 오늘의 경보</SectionTitle>
      {alerts.length===0
        ? <div style={{margin:'0 12px 8px',padding:'10px 14px',background:'var(--green-bg)',border:'1px solid var(--green-bd)',borderRadius:10,fontSize:11,color:'var(--dim2)'}}>✅ 현재 활성 경보 없음</div>
        : alerts.map((a,i)=>(
          <div key={i} style={{margin:'0 12px 4px',padding:'10px 14px',background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:10}}>
            <span className="mono" style={{fontSize:11,fontWeight:700,color:'var(--red)'}}>{a.sym}</span>
            <span style={{fontSize:11,color:'var(--dim2)',marginLeft:8}}>{a.msg}</span>
          </div>
        ))
      }
      <div style={{height:10}}/>
    </div>
  );
}
