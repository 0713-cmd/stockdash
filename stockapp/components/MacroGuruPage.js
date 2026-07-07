import { useState } from 'react';
import { MACRO_INIT, GURU_POSITIONS } from '../lib/data';
import { fmt, computeMacroValues, SectionTitle, MiniBar, CardGrid } from './shared';
import { MacroGrid } from './MacroBits';

function Segmented({ value, onChange, options }) {
  return (
    <div style={{display:'flex',gap:6,padding:'0 12px 10px'}}>
      {options.map(([k,l])=>(
        <div key={k} onClick={()=>onChange(k)} style={{flex:1,textAlign:'center',padding:'8px',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer',background:value===k?'var(--gold-bg)':'var(--bg2)',border:`1px solid ${value===k?'var(--gold-bd)':'var(--line2)'}`,color:value===k?'var(--gold)':'var(--dim2)'}}>{l}</div>
      ))}
    </div>
  );
}

function GuruCard({ g, prices }) {
  const postureCol = g.posture_score>=70?'var(--green)':g.posture_score>=45?'var(--gold)':'var(--red)';
  const ast = a => ({
    NEW:{bg:'var(--green-bg)',bd:'var(--green-bd)',col:'var(--green)',l:'신규'},
    ADD:{bg:'var(--blue-bg)',bd:'var(--blue-bd)',col:'var(--blue)',l:'추가'},
    HOLD:{bg:'var(--gold-bg)',bd:'var(--gold-bd)',col:'var(--gold)',l:'보유'},
    REDUCE:{bg:'var(--pur-bg)',bd:'var(--pur-bd)',col:'var(--pur)',l:'축소'},
    SOLD:{bg:'var(--red-bg)',bd:'var(--red-bd)',col:'var(--red)',l:'매도'},
  }[a]||{bg:'var(--bg3)',bd:'var(--line2)',col:'var(--dim2)',l:a});

  return (
    <div style={{background:'var(--bg2)',borderRadius:14,border:`1px solid ${g.tier===1?'var(--gold-bd)':'var(--line2)'}`,overflow:'hidden',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'12px 14px',borderBottom:'1px solid var(--line)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'var(--strong)'}}>{g.name}</div>
            <div style={{fontSize:10,color:'var(--dim2)',marginTop:1}}>{g.fund} · AUM ${g.aum_b}B · {g.updated}</div>
          </div>
          <span style={{fontSize:8,padding:'2px 8px',borderRadius:10,background:g.tier===1?'var(--gold-bg)':'var(--pur-bg)',border:`1px solid ${g.tier===1?'var(--gold-bd)':'var(--pur-bd)'}`,color:g.tier===1?'var(--gold)':'var(--pur)',fontWeight:700}}>T{g.tier}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <span style={{fontSize:10,color:'var(--dim)'}}>이번 분기 포지션 성향</span>
          <span style={{fontSize:11,fontWeight:700,color:postureCol}}>{g.posture}</span>
        </div>
        <MiniBar pct={g.posture_score} col={postureCol}/>
        <div style={{fontSize:10,color:'var(--dim2)',lineHeight:1.6,marginTop:8}}>{g.qoq_summary}</div>
      </div>
      {g.positions.map((pos,j)=>{
        const st=ast(pos.action);
        const cur=prices[pos.sym]?.price;
        const diff=cur&&pos.cost_est?(pos.cost_est-cur)/pos.cost_est*100:null;
        return (
          <div key={j} style={{padding:'10px 14px',borderBottom:j<g.positions.length-1?'1px solid var(--line)':'none'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <span className="mono" style={{fontWeight:700,fontSize:13,color:'var(--strong)'}}>{pos.sym}</span>
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
  );
}

export default function MacroGuruPage({ macro, prices, openMacro }) {
  const [seg, setSeg] = useState('macro');
  const m = {...MACRO_INIT, ...macro};
  const values = computeMacroValues(m);

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 8px',fontSize:20,fontWeight:700,color:'var(--strong)'}}>📡 매크로 · 구루</div>
      <Segmented value={seg} onChange={setSeg} options={[['macro','📡 매크로'],['guru','🧠 투자구루']]}/>

      {seg==='macro' && (
        <>
          <div style={{margin:'0 12px 10px',padding:'12px 14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--gold-bd)'}}>
            <div style={{fontSize:9,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>현재 시장 레짐</div>
            <div style={{fontSize:15,fontWeight:700,color:'var(--strong)',marginBottom:3}}>{m.regime}</div>
            <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.6}}>{m.regime_detail}<br/>권고: 주식 <b style={{color:'var(--gold)'}}>{m.stock_cash_ratio}%</b> / 현금 <b style={{color:'var(--gold)'}}>{100-m.stock_cash_ratio}%</b></div>
          </div>
          <SectionTitle>지표 한눈에 보기 (탭하면 해설·역사적 사례)</SectionTitle>
          <MacroGrid values={values} onOpen={openMacro}/>
          <div style={{margin:'10px 12px 0',fontSize:9,color:'var(--dim)',lineHeight:1.6}}>업데이트: {MACRO_INIT.updated} · 각 카드를 탭하면 지표 정의, 왜 중요한지, 현재 구간 판정, 역사적 사례를 확인할 수 있습니다.</div>
        </>
      )}

      {seg==='guru' && (
        <>
          <div style={{padding:'0 16px 8px',fontSize:11,color:'var(--dim)'}}>Q1 2026 13F 기준 · 분기 대비 매수/매도 규모로 공격성 판정</div>
          <CardGrid min={340} gap={10}>
            {GURU_POSITIONS.map(g=><GuruCard key={g.id} g={g} prices={prices}/>)}
          </CardGrid>
        </>
      )}
    </div>
  );
}
