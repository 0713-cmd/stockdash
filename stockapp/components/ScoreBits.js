import { useState } from 'react';
import { COMPREHENSIVE_CATEGORIES } from '../lib/calculations';
import { MiniBar } from './shared';

export const gradeCol = g => g?.startsWith('A') ? 'var(--green)' : g?.startsWith('B') ? 'var(--gold)' : 'var(--red)';
const CAT_LABEL = Object.fromEntries(COMPREHENSIVE_CATEGORIES.map(c => [c.key, c.label]));

// ── 종합점수 산정 방식 설명 (접이식) ──
export function ScoreExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{margin:'0 12px 8px',background:'var(--bg2)',border:'1px solid var(--gold-bd)',borderRadius:12,overflow:'hidden'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:'10px 14px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:12,fontWeight:700,color:'var(--gold)'}}>❓ 종합점수는 어떻게 계산되나요?</span>
        <span style={{fontSize:11,color:'var(--dim)'}}>{open?'접기 ▲':'펼치기 ▼'}</span>
      </div>
      {open&&(
        <div style={{padding:'0 14px 14px',fontSize:11,color:'var(--text)',lineHeight:1.8}}>
          <div style={{marginBottom:10,color:'var(--dim2)'}}>
            인베스팅닷컴 "건전성 점수"와 같은 철학으로, Yahoo Finance 실시간 지표(PER·PEG·애널리스트 목표가·이평선)와
            분기 재무데이터(성장률·마진·ROIC·재무건전성)를 <b style={{color:'var(--gold)'}}>5개 영역 100점 만점</b>으로 채점합니다.
          </div>
          {COMPREHENSIVE_CATEGORIES.map(c=>(
            <div key={c.key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--line)'}}>
              <div>
                <span style={{fontWeight:700}}>{c.label}</span>
                <span style={{fontSize:10,color:'var(--dim2)',marginLeft:8}}>{c.desc}</span>
              </div>
              <span className="mono" style={{fontWeight:700,color:'var(--gold)'}}>{c.max}점</span>
            </div>
          ))}
          <div style={{marginTop:10,padding:'8px 10px',background:'var(--bg3)',borderRadius:8,fontSize:10,color:'var(--dim2)',lineHeight:1.7}}>
            · 등급: 80↑ A+ · 70↑ A · 60↑ B+ · 50↑ B · 40↑ C · 미만 D<br/>
            · 데이터가 없는 항목은 <b>채점에서 제외</b>하고, 채점 가능했던 배점 대비 백분율로 환산합니다 (없는 데이터를 지어내지 않음)<br/>
            · 종목을 클릭하면 <b>항목별 현재값 · 기준 · 획득점수</b>를 전부 확인할 수 있습니다
          </div>
        </div>
      )}
    </div>
  );
}

// ── 종목별 점수 브레이크다운 (상세 페이지용) ──
export function ScoreBreakdown({ comp }) {
  if (!comp?.items) return null;
  const col = gradeCol(comp.grade);
  return (
    <div style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:14,border:`1px solid ${col}40`,overflow:'hidden'}}>
      {/* 헤더: 총점 + 영역별 바 */}
      <div style={{padding:'14px',borderBottom:'1px solid var(--line)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{fontSize:12,fontWeight:700,color:'var(--strong)'}}>종합점수 산정 근거</span>
          <span className="mono" style={{fontSize:20,fontWeight:700,color:col}}>{comp.score}<span style={{fontSize:12,marginLeft:3}}>{comp.grade}</span></span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
          {COMPREHENSIVE_CATEGORIES.map(c=>{
            const got = comp.breakdown[c.key] ?? 0;
            // 이 영역에서 실제 채점된 배점
            const scoredMax = comp.items.filter(i=>i.cat===c.key&&i.max!=null).reduce((a,i)=>a+i.max,0);
            const p = scoredMax>0 ? got/scoredMax*100 : 0;
            const c2 = p>=70?'var(--green)':p>=40?'var(--gold)':'var(--red)';
            return (
              <div key={c.key}>
                <div style={{fontSize:9,color:'var(--dim)',marginBottom:3,textAlign:'center'}}>{c.label}</div>
                <MiniBar pct={p} col={scoredMax>0?c2:'var(--bg4)'}/>
                <div className="mono" style={{fontSize:10,fontWeight:700,color:scoredMax>0?c2:'var(--dim)',textAlign:'center',marginTop:3}}>
                  {scoredMax>0?`${got}/${scoredMax}`:'—'}
                </div>
              </div>
            );
          })}
        </div>
        {comp.lowConfidence&&<div style={{marginTop:8,fontSize:9,color:'var(--gold)'}}>⚠️ 채점 가능한 데이터가 적어({comp.coverage}/100 배점) 신뢰도가 낮습니다</div>}
      </div>
      {/* 항목별 테이블: 지표 | 현재값 | 기준 | 점수 */}
      <div style={{padding:'6px 14px 10px'}}>
        {comp.items.map((it,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:i<comp.items.length-1?'1px solid var(--line)':'none',opacity:it.pts==null?.45:1}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:'var(--text)'}}><span style={{fontSize:8,color:'var(--dim)',marginRight:5}}>{CAT_LABEL[it.cat]}</span>{it.label}</div>
              <div style={{fontSize:9,color:'var(--dim)',marginTop:1}}>기준: {it.std}</div>
            </div>
            <span className="mono" style={{fontSize:11,fontWeight:700,color:it.pts==null?'var(--dim)':'var(--text)',flexShrink:0}}>{it.cur}</span>
            <span className="mono" style={{fontSize:11,fontWeight:700,minWidth:40,textAlign:'right',flexShrink:0,
              color:it.pts==null?'var(--dim)':it.pts===it.max?'var(--green)':it.pts>0?'var(--gold)':'var(--red)'}}>
              {it.pts==null?'제외':`${it.pts}/${it.max}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
