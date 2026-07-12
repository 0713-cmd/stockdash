import { useState } from 'react';
import { STOCK_UNIVERSE } from '../lib/data';
import { calcTenBaggerScore } from '../lib/calculations';
import { fmt, clr } from './shared';

// 텐베거 탭 — 테이블 + 행 클릭시 채점 근거 펼침
export default function TenBaggerPage({ prices, openStock }) {
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const list = Object.entries(STOCK_UNIVERSE)
    .filter(([,s])=>s.type!=='locked')
    .map(([sym,s])=>{
      const p = prices[sym];
      const cur = p?.price;
      const ten = calcTenBaggerScore(s);
      let up = cur && s.fair_value ? +((s.fair_value-cur)/cur*100).toFixed(1) : null;
      if (up != null && up > 200) up = null;
      const r40 = (s.rule_of_40||(s.gross_margin+s.rev_growth_yoy-100))|0;
      const r40Pts=r40>60?30:r40>40?22:r40>20?12:r40>0?5:0;
      const accelPts=(s.rev_growth_accel||0)>5?25:(s.rev_growth_accel||0)>2?18:(s.rev_growth_accel||0)>0?10:3;
      const tamPts=s.tam_penetration!==undefined?(s.tam_penetration<3?20:s.tam_penetration<8?14:7):8;
      const gmPts=(s.gm_trend||0)>3?15:(s.gm_trend||0)>1?10:(s.gm_trend||0)>0?5:0;
      const piotPts=s.piotroski>=8?10:s.piotroski>=6?6:s.piotroski>=4?3:0;
      return {sym,...s,cur,chg:p?.change,up,ten,r40,r40Pts,accelPts,tamPts,gmPts,piotPts};
    })
    .sort((a,b)=>b.ten-a.ten);

  const visible = showAll ? list : list.slice(0,15);
  const th = {fontSize:9,color:'var(--dim)',fontWeight:600,textAlign:'right',padding:'6px 6px',whiteSpace:'nowrap'};
  const td = {fontSize:11,textAlign:'right',padding:'8px 6px',whiteSpace:'nowrap'};
  const ptCol = (g,m) => g===m?'var(--green)':g>m*.6?'var(--gold)':'var(--dim2)';

  return (
    <div style={{paddingBottom:40}}>
      <div style={{padding:'14px 16px 4px',display:'flex',justifyContent:'space-between',alignItems:'baseline',flexWrap:'wrap',gap:6}}>
        <span style={{fontSize:18,fontWeight:800,color:'var(--strong)'}}>텐베거 랭킹</span>
        <span style={{fontSize:10,color:'var(--dim)'}}>밸류에이션 무관 — "지금 비싸도 5년 후 크기가 중요" · 행 클릭시 채점 근거</span>
      </div>
      <div style={{margin:'8px 12px 0',background:'var(--bg2)',border:'1px solid var(--line2)',borderRadius:10,overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:640}}>
          <thead>
            <tr style={{background:'var(--bg3)',borderBottom:'1px solid var(--line2)'}}>
              <th style={{...th,textAlign:'left',paddingLeft:12,width:150}}># 종목</th>
              <th style={th}>텐베거점수</th>
              <th style={th}>Rule of 40</th>
              <th style={th}>매출성장</th>
              <th style={th}>성장가속</th>
              <th style={th}>TAM침투</th>
              <th style={th}>현재가</th>
              <th style={{...th,paddingRight:12}}>예상수익</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s,i)=>{
              const col = s.ten>=70?'var(--green)':s.ten>=50?'var(--gold)':'var(--dim2)';
              const isOpen = open===s.sym;
              return [
                <tr key={s.sym} onClick={()=>setOpen(isOpen?null:s.sym)} style={{borderTop:i>0?'1px solid var(--line)':'none',cursor:'pointer',background:isOpen?'var(--bg3)':'transparent'}}>
                  <td style={{...td,textAlign:'left',paddingLeft:12}}>
                    <span style={{fontSize:9,color:'var(--dim)',marginRight:5}}>{i+1}</span>
                    <span className="mono" style={{fontWeight:700,color:'var(--strong)'}}>{s.sym}</span>
                    <span style={{fontSize:9,color:'var(--dim)',marginLeft:5}}>{s.name}</span>
                    <span style={{fontSize:8,color:'var(--dim)',marginLeft:4}}>{isOpen?'▲':'▼'}</span>
                  </td>
                  <td className="mono" style={{...td,fontWeight:700,color:col}}>{s.ten}점{s.ten>=70&&' ⭐'}</td>
                  <td className="mono" style={{...td,color:s.r40>40?'var(--green)':'var(--dim2)'}}>{s.r40}</td>
                  <td className="mono" style={{...td,color:s.rev_growth_yoy>30?'var(--green)':'var(--text)'}}>{s.rev_growth_yoy>0?'+':''}{s.rev_growth_yoy}%</td>
                  <td className="mono" style={{...td,color:'var(--text)'}}>{(s.rev_growth_accel||0)>0?'+':''}{(s.rev_growth_accel||0).toFixed(1)}p</td>
                  <td className="mono" style={{...td,color:'var(--text)'}}>{s.tam_penetration!=null?`${s.tam_penetration}%`:'—'}</td>
                  <td className="mono" style={{...td,color:'var(--strong)',fontWeight:600}}>{s.cur?`$${fmt(s.cur)}`:'—'}</td>
                  <td className="mono" style={{...td,fontWeight:700,paddingRight:12,color:s.up==null?'var(--dim)':s.up>0?'var(--green)':'var(--red)'}}>{s.up!=null?`${s.up>0?'+':''}${s.up}%`:'—'}</td>
                </tr>,
                isOpen && (
                  <tr key={s.sym+'_d'}>
                    <td colSpan={8} style={{padding:'8px 12px 10px 28px',background:'var(--bg3)',borderTop:'1px solid var(--line)'}}>
                      <div style={{fontSize:10,color:'var(--dim2)',lineHeight:2}}>
                        채점 근거: Rule of 40 <b className="mono" style={{color:ptCol(s.r40Pts,30)}}>{s.r40Pts}/30</b> (성장{(s.rev_growth_yoy||0).toFixed(0)}%+GM{(s.gross_margin||0).toFixed(0)}%)
                        {' · '}성장가속 <b className="mono" style={{color:ptCol(s.accelPts,25)}}>{s.accelPts}/25</b>
                        {' · '}TAM침투 <b className="mono" style={{color:ptCol(s.tamPts,20)}}>{s.tamPts}/20</b>
                        {' · '}GM추세 <b className="mono" style={{color:ptCol(s.gmPts,15)}}>{s.gmPts}/15</b>
                        {' · '}품질(F{s.piotroski??'?'}) <b className="mono" style={{color:ptCol(s.piotPts,10)}}>{s.piotPts}/10</b>
                        <span onClick={e=>{e.stopPropagation();openStock(s.sym);}} style={{marginLeft:12,color:'var(--blue)',cursor:'pointer',fontWeight:700}}>종목 상세 →</span>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      {list.length>15&&!showAll&&(
        <div onClick={()=>setShowAll(true)} style={{margin:'8px 12px',padding:'9px',textAlign:'center',fontSize:11,color:'var(--blue)',cursor:'pointer',background:'var(--bg2)',border:'1px solid var(--line2)',borderRadius:8}}>전체 {list.length}개 보기 ▼</div>
      )}
    </div>
  );
}
