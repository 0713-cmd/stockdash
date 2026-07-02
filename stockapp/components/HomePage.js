import { MACRO_INIT } from '../lib/data';
import { calcPositionSize } from '../lib/calculations';
import { fmt, pct, SectionTitle, ScoreRing, StockCompactRow, computeMacroValues } from './shared';
import { MacroGrid } from './MacroBits';
import { buildStocks } from './stockUtils';

export default function HomePage({ prices, loading, macro, openStock, openMacro, goTab }) {
  const m = {...MACRO_INIT, ...macro};
  const treasury = m.treasury_10y || 4.42;
  const values = computeMacroValues(m);
  const stocks = buildStocks(prices, treasury);

  const buys = stocks.filter(s=>s.comp.signal==='BUY'&&s.type!=='locked').sort((a,b)=>parseFloat(b.comp.score||0)-parseFloat(a.comp.score||0)).slice(0,10);
  const upsideRanked = stocks.filter(s=>s.type!=='locked'&&s.cur&&s.up!=null).sort((a,b)=>b.up-a.up).slice(0,10);
  const tenTop = [...stocks].filter(s=>s.type!=='locked').sort((a,b)=>b.ten-a.ten).slice(0,10);

  const portWithPrice = stocks.filter(s=>(s.type==='portfolio'||s.type==='locked')&&s.cur&&s.up!=null);
  const avgUp = portWithPrice.length ? portWithPrice.reduce((a,s)=>a+(s.up||0),0)/portWithPrice.length : null;

  return (
    <div style={{paddingBottom:80}}>
      {/* 레짐 카드 */}
      <div style={{margin:'8px 12px',padding:'12px 14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line2)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:9,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:3}}>시장 레짐</div>
          <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{m.regime}</div>
          <div style={{fontSize:10,color:'var(--dim2)',marginTop:2}}>{m.regime_detail}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:9,color:'var(--dim)',marginBottom:3}}>보유종목 평균 목표가 괴리율</div>
          <div className="mono" style={{fontSize:18,fontWeight:700,color:avgUp!=null?(avgUp>0?'var(--green)':'var(--red)'):'var(--dim)'}}>{avgUp!=null?pct(avgUp):'—'}</div>
          <div style={{fontSize:9,color:'var(--dim2)',marginTop:2}}>(목표가-현재가)/현재가 평균</div>
        </div>
      </div>

      {/* 매크로 컴팩트 그리드 */}
      <SectionTitle right={<span onClick={()=>goTab('macroguru')} style={{fontSize:9,color:'var(--gold)',cursor:'pointer'}}>전체보기 →</span>}>📡 매크로 한눈에 (탭하면 해설)</SectionTitle>
      <MacroGrid values={values} onOpen={openMacro}/>

      {loading&&<div style={{padding:'10px 16px',color:'var(--dim)',fontSize:11}}>⏳ 가격 로딩 중...</div>}

      {/* 매수 추천 TOP */}
      <SectionTitle right={<span onClick={()=>goTab('stocks')} style={{fontSize:9,color:'var(--gold)',cursor:'pointer'}}>전체보기 →</span>}>📗 매수 추천 TOP{Math.min(10,buys.length)}</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--green-bd)',overflow:'hidden'}}>
        {buys.length>0 ? buys.slice(0,5).map((s,i)=>(
          <div key={s.sym} style={{borderBottom:i<Math.min(5,buys.length)-1?'1px solid var(--line)':'none'}}>
            <StockCompactRow s={s} onClick={()=>openStock(s.sym)}/>
          </div>
        )) : <div style={{padding:'12px',fontSize:11,color:'var(--dim)',textAlign:'center'}}>현재 BUY 신호 없음</div>}
      </div>

      {/* 업사이드 TOP */}
      <SectionTitle right={<span onClick={()=>goTab('stocks')} style={{fontSize:9,color:'var(--gold)',cursor:'pointer'}}>전체보기 →</span>}>📈 업사이드 TOP{Math.min(10,upsideRanked.length)} (보유+트래킹)</SectionTitle>
      <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        {upsideRanked.slice(0,5).map((s,i)=>(
          <div key={s.sym} style={{borderBottom:i<4?'1px solid var(--line)':'none'}}>
            <StockCompactRow s={s} onClick={()=>openStock(s.sym)}/>
          </div>
        ))}
      </div>

      {/* 텐베거 TOP */}
      <SectionTitle right={<span onClick={()=>goTab('ten')} style={{fontSize:9,color:'var(--gold)',cursor:'pointer'}}>전체보기 →</span>}>🚀 텐베거 유망 TOP{Math.min(10,tenTop.length)}</SectionTitle>
      <div style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',overflow:'hidden'}}>
        {tenTop.slice(0,5).map((s,i)=>(
          <div key={s.sym} onClick={()=>openStock(s.sym)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:i<4?'1px solid var(--line)':'none',cursor:'pointer'}}>
            <ScoreRing score={s.ten} size={34}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',gap:6,alignItems:'center'}}><span className="mono" style={{fontWeight:700,fontSize:12,color:'#fff'}}>{s.sym}</span><span style={{fontSize:10,color:'var(--dim2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name}</span></div>
            </div>
            <div style={{textAlign:'right'}}>
              <div className="mono" style={{fontSize:12,fontWeight:700,color:'#fff'}}>{s.cur?`$${fmt(s.cur)}`:'—'}</div>
              {s.up!=null&&<div style={{fontSize:10,color:s.up>0?'var(--green)':'var(--red)',fontWeight:600}}>{pct(s.up)}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
