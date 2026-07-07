import { useState } from 'react';
import { fmt, pct, clr, sigCol, SigBadge, UpsideBar, Chip, CardGrid } from './shared';
import { buildStocks } from './stockUtils';

export default function StocksPage({ prices, loading, macro, openStock }) {
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const treasury = macro?.treasury_10y||4.42;
  const stocks = buildStocks(prices, treasury);
  const buyCnt=stocks.filter(s=>s.comp.signal==='BUY'&&s.type!=='locked').length;
  const holdCnt=stocks.filter(s=>s.comp.signal==='HOLD'&&s.type!=='locked').length;
  const waitCnt=stocks.filter(s=>['WAIT','DANGER'].includes(s.comp.signal)).length;

  let shown = filter==='all' ? stocks
    : filter==='portfolio' ? stocks.filter(s=>s.type==='portfolio'||s.type==='locked')
    : filter==='watch' ? stocks.filter(s=>s.type==='watch')
    : stocks.filter(s=>s.comp.signal===filter.toUpperCase());

  // 기본은 종합점수 상위 10개만, "전체보기"로 확장
  const sorted = [...shown].sort((a,b)=>parseFloat(b.comp.score||-99)-parseFloat(a.comp.score||-99));
  const visible = showAll ? sorted : sorted.slice(0,12);

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:20,fontWeight:700,color:'var(--strong)'}}>📊 종목</span>
        <div style={{display:'flex',gap:5}}>
          {[['BUY',buyCnt,'var(--green)'],['HOLD',holdCnt,'var(--gold)'],['WAIT',waitCnt,'var(--red)']].map(([l,n,c])=>(
            <div key={l} style={{padding:'2px 8px',borderRadius:20,fontSize:9,fontWeight:700,color:c,background:'rgba(0,0,0,.3)',border:`1px solid ${c}40`}}>{l} {n}</div>
          ))}
        </div>
      </div>
      <div style={{display:'flex',gap:6,padding:'0 12px 8px',overflowX:'auto',scrollbarWidth:'none'}}>
        {[['all','전체'],['portfolio','보유'],['watch','트래킹'],['BUY','📗매수'],['HOLD','🟡보유'],['WAIT','🔴대기']].map(([k,l])=>(
          <div key={k} onClick={()=>{setFilter(k);setShowAll(false);}} style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0,background:filter===k?'var(--gold-bg)':'var(--bg2)',border:`1px solid ${filter===k?'var(--gold-bd)':'var(--line2)'}`,color:filter===k?'var(--gold)':'var(--dim2)'}}>{l}</div>
        ))}
      </div>
      <div style={{padding:'0 16px 6px',fontSize:10,color:'var(--dim)'}}>{showAll?`전체 ${sorted.length}개`:`종합점수 상위 ${visible.length}개`} · 탭하면 재무·설명 상세</div>
      {loading&&<div style={{padding:'8px 16px',color:'var(--dim)',fontSize:11}}>⏳ 가격 로딩 중...</div>}
      <CardGrid min={280}>
      {visible.map(s=>{
        if (s.type==='locked') return (
          <div key={s.sym} onClick={()=>openStock(s.sym)} style={{padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',opacity:.7}}>
            <div><span className="mono" style={{fontWeight:700,color:'var(--dim2)'}}>{s.sym}</span><span style={{fontSize:11,color:'var(--dim)',marginLeft:8}}>{s.locked_note}</span></div>
            <span style={{fontSize:9,color:'var(--dim)',border:'1px solid var(--line2)',borderRadius:3,padding:'1px 5px'}}>🔒 예외</span>
          </div>
        );
        const bcol=sigCol(s.comp.signal);
        const guruDiff=s.guru_cost&&s.cur?(s.guru_cost-s.cur)/s.guru_cost*100:null;
        return (
          <div key={s.sym} onClick={()=>openStock(s.sym)} style={{padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)',borderLeft:`3px solid ${bcol}`,cursor:'pointer',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
              <div>
                <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:2}}>
                  <span className="mono" style={{fontWeight:700,fontSize:14,color:'var(--strong)'}}>{s.sym}</span>
                  <SigBadge s={s.comp.signal} sm/>
                  {s.type==='watch'&&<span style={{fontSize:8,color:'var(--dim)',border:'1px solid var(--line2)',borderRadius:2,padding:'1px 4px'}}>트래킹</span>}
                </div>
                <div style={{fontSize:10,color:'var(--dim2)'}}>{s.name} · {s.sector}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:15,fontWeight:700,color:'var(--strong)'}}>{s.cur?`$${fmt(s.cur)}`:loading?'⋯':'—'}</div>
                {s.chg!=null&&<div className={`mono ${clr(s.chg)}`} style={{fontSize:10,marginTop:1}}>{s.chg>0?'▲':'▼'}{Math.abs(s.chg).toFixed(2)}%</div>}
              </div>
            </div>
            <UpsideBar cur={s.cur} fair={s.fair_value} low={s.fair_low} high={s.fair_high}/>
            <div style={{display:'flex',gap:5,marginTop:'auto',paddingTop:5,flexWrap:'wrap'}}>
              {s.fair_value&&<Chip label="목표" val={`$${fmt(s.fair_value,0)}`} col="var(--gold)"/>}
              {s.trailingPE&&<Chip label="PE" val={`${fmt(s.trailingPE,1)}x`}/>}
              {s.piotroski!=null&&<Chip label="F" val={`${s.piotroski}/9`} col={s.piotroski>=7?'var(--green)':s.piotroski>=4?'var(--gold)':'var(--red)'}/>}
              {guruDiff!=null&&<Chip label="구루比" val={guruDiff>0?`저렴${guruDiff.toFixed(1)}%`:`비쌈${Math.abs(guruDiff).toFixed(1)}%`} col={guruDiff>0?'var(--green)':'var(--red)'}/>}
            </div>
          </div>
        );
      })}
      </CardGrid>
      {!showAll && sorted.length>12 && (
        <div onClick={()=>setShowAll(true)} style={{margin:'8px 12px',padding:'10px',textAlign:'center',fontSize:11,color:'var(--gold)',cursor:'pointer',background:'var(--bg2)',borderRadius:10,border:'1px solid var(--gold-bd)'}}>
          나머지 {sorted.length-12}개 더보기
        </div>
      )}
    </div>
  );
}
