import { useState } from 'react';
import { STOCK_UNIVERSE } from '../lib/data';
import { calcTenBaggerScore } from '../lib/calculations';
import { fmt, pct, ScoreRing, MiniBar } from './shared';

export default function TenBaggerPage({ prices, openStock }) {
  const [showAll, setShowAll] = useState(false);
  const list = Object.entries(STOCK_UNIVERSE)
    .filter(([,s])=>s.type!=='locked')
    .map(([sym,s])=>{
      const cur=prices[sym]?.price;
      const ten=calcTenBaggerScore(s);
      const up = cur && s.fair_value ? (s.fair_value-cur)/cur*100 : null;
      const r40=(s.rule_of_40||(s.gross_margin+s.rev_growth_yoy-100))|0;
      const r40Pts=r40>60?30:r40>40?22:r40>20?12:r40>0?5:0;
      const accelPts=(s.rev_growth_accel||0)>5?25:(s.rev_growth_accel||0)>2?18:(s.rev_growth_accel||0)>0?10:3;
      const tamPts=s.tam_penetration!==undefined?(s.tam_penetration<3?20:s.tam_penetration<8?14:7):8;
      const gmPts=(s.gm_trend||0)>3?15:(s.gm_trend||0)>1?10:(s.gm_trend||0)>0?5:0;
      const piotPts=s.piotroski>=8?10:s.piotroski>=6?6:s.piotroski>=4?3:0;
      return {sym,...s,cur,up,ten,r40,r40Pts,accelPts,tamPts,gmPts,piotPts};
    })
    .sort((a,b)=>b.ten-a.ten);

  const visible = showAll ? list : list.slice(0,10);

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 4px',fontSize:20,fontWeight:700,color:'var(--strong)'}}>🚀 텐베거 TOP{Math.min(10,list.length)}</div>
      <div style={{padding:'0 16px 10px',fontSize:11,color:'var(--dim)'}}>5년 내 10배 가능성 · Rule of 40 / 성장가속 / TAM / GM트렌드 / 품질 합산 · 탭하면 재무 상세</div>
      {visible.map((s,idx)=>{
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
            <div onClick={()=>openStock(s.sym)} style={{padding:'12px 14px',display:'flex',gap:12,alignItems:'center',borderBottom:'1px solid var(--line)',cursor:'pointer'}}>
              <ScoreRing score={s.ten} size={48}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:3}}>
                  <span className="mono" style={{fontSize:14,fontWeight:700,color:'var(--strong)'}}>{s.sym}</span>
                  {s.ten>=70&&<span style={{fontSize:8,padding:'1px 6px',borderRadius:10,background:'var(--pur-bg)',border:'1px solid var(--pur-bd)',color:'var(--pur)'}}>텐베거 후보</span>}
                </div>
                <div style={{fontSize:11,color:'var(--dim2)'}}>{s.name} · R40:{s.r40} · 성장+{s.rev_growth_yoy}%</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:12,fontWeight:700,color:'var(--strong)'}}>{s.cur?`$${fmt(s.cur)}`:'—'}</div>
                {s.up!=null&&<div style={{fontSize:10,color:s.up>0?'var(--green)':'var(--red)',fontWeight:600}}>{pct(s.up)}</div>}
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
                <span style={{fontSize:11,fontWeight:700,color:'var(--strong)'}}>합계</span>
                <span className="mono" style={{fontSize:11,fontWeight:700,color:col}}>{s.ten}/100</span>
              </div>
            </div>
          </div>
        );
      })}
      {!showAll && list.length>10 && (
        <div onClick={()=>setShowAll(true)} style={{margin:'4px 12px 8px',padding:'10px',textAlign:'center',fontSize:11,color:'var(--gold)',cursor:'pointer',background:'var(--bg2)',borderRadius:10,border:'1px solid var(--gold-bd)'}}>
          나머지 {list.length-10}개 더보기
        </div>
      )}
    </div>
  );
}
