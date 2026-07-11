import { useState } from 'react';
import { fmt, clr } from './shared';
import { gradeCol } from './ScoreBits';
import { verdictChip, signalShort } from './concepts';
import { useHomeData, RANK_BASES, rowsForBase } from './useHomeData';

const upCol = u => u == null ? 'var(--dim)' : u > 0 ? 'var(--green)' : 'var(--red)';
const upTxt = u => u == null ? '—' : `${u > 0 ? '+' : ''}${u.toFixed(1)}%`;

function MacroStrip({ m, macroDots, redCnt, goTab, openMacro }) {
  return (
    <div onClick={()=>goTab('macroguru')} style={{margin:'10px 12px',padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line2)',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:700,color:'var(--strong)'}}>시장 {redCnt>=4?'🔴 위험':redCnt>=2?'🟡 주의':'🟢 양호'}</span>
        <span style={{fontSize:10,color:'var(--dim2)'}}>{m.regime} · 주식 {m.stock_cash_ratio}% 권고</span>
        <div style={{display:'flex',gap:8}}>
          {macroDots.map(d=>(
            <div key={d.key} onClick={e=>{e.stopPropagation();openMacro(d.key);}} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
              <div style={{width:9,height:9,borderRadius:'50%',background:d.col}}/>
              <span style={{fontSize:7,color:'var(--dim)'}}>{d.short}</span>
            </div>
          ))}
        </div>
      </div>
      <span style={{fontSize:10,color:'var(--blue)'}}>자세히 →</span>
    </div>
  );
}

function BaseTabs({ base, setBase, style }) {
  return (
    <div style={{display:'flex',gap:6,flexWrap:'wrap',...style}}>
      {RANK_BASES.map(b=>(
        <div key={b.key} onClick={()=>setBase(b.key)} style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:base===b.key?700:500,cursor:'pointer',background:base===b.key?'var(--blue-bg)':'var(--bg2)',border:`1px solid ${base===b.key?'var(--blue-bd)':'var(--line2)'}`,color:base===b.key?'var(--blue)':'var(--dim2)'}}>{b.label}</div>
      ))}
    </div>
  );
}

function rightMetric(base, s) {
  if (base === 'ten') return { label:'텐베거', node:<span className="mono" style={{fontSize:13,fontWeight:700,color:s.tenBagger>=70?'var(--green)':s.tenBagger>=50?'var(--gold)':'var(--dim2)'}}>{s.tenBagger}점</span> };
  const c = s.comprehensive;
  return { label:'종합점수', node:<span className="mono" style={{fontSize:13,fontWeight:700,color:gradeCol(c.grade)}}>{c.score} {c.grade}</span> };
}

function Loading({ err }) {
  if (err) return <div style={{margin:'0 12px',padding:'14px',background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:10,fontSize:12,color:'var(--red)'}}>스크리닝 실패: {err} — 새로고침 해주세요</div>;
  return <div style={{margin:'0 12px',padding:'20px',textAlign:'center',fontSize:12,color:'var(--dim)'}}>⏳ 스크리닝 데이터 불러오는 중...</div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 시안 A — 클린 테이블 (인베스팅닷컴풍)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function HomeA({ prices, macro, openStock, openMacro, goTab }) {
  const { m, screen, screenErr, myStocks, macroDots, redCnt } = useHomeData({ prices, macro });
  const [base, setBase] = useState('comp');
  const [expand, setExpand] = useState(false);
  const rows = rowsForBase(base, screen, myStocks);
  const visible = rows ? (expand ? rows : rows.slice(0, 15)) : null;
  const baseInfo = RANK_BASES.find(b=>b.key===base);

  const th = {fontSize:10,color:'var(--dim)',fontWeight:600,textAlign:'right',padding:'8px 8px',whiteSpace:'nowrap'};
  const td = {fontSize:12,textAlign:'right',padding:'9px 8px',whiteSpace:'nowrap'};

  return (
    <div style={{paddingBottom:80}}>
      <MacroStrip m={m} macroDots={macroDots} redCnt={redCnt} goTab={goTab} openMacro={openMacro}/>
      <div style={{margin:'0 12px 8px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <BaseTabs base={base} setBase={setBase}/>
        <span style={{fontSize:10,color:'var(--dim)'}}>{baseInfo.label} 기준 정렬 · {baseInfo.sub}</span>
      </div>
      {!visible && <Loading err={screenErr}/>}
      {visible && (
        <div style={{margin:'0 12px',background:'var(--bg2)',border:'1px solid var(--line2)',borderRadius:10,overflow:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:640}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--line2)',background:'var(--bg3)'}}>
                <th style={{...th,textAlign:'left',paddingLeft:14,width:36}}>#</th>
                <th style={{...th,textAlign:'left'}}>종목</th>
                <th style={th}>현재가</th>
                <th style={th}>등락</th>
                <th style={th}>목표가</th>
                <th style={th}>예상수익</th>
                <th style={th}>{base==='ten'?'텐베거':'점수'}</th>
                <th style={{...th,textAlign:'center',paddingRight:14}}>신호</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s,i)=>{
                const [sigT, sigC] = signalShort(s.marsV?.signal, s.lite, s.comprehensive?.score, s.upside);
                const rm = rightMetric(base, s);
                return (
                  <tr key={s.symbol} onClick={()=>openStock(s.symbol)} style={{borderBottom:i<visible.length-1?'1px solid var(--line)':'none',cursor:'pointer'}}>
                    <td style={{...td,textAlign:'left',paddingLeft:14,color:'var(--dim)'}}>{i+1}</td>
                    <td style={{...td,textAlign:'left'}}>
                      <span className="mono" style={{fontWeight:700,color:'var(--strong)'}}>{s.symbol}</span>
                      <span style={{fontSize:10,color:'var(--dim)',marginLeft:6}}>{s.name}</span>
                      {s.locked&&<span style={{fontSize:9,marginLeft:4}}>🔒</span>}
                    </td>
                    <td className="mono" style={{...td,color:'var(--strong)',fontWeight:600}}>${fmt(s.price)}</td>
                    <td className={`mono ${clr(s.change)}`} style={td}>{s.change!=null?`${s.change>0?'+':''}${s.change.toFixed(2)}%`:'—'}</td>
                    <td className="mono" style={{...td,color:'var(--text)'}}>{s.target?`$${fmt(s.target,0)}`:'—'}{s.targetSrc&&<span style={{fontSize:8,color:'var(--dim)',marginLeft:3}}>{s.targetSrc}</span>}</td>
                    <td className="mono" style={{...td,fontWeight:700,color:upCol(s.upside)}}>{upTxt(s.upside)}</td>
                    <td style={td}>{rm.node}</td>
                    <td style={{...td,textAlign:'center',paddingRight:14}}><span style={{fontSize:11,fontWeight:700,color:sigC}}>{sigT}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows&&rows.length>15&&!expand&&(
        <div onClick={()=>setExpand(true)} style={{margin:'8px 12px',padding:'9px',textAlign:'center',fontSize:11,color:'var(--blue)',cursor:'pointer',background:'var(--bg2)',border:'1px solid var(--line2)',borderRadius:8}}>전체 {rows.length}개 보기 ▼</div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 시안 B — 소프트 카드 (토스풍)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function HomeB({ prices, macro, openStock, openMacro, goTab }) {
  const { m, screen, screenErr, myStocks, macroDots, redCnt } = useHomeData({ prices, macro });
  const [base, setBase] = useState('comp');
  const [expand, setExpand] = useState(false);
  const rows = rowsForBase(base, screen, myStocks);
  const visible = rows ? (expand ? rows : rows.slice(0, 12)) : null;

  return (
    <div style={{paddingBottom:90}}>
      <MacroStrip m={m} macroDots={macroDots} redCnt={redCnt} goTab={goTab} openMacro={openMacro}/>
      <div style={{padding:'2px 16px 4px',fontSize:17,fontWeight:700,color:'var(--strong)'}}>
        {base==='my'?'내 종목 현황':base==='ten'?'10배 노려볼 종목':base==='mars'?'전략 신호 좋은 종목':'오늘 사볼만한 종목'}
      </div>
      <div style={{padding:'0 16px 10px',fontSize:11,color:'var(--dim)'}}>{RANK_BASES.find(b=>b.key===base).sub} · 카드를 누르면 근거를 볼 수 있어요</div>
      <BaseTabs base={base} setBase={setBase} style={{margin:'0 12px 12px'}}/>
      {!visible && <Loading err={screenErr}/>}
      {visible && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(215px,1fr))',gap:10,margin:'0 12px'}}>
          {visible.map((s)=>{
            const chip = verdictChip(s.marsV?.signal, s.lite, s.comprehensive?.score, s.upside);
            return (
              <div key={s.symbol} onClick={()=>openStock(s.symbol)} style={{background:'var(--bg2)',borderRadius:16,padding:'15px 16px',cursor:'pointer',border:'1px solid var(--line)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
                  <span className="mono" style={{fontSize:15,fontWeight:700,color:'var(--strong)'}}>{s.symbol}{s.locked&&' 🔒'}</span>
                  <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:700,background:chip.bg,border:`1px solid ${chip.bd}`,color:chip.col}}>{chip.t}</span>
                </div>
                <div className="mono" style={{fontSize:26,fontWeight:700,color:upCol(s.upside),lineHeight:1,marginBottom:3}}>{upTxt(s.upside)}</div>
                <div style={{fontSize:11,color:'var(--dim)'}}>예상 수익{s.target?` · 목표 $${fmt(s.target,0)}`:''}{s.targetSrc?` (${s.targetSrc})`:''}</div>
                <div style={{marginTop:10,paddingTop:9,borderTop:'1px solid var(--line)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:11,color:'var(--dim2)'}}>현재 <b className="mono" style={{color:'var(--text)'}}>${fmt(s.price)}</b>
                    {s.change!=null&&<span className={`mono ${clr(s.change)}`} style={{fontSize:10,marginLeft:4}}>{s.change>0?'+':''}{s.change.toFixed(2)}%</span>}
                  </span>
                  <span className="mono" style={{fontSize:11,fontWeight:700,color:gradeCol(s.comprehensive?.grade)}}>{s.comprehensive?.score}점 {s.comprehensive?.grade}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {rows&&rows.length>12&&!expand&&(
        <div onClick={()=>setExpand(true)} style={{margin:'10px 12px',padding:'11px',textAlign:'center',fontSize:12,fontWeight:600,color:'var(--blue)',cursor:'pointer',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)'}}>더 보기 ({rows.length-12}개)</div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 시안 C — 뉴트럴 대시보드 (구글파이낸스풍)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function HomeC({ prices, macro, openStock, openMacro, goTab }) {
  const { m, screen, screenErr, myStocks, macroDots, redCnt } = useHomeData({ prices, macro });
  const [base, setBase] = useState('comp');
  const [expand, setExpand] = useState(false);
  const rows = rowsForBase(base, screen, myStocks);
  const visible = rows ? (expand ? rows : rows.slice(0, 20)) : null;

  return (
    <div style={{display:'flex',gap:0,paddingBottom:80}} className="homeC-wrap">
      <style>{`@media(max-width:760px){.homeC-side{display:none!important}}`}</style>
      {/* 좌측 요약 레일 */}
      <div className="homeC-side" style={{width:210,flexShrink:0,borderRight:'1px solid var(--line2)',padding:'14px 14px 0',minHeight:400}}>
        <div style={{fontSize:11,fontWeight:700,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>랭킹 기준</div>
        {RANK_BASES.map(b=>(
          <div key={b.key} onClick={()=>setBase(b.key)} style={{padding:'8px 10px',borderRadius:8,fontSize:12,fontWeight:base===b.key?700:400,cursor:'pointer',marginBottom:2,background:base===b.key?'var(--blue-bg)':'transparent',color:base===b.key?'var(--blue)':'var(--dim2)'}}>{b.label}</div>
        ))}
        <div onClick={()=>goTab('macroguru')} style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--line)',cursor:'pointer'}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>시장 신호등</div>
          <div style={{fontSize:13,fontWeight:700,color:'var(--strong)',marginBottom:6}}>{redCnt>=4?'🔴 위험':redCnt>=2?'🟡 주의':'🟢 양호'} <span style={{fontSize:10,color:'var(--dim)',fontWeight:400}}>적신호 {redCnt}/7</span></div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {macroDots.map(d=>(
              <div key={d.key} onClick={e=>{e.stopPropagation();openMacro(d.key);}} title={d.short} style={{width:9,height:9,borderRadius:'50%',background:d.col,cursor:'pointer'}}/>
            ))}
          </div>
          <div style={{fontSize:10,color:'var(--dim2)',marginTop:8,lineHeight:1.5}}>{m.regime}<br/>주식 {m.stock_cash_ratio}% 권고</div>
        </div>
      </div>
      {/* 우측 리스트 */}
      <div style={{flex:1,minWidth:0,padding:'14px 16px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
          <span style={{fontSize:16,fontWeight:700,color:'var(--strong)'}}>{RANK_BASES.find(b=>b.key===base).label} 랭킹</span>
          <span style={{fontSize:10,color:'var(--dim)'}}>{RANK_BASES.find(b=>b.key===base).sub}</span>
        </div>
        <div className="homeC-mobiletabs" style={{margin:'8px 0'}}>
          <style>{`@media(min-width:761px){.homeC-mobiletabs{display:none}}`}</style>
          <BaseTabs base={base} setBase={setBase}/>
        </div>
        {!visible && <Loading err={screenErr}/>}
        {visible && visible.map((s,i)=>{
          const [sigT, sigC] = signalShort(s.marsV?.signal, s.lite, s.comprehensive?.score, s.upside);
          const rm = rightMetric(base, s);
          return (
            <div key={s.symbol} onClick={()=>openStock(s.symbol)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 4px',borderBottom:'1px solid var(--line)',cursor:'pointer',gap:10}}>
              <div style={{minWidth:0,flex:1}}>
                <div style={{display:'flex',gap:6,alignItems:'baseline'}}>
                  <span style={{fontSize:11,color:'var(--dim)',width:20}}>{i+1}</span>
                  <span className="mono" style={{fontSize:13,fontWeight:700,color:'var(--strong)'}}>{s.symbol}{s.locked&&' 🔒'}</span>
                  <span style={{fontSize:10,color:'var(--dim)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name}</span>
                </div>
                <div style={{fontSize:10,color:'var(--dim2)',marginLeft:26}}>
                  ${fmt(s.price)}{s.change!=null&&<span className={clr(s.change)}> {s.change>0?'+':''}{s.change.toFixed(2)}%</span>}
                  {s.target&&<> → 목표 ${fmt(s.target,0)} <span style={{color:'var(--dim)'}}>({s.targetSrc})</span></>}
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div className="mono" style={{fontSize:14,fontWeight:700,color:upCol(s.upside)}}>{upTxt(s.upside)}</div>
                <div style={{fontSize:10}}>{rm.node} <span style={{fontWeight:700,color:sigC}}>· {sigT}</span></div>
              </div>
            </div>
          );
        })}
        {rows&&rows.length>20&&!expand&&(
          <div onClick={()=>setExpand(true)} style={{padding:'10px',textAlign:'center',fontSize:11,color:'var(--blue)',cursor:'pointer'}}>전체 {rows.length}개 보기 ▼</div>
        )}
      </div>
    </div>
  );
}
