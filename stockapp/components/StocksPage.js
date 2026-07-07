import { useState } from 'react';
import { calcComprehensiveScore } from '../lib/calculations';
import { fmt, pct, clr, sigCol, SigBadge, UpsideBar, CardGrid } from './shared';
import { gradeCol } from './ScoreBits';
import { buildStocks } from './stockUtils';

export default function StocksPage({ prices, loading, macro, openStock }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('score');
  const [showAll, setShowAll] = useState(false);
  const treasury = macro?.treasury_10y||4.42;
  const stocks = buildStocks(prices, treasury).map(s=>({ ...s, comprehensive: calcComprehensiveScore(s, prices[s.sym]) }));

  const buyCnt=stocks.filter(s=>s.comp.signal==='BUY'&&s.type!=='locked').length;
  const holdCnt=stocks.filter(s=>s.comp.signal==='HOLD'&&s.type!=='locked').length;
  const waitCnt=stocks.filter(s=>['WAIT','DANGER'].includes(s.comp.signal)).length;

  let shown = filter==='all' ? stocks
    : filter==='portfolio' ? stocks.filter(s=>s.type==='portfolio'||s.type==='locked')
    : filter==='watch' ? stocks.filter(s=>s.type==='watch')
    : stocks.filter(s=>s.comp.signal===filter.toUpperCase());

  const sorted = [...shown].sort((a,b)=>
    sort==='score' ? b.comprehensive.score-a.comprehensive.score
    : sort==='upside' ? ((b.up!=null&&b.up<=200?b.up:-999)-(a.up!=null&&a.up<=200?a.up:-999))
    : (b.chg??-999)-(a.chg??-999)
  );
  const visible = showAll ? sorted : sorted.slice(0,12);

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 6px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6}}>
        <span style={{fontSize:20,fontWeight:700,color:'var(--strong)'}}>📊 종목</span>
        <div style={{display:'flex',gap:5}}>
          {[['BUY',buyCnt,'var(--green)'],['HOLD',holdCnt,'var(--gold)'],['WAIT',waitCnt,'var(--red)']].map(([l,n,c])=>(
            <div key={l} style={{padding:'2px 8px',borderRadius:20,fontSize:9,fontWeight:700,color:c,background:'rgba(0,0,0,.15)',border:`1px solid ${c}40`}}>{l} {n}</div>
          ))}
        </div>
      </div>

      {/* 필터 + 정렬 */}
      <div style={{display:'flex',gap:6,padding:'0 12px 4px',overflowX:'auto',scrollbarWidth:'none',flexWrap:'wrap'}}>
        {[['all','전체'],['portfolio','보유'],['watch','트래킹'],['BUY','📗매수'],['HOLD','🟡보유'],['WAIT','🔴대기']].map(([k,l])=>(
          <div key={k} onClick={()=>{setFilter(k);setShowAll(false);}} style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0,background:filter===k?'var(--gold-bg)':'var(--bg2)',border:`1px solid ${filter===k?'var(--gold-bd)':'var(--line2)'}`,color:filter===k?'var(--gold)':'var(--dim2)'}}>{l}</div>
        ))}
        <div style={{width:1,background:'var(--line2)',margin:'2px 2px',flexShrink:0}}/>
        {[['score','종합점수순'],['upside','업사이드순'],['chg','등락순']].map(([k,l])=>(
          <div key={k} onClick={()=>setSort(k)} style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0,background:sort===k?'var(--blue-bg)':'var(--bg2)',border:`1px solid ${sort===k?'var(--blue-bd)':'var(--line2)'}`,color:sort===k?'var(--blue)':'var(--dim2)'}}>{l}</div>
        ))}
      </div>
      <div style={{padding:'2px 16px 8px',fontSize:10,color:'var(--dim)'}}>카드를 클릭하면 항목별 채점 근거·재무·구루 포지션 상세를 볼 수 있습니다</div>
      {loading&&<div style={{padding:'8px 16px',color:'var(--dim)',fontSize:11}}>⏳ 가격 로딩 중...</div>}

      <CardGrid min={270}>
      {visible.map(s=>{
        if (s.type==='locked') return (
          <div key={s.sym} onClick={()=>openStock(s.sym)} style={{padding:'12px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',opacity:.7}}>
            <div><span className="mono" style={{fontWeight:700,color:'var(--dim2)'}}>{s.sym}</span><span style={{fontSize:11,color:'var(--dim)',marginLeft:8}}>{s.locked_note}</span></div>
            <span style={{fontSize:9,color:'var(--dim)',border:'1px solid var(--line2)',borderRadius:3,padding:'1px 5px'}}>🔒 예외</span>
          </div>
        );
        const cGrade = s.comprehensive.grade;
        return (
          <div key={s.sym} onClick={()=>openStock(s.sym)} style={{padding:'12px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)',borderLeft:`3px solid ${sigCol(s.comp.signal)}`,cursor:'pointer',display:'flex',flexDirection:'column',gap:7}}>
            {/* 1행: 종목 + 가격 */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span className="mono" style={{fontWeight:700,fontSize:15,color:'var(--strong)'}}>{s.sym}</span>
                  <SigBadge s={s.comp.signal} sm/>
                </div>
                <div style={{fontSize:10,color:'var(--dim2)',marginTop:1}}>{s.name} · {s.sector}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:15,fontWeight:700,color:'var(--strong)'}}>{s.cur?`$${fmt(s.cur)}`:loading?'⋯':'—'}</div>
                {s.chg!=null&&<div className={`mono ${clr(s.chg)}`} style={{fontSize:10}}>{s.chg>0?'▲':'▼'}{Math.abs(s.chg).toFixed(2)}%</div>}
              </div>
            </div>
            {/* 2행: 핵심 2개 숫자 크게 */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div style={{background:'var(--bg3)',borderRadius:8,padding:'7px 10px',textAlign:'center'}}>
                <div style={{fontSize:8,color:'var(--dim)',marginBottom:2}}>종합점수</div>
                <span className="mono" style={{fontSize:17,fontWeight:700,color:gradeCol(cGrade)}}>{s.comprehensive.score}</span>
                <span style={{fontSize:10,fontWeight:700,color:gradeCol(cGrade),marginLeft:3}}>{cGrade}</span>
              </div>
              <div style={{background:'var(--bg3)',borderRadius:8,padding:'7px 10px',textAlign:'center'}}>
                <div style={{fontSize:8,color:'var(--dim)',marginBottom:2}}>목표가 대비 여력</div>
                {s.up!=null&&s.up<=200
                  ? <span className="mono" style={{fontSize:17,fontWeight:700,color:s.up>0?'var(--green)':'var(--red)'}}>{pct(s.up)}</span>
                  : <span style={{fontSize:11,color:'var(--dim)'}}>{s.up!=null?'검증필요':'—'}</span>}
              </div>
            </div>
            {/* 3행: 업사이드 바 */}
            <UpsideBar cur={s.cur} fair={s.fair_value} low={s.fair_low} high={s.fair_high}/>
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
