import { useState, useEffect } from 'react';
import { STOCK_UNIVERSE } from '../lib/data';
import { fmt, clr } from './shared';
import { gradeCol } from './ScoreBits';
import { signalShort } from './concepts';
import { getScreen } from './screenCache';

const upCol = u => u == null ? 'var(--dim)' : u > 0 ? 'var(--green)' : 'var(--red)';
const upTxt = u => u == null ? '—' : `${u > 0 ? '+' : ''}${u.toFixed(1)}%`;

// 종목 탭 = 163종목 전체 스크리너
export default function StocksPage({ openStock }) {
  const [screen, setScreen] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState('all');   // all | curated | buy | port
  const [minScore, setMinScore] = useState('');
  const [minUp, setMinUp] = useState('');
  const [sector, setSector] = useState('all');
  const [sort, setSort] = useState('score');     // score | upside | change | ten
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    getScreen().then(d => { if (alive) { if (d.error) setErr(d.error); setScreen(d); } })
      .catch(e => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, []);

  const all = screen?.all || null;
  const portSyms = new Set(Object.entries(STOCK_UNIVERSE).filter(([,s])=>s.type==='portfolio'||s.type==='locked').map(([k])=>k));
  const sectors = all ? [...new Set(all.map(s=>s.sector).filter(Boolean))].sort() : [];

  let rows = all;
  if (rows) {
    if (filter==='curated') rows = rows.filter(s=>!s.lite);
    if (filter==='buy') rows = rows.filter(s=>s.signal==='BUY');
    if (filter==='port') rows = rows.filter(s=>portSyms.has(s.symbol));
    if (sector!=='all') rows = rows.filter(s=>s.sector===sector);
    if (minScore!=='') rows = rows.filter(s=>s.score>=+minScore);
    if (minUp!=='') rows = rows.filter(s=>s.upside!=null&&s.upside>=+minUp);
    rows = [...rows].sort((a,b)=>
      sort==='upside' ? ((b.upside??-999)-(a.upside??-999))
      : sort==='change' ? ((b.change??-999)-(a.change??-999))
      : sort==='ten' ? ((b.ten??-1)-(a.ten??-1))
      : b.score-a.score);
  }
  const visible = rows ? (showAll ? rows : rows.slice(0,25)) : null;

  const chip = (active) => ({padding:'4px 11px',borderRadius:14,fontSize:11,fontWeight:active?700:400,cursor:'pointer',whiteSpace:'nowrap',background:active?'var(--blue-bg)':'var(--bg2)',border:`1px solid ${active?'var(--blue-bd)':'var(--line2)'}`,color:active?'var(--blue)':'var(--dim2)'});
  const numIn = {width:52,background:'var(--bg2)',border:'1px solid var(--line2)',borderRadius:6,padding:'3px 7px',fontSize:11,color:'var(--text)',outline:'none'};
  const th = {fontSize:9,color:'var(--dim)',fontWeight:600,textAlign:'right',padding:'6px 6px',whiteSpace:'nowrap'};
  const td = {fontSize:11,textAlign:'right',padding:'7px 6px',whiteSpace:'nowrap'};

  return (
    <div style={{paddingBottom:40}}>
      <div style={{padding:'14px 16px 4px',display:'flex',justifyContent:'space-between',alignItems:'baseline',flexWrap:'wrap',gap:6}}>
        <span style={{fontSize:18,fontWeight:800,color:'var(--strong)'}}>종목 스크리너</span>
        <span style={{fontSize:10,color:'var(--dim)'}}>{rows?`조건 충족 ${rows.length}개 / 전체 ${all.length}개`:'로딩 중'} · 클릭하면 채점 근거 상세</span>
      </div>

      {/* 필터 바 */}
      <div style={{display:'flex',gap:6,padding:'6px 12px 8px',flexWrap:'wrap',alignItems:'center'}}>
        <span onClick={()=>setFilter('all')} style={chip(filter==='all')}>전체</span>
        <span onClick={()=>setFilter('curated')} style={chip(filter==='curated')}>정밀 39</span>
        <span onClick={()=>setFilter('buy')} style={chip(filter==='buy')}>매수신호</span>
        <span onClick={()=>setFilter('port')} style={chip(filter==='port')}>보유</span>
        <span style={{width:1,alignSelf:'stretch',background:'var(--line2)',margin:'0 2px'}}/>
        <label style={{fontSize:10,color:'var(--dim2)',display:'flex',alignItems:'center',gap:4}}>점수≥<input style={numIn} type="number" placeholder="70" value={minScore} onChange={e=>setMinScore(e.target.value)}/></label>
        <label style={{fontSize:10,color:'var(--dim2)',display:'flex',alignItems:'center',gap:4}}>예상수익≥<input style={numIn} type="number" placeholder="15" value={minUp} onChange={e=>setMinUp(e.target.value)}/>%</label>
        <select value={sector} onChange={e=>setSector(e.target.value)} style={{background:'var(--bg2)',border:'1px solid var(--line2)',borderRadius:6,padding:'3px 7px',fontSize:11,color:'var(--text)',outline:'none'}}>
          <option value="all">전체 섹터</option>
          {sectors.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{width:1,alignSelf:'stretch',background:'var(--line2)',margin:'0 2px'}}/>
        {[['score','점수순'],['upside','예상수익순'],['change','등락순'],['ten','텐베거순']].map(([k,l])=>(
          <span key={k} onClick={()=>setSort(k)} style={chip(sort===k)}>{l}</span>
        ))}
      </div>

      {err&&<div style={{margin:'0 12px',padding:'12px',background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:8,fontSize:11,color:'var(--red)'}}>로딩 실패: {err}</div>}
      {!visible&&!err&&<div style={{padding:'24px',textAlign:'center',fontSize:12,color:'var(--dim)'}}>⏳ 163종목 스크리닝 로딩 중...</div>}

      {visible&&(
        <div style={{margin:'0 12px',background:'var(--bg2)',border:'1px solid var(--line2)',borderRadius:10,overflow:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:680}}>
            <thead>
              <tr style={{background:'var(--bg3)',borderBottom:'1px solid var(--line2)'}}>
                <th style={{...th,textAlign:'left',paddingLeft:12,width:150}}>종목</th>
                <th style={th}>현재가</th>
                <th style={th}>등락</th>
                <th style={th}>목표가</th>
                <th style={th}>예상수익</th>
                <th style={th}>PER</th>
                <th style={th}>텐베거</th>
                <th style={th}>점수</th>
                <th style={{...th,textAlign:'center',paddingRight:12}}>신호</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s,i)=>{
                const [sigT,sigC] = signalShort(s.signal, s.lite, s.score, s.upside);
                return (
                  <tr key={s.symbol} onClick={()=>openStock(s.symbol)} style={{borderBottom:i<visible.length-1?'1px solid var(--line)':'none',cursor:'pointer'}}>
                    <td style={{...td,textAlign:'left',paddingLeft:12}}>
                      <span className="mono" style={{fontWeight:700,color:'var(--strong)'}}>{s.symbol}</span>
                      <span style={{fontSize:9,color:'var(--dim)',marginLeft:5}}>{(s.name||'').slice(0,14)}</span>
                      {s.cycleWarning&&<span title="사이클 정점 주의" style={{fontSize:9,marginLeft:3}}>⚠️</span>}
                    </td>
                    <td className="mono" style={{...td,color:'var(--strong)',fontWeight:600}}>${fmt(s.price)}</td>
                    <td className={`mono ${clr(s.change)}`} style={td}>{s.change!=null?`${s.change>0?'+':''}${s.change.toFixed(2)}%`:'—'}</td>
                    <td className="mono" style={{...td,color:'var(--text)'}}>{s.target?`$${fmt(s.target,0)}`:'—'}</td>
                    <td className="mono" style={{...td,fontWeight:700,color:upCol(s.upside)}}>{upTxt(s.upside)}</td>
                    <td className="mono" style={{...td,color:'var(--dim2)'}}>{s.pe!=null?`${s.pe.toFixed(1)}x`:'—'}</td>
                    <td className="mono" style={{...td,color:s.ten>=70?'var(--green)':s.ten>=50?'var(--gold)':'var(--dim2)'}}>{s.ten??'—'}</td>
                    <td className="mono" style={{...td,fontWeight:700,color:gradeCol(s.grade)}}>{s.score} {s.grade}</td>
                    <td style={{...td,textAlign:'center',paddingRight:12}}><span style={{fontSize:10,fontWeight:700,color:sigC}}>{sigT}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows&&rows.length>25&&!showAll&&(
        <div onClick={()=>setShowAll(true)} style={{margin:'8px 12px',padding:'9px',textAlign:'center',fontSize:11,color:'var(--blue)',cursor:'pointer',background:'var(--bg2)',border:'1px solid var(--line2)',borderRadius:8}}>전체 {rows.length}개 보기 ▼</div>
      )}
    </div>
  );
}
