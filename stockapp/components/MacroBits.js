import { MACRO_META } from '../lib/data';
import { levelMatch, colOf } from './shared';

// 컴팩트 정사각 매크로 카드 — 그리드에 여러 개 배치
export function MacroCard({ mkey, value, onClick }) {
  const meta = MACRO_META[mkey];
  if (!meta) return null;
  const lvl = levelMatch(meta.levels, value);
  const score = meta.scoreFn ? meta.scoreFn(value) : 50;
  const col = lvl ? colOf(lvl.color) : 'var(--dim)';
  const disp = value == null ? '—' : `${value}${meta.unit||''}`;
  return (
    <div onClick={onClick} style={{
      background:'var(--bg2)', border:`1px solid ${lvl?`${col}40`:'var(--line)'}`, borderRadius:12,
      padding:'10px 10px 8px', cursor:'pointer', display:'flex', flexDirection:'column', gap:4, minHeight:82,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <span style={{fontSize:15}}>{meta.icon}</span>
        <span style={{fontSize:8,padding:'1px 5px',borderRadius:8,background:`${col}22`,color:col,fontWeight:700,whiteSpace:'nowrap'}}>{lvl?.label||'—'}</span>
      </div>
      <div style={{fontSize:9,color:'var(--dim)'}}>{meta.short||meta.label}</div>
      <div className="mono" style={{fontSize:16,fontWeight:700,color:col}}>{disp}</div>
      <div style={{height:3,background:'var(--bg4)',borderRadius:2,marginTop:'auto'}}>
        <div style={{height:'100%',width:`${score}%`,background:col,borderRadius:2}}/>
      </div>
    </div>
  );
}

// 매크로 지표 상세 — 정의/이유/구간별 해석/역사적 사례
export function MacroDetail({ mkey, value, onBack }) {
  const meta = MACRO_META[mkey];
  if (!meta) return null;
  const lvl = levelMatch(meta.levels, value);
  const score = meta.scoreFn ? meta.scoreFn(value) : 50;
  const col = lvl ? colOf(lvl.color) : 'var(--dim)';

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:'12px 16px 4px'}}>
        <div style={{fontSize:11,color:'var(--dim)',cursor:'pointer',marginBottom:8}} onClick={onBack}>← 뒤로</div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
          <span style={{fontSize:22}}>{meta.icon}</span>
          <span style={{fontSize:18,fontWeight:700,color:'var(--strong)'}}>{meta.label}</span>
        </div>
      </div>

      <div style={{margin:'6px 12px',padding:'16px',background:'var(--bg2)',borderRadius:14,border:`1px solid ${col}40`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div className="mono" style={{fontSize:30,fontWeight:700,color:col}}>{value==null?'—':`${value}${meta.unit||''}`}</div>
            <div style={{fontSize:11,color:col,fontWeight:700,marginTop:2}}>{lvl?.label}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:9,color:'var(--dim)',marginBottom:3}}>우호도 점수</div>
            <div className="mono" style={{fontSize:20,fontWeight:700,color:col}}>{score}/100</div>
          </div>
        </div>
        <div style={{height:5,background:'var(--bg4)',borderRadius:3,marginTop:10}}>
          <div style={{height:'100%',width:`${score}%`,background:col,borderRadius:3}}/>
        </div>
        <div style={{fontSize:11,color:'var(--dim2)',marginTop:8,lineHeight:1.6}}>{lvl?.desc}</div>
      </div>

      <div style={{margin:'0 12px 6px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)'}}>
        <div style={{fontSize:10,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>이 지표는 무엇인가</div>
        <div style={{fontSize:12,color:'var(--text)',lineHeight:1.7}}>{meta.what}</div>
      </div>

      <div style={{margin:'0 12px 6px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)'}}>
        <div style={{fontSize:10,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>왜 중요한가</div>
        <div style={{fontSize:12,color:'var(--text)',lineHeight:1.7}}>{meta.why}</div>
      </div>

      <div style={{margin:'0 12px 6px',padding:'14px',background:'var(--bg2)',borderRadius:14,border:'1px solid var(--line)'}}>
        <div style={{fontSize:10,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>구간별 해석 기준 · {meta.benchmark}</div>
        {meta.levels.map((l,i)=>{
          const active = lvl===l;
          const c = colOf(l.color);
          return (
            <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'7px 0',borderBottom:i<meta.levels.length-1?'1px solid var(--line)':'none',opacity:active?1:.55}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:c,marginTop:4,flexShrink:0}}/>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:active?c:'var(--text)'}}>{l.label}{active&&' ← 현재'}</div>
                <div style={{fontSize:10,color:'var(--dim2)',marginTop:1}}>{l.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{margin:'0 12px 8px',padding:'14px',background:'var(--gold-bg)',border:'1px solid var(--gold-bd)',borderRadius:14}}>
        <div style={{fontSize:10,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>📜 역사적 사례</div>
        <div style={{fontSize:11,color:'var(--text)',lineHeight:1.7}}>{meta.history}</div>
      </div>
    </div>
  );
}

// 매크로 지표 컴팩트 그리드
export function MacroGrid({ values, onOpen }) {
  const keys = ['fed_rate','shiller_cape','buffett_indicator','ism_pmi','cpi_yoy','dxy','fed_model'];
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8,margin:'0 12px'}}>
      {keys.map(k=><MacroCard key={k} mkey={k} value={values[k]} onClick={()=>onOpen(k)}/>)}
    </div>
  );
}
