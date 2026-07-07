import { useState, useEffect, useCallback, useRef } from 'react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 테마
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const THEMES = {
  dark: {
    label: '🌙 다크', icon: '🌙',
    vars: `
      --bg:#0b0c12;--bg2:#12131e;--bg3:#1a1b2a;--bg4:#222336;
      --text:#dde0f0;--strong:#ffffff;--dim:#55597a;--dim2:#8890b0;
      --line:rgba(255,255,255,0.05);--line2:rgba(255,255,255,0.10);
      --gold:#c9a84c;--gold2:#e8c87a;
      --green:#00d98a;--red:#ff3f5c;--blue:#4d9fff;--pur:#9b8fff;
      --green-bg:rgba(0,217,138,.10);--green-bd:rgba(0,217,138,.22);
      --red-bg:rgba(255,63,92,.10);--red-bd:rgba(255,63,92,.22);
      --gold-bg:rgba(201,168,76,.10);--gold-bd:rgba(201,168,76,.28);
      --pur-bg:rgba(155,143,255,.10);--pur-bd:rgba(155,143,255,.28);
      --blue-bg:rgba(77,159,255,.10);--blue-bd:rgba(77,159,255,.28);
    `,
  },
  light: {
    label: '☀️ 라이트', icon: '☀️',
    vars: `
      --bg:#f5f5f7;--bg2:#ffffff;--bg3:#f0f0f2;--bg4:#e2e2e6;
      --text:#1a1a1a;--strong:#000000;--dim:#8a8a8a;--dim2:#5a5a66;
      --line:rgba(0,0,0,0.07);--line2:rgba(0,0,0,0.13);
      --gold:#b8923a;--gold2:#96731f;
      --green:#0f9d58;--red:#d93025;--blue:#1a73e8;--pur:#7c4dff;
      --green-bg:rgba(15,157,88,.08);--green-bd:rgba(15,157,88,.30);
      --red-bg:rgba(217,48,37,.08);--red-bd:rgba(217,48,37,.30);
      --gold-bg:rgba(184,146,58,.10);--gold-bd:rgba(184,146,58,.35);
      --pur-bg:rgba(124,77,255,.08);--pur-bd:rgba(124,77,255,.30);
      --blue-bg:rgba(26,115,232,.08);--blue-bd:rgba(26,115,232,.30);
    `,
  },
  claude: {
    label: '🧡 Claude', icon: '🧡',
    vars: `
      --bg:#faf9f5;--bg2:#ffffff;--bg3:#f0eee6;--bg4:#e4e1d5;
      --text:#3d3929;--strong:#1f1c10;--dim:#a09a85;--dim2:#6e6852;
      --line:rgba(61,57,41,0.08);--line2:rgba(61,57,41,0.15);
      --gold:#c96442;--gold2:#a94f30;
      --green:#788c5d;--red:#bd5d3a;--blue:#5c7c9d;--pur:#8d7a9e;
      --green-bg:rgba(120,140,93,.10);--green-bd:rgba(120,140,93,.32);
      --red-bg:rgba(189,93,58,.10);--red-bd:rgba(189,93,58,.32);
      --gold-bg:rgba(201,100,66,.09);--gold-bd:rgba(201,100,66,.32);
      --pur-bg:rgba(141,122,158,.10);--pur-bd:rgba(141,122,158,.32);
      --blue-bg:rgba(92,124,157,.10);--blue-bd:rgba(92,124,157,.32);
    `,
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 포맷/색상 유틸
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const fmt = (n, d = 2) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtK = n => { if (!n) return '—'; const a = Math.abs(n); if (a >= 1e12) return `$${(n/1e12).toFixed(2)}T`; if (a >= 1e9) return `$${(n/1e9).toFixed(1)}B`; return `$${(n/1e6).toFixed(0)}M`; };
export const pct = (n, d = 1) => n == null ? '—' : `${n > 0 ? '+' : ''}${Number(n).toFixed(d)}%`;
export const clr = n => n > 0 ? 'c-green' : n < 0 ? 'c-red' : 'c-dim2';
export const sigCol  = s => ({BUY:'var(--green)',HOLD:'var(--gold)',NEUTRAL:'var(--dim2)',WAIT:'var(--red)',DANGER:'var(--red)',UNKNOWN:'var(--dim)'}[s]||'var(--dim)');
export const sigBg   = s => ({BUY:'var(--green-bg)',HOLD:'var(--gold-bg)',NEUTRAL:'var(--pur-bg)',WAIT:'var(--red-bg)',DANGER:'var(--red-bg)',UNKNOWN:'var(--bg3)'}[s]||'var(--bg3)');
export const sigBd   = s => ({BUY:'var(--green-bd)',HOLD:'var(--gold-bd)',NEUTRAL:'var(--pur-bd)',WAIT:'var(--red-bd)',DANGER:'var(--red-bd)',UNKNOWN:'var(--line2)'}[s]||'var(--line2)');
export const sigLbl  = s => ({BUY:'매수',HOLD:'보유',NEUTRAL:'중립',WAIT:'대기',DANGER:'위험',UNKNOWN:'—'}[s]||'—');
export const sigIcon = s => ({BUY:'📗',HOLD:'🟡',NEUTRAL:'⬜',WAIT:'🔴',DANGER:'⛔',UNKNOWN:'？'}[s]||'？');

const COLMAP = { green:'var(--green)', gold:'var(--gold)', red:'var(--red)' };
export const colOf = c => COLMAP[c] || 'var(--dim2)';

// levels 배열에서 값에 맞는 구간을 찾음 (max 오름차순 or min 내림차순 정의, 배열 순서상 첫 매치 채택)
export function levelMatch(levels, value) {
  if (!levels || value == null) return null;
  for (const lvl of levels) {
    if (lvl.max != null && value <= lvl.max) return lvl;
    if (lvl.min != null && value >= lvl.min) return lvl;
  }
  return levels[levels.length - 1];
}

export function computeMacroValues(m) {
  const EY = 100 / 22;
  const fed_model = +(EY - (m.treasury_10y || 4.42)).toFixed(2);
  return {
    fed_rate: m.fed_rate,
    shiller_cape: m.shiller_cape,
    buffett_indicator: m.buffett_indicator,
    ism_pmi: m.ism_pmi,
    cpi_yoy: m.cpi_yoy,
    dxy: m.dxy,
    fed_model,
    EY,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// localStorage 훅
// 주의: 브라우저 로컬 저장이므로 기기(또는 브라우저)가 바뀌면
// 포트폴리오·일지 데이터가 따라가지 않습니다.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function useLS(key, init) {
  const [val, setVal] = useState(init);
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try { const s = localStorage.getItem(key); if (s) setVal(JSON.parse(s)); } catch {}
  }, [key]);
  const save = useCallback(v => {
    const next = typeof v === 'function' ? v : () => v;
    setVal(prev => {
      const updated = next(prev);
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [key]);
  return [val, save];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 공통 UI 아톰
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function SigBadge({ s, sm }) {
  const col=sigCol(s),bg=sigBg(s),bd=sigBd(s);
  return <span style={{display:'inline-flex',alignItems:'center',gap:3,padding:sm?'1px 6px':'2px 8px',borderRadius:20,fontSize:sm?9:10,fontWeight:700,background:bg,border:`1px solid ${bd}`,color:col,whiteSpace:'nowrap'}}>{sigIcon(s)} {sigLbl(s)}</span>;
}

export function Chip({ label, val, col }) {
  return <span style={{display:'inline-flex',alignItems:'center',gap:3,padding:'1px 7px',borderRadius:12,fontSize:10,background:'var(--bg3)',border:'1px solid var(--line2)',color:'var(--dim2)'}}><span style={{fontSize:9}}>{label}</span><span style={{fontWeight:700,color:col||'var(--text)'}}>{val}</span></span>;
}

export function UpsideBar({ cur, fair, low, high }) {
  if (!cur || !fair) return null;
  const upCheck = (fair - cur) / cur * 100;
  if (upCheck > 200) {
    return <div style={{fontSize:9,color:'var(--dim)',marginTop:4}}>⚠️ 목표가 기준 검증 필요 (액면분할 가능성) — 업사이드 표시 보류</div>;
  }
  const mn=Math.min(low??fair*.65,cur*.85),mx=Math.max(high??fair*1.35,cur*1.15);
  const rng=mx-mn||1,cp=Math.max(2,Math.min(96,(cur-mn)/rng*100)),fp=Math.max(2,Math.min(96,(fair-mn)/rng*100));
  const up=(fair-cur)/cur*100,col=up>0?'var(--green)':'var(--red)';
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
      <div style={{flex:1,height:4,background:'var(--bg4)',borderRadius:2,position:'relative'}}>
        <div style={{position:'absolute',top:0,height:'100%',left:`${Math.min(cp,fp)}%`,width:`${Math.abs(fp-cp)}%`,background:col,opacity:.4,borderRadius:2}}/>
        <div style={{position:'absolute',top:-4,width:12,height:12,borderRadius:'50%',border:'2px solid var(--bg)',background:'var(--dim2)',transform:'translateX(-50%)',left:`${cp}%`}}/>
        <div style={{position:'absolute',top:-4,width:12,height:12,borderRadius:'50%',border:'2px solid var(--bg)',background:'var(--gold)',transform:'translateX(-50%)',left:`${fp}%`}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color:col,minWidth:44,textAlign:'right'}}>{pct(up)}</span>
    </div>
  );
}

export function ScoreRing({ score, size=44 }) {
  const r=size/2-4,c=2*Math.PI*r,p=Math.max(0,Math.min(1,score/100));
  const col=score>=70?'var(--green)':score>=50?'var(--gold)':'var(--dim2)';
  return (
    <svg width={size} height={size} style={{flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg4)" strokeWidth={3}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={3}
        strokeDasharray={`${c*p} ${c*(1-p)}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        fill={col} fontSize={size>40?11:9} fontWeight="700" fontFamily="monospace">{Math.round(score)}</text>
    </svg>
  );
}

export function MiniBar({ pct: p, col }) {
  return <div style={{height:3,background:'var(--bg4)',borderRadius:2}}><div style={{height:'100%',width:`${Math.max(0,Math.min(100,p))}%`,background:col||'var(--gold)',borderRadius:2}}/></div>;
}

// 반응형 카드 그리드 — 데스크톱 4열, 태블릿 2~3열, 모바일 1~2열
export function CardGrid({ children, min = 230, gap = 8 }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fill,minmax(${min}px,1fr))`,gap,margin:'0 12px'}}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{padding:'10px 16px 5px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--dim)'}}>{children}</span>
      {right}
    </div>
  );
}

export function Row({ label, val, valCol, note, last }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',borderBottom:last?'none':'1px solid var(--line)'}}>
      <div>
        <div style={{fontSize:11,color:'var(--dim)'}}>{label}</div>
        {note&&<div style={{fontSize:9,color:'var(--dim)',marginTop:1}}>{note}</div>}
      </div>
      <span className="mono" style={{fontSize:13,fontWeight:700,color:valCol||'var(--text)'}}>{val}</span>
    </div>
  );
}

// 클릭하면 METRIC_META 설명이 펼쳐지는 지표 행
export function MetricRow({ meta, label, val, valCol, note, value, last }) {
  const [open, setOpen] = useState(false);
  const lvl = meta ? levelMatch(meta.levels, value) : null;
  return (
    <div style={{borderBottom:last?'none':'1px solid var(--line)'}}>
      <div onClick={()=>meta&&setOpen(o=>!o)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',cursor:meta?'pointer':'default'}}>
        <div>
          <div style={{fontSize:11,color:'var(--dim)',display:'flex',alignItems:'center',gap:4}}>
            {label}{meta&&<span style={{fontSize:8,color:'var(--dim)'}}>{open?'▲':'▼'}</span>}
          </div>
          {note&&<div style={{fontSize:9,color:'var(--dim)',marginTop:1}}>{note}</div>}
        </div>
        <span className="mono" style={{fontSize:13,fontWeight:700,color:valCol||'var(--text)'}}>{val}</span>
      </div>
      {open&&meta&&(
        <div style={{padding:'0 14px 12px',fontSize:10,color:'var(--dim2)',lineHeight:1.7}}>
          <div style={{marginBottom:6}}>{meta.what}</div>
          <div style={{marginBottom:6}}>💡 {meta.why}</div>
          {lvl&&<div style={{padding:'6px 8px',background:'var(--bg3)',borderRadius:6,color:colOf(lvl.color)}}>현재 판정: <b>{lvl.label}</b> — {lvl.desc}</div>}
        </div>
      )}
    </div>
  );
}

// 홈/Top10 리스트용 종목 압축 행
export function StockCompactRow({ s, onClick, rightLabel }) {
  return (
    <div onClick={onClick} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',cursor:'pointer'}}>
      <div style={{display:'flex',gap:7,alignItems:'center',minWidth:0}}>
        <span className="mono" style={{fontWeight:700,fontSize:12,color:'var(--strong)',width:46,flexShrink:0}}>{s.sym}</span>
        <div style={{minWidth:0}}>
          <div style={{fontSize:10,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name}</div>
          {s.fair_value&&<div style={{fontSize:9,color:'var(--dim)'}}>목표 ${fmt(s.fair_value,0)}</div>}
        </div>
      </div>
      <div style={{textAlign:'right',flexShrink:0}}>
        <div className="mono" style={{fontSize:12,fontWeight:700,color:'var(--strong)'}}>{s.cur?`$${fmt(s.cur)}`:'—'}</div>
        {rightLabel!=null ? rightLabel : (s.up!=null && (s.up>200
          ? <div style={{fontSize:9,color:'var(--dim)'}}>⚠️검증필요</div>
          : <div style={{fontSize:10,fontWeight:600,color:s.up>0?'var(--green)':'var(--red)'}}>{pct(s.up)}</div>))}
      </div>
    </div>
  );
}
