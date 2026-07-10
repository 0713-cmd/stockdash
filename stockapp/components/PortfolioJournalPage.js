import { useState } from 'react';
import { STOCK_UNIVERSE } from '../lib/data';
import { calcCompositeSignal, calcPortfolioStats } from '../lib/calculations';
import { fmt, fmtK, sigCol, sigIcon, SectionTitle, CardGrid } from './shared';

const inp = {width:'100%',background:'var(--bg3)',border:'1px solid var(--line2)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontSize:13,fontFamily:'inherit',outline:'none'};

function Segmented({ value, onChange, options }) {
  return (
    <div style={{display:'flex',gap:6,padding:'0 12px 10px'}}>
      {options.map(([k,l])=>(
        <div key={k} onClick={()=>onChange(k)} style={{flex:1,textAlign:'center',padding:'8px',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer',background:value===k?'var(--gold-bg)':'var(--bg2)',border:`1px solid ${value===k?'var(--gold-bd)':'var(--line2)'}`,color:value===k?'var(--gold)':'var(--dim2)'}}>{l}</div>
      ))}
    </div>
  );
}

function TradesTab({ prices, trades, setTrades }) {
  const [form, setForm] = useState({sym:'',action:'매수',price:'',qty:'',note:''});
  const stats = calcPortfolioStats(trades, prices);
  const add = () => {
    if (!form.sym.trim()||!form.price||!form.qty) return;
    const t = {...form, sym:form.sym.toUpperCase().trim(), price:parseFloat(form.price), qty:parseFloat(form.qty), date:new Date().toLocaleDateString('ko-KR'), id:Date.now()};
    setTrades(prev=>[...prev, t]);
    setForm(f=>({...f,sym:'',price:'',qty:'',note:''}));
  };
  const del = id => setTrades(prev=>prev.filter(t=>t.id!==id));

  return (
    <>
      {stats&&stats.positions.length>0&&(
        <div style={{margin:'0 12px 8px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--gold-bd)'}}>
          <div style={{fontSize:9,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>전략 수익률</div>
          <div className={`mono ${stats.total_return>=0?'c-green':'c-red'}`} style={{fontSize:26,fontWeight:700}}>{stats.total_return>=0?'+':''}{fmt(stats.total_return)}%</div>
          <div style={{fontSize:11,color:'var(--dim2)',marginTop:3}}>투자금 {fmtK(stats.total_cost)} → 현재 {fmtK(stats.total_value)}</div>
          <div style={{marginTop:10}}>
            {stats.positions.map((pos,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<stats.positions.length-1?'1px solid var(--line)':'none'}}>
                <div><span className="mono" style={{fontWeight:700,fontSize:12,color:'var(--strong)'}}>{pos.sym}</span><span style={{fontSize:10,color:'var(--dim)',marginLeft:6}}>{pos.qty}주 @ ${fmt(pos.avg_cost)}</span></div>
                <div style={{textAlign:'right'}}>
                  <span className={`mono ${pos.pnl_pct>=0?'c-green':'c-red'}`} style={{fontSize:12,fontWeight:700}}>{pos.pnl_pct!=null?`${pos.pnl_pct>=0?'+':''}${fmt(pos.pnl_pct)}%`:'—'}</span>
                  {pos.current_price&&<div style={{fontSize:10,color:'var(--dim)',marginTop:1}}>${fmt(pos.current_price)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{margin:'0 12px 8px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',maxWidth:560}}>
        <div style={{fontSize:10,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:8}}>매매 기록 추가</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>종목</div><input style={inp} placeholder="GOOGL" value={form.sym} onChange={e=>setForm(f=>({...f,sym:e.target.value.toUpperCase()}))}/></div>
          <div><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>가격($)</div><input style={inp} type="number" placeholder="356" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></div>
          <div><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>수량</div><input style={inp} type="number" placeholder="5" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))}/></div>
          <div><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>구분</div><select style={inp} value={form.action} onChange={e=>setForm(f=>({...f,action:e.target.value}))}><option>매수</option><option>매도</option></select></div>
        </div>
        <input style={{...inp,marginBottom:8}} placeholder="메모 (선택)" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
        <button onClick={add} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'var(--gold)',color:'#000',fontSize:13,fontWeight:700,cursor:'pointer'}}>저장</button>
      </div>
      {trades.length>0&&(
        <>
          <SectionTitle>거래 내역 ({trades.length}건)</SectionTitle>
          <CardGrid min={260}>
          {[...trades].reverse().map((t,i)=>(
            <div key={t.id||i} style={{padding:'10px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span className="mono" style={{fontWeight:700,fontSize:13,color:'var(--strong)'}}>{t.sym}</span>
                  <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:t.action==='매수'?'var(--green-bg)':'var(--red-bg)',border:`1px solid ${t.action==='매수'?'var(--green-bd)':'var(--red-bd)'}`,color:t.action==='매수'?'var(--green)':'var(--red)'}}>{t.action}</span>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:10,color:'var(--dim)'}}>{t.date}</span>
                  <button onClick={()=>del(t.id||i)} style={{background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:6,color:'var(--red)',fontSize:10,padding:'2px 7px',cursor:'pointer'}}>삭제</button>
                </div>
              </div>
              <div style={{fontSize:11,color:'var(--dim2)'}}>${fmt(t.price)} × {t.qty}주 = {fmtK(t.price*t.qty)}</div>
              {t.note&&<div style={{fontSize:10,color:'var(--dim)',marginTop:2}}>{t.note}</div>}
            </div>
          ))}
          </CardGrid>
        </>
      )}
      {trades.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:'var(--dim)',fontSize:12}}>거래 기록이 없습니다. 첫 매매를 입력해보세요.</div>}
    </>
  );
}

function JournalTab({ prices, journal, setJournal }) {
  const [form, setForm] = useState({sym:'',price:'',reason:'',expected:''});
  const [lastAnalysis, setLastAnalysis] = useState(null);

  const save = () => {
    if (!form.reason.trim()) return;
    const sym = form.sym.toUpperCase().trim();
    const stock = STOCK_UNIVERSE[sym];
    const cur = sym ? prices[sym]?.price : null;
    let analysis = null;
    if (stock && cur) {
      const comp = calcCompositeSignal(stock, cur, 4.42);
      const gd = stock.guru_cost&&cur ? ((stock.guru_cost-cur)/stock.guru_cost*100).toFixed(1) : null;
      const sigOk = comp.signal==='BUY';
      const momOk = (stock.mom_12_1||0)>5;
      const guruOk = gd!=null ? parseFloat(gd)>0 : null; // null=판정불가
      // 규칙 준수 판정: 3개 조건 중 몇 개 충족했는지
      const checks = [sigOk, momOk, ...(guruOk!=null?[guruOk]:[])];
      const okCnt = checks.filter(Boolean).length;
      const compliance = okCnt===checks.length ? '✅ 규칙 준수 진입'
        : okCnt>=checks.length-1 ? '🟡 부분 준수 진입'
        : '🔴 규칙 미준수 진입 — 근거 재점검 필요';
      analysis = {signal:comp.signal, ok:sigOk, score:comp.score, mom:stock.mom_12_1, momOk, guru:gd?(parseFloat(gd)>0?`구루보다 ${gd}% 저렴`:`구루보다 ${Math.abs(gd)}% 비쌈`):'구루 데이터 없음', risk:stock.key_risk?.slice(0,60)||'없음', compliance};
    }
    const entry = {sym,price:form.price,reason:form.reason,expected:form.expected,date:new Date().toLocaleDateString('ko-KR'),id:Date.now(),analysis};
    setJournal(prev=>[entry,...prev]);
    setLastAnalysis(analysis);
    setForm({sym:'',price:'',reason:'',expected:''});
  };
  const del = id => setJournal(prev=>prev.filter(e=>e.id!==id));

  return (
    <>
      <div style={{margin:'0 12px 8px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)',maxWidth:560}}>
        <div style={{fontSize:10,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:8}}>새 기록</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>종목(선택)</div><input style={inp} placeholder="GOOGL" value={form.sym} onChange={e=>setForm(f=>({...f,sym:e.target.value.toUpperCase()}))}/></div>
          <div><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>가격($)</div><input style={inp} type="number" placeholder="356" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></div>
        </div>
        <div style={{marginBottom:8}}><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>왜 매수/매도 했는가? (필수)</div><textarea style={{...inp,resize:'vertical',minHeight:70}} placeholder="DCF 저평가 + 버크셔 신규매수 + Cloud 가속..." value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}/></div>
        <div style={{marginBottom:8}}><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>기대하는 결과</div><input style={inp} placeholder="12개월 내 $450 도달" value={form.expected} onChange={e=>setForm(f=>({...f,expected:e.target.value}))}/></div>
        <button onClick={save} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'var(--gold)',color:'#000',fontSize:13,fontWeight:700,cursor:'pointer'}}>저장 + 자동 분석</button>
      </div>
      {lastAnalysis&&(
        <div style={{margin:'0 12px 8px',padding:'12px 14px',background:'var(--gold-bg)',border:'1px solid var(--gold-bd)',borderRadius:14}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--gold)',marginBottom:8}}>📊 진입 시점 자동 분석</div>
          {lastAnalysis.compliance&&<div style={{fontSize:13,fontWeight:700,marginBottom:8,color:lastAnalysis.compliance.startsWith('✅')?'var(--green)':lastAnalysis.compliance.startsWith('🟡')?'var(--gold)':'var(--red)'}}>{lastAnalysis.compliance}</div>}
          <div style={{fontSize:11,color:'var(--text)',lineHeight:1.9}}>
            <div>신호: <b style={{color:sigCol(lastAnalysis.signal)}}>{sigIcon(lastAnalysis.signal)} {lastAnalysis.signal} {lastAnalysis.ok?'✅ 확인':'⚠️ BUY 아님'}</b></div>
            <div>종합점수: <b style={{color:'var(--gold)'}}>{lastAnalysis.score}</b></div>
            <div>모멘텀(12-1M): <b style={{color:lastAnalysis.momOk?'var(--green)':'var(--red)'}}>{lastAnalysis.mom!=null?`${lastAnalysis.mom>0?'+':''}${lastAnalysis.mom}%`:'—'} {lastAnalysis.momOk?'✅':'⚠️'}</b></div>
            <div>구루 대비: <b style={{color:'var(--gold)'}}>{lastAnalysis.guru}</b></div>
            <div style={{marginTop:4,fontSize:10,color:'var(--red)'}}>⚠️ 주요 리스크: {lastAnalysis.risk}</div>
          </div>
        </div>
      )}
      <CardGrid min={300}>
      {journal.map((e,i)=>(
        <div key={e.id||i} style={{padding:'12px 14px',background:'var(--bg2)',borderRadius:12,border:'1px solid var(--line)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              {e.sym&&<span className="mono" style={{fontWeight:700,fontSize:13,color:'var(--strong)'}}>{e.sym}</span>}
              {e.price&&<span style={{fontSize:10,color:'var(--dim2)'}}>${e.price}</span>}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:10,color:'var(--dim)'}}>{e.date}</span>
              <button onClick={()=>del(e.id||i)} style={{background:'var(--red-bg)',border:'1px solid var(--red-bd)',borderRadius:6,color:'var(--red)',fontSize:10,padding:'2px 7px',cursor:'pointer'}}>삭제</button>
            </div>
          </div>
          <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.6,marginBottom:e.expected?4:0}}>{e.reason}</div>
          {e.expected&&<div style={{fontSize:10,color:'var(--gold)',marginBottom:4}}>기대: {e.expected}</div>}
          {e.analysis&&(
            <div style={{marginTop:4,padding:'7px 10px',background:'var(--bg3)',borderRadius:8,fontSize:10,color:'var(--dim2)',lineHeight:1.6}}>
              {e.analysis.compliance&&<div style={{fontWeight:700,marginBottom:2,color:e.analysis.compliance.startsWith('✅')?'var(--green)':e.analysis.compliance.startsWith('🟡')?'var(--gold)':'var(--red)'}}>{e.analysis.compliance}</div>}
              신호 <span style={{color:sigCol(e.analysis.signal)}}>{e.analysis.signal}</span> · 모멘텀 <span style={{color:e.analysis.momOk?'var(--green)':'var(--red)'}}>{e.analysis.momOk?'충족':'미달'}</span> · {e.analysis.guru}
            </div>
          )}
        </div>
      ))}
      </CardGrid>
      {journal.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:'var(--dim)',fontSize:12}}>일지가 없습니다. 매매 이유를 기록해보세요.</div>}
    </>
  );
}

export default function PortfolioJournalPage({ prices, trades, setTrades, journal, setJournal }) {
  const [seg, setSeg] = useState('trades');
  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'14px 16px 8px',fontSize:20,fontWeight:700,color:'var(--strong)'}}>💼 포트폴리오 · 일지</div>
      <Segmented value={seg} onChange={setSeg} options={[['trades','💼 매매기록'],['journal','📔 투자일지']]}/>
      {seg==='trades' && <TradesTab prices={prices} trades={trades} setTrades={setTrades}/>}
      {seg==='journal' && <JournalTab prices={prices} journal={journal} setJournal={setJournal}/>}
    </div>
  );
}
