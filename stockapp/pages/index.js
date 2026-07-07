import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { THEMES, useLS, computeMacroValues } from '../components/shared';
import { MacroDetail } from '../components/MacroBits';
import StockDetail from '../components/StockDetail';
import HomePage from '../components/HomePage';
import StocksPage from '../components/StocksPage';
import TenBaggerPage from '../components/TenBaggerPage';
import MacroGuruPage from '../components/MacroGuruPage';
import PortfolioJournalPage from '../components/PortfolioJournalPage';
import { MACRO_INIT } from '../lib/data';

const TABS = [
  {id:'home',icon:'🏠',label:'홈'},
  {id:'stocks',icon:'📊',label:'종목'},
  {id:'ten',icon:'🚀',label:'텐베거'},
  {id:'macroguru',icon:'📡',label:'매크로·구루'},
  {id:'portfolio',icon:'💼',label:'포트·일지'},
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [theme, setTheme] = useLS('stockdash_theme', 'dark');
  const [prices, setPrices] = useState({});
  const [macro, setMacro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [trades, setTrades] = useLS('stockdash_trades', []);
  const [journal, setJournal] = useLS('stockdash_journal', []);
  const [detail, setDetail] = useState(null); // {type:'stock',sym} | {type:'macro',key}

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pRes, mRes] = await Promise.allSettled([
      fetch('/api/prices').then(r=>r.json()).catch(()=>null),
      fetch('/api/macro').then(r=>r.json()).catch(()=>null),
    ]);
    if (pRes.status==='fulfilled'&&pRes.value?.prices) setPrices(pRes.value.prices);
    if (mRes.status==='fulfilled'&&mRes.value?.macro) setMacro(mRes.value.macro);
    setFetchedAt(new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}));
    setLoading(false);
  }, []);

  useEffect(()=>{ fetchAll(); const id=setInterval(fetchAll,5*60*1000); return()=>clearInterval(id); },[fetchAll]);

  const cycleTheme = () => {
    const order=['dark','light','claude'];
    setTheme(prev=>order[(order.indexOf(prev)+1)%order.length]);
  };

  const th = THEMES[theme]||THEMES.dark;
  const openStock = sym => setDetail({type:'stock', sym});
  const openMacro = key => setDetail({type:'macro', key});
  const closeDetail = () => setDetail(null);
  const goTab = id => { setDetail(null); setTab(id); };

  const m = {...MACRO_INIT, ...macro};
  const macroValues = computeMacroValues(m);

  return (
    <>
      <Head>
        <title>투자 대시보드</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <style>{`:root{${th.vars}}`}</style>
      </Head>
      <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--bg)',color:'var(--text)',fontFamily:'Pretendard,-apple-system,BlinkMacSystemFont,sans-serif'}}>
        <div style={{background:'var(--bg)',paddingTop:'env(safe-area-inset-top)',borderBottom:'1px solid var(--line)',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px 7px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--gold)'}}>📊 투자 대시보드</div>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              {fetchedAt&&<span style={{fontSize:9,color:'var(--dim)'}}>갱신 {fetchedAt}</span>}
              {loading&&<span style={{fontSize:11}}>⏳</span>}
              <button onClick={cycleTheme} style={{background:'var(--bg3)',border:'1px solid var(--line2)',borderRadius:6,fontSize:14,padding:'3px 9px',cursor:'pointer',lineHeight:1.4,color:'var(--text)'}}>{th.icon}</button>
              <button onClick={fetchAll} style={{background:'var(--bg3)',border:'1px solid var(--line2)',borderRadius:6,color:'var(--dim2)',fontSize:11,padding:'4px 9px',cursor:'pointer'}}>🔄</button>
            </div>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',paddingBottom:'calc(60px + env(safe-area-inset-bottom))'}}>
          {detail?.type==='stock' && <StockDetail sym={detail.sym} prices={prices} macro={macro} macroValues={macroValues} onBack={closeDetail}/>}
          {detail?.type==='macro' && <MacroDetail mkey={detail.key} value={macroValues[detail.key]} onBack={closeDetail}/>}

          {!detail && tab==='home'      && <HomePage prices={prices} loading={loading} macro={macro} openStock={openStock} openMacro={openMacro} goTab={goTab}/>}
          {!detail && tab==='stocks'    && <StocksPage prices={prices} loading={loading} macro={macro} openStock={openStock}/>}
          {!detail && tab==='ten'       && <TenBaggerPage prices={prices} openStock={openStock}/>}
          {!detail && tab==='macroguru' && <MacroGuruPage macro={macro} prices={prices} openMacro={openMacro}/>}
          {!detail && tab==='portfolio' && <PortfolioJournalPage prices={prices} trades={trades} setTrades={setTrades} journal={journal} setJournal={setJournal}/>}
        </div>

        <div style={{position:'fixed',bottom:0,left:0,right:0,height:'calc(60px + env(safe-area-inset-bottom))',paddingBottom:'env(safe-area-inset-bottom)',background:'var(--bg2)',borderTop:'1px solid var(--line2)',display:'flex',alignItems:'flex-start',paddingTop:8,zIndex:100}}>
          {TABS.map(t=>(
            <div key={t.id} onClick={()=>goTab(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'pointer',padding:'3px 0',WebkitTapHighlightColor:'transparent'}}>
              <span style={{fontSize:19,lineHeight:1}}>{t.icon}</span>
              <span style={{fontSize:8.5,color:tab===t.id&&!detail?'var(--gold)':'var(--dim)',letterSpacing:'.01em'}}>{t.label}</span>
              {tab===t.id&&!detail&&<div style={{width:4,height:4,borderRadius:'50%',background:'var(--gold)',marginTop:1}}/>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
