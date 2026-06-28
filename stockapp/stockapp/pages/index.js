import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { STOCK_UNIVERSE, GURU_POSITIONS, MACRO_INIT } from '../lib/data';
import {
  calcCompositeSignal, calcReverseDCF, calcFCFYield,
  calcPiotroski, calcBeneish, calcROICWACC,
  calcTenBaggerScore, calcPositionSize, calcPortfolioStats
} from '../lib/calculations';

// ── 유틸 ─────────────────────────────────────────
const fmt = (n, d=2) => n==null?'—':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtB = n => { if(!n)return'—'; if(n>=1e12)return`$${(n/1e12).toFixed(2)}T`; if(n>=1e9)return`$${(n/1e9).toFixed(1)}B`; return`$${(n/1e6).toFixed(0)}M`; };
const pct = (n,plus=true) => n==null?'—':`${plus&&n>0?'+':''}${fmt(n)}%`;
const clr = n => n==null?'':n>0?'c-green':n<0?'c-red':'c-dim2';

// ── SVG 도넛 차트 ─────────────────────────────────
const SEG_COLORS = ['#4d9fff','#00d98a','#8b7fff','#ff8c42','#ff3f5c','#c9a84c','#00c9d9'];
function DonutChart({ segments, size=130 }) {
  if(!segments||!segments.length) return null;
  const cx=size/2, cy=size/2, r=(size/2)-18, sw=22;
  const circ = 2*Math.PI*r;
  const total = segments.reduce((s,g)=>s+g.pct,0)||100;
  let offset=0;
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2030" strokeWidth={sw}/>
      {segments.map((seg,i)=>{
        const frac=seg.pct/total;
        const dash=frac*circ;
        const rot=offset*360-90;
        offset+=frac;
        return(
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={SEG_COLORS[i%SEG_COLORS.length]}
            strokeWidth={sw}
            strokeDasharray={`${dash} ${circ-dash}`}
            strokeLinecap="butt"
            transform={`rotate(${rot} ${cx} ${cy})`}/>
        );
      })}
      <circle cx={cx} cy={cy} r={r-sw/2-1} fill="#09090f"/>
    </svg>
  );
}

// ── SVG 바 차트 (분기별 성장률) ───────────────────
function BarChart({ data, height=80 }) {
  if(!data||!data.length) return null;
  const w=280, bw=Math.min(28, (w-20)/data.length-4);
  const vals=data.map(d=>d.val);
  const maxV=Math.max(...vals.map(Math.abs),1);
  const zero=height*0.6;
  return(
    <svg width="100%" viewBox={`0 0 ${w} ${height+20}`} style={{overflow:'visible'}}>
      <line x1={0} y1={zero} x2={w} y2={zero} stroke="#1e2030" strokeWidth={1}/>
      {data.map((d,i)=>{
        const x=10+i*(bw+4);
        const barH=Math.abs(d.val)/maxV*(height*0.55);
        const pos=d.val>=0;
        const y=pos?zero-barH:zero;
        return(
          <g key={i}>
            <rect x={x} y={y} width={bw} height={barH}
              fill={pos?'#00d98a':'#ff3f5c'} rx={2} opacity={0.85}/>
            <text x={x+bw/2} y={pos?y-3:y+barH+10} textAnchor="middle"
              fontSize={8} fill={pos?'#00d98a':'#ff3f5c'}>{d.val>0?'+':''}{d.val}%</text>
            <text x={x+bw/2} y={height+16} textAnchor="middle"
              fontSize={7} fill="#5a5f7a">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 신호 배지 ────────────────────────────────────
function Sig({ s, large }) {
  const map={BUY:['#00d98a','rgba(0,217,138,.15)','📗 매수'],HOLD:['#c9a84c','rgba(201,168,76,.15)','🟡 보유'],
             WAIT:['#ff3f5c','rgba(255,63,92,.15)','🔴 대기'],NEUTRAL:['#c9a84c','rgba(201,168,76,.15)','⏸ 중립'],
             DANGER:['#ff3f5c','rgba(255,63,92,.15)','⛔ 위험']};
  const [col,bg,label]=map[s]||['#5a5f7a','rgba(90,95,122,.15)','—'];
  return(
    <span style={{display:'inline-flex',alignItems:'center',gap:3,padding:large?'5px 14px':'3px 9px',
      borderRadius:20,background:bg,border:`1px solid ${col}40`,
      color:col,fontSize:large?12:10,fontWeight:700,whiteSpace:'nowrap'}}>
      {label}
    </span>
  );
}

// ── 지표 박스 ────────────────────────────────────
function MetBox({label,val,sub,ok,warn,raw}) {
  const col=ok?'var(--green)':warn?'var(--red)':'var(--text)';
  return(
    <div style={{background:'var(--bg3)',borderRadius:8,padding:'8px 10px'}}>
      <div style={{fontSize:9,color:'var(--dim)',marginBottom:3,textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</div>
      <div className="mono" style={{fontSize:13,fontWeight:700,color:col}}>{val}</div>
      {sub&&<div style={{fontSize:9,color:'var(--dim2)',marginTop:2}}>{sub}</div>}
    </div>
  );
}

// ── PE 비교 표시 ─────────────────────────────────
function PECompare({pe, avg5, avg10, min5, max5}) {
  if(!pe) return null;
  const vs5 = avg5 ? ((pe-avg5)/avg5*100).toFixed(0) : null;
  const perc5 = (avg5&&min5&&max5) ? ((pe-min5)/(max5-min5)*100).toFixed(0) : null;
  return(
    <div style={{background:'var(--bg3)',borderRadius:8,padding:'10px 12px'}}>
      <div style={{fontSize:9,color:'var(--dim)',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em'}}>PE 역사 비교</div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <div style={{textAlign:'center'}}>
          <div className="mono" style={{fontSize:16,fontWeight:700,color:vs5>15?'var(--red)':vs5<-15?'var(--green)':'var(--gold)'}}>{pe?fmt(pe,1):' —'}x</div>
          <div style={{fontSize:9,color:'var(--dim)'}}>현재</div>
        </div>
        {avg5&&<div style={{textAlign:'center'}}>
          <div className="mono" style={{fontSize:13,color:'var(--dim2)'}}>{avg5}x</div>
          <div style={{fontSize:9,color:'var(--dim)'}}>5년평균</div>
        </div>}
        {avg10&&<div style={{textAlign:'center'}}>
          <div className="mono" style={{fontSize:13,color:'var(--dim2)'}}>{avg10}x</div>
          <div style={{fontSize:9,color:'var(--dim)'}}>10년평균</div>
        </div>}
        {vs5&&<div style={{textAlign:'center'}}>
          <div className="mono" style={{fontSize:14,fontWeight:700,color:vs5>0?'var(--red)':'var(--green)'}}>{vs5>0?'+':''}{vs5}%</div>
          <div style={{fontSize:9,color:'var(--dim)'}}>5년대비</div>
        </div>}
      </div>
      {perc5&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--dim)',marginBottom:3}}>
            <span>5년 최저 {min5}x</span>
            <span>백분위 <strong style={{color:perc5>70?'var(--red)':perc5<30?'var(--green)':'var(--gold)'}}>{perc5}%</strong></span>
            <span>5년 최고 {max5}x</span>
          </div>
          <div style={{height:5,background:'var(--bg4)',borderRadius:3,position:'relative'}}>
            <div style={{position:'absolute',left:`${perc5}%`,top:-3,width:11,height:11,borderRadius:'50%',
              background:perc5>70?'var(--red)':perc5<30?'var(--green)':'var(--gold)',
              border:'2px solid var(--bg)',transform:'translateX(-50%)'}}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
// 홈 페이지 — 종합 요약
// ══════════════════════════════════════════════════
function HomePage({ stocks, macro, prices, loading }) {
  const m = { ...MACRO_INIT, ...macro };
  const spGap = ((m.sp500-m.sp500_dcf_fair)/m.sp500_dcf_fair*100).toFixed(1);

  const buys  = stocks.filter(s=>s.signal==='BUY'&&s.type!=='locked');
  const holds = stocks.filter(s=>s.signal==='HOLD'&&s.type!=='locked');
  const waits = stocks.filter(s=>s.signal==='WAIT'&&s.type!=='locked');

  const topBuy = buys.sort((a,b)=>(b.upside||0)-(a.upside||0)).slice(0,3);

  return(
    <div>
      <div className="page-title">🏠 홈</div>

      {/* 매크로 한 줄 판단 */}
      <div style={{margin:'0 12px 8px',background:'linear-gradient(135deg,#1e2030,#10111a)',
        borderRadius:14,padding:14,border:'1px solid rgba(201,168,76,.2)'}}>
        <div style={{fontSize:10,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6}}>
          지금 시장 상황
        </div>
        <div style={{fontSize:16,fontWeight:700,color:'#fff',marginBottom:6}}>
          {spGap>5?'⚠️ 고평가 — 신중하게':spGap>0?'🟡 소폭 고평가 — 선별 진입':'🟢 적정 — 진입 가능'}
        </div>
        <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.7}}>
          S&P 7,420 → DCF 적정가 7,180 대비 <strong className={spGap>0?'c-red':'c-green'}>{spGap>0?'+':''}{spGap}%</strong> 고평가<br/>
          Fed {m.fed_rate}% 유지 · ISM PMI {m.ism_pmi} (수축권) · 달러 강세 DXY {m.dxy}<br/>
          <strong className="c-gold">권고: 주식 {m.stock_cash_ratio}% / 현금 {100-m.stock_cash_ratio}% 유지</strong>
        </div>
      </div>

      {/* 지금 당장 할 것 */}
      <div style={{padding:'10px 16px 6px',fontSize:11,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--dim)'}}>
        🎯 지금 당장 할 것
      </div>

      {loading && <div style={{padding:'20px',textAlign:'center',color:'var(--dim)',fontSize:12}}>⏳ 가격 로딩 중...</div>}

      {topBuy.map(s=>{
        const up = s.upside;
        const pos = s.cur ? calcPositionSize(parseFloat(s.composite?.score||0), up||0) : null;
        return(
          <div key={s.sym} style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,
            padding:14,borderLeft:'3px solid var(--green)',border:'1px solid rgba(0,217,138,.2)',
            borderLeft:'3px solid var(--green)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:3}}>
                  <span className="mono" style={{fontSize:16,fontWeight:700,color:'#fff'}}>{s.sym}</span>
                  <Sig s="BUY"/>
                </div>
                <div style={{fontSize:11,color:'var(--dim2)'}}>{s.name}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:20,fontWeight:700,color:'#fff'}}>
                  {s.cur?`$${fmt(s.cur)}`:loading?'..':'—'}
                </div>
                {s.chg!=null&&<div className={`mono ${clr(s.chg)}`} style={{fontSize:11}}>
                  {s.chg>0?'▲':'▼'} {Math.abs(s.chg).toFixed(2)}%
                </div>}
              </div>
            </div>
            <div style={{background:'rgba(0,217,138,.06)',borderRadius:8,padding:'10px 12px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,textAlign:'center'}}>
                <div>
                  <div style={{fontSize:9,color:'var(--dim)',marginBottom:2}}>목표가</div>
                  <div className="mono" style={{fontSize:13,fontWeight:700,color:'var(--gold)'}}>${fmt(s.fair_value,0)}</div>
                </div>
                <div>
                  <div style={{fontSize:9,color:'var(--dim)',marginBottom:2}}>기대 수익</div>
                  <div className="mono" style={{fontSize:13,fontWeight:700,color:'var(--green)'}}>+{fmt(up,0)}%</div>
                </div>
                <div>
                  <div style={{fontSize:9,color:'var(--dim)',marginBottom:2}}>권고 비중</div>
                  <div className="mono" style={{fontSize:13,fontWeight:700,color:'var(--blue)'}}>{pos||'—'}%</div>
                </div>
              </div>
              <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(255,255,255,.05)',
                fontSize:10,color:'var(--dim2)'}}>
                손절 ${s.cur?(s.cur*0.8).toFixed(0):'—'} (-20%) · {s.guru_note}
              </div>
            </div>
          </div>
        );
      })}

      {/* 보유 유지 종목 */}
      {holds.length>0&&(
        <>
          <div style={{padding:'10px 16px 6px',fontSize:11,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--dim)'}}>
            🟡 보유 유지 ({holds.length}개)
          </div>
          {holds.map(s=>(
            <div key={s.sym} style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:10,
              padding:'10px 14px',borderLeft:'3px solid var(--gold)',display:'flex',
              justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <span className="mono" style={{fontWeight:700,color:'#fff',fontSize:13}}>{s.sym}</span>
                <span style={{fontSize:10,color:'var(--dim2)',marginLeft:8}}>{s.name}</span>
              </div>
              <div style={{textAlign:'right',display:'flex',gap:10,alignItems:'center'}}>
                <span className="mono" style={{fontSize:14,fontWeight:700,color:'#fff'}}>
                  {s.cur?`$${fmt(s.cur)}`:loading?'...':'—'}
                </span>
                {s.chg!=null&&<span className={`mono ${clr(s.chg)}`} style={{fontSize:11}}>
                  {s.chg>0?'▲':'▼'}{Math.abs(s.chg).toFixed(1)}%
                </span>}
                {s.fair_value&&s.cur&&<span className="mono" style={{fontSize:11,color:s.fair_value>s.cur?'var(--green)':'var(--red)'}}>
                  {s.fair_value>s.cur?'+':''}{((s.fair_value-s.cur)/s.cur*100).toFixed(0)}%
                </span>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 진입 보류 */}
      {waits.length>0&&(
        <>
          <div style={{padding:'10px 16px 6px',fontSize:11,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--dim)'}}>
            🔴 진입 보류 ({waits.length}개)
          </div>
          {waits.map(s=>(
            <div key={s.sym} style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:10,
              padding:'10px 14px',borderLeft:'3px solid var(--red)',display:'flex',
              justifyContent:'space-between',alignItems:'center',opacity:.8}}>
              <div>
                <span className="mono" style={{fontWeight:700,color:'var(--dim2)',fontSize:13}}>{s.sym}</span>
                <span style={{fontSize:10,color:'var(--dim)',marginLeft:8}}>{s.name}</span>
              </div>
              <span className="mono" style={{fontSize:14,color:'var(--dim2)'}}>
                {s.cur?`$${fmt(s.cur)}`:loading?'...':'—'}
              </span>
            </div>
          ))}
        </>
      )}

      {/* 오늘의 경보 */}
      <div style={{padding:'10px 16px 6px',fontSize:11,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--dim)'}}>
        ⚡ 경보
      </div>
      <div style={{margin:'0 12px',background:'rgba(255,63,92,.08)',border:'1px solid rgba(255,63,92,.2)',borderRadius:10,padding:12}}>
        <div style={{fontSize:11,color:'var(--text)',lineHeight:1.8}}>
          ⚠️ <strong>AI섹터 집중도 높음</strong> — 빅테크·반도체 동반 조정 리스크<br/>
          📅 <strong className="c-red">ORCL 오늘 실적 발표</strong> — 진입 시 이벤트 리스크 주의<br/>
          💰 <strong>현금 {100-m.stock_cash_ratio}% 유지 권고</strong> — S&P 고평가 구간
        </div>
      </div>

      <div style={{height:20}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 매크로 페이지
// ══════════════════════════════════════════════════
function MacroPage({ macro }) {
  const m = { ...MACRO_INIT, ...macro };
  const spGap = ((m.sp500-m.sp500_dcf_fair)/m.sp500_dcf_fair*100).toFixed(1);
  const stockBondPrem = m.treasury_10y ? (100/22 - m.treasury_10y).toFixed(2) : null;

  const cells = [
    {l:'Fed 기준금리', v:`${m.fed_rate??3.75}%`, s:'Warsh 체제 동결', c:'var(--red)'},
    {l:'10Y 국채', v:`${m.treasury_10y??4.42}%`, s:`주식프리미엄 ${stockBondPrem??'+0.1'}%`, c:'var(--red)'},
    {l:'S&P 500', v:(m.sp500||7420).toLocaleString(), s:`DCF 적정가 7,180 (${spGap}%)`, c:'var(--gold)'},
    {l:'Shiller CAPE', v:`${m.shiller_cape??37}x`, s:'역사평균 17x 대비 고평가', c:'var(--red)'},
    {l:'ISM PMI', v:m.ism_pmi??48.9, s:`${(m.ism_pmi??48.9)<50?'수축권 — 방어적 포지션':'확장권'}`, c:(m.ism_pmi??48.9)<50?'var(--red)':'var(--green)'},
    {l:'달러/원', v:(m.usd_krw??1384).toLocaleString(), s:'환차익 발생 중', c:'var(--green)'},
    {l:'버핏 지수', v:`${m.buffett_indicator??196}%`, s:'닷컴버블 초과 극단 고평가', c:'var(--red)'},
    {l:'달러(DXY)', v:m.dxy??105, s:'해외매출 보유주 역풍', c:'var(--red)'},
  ];

  return(
    <div>
      <div className="page-title">📡 매크로</div>
      <div style={{margin:'0 12px 8px',background:'linear-gradient(135deg,#1e2030,#10111a)',
        borderRadius:14,padding:14,border:'1px solid rgba(201,168,76,.2)'}}>
        <div style={{fontSize:10,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:5}}>현재 레짐 · 결론</div>
        <div style={{fontSize:15,fontWeight:700,color:'#fff',marginBottom:5}}>🟡 선별 진입 구간</div>
        <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.7}}>
          S&P 고평가 {spGap}% + PMI 수축 + 달러 강세 = 방어적 포지셔닝<br/>
          <strong className="c-gold">주식 {m.stock_cash_ratio}% / 현금 {100-m.stock_cash_ratio}% 유지</strong><br/>
          AI·클라우드 섹터만 선별 진입. 대규모 신규 진입 부적절.
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,padding:'0 12px',marginBottom:8}}>
        {cells.map((c,i)=>(
          <div key={i} style={{background:'var(--bg2)',borderRadius:10,padding:'10px 12px',border:'1px solid var(--line)'}}>
            <div style={{fontSize:9,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>{c.l}</div>
            <div className="mono" style={{fontSize:18,fontWeight:700,color:c.c}}>{c.v}</div>
            <div style={{fontSize:9,color:'var(--dim2)',marginTop:2}}>{c.s}</div>
          </div>
        ))}
      </div>
      <div style={{padding:'6px 16px',fontSize:11,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--dim)'}}>섹터 우선순위</div>
      {[['AI/IT 인프라','★★★★★','var(--green)',100],['헬스케어','★★★★','var(--green)',80],
        ['커뮤니케이션','★★★','var(--gold)',60],['필수소비재','★★★','var(--gold)',60],
        ['부동산(REIT)','★','var(--red)',20]].map(([n,s,c,w],i)=>(
        <div key={i} style={{margin:'0 12px 5px',background:'var(--bg2)',borderRadius:8,padding:'8px 12px',border:'1px solid var(--line)'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:12,color:'var(--text)'}}>{n}</span>
            <span style={{color:c,fontSize:12}}>{s}</span>
          </div>
          <div style={{height:4,background:'var(--bg4)',borderRadius:2}}>
            <div style={{width:`${w}%`,height:'100%',background:c,borderRadius:2}}/>
          </div>
        </div>
      ))}
      <div style={{height:16}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 종목 리스트
// ══════════════════════════════════════════════════
function StocksPage({ stocks, loading, onSelect }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter==='all' ? stocks
    : filter==='port' ? stocks.filter(s=>s.type==='portfolio')
    : stocks.filter(s=>s.signal===filter.toUpperCase());

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 16px 8px'}}>
        <div style={{fontSize:22,fontWeight:700,color:'#fff'}}>📊 종목</div>
        <div style={{display:'flex',gap:4}}>
          {[['BUY',stocks.filter(s=>s.signal==='BUY'&&s.type!=='locked').length,'var(--green)'],
            ['HOLD',stocks.filter(s=>s.signal==='HOLD'&&s.type!=='locked').length,'var(--gold)'],
            ['WAIT',stocks.filter(s=>s.signal==='WAIT'&&s.type!=='locked').length,'var(--red)']
          ].map(([s,c,col])=>(
            <div key={s} style={{background:`${col}20`,border:`1px solid ${col}40`,borderRadius:20,
              padding:'3px 8px',fontSize:9,fontWeight:700,color:col}}>{s} {c}</div>
          ))}
        </div>
      </div>
      <div style={{display:'flex',gap:6,padding:'0 12px 10px',overflowX:'auto'}}>
        {[['all','전체'],['port','보유'],['BUY','🟢 매수'],['HOLD','🟡 보유'],['WAIT','🔴 대기']].map(([k,l])=>(
          <div key={k} onClick={()=>setFilter(k)} style={{
            padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',
            background:filter===k?'rgba(201,168,76,.15)':'var(--bg2)',
            border:filter===k?'1px solid rgba(201,168,76,.3)':'1px solid var(--line2)',
            color:filter===k?'var(--gold)':'var(--dim2)'}}>
            {l}
          </div>
        ))}
      </div>
      {loading&&<div style={{padding:20,textAlign:'center',color:'var(--dim)',fontSize:12}}>⏳ 가격 로딩 중...</div>}
      {filtered.map(s=>{
        if(s.type==='locked') return(
          <div key={s.sym} style={{margin:'0 12px 6px',background:'var(--bg2)',borderRadius:10,
            padding:'10px 14px',display:'flex',justifyContent:'space-between',opacity:.5,border:'1px solid var(--line)'}}>
            <span className="mono" style={{fontWeight:700,color:'var(--dim2)'}}>{s.sym}</span>
            <span style={{fontSize:10,color:'var(--dim)'}}>🔒 10년 장기보유 예외</span>
          </div>
        );
        const borderCol=s.signal==='BUY'?'var(--green)':s.signal==='HOLD'?'var(--gold)':s.signal==='DANGER'?'var(--red)':'var(--line)';
        const up = s.upside;
        return(
          <div key={s.sym} style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,
            padding:14,borderLeft:`3px solid ${borderCol}`,cursor:'pointer',border:`1px solid ${borderCol}30`,
            borderLeft:`3px solid ${borderCol}`}} onClick={()=>onSelect(s.sym)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
              <div>
                <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:2}}>
                  <span className="mono" style={{fontWeight:700,fontSize:15,color:'#fff'}}>{s.sym}</span>
                  <Sig s={s.signal}/>
                  {s.type==='watch'&&<span style={{fontSize:8,color:'var(--dim)',border:'1px solid var(--line2)',borderRadius:3,padding:'1px 5px'}}>트래킹</span>}
                </div>
                <div style={{fontSize:10,color:'var(--dim2)'}}>{s.name} · {s.sector}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="mono" style={{fontSize:18,fontWeight:700,color:'#fff'}}>
                  {s.cur?`$${fmt(s.cur)}`:loading?'...':'—'}
                </div>
                {s.chg!=null&&<div className={`mono ${clr(s.chg)}`} style={{fontSize:11,marginTop:1}}>
                  {s.chg>0?'▲':'▼'} {Math.abs(s.chg).toFixed(2)}%
                </div>}
              </div>
            </div>
            {/* 업사이드 바 */}
            {s.cur&&s.fair_value&&(()=>{
              const mn=Math.min((s.fair_low||s.fair_value*.6),s.cur*.8);
              const mx=Math.max((s.fair_high||s.fair_value*1.4),s.cur*1.2);
              const r=mx-mn;
              const cp=Math.max(2,Math.min(96,(s.cur-mn)/r*100));
              const fp=Math.max(2,Math.min(96,(s.fair_value-mn)/r*100));
              const col=up>0?'var(--green)':'var(--red)';
              return(
                <div style={{display:'flex',alignItems:'center',gap:8,margin:'4px 0'}}>
                  <div style={{flex:1,height:5,background:'var(--bg4)',borderRadius:3,position:'relative'}}>
                    <div style={{position:'absolute',left:`${Math.min(cp,fp)}%`,width:`${Math.abs(fp-cp)}%`,
                      height:'100%',background:col,opacity:.35,borderRadius:3}}/>
                    <div style={{position:'absolute',left:`${cp}%`,top:-3,width:11,height:11,
                      borderRadius:'50%',background:'var(--text)',border:'2px solid var(--bg)',transform:'translateX(-50%)'}}/>
                    <div style={{position:'absolute',left:`${fp}%`,top:-3,width:11,height:11,
                      borderRadius:'50%',background:'var(--gold)',border:'2px solid var(--bg)',transform:'translateX(-50%)'}}/>
                  </div>
                  <span className="mono" style={{fontSize:12,fontWeight:700,color:up>0?'var(--green)':'var(--red)',minWidth:46,textAlign:'right'}}>
                    {up>0?'+':''}{fmt(up,0)}%
                  </span>
                </div>
              );
            })()}
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:5}}>
              {s.fair_value&&<span style={{background:'var(--bg3)',borderRadius:5,padding:'2px 7px',fontSize:9,color:'var(--dim2)'}}>기대값 <strong className="c-gold">${fmt(s.fair_value,0)}</strong></span>}
              {s.cur&&s.pe_hist_avg_5y&&(()=>{
                const pe = s.cur/s.eps_ttm;
                const vs = ((pe-s.pe_hist_avg_5y)/s.pe_hist_avg_5y*100).toFixed(0);
                return <span style={{background:'var(--bg3)',borderRadius:5,padding:'2px 7px',fontSize:9,color:'var(--dim2)'}}>
                  PE <strong style={{color:vs>20?'var(--red)':vs<-20?'var(--green)':'var(--text)'}}>{pe.toFixed(1)}x</strong>
                  <span style={{color:vs>0?'var(--red)':'var(--green)',marginLeft:3}}>{vs>0?'+':''}{vs}%</span>
                </span>;
              })()}
              {s.piotroski!=null&&<span style={{background:'var(--bg3)',borderRadius:5,padding:'2px 7px',fontSize:9,color:'var(--dim2)'}}>F-Score <strong style={{color:s.piotroski>=7?'var(--green)':s.piotroski<4?'var(--red)':'var(--gold)'}}>{s.piotroski}/9</strong></span>}
              {s.guru_cost&&s.cur&&<span style={{background:'var(--bg3)',borderRadius:5,padding:'2px 7px',fontSize:9,color:s.cur<s.guru_cost?'var(--green)':'var(--dim2)'}}>
                {s.cur<s.guru_cost?`구루보다 ${((s.guru_cost-s.cur)/s.guru_cost*100).toFixed(0)}% 저렴`:`구루 $${s.guru_cost}`}
              </span>}
            </div>
          </div>
        );
      })}
      <div style={{height:16}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 종목 상세
// ══════════════════════════════════════════════════
function StockDetail({ sym, stocks, onBack, treasury }) {
  const s = stocks.find(x=>x.sym===sym);
  if(!s) return null;
  const pe = s.cur&&s.eps_ttm>0 ? s.cur/s.eps_ttm : null;
  const up = s.cur&&s.fair_value ? (s.fair_value-s.cur)/s.cur*100 : null;
  const pos = up ? calcPositionSize(parseFloat(s.composite?.score||0), up) : null;
  const ben = calcBeneish(s.beneish_m);

  // 분기별 성장률 샘플 데이터 (실제는 Finnhub에서 가져옴)
  const growthData = [
    {label:'24Q1',val:s.rev_growth_yoy-8},{label:'24Q2',val:s.rev_growth_yoy-5},
    {label:'24Q3',val:s.rev_growth_yoy-2},{label:'24Q4',val:s.rev_growth_yoy},
    {label:'25Q1',val:s.rev_growth_yoy+s.rev_growth_accel},
  ].filter(d=>d.val!=null&&!isNaN(d.val));

  return(
    <div>
      {/* 헤더 */}
      <div style={{padding:'16px 16px 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontSize:11,color:'var(--dim)',cursor:'pointer',marginBottom:4,display:'flex',alignItems:'center',gap:4}}
            onClick={onBack}>← 종목 목록</div>
          <div className="mono" style={{fontSize:26,fontWeight:700,color:'#fff'}}>{s.sym}</div>
          <div style={{fontSize:11,color:'var(--dim2)',marginTop:1}}>{s.name} · {s.sector}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div className="mono" style={{fontSize:30,fontWeight:700,color:'#fff'}}>{s.cur?`$${fmt(s.cur)}`:'—'}</div>
          {s.chg!=null&&<div className={`mono ${clr(s.chg)}`} style={{fontSize:12,marginTop:2}}>
            {s.chg>0?'▲':'▼'} {Math.abs(s.chg).toFixed(2)}%
          </div>}
        </div>
      </div>

      {/* 핵심 판단 */}
      <div style={{margin:'10px 12px 6px',background:s.signal==='BUY'?'rgba(0,217,138,.08)':'rgba(201,168,76,.08)',
        border:`1px solid ${s.signal==='BUY'?'rgba(0,217,138,.25)':'rgba(201,168,76,.25)'}`,
        borderRadius:14,padding:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <Sig s={s.signal} large/>
          <span style={{fontSize:10,color:'var(--dim)'}}>종합점수 {s.composite?.score||'—'}/2.0</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,textAlign:'center'}}>
          <div style={{background:'rgba(0,0,0,.2)',borderRadius:8,padding:'8px 4px'}}>
            <div style={{fontSize:9,color:'var(--dim)',marginBottom:3}}>목표가</div>
            <div className="mono" style={{fontSize:14,fontWeight:700,color:'var(--gold)'}}>${fmt(s.fair_value,0)}</div>
          </div>
          <div style={{background:'rgba(0,0,0,.2)',borderRadius:8,padding:'8px 4px'}}>
            <div style={{fontSize:9,color:'var(--dim)',marginBottom:3}}>기대 수익</div>
            <div className="mono" style={{fontSize:14,fontWeight:700,color:up>0?'var(--green)':'var(--red)'}}>{up!=null?`${up>0?'+':''}${fmt(up,0)}%`:'—'}</div>
          </div>
          <div style={{background:'rgba(0,0,0,.2)',borderRadius:8,padding:'8px 4px'}}>
            <div style={{fontSize:9,color:'var(--dim)',marginBottom:3}}>권고 비중</div>
            <div className="mono" style={{fontSize:14,fontWeight:700,color:'var(--blue)'}}>{pos||'—'}%</div>
          </div>
        </div>
        {s.cur&&<div style={{marginTop:8,fontSize:10,color:'var(--dim2)'}}>
          손절 ${(s.cur*.8).toFixed(0)} (-20%) · 구루: {s.guru_note}
        </div>}
      </div>

      {/* PE 역사 비교 */}
      <div style={{padding:'8px 16px 4px',fontSize:10,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em'}}>밸류에이션</div>
      <div style={{margin:'0 12px 8px'}}>
        <PECompare pe={pe} avg5={s.pe_hist_avg_5y} avg10={s.pe_hist_avg_10y}
          min5={s.pe_hist_min_5y} max5={s.pe_hist_max_5y}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,padding:'0 12px',marginBottom:8}}>
        <MetBox label="FCF Yield (SBC조정)" val={s.fcf_annual&&s.sbc_annual&&s.cur&&s.shares_out?
          `${(((s.fcf_annual-s.sbc_annual)/(s.cur*s.shares_out))*100).toFixed(1)}%`:'—'}
          sub={`채권(4.42%) 대비`}/>
        <MetBox label="ROIC-WACC" val={s.roic&&s.wacc?`+${(s.roic-s.wacc).toFixed(1)}%p`:'—'}
          ok={s.roic&&s.wacc&&s.roic-s.wacc>10} sub={`ROIC ${s.roic}% / WACC ${s.wacc}%`}/>
        <MetBox label="역산DCF 기대값" val={`$${s.fair_value||'—'}`}
          sub={`범위 $${s.fair_low||'—'}~$${s.fair_high||'—'}`}/>
        <MetBox label="주주수익률" val={s.fcf_annual&&s.sbc_annual&&s.cur&&s.shares_out?
          `${(((s.fcf_annual-s.sbc_annual)/(s.cur*s.shares_out))*100).toFixed(1)}%`:'—'}/>
      </div>

      {/* 품질 지표 — 점수 명확히 */}
      <div style={{padding:'8px 16px 4px',fontSize:10,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em'}}>품질 지표</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,padding:'0 12px',marginBottom:8}}>
        <MetBox label="Piotroski F-Score" val={s.piotroski!=null?`${s.piotroski}/9점`:'—'}
          sub={s.piotroski>=7?'우수 (7점+)':s.piotroski>=4?'보통':'주의'}
          ok={s.piotroski>=7} warn={s.piotroski<4}/>
        <MetBox label="Beneish M-Score" val={s.beneish_m!=null?fmt(s.beneish_m):'—'}
          sub={ben.pass?'✓ 안전 (-1.78 이하)':'⛔ 조작 의심!'}
          ok={ben.pass} warn={!ben.pass}/>
        <MetBox label="Altman Z-Score" val={s.altman_z!=null?fmt(s.altman_z):'—'}
          sub={s.altman_z>2.99?'안전 (2.99+)':s.altman_z>1.81?'주의권':'위험'}
          ok={s.altman_z>2.99} warn={s.altman_z&&s.altman_z<1.81}/>
        <MetBox label="가격모멘텀(12-1M)" val={s.mom_12_1!=null?`${s.mom_12_1>0?'+':''}${s.mom_12_1}%`:'—'}
          sub={s.mom_12_1>10?'강함':s.mom_12_1>0?'중립':'약함'}
          ok={s.mom_12_1>10} warn={s.mom_12_1<-10}/>
      </div>

      {/* 매출 세그먼트 + 도넛 */}
      {s.segments&&s.segments.length>0&&(
        <>
          <div style={{padding:'8px 16px 4px',fontSize:10,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em'}}>매출 세그먼트</div>
          <div style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,padding:14,border:'1px solid var(--line)'}}>
            <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
              <DonutChart segments={s.segments} size={120}/>
              <div style={{flex:1}}>
                {s.segments.map((seg,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:SEG_COLORS[i%SEG_COLORS.length]}}/>
                      <span style={{fontSize:11,color:'var(--text)'}}>{seg.name}</span>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <span className="mono" style={{fontSize:11,fontWeight:600,color:'var(--dim2)'}}>{seg.pct}%</span>
                      <span className="mono" style={{fontSize:10,color:seg.growth>0?'var(--green)':'var(--red)',marginLeft:6}}>
                        {seg.growth>0?'+':''}{seg.growth}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 분기별 성장률 바 차트 */}
      {growthData.length>0&&(
        <>
          <div style={{padding:'8px 16px 4px',fontSize:10,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em'}}>분기별 매출성장률</div>
          <div style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,padding:'14px 10px',border:'1px solid var(--line)'}}>
            <BarChart data={growthData}/>
          </div>
        </>
      )}

      {/* 리스크·기회 */}
      {s.key_risk&&<div style={{margin:'0 12px 5px',background:'rgba(255,63,92,.08)',border:'1px solid rgba(255,63,92,.2)',borderRadius:10,padding:'10px 12px'}}>
        <div style={{fontSize:10,color:'var(--red)',fontWeight:700,marginBottom:3}}>⚠️ 핵심 리스크</div>
        <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.5}}>{s.key_risk}</div>
      </div>}
      {s.key_oppty&&<div style={{margin:'0 12px 8px',background:'rgba(0,217,138,.08)',border:'1px solid rgba(0,217,138,.2)',borderRadius:10,padding:'10px 12px'}}>
        <div style={{fontSize:10,color:'var(--green)',fontWeight:700,marginBottom:3}}>✅ 핵심 기회</div>
        <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.5}}>{s.key_oppty}</div>
      </div>}

      <div style={{height:20}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 텐베거 페이지
// ══════════════════════════════════════════════════
function TenPage({ stocks, loading }) {
  const cands = stocks.filter(s=>s.type!=='locked')
    .map(s=>({...s,ten:s.ten_bagger_score||calcTenBaggerScore(s)}))
    .sort((a,b)=>b.ten-a.ten);

  return(
    <div>
      <div className="page-title">🚀 텐베거</div>
      <div style={{padding:'0 16px 10px',fontSize:11,color:'var(--dim)'}}>
        5년 내 10배 가능성 점수 100점 만점<br/>
        Rule of 40 (30점) + 성장가속 (25점) + TAM침투율 (20점) + GM트렌드 (15점) + 품질 (10점)
      </div>
      {cands.map((s,i)=>{
        const col=s.ten>=70?'var(--green)':s.ten>=50?'var(--gold)':'var(--dim2)';
        const r40=s.rule_of_40||(s.gross_margin+s.rev_growth_yoy-100);
        return(
          <div key={s.sym} style={{margin:'0 12px 10px',background:'var(--bg2)',borderRadius:14,
            padding:14,border:`1px solid ${col}30`,borderLeft:`3px solid ${col}`}}>
            <div style={{display:'flex',gap:12,marginBottom:10}}>
              <div style={{width:58,height:58,borderRadius:'50%',border:`2px solid ${col}`,
                background:`${col}12`,display:'flex',flexDirection:'column',alignItems:'center',
                justifyContent:'center',flexShrink:0}}>
                <div className="mono" style={{fontSize:20,fontWeight:700,color:col,lineHeight:1}}>{s.ten}</div>
                <div style={{fontSize:8,color:col}}>/ 100점</div>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:4}}>
                  <span className="mono" style={{fontSize:16,fontWeight:700,color:'#fff'}}>{s.sym}</span>
                  {s.ten>=70&&<span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:'rgba(139,127,255,.15)',color:'var(--pur)',border:'1px solid rgba(139,127,255,.3)',fontWeight:700}}>텐베거 후보</span>}
                  {s.ten>=50&&s.ten<70&&<span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:'rgba(201,168,76,.15)',color:'var(--gold)',border:'1px solid rgba(201,168,76,.3)',fontWeight:700}}>관심 후보</span>}
                </div>
                <div style={{fontSize:11,color:'var(--dim2)'}}>{s.name}</div>
                {s.cur&&<div className="mono" style={{fontSize:13,fontWeight:600,color:'#fff',marginTop:3}}>${fmt(s.cur)}</div>}
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[
                ['Rule of 40', r40!=null?`${r40.toFixed(0)}점`:'—', r40>40],
                ['매출성장 가속', s.rev_growth_accel!=null?`${s.rev_growth_accel>0?'+':''}${s.rev_growth_accel}%p`:'—', s.rev_growth_accel>2],
                ['GM 트렌드', s.gm_trend!=null?`${s.gm_trend>0?'+':''}${s.gm_trend}%p`:'—', s.gm_trend>1],
                ['TAM 침투율', s.tam_penetration?`${s.tam_penetration}%`:'추정중', s.tam_penetration&&s.tam_penetration<5],
              ].map(([l,v,ok],j)=>(
                <div key={j} style={{background:'var(--bg3)',borderRadius:8,padding:'7px 10px',display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:10,color:'var(--dim)'}}>{l}</span>
                  <span className="mono" style={{fontSize:10,fontWeight:600,color:ok?'var(--green)':'var(--dim2)'}}>{v}</span>
                </div>
              ))}
            </div>
            {s.ten_narrative&&(
              <div style={{marginTop:8,background:'var(--bg3)',borderRadius:8,padding:8,fontSize:10,color:'var(--dim2)',lineHeight:1.6}}>
                {s.ten_narrative}
              </div>
            )}
          </div>
        );
      })}
      <div style={{height:16}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 구루 페이지
// ══════════════════════════════════════════════════
function GuruPage({ prices }) {
  return(
    <div>
      <div className="page-title">🧠 구루</div>
      <div style={{padding:'0 16px 10px',fontSize:11,color:'var(--dim)'}}>Q1 2026 13F · 분기별 갱신</div>
      {GURU_POSITIONS.map(g=>{
        const tc=g.tier===1?'var(--green)':'var(--blue)';
        const ab={NEW:'🆕 신규',ADD:'➕ 추가',HOLD:'⏸ 보유',REDUCE:'➖ 축소',SOLD:'❌ 매도'};
        const ac={NEW:'var(--green)',ADD:'var(--green)',HOLD:'var(--gold)',REDUCE:'var(--gold)',SOLD:'var(--red)'};
        return(
          <div key={g.id} style={{margin:'0 12px 10px',background:'var(--bg2)',borderRadius:14,
            padding:14,borderTop:`3px solid ${tc}`,border:`1px solid var(--line)`,borderTop:`3px solid ${tc}`}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>{g.name}</div>
                <div style={{fontSize:10,color:'var(--dim2)',marginTop:1}}>{g.fund} · AUM ${g.aum_b}B</div>
              </div>
              <span style={{fontSize:8,padding:'3px 8px',borderRadius:10,background:`${tc}20`,color:tc,border:`1px solid ${tc}40`,fontWeight:700,alignSelf:'flex-start'}}>
                T{g.tier} · {g.updated}
              </span>
            </div>
            {g.positions.map((pos,j)=>{
              const cur=prices[pos.sym]?.price;
              const diff=cur&&pos.cost_est?(pos.cost_est-cur)/pos.cost_est*100:null;
              return(
                <div key={j} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'8px 0',borderBottom:j<g.positions.length-1?'1px solid var(--line)':'none'}}>
                  <div>
                    <div style={{display:'flex',gap:7,alignItems:'center'}}>
                      <span className="mono" style={{fontWeight:700,fontSize:13,color:'#fff'}}>{pos.sym}</span>
                      <span style={{fontSize:9,fontWeight:700,color:ac[pos.action]||'var(--dim2)'}}>{ab[pos.action]||pos.action}</span>
                      {pos.cost_type==='확인값'&&<span style={{fontSize:8,color:'var(--green)'}}>✓확인</span>}
                    </div>
                    <div style={{fontSize:9,color:'var(--dim)',marginTop:1}}>{pos.shares}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    {pos.cost_est&&<div style={{fontSize:10,color:'var(--gold)'}}>추정 ${pos.cost_est}</div>}
                    {cur&&<div className="mono" style={{fontSize:11,color:diff>0?'var(--green)':'var(--red)',marginTop:1}}>
                      ${fmt(cur)} ({diff>0?'저렴':'비쌈'} {Math.abs(diff).toFixed(0)}%)
                    </div>}
                    {pos.note&&<div style={{fontSize:9,color:'var(--dim2)',marginTop:2,maxWidth:140,textAlign:'right'}}>{pos.note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{height:16}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 포트폴리오 페이지
// ══════════════════════════════════════════════════
function PortPage({ prices }) {
  const [trades, setTrades] = useState([]);
  const [form, setForm] = useState({sym:'',action:'매수',price:'',qty:'',note:''});
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    fetch('/api/store?type=trades').then(r=>r.json()).then(d=>setTrades(d.trades||[])).catch(()=>{});
  },[]);

  const addTrade = async()=>{
    if(!form.sym||!form.price||!form.qty)return;
    setSaving(true);
    try{
      const r=await fetch('/api/store?type=trades',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const d=await r.json();
      if(d.ok){setTrades(t=>[...t,d.trade]);setForm({sym:'',action:'매수',price:'',qty:'',note:''});}
    }catch(e){}
    setSaving(false);
  };

  const stats=calcPortfolioStats(trades,prices);

  return(
    <div>
      <div className="page-title">💼 포트폴리오</div>
      {stats&&(
        <div style={{margin:'0 12px 8px',background:'linear-gradient(135deg,#1e2030,#10111a)',borderRadius:14,padding:16,border:'1px solid rgba(201,168,76,.2)'}}>
          <div style={{fontSize:10,color:'var(--dim)',marginBottom:4}}>전략 운용 수익률</div>
          <div className="mono" style={{fontSize:28,fontWeight:700,color:stats.total_return>=0?'var(--green)':'var(--red)'}}>
            {stats.total_return>=0?'+':''}{fmt(stats.total_return)}%
          </div>
          <div style={{fontSize:11,color:'var(--dim2)',marginTop:4}}>
            투자 {fmtB(stats.total_cost)} → 현재 {fmtB(stats.total_value)}
          </div>
        </div>
      )}
      {stats?.positions.length>0&&(
        <div style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,padding:14,border:'1px solid var(--line)'}}>
          {stats.positions.map((pos,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',padding:'9px 0',borderBottom:i<stats.positions.length-1?'1px solid var(--line)':'none'}}>
              <div className="mono" style={{fontWeight:700,width:55,color:'#fff',fontSize:13}}>{pos.sym}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:'var(--dim2)'}}>평단 ${fmt(pos.avg_cost)} · {pos.qty}주</div>
                <div style={{fontSize:10,color:'var(--dim)'}}>현재 {pos.current_price?`$${fmt(pos.current_price)}`:'—'}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className={`mono ${clr(pos.pnl_pct)}`} style={{fontSize:14,fontWeight:700}}>
                  {pos.pnl_pct!=null?`${pos.pnl_pct>=0?'+':''}${fmt(pos.pnl_pct)}%`:'—'}
                </div>
                {pos.current_value&&<div style={{fontSize:10,color:'var(--dim)',marginTop:1}}>{fmtB(pos.current_value)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{padding:'8px 16px 4px',fontSize:10,color:'var(--dim)',textTransform:'uppercase',letterSpacing:'.1em'}}>매매 기록 입력</div>
      <div style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,padding:14,border:'1px solid var(--line)'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div><div style={{fontSize:9,color:'var(--dim)',marginBottom:4}}>종목</div>
            <input className="input" placeholder="GOOGL" value={form.sym}
              onChange={e=>setForm(f=>({...f,sym:e.target.value.toUpperCase()}))}/>
          </div>
          <div><div style={{fontSize:9,color:'var(--dim)',marginBottom:4}}>구분</div>
            <select className="input" value={form.action} onChange={e=>setForm(f=>({...f,action:e.target.value}))}>
              <option>매수</option><option>매도</option>
            </select>
          </div>
          <div><div style={{fontSize:9,color:'var(--dim)',marginBottom:4}}>가격 ($)</div>
            <input className="input" placeholder="356" type="number" value={form.price}
              onChange={e=>setForm(f=>({...f,price:e.target.value}))}/>
          </div>
          <div><div style={{fontSize:9,color:'var(--dim)',marginBottom:4}}>수량</div>
            <input className="input" placeholder="5" type="number" value={form.qty}
              onChange={e=>setForm(f=>({...f,qty:e.target.value}))}/>
          </div>
        </div>
        <button style={{width:'100%',padding:13,background:'var(--gold)',border:'none',borderRadius:10,
          color:'#000',fontSize:13,fontWeight:700,cursor:'pointer'}} onClick={addTrade} disabled={saving}>
          {saving?'저장 중...':'기록 저장'}
        </button>
      </div>
      {trades.length>0&&trades.slice().reverse().slice(0,5).map((t,i)=>(
        <div key={i} style={{margin:'0 12px 5px',background:'var(--bg2)',borderRadius:10,padding:'10px 14px',border:'1px solid var(--line)'}}>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <div><span className="mono" style={{fontWeight:700,color:'#fff'}}>{t.sym}</span>
              <span style={{fontSize:11,color:t.action==='매수'?'var(--green)':'var(--red)',marginLeft:8}}>{t.action}</span>
            </div>
            <div className="mono" style={{fontSize:10,color:'var(--dim)'}}>{t.date}</div>
          </div>
          <div style={{fontSize:11,color:'var(--dim2)',marginTop:2}}>${fmt(t.price)} × {t.qty}주 = ${fmtB(t.price*t.qty)}</div>
        </div>
      ))}
      <div style={{height:16}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 투자일지
// ══════════════════════════════════════════════════
function JournalPage() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({sym:'',price:'',reason:'',expected:''});
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    fetch('/api/store?type=journal').then(r=>r.json()).then(d=>setEntries(d.entries||[])).catch(()=>{});
  },[]);

  const add = async()=>{
    if(!form.sym||!form.reason)return;
    setSaving(true);
    try{
      const r=await fetch('/api/store?type=journal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const d=await r.json();
      if(d.ok){setEntries(e=>[d.entry,...e]);setForm({sym:'',price:'',reason:'',expected:''});}
    }catch(e){}
    setSaving(false);
  };

  const closed=entries.filter(e=>e.status==='closed');
  const wins=closed.filter(e=>e.result?.includes('+')).length;

  return(
    <div>
      <div className="page-title">📔 투자일지</div>
      {closed.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,padding:'0 12px',marginBottom:8}}>
          {[['승률',`${(wins/closed.length*100).toFixed(0)}%`,'var(--green)'],
            ['기록',`${entries.length}건`,'var(--gold)'],
            ['완료',`${closed.length}건`,'var(--dim2)']
          ].map(([l,v,c],i)=>(
            <div key={i} style={{background:'var(--bg2)',borderRadius:10,padding:'10px 12px',border:'1px solid var(--line)',textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--dim)',marginBottom:3}}>{l}</div>
              <div className="mono" style={{fontSize:18,fontWeight:700,color:c}}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,padding:14,border:'1px solid var(--line)'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div><div style={{fontSize:9,color:'var(--dim)',marginBottom:4}}>종목</div>
            <input className="input" placeholder="GOOGL" value={form.sym}
              onChange={e=>setForm(f=>({...f,sym:e.target.value.toUpperCase()}))}/>
          </div>
          <div><div style={{fontSize:9,color:'var(--dim)',marginBottom:4}}>가격 ($)</div>
            <input className="input" placeholder="356" value={form.price}
              onChange={e=>setForm(f=>({...f,price:e.target.value}))}/>
          </div>
        </div>
        <div style={{marginBottom:8}}><div style={{fontSize:9,color:'var(--dim)',marginBottom:4}}>매수/매도 이유</div>
          <textarea className="input" placeholder="DCF 저평가 + 버크셔 매수 + 클라우드 +48%..."
            value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} style={{resize:'vertical',minHeight:70}}/>
        </div>
        <div style={{marginBottom:8}}><div style={{fontSize:9,color:'var(--dim)',marginBottom:4}}>기대 결과</div>
          <input className="input" placeholder="12개월 내 $450 도달" value={form.expected}
            onChange={e=>setForm(f=>({...f,expected:e.target.value}))}/>
        </div>
        <button style={{width:'100%',padding:13,background:'var(--gold)',border:'none',borderRadius:10,
          color:'#000',fontSize:13,fontWeight:700,cursor:'pointer'}} onClick={add} disabled={saving}>
          {saving?'저장 중...':'저장'}
        </button>
      </div>
      {entries.map((e,i)=>(
        <div key={i} style={{margin:'0 12px 8px',background:'var(--bg2)',borderRadius:14,padding:14,border:'1px solid var(--line)'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span className="mono" style={{fontWeight:700,fontSize:13,color:'#fff'}}>{e.sym}</span>
              {e.price&&<span style={{fontSize:11,color:'var(--dim2)'}}>${e.price}</span>}
              <span style={{fontSize:9,padding:'2px 7px',borderRadius:10,
                background:e.status==='closed'?'rgba(201,168,76,.15)':'rgba(0,217,138,.15)',
                color:e.status==='closed'?'var(--gold)':'var(--green)',
                border:`1px solid ${e.status==='closed'?'rgba(201,168,76,.3)':'rgba(0,217,138,.3)'}`}}>
                {e.status==='closed'?'완료':'진행 중'}
              </span>
            </div>
            <span style={{fontSize:10,color:'var(--dim)'}}>{e.date}</span>
          </div>
          <div style={{fontSize:11,color:'var(--dim2)',lineHeight:1.6,marginBottom:e.result?6:0}}>{e.reason}</div>
          {e.expected&&<div style={{fontSize:10,color:'var(--gold)',marginBottom:e.result?6:0}}>기대: {e.expected}</div>}
          {e.result&&(
            <div style={{background:'var(--bg3)',borderRadius:8,padding:8,fontSize:11}}>
              <div style={{color:'var(--text)'}}>{e.result}</div>
              {e.analysis&&<div style={{fontSize:10,color:'var(--dim2)',lineHeight:1.5,marginTop:6,paddingTop:6,borderTop:'1px solid var(--line)'}}>🔍 {e.analysis}</div>}
            </div>
          )}
        </div>
      ))}
      {entries.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--dim)'}}>
        <div style={{fontSize:36,marginBottom:12}}>📔</div>
        <div style={{fontSize:14,color:'var(--dim2)'}}>첫 매매 이유를 기록해보세요</div>
      </div>}
      <div style={{height:16}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
// 메인 앱
// ══════════════════════════════════════════════════
const TABS=[
  {id:'home',icon:'🏠',label:'홈'},
  {id:'macro',icon:'🌍',label:'매크로'},
  {id:'stocks',icon:'📊',label:'종목'},
  {id:'ten',icon:'🚀',label:'텐베거'},
  {id:'guru',icon:'🧠',label:'구루'},
  {id:'port',icon:'💼',label:'포트'},
  {id:'journal',icon:'📔',label:'일지'},
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [prices, setPrices] = useState({});
  const [macro, setMacro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSym, setSelectedSym] = useState(null);

  const fetchAll = useCallback(async()=>{
    setLoading(true);
    try{
      const [pr,mr]=await Promise.allSettled([
        fetch('/api/prices').then(r=>r.json()),
        fetch('/api/macro').then(r=>r.json()),
      ]);
      if(pr.status==='fulfilled') setPrices(pr.value.prices||{});
      if(mr.status==='fulfilled') setMacro(mr.value.macro);
    }catch(e){}
    setLoading(false);
  },[]);

  useEffect(()=>{ fetchAll(); const id=setInterval(fetchAll,5*60*1000); return()=>clearInterval(id); },[fetchAll]);

  // 종목 데이터 + 가격 결합
  const stocks = Object.entries(STOCK_UNIVERSE).map(([sym,s])=>{
    const p=prices[sym];
    const cur=p?.price;
    const composite=calcCompositeSignal(s,cur,macro?.treasury_10y||4.42);
    const up=cur&&s.fair_value?(s.fair_value-cur)/cur*100:null;
    return{sym,...s,cur,chg:p?.change,high52:p?.high52,low52:p?.low52,
           signal:composite.signal,composite,upside:up,
           ten_bagger_score:s.ten_bagger_score||calcTenBaggerScore(s)};
  });

  const updatedAt=prices.GOOGL?.fetched
    ?new Date(prices.GOOGL.fetched).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})
    :null;

  return(
    <>
      <Head>
        <title>투자 대시보드</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="theme-color" content="#09090f"/>
      </Head>
      <div className="app">
        {/* 상태바 */}
        <div style={{background:'var(--bg)',paddingTop:'env(safe-area-inset-top)',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'8px 16px 6px',borderBottom:'1px solid var(--line)'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--gold)'}}>📊 투자 대시보드</div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {updatedAt&&<span style={{fontSize:9,color:'var(--dim)'}}>{updatedAt} 갱신</span>}
              {loading&&<span style={{fontSize:9,color:'var(--gold)'}}>⏳</span>}
              <button onClick={fetchAll} style={{background:'var(--bg3)',border:'1px solid var(--line2)',
                borderRadius:6,color:'var(--dim2)',fontSize:10,padding:'3px 8px',cursor:'pointer'}}>🔄</button>
            </div>
          </div>
        </div>

        {/* 페이지 */}
        <div className="page-area">
          {tab==='home'&&<HomePage stocks={stocks} macro={macro} prices={prices} loading={loading}/>}
          {tab==='macro'&&<MacroPage macro={macro}/>}
          {tab==='stocks'&&!selectedSym&&<StocksPage stocks={stocks} loading={loading} onSelect={s=>{setSelectedSym(s);setTab('stocks');}}/>}
          {tab==='stocks'&&selectedSym&&<StockDetail sym={selectedSym} stocks={stocks} onBack={()=>setSelectedSym(null)} treasury={macro?.treasury_10y||4.42}/>}
          {tab==='ten'&&<TenPage stocks={stocks} loading={loading}/>}
          {tab==='guru'&&<GuruPage prices={prices}/>}
          {tab==='port'&&<PortPage prices={prices}/>}
          {tab==='journal'&&<JournalPage/>}
        </div>

        {/* 하단 네비게이션 */}
        <div className="bottom-nav">
          {TABS.map(t=>(
            <div key={t.id} className={`nav-item ${tab===t.id?'active':''}`}
              onClick={()=>{setTab(t.id);if(t.id!=='stocks')setSelectedSym(null);}}>
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
              {tab===t.id&&<div className="nav-active-dot"/>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
