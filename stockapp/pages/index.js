import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useLS, computeMacroValues } from '../components/shared';
import { CONCEPTS } from '../components/concepts';
import { MacroDetail } from '../components/MacroBits';
import StockDetail from '../components/StockDetail';
import { HomeA } from '../components/HomeConcepts';
import StocksPage from '../components/StocksPage';
import TenBaggerPage from '../components/TenBaggerPage';
import MacroGuruPage from '../components/MacroGuruPage';
import PortfolioJournalPage from '../components/PortfolioJournalPage';
import { MACRO_INIT } from '../lib/data';

const TABS = [
  {id:'home',label:'홈'},
  {id:'stocks',label:'종목'},
  {id:'ten',label:'텐베거'},
  {id:'macroguru',label:'매크로·구루'},
  {id:'portfolio',label:'포트·일지'},
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [prices, setPrices] = useState({});
  const [macro, setMacro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [trades, setTrades] = useLS('stockdash_trades', []);
  const [journal, setJournal] = useLS('stockdash_journal', []);
  const [detail, setDetail] = useState(null);

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
        <style>{`:root{${CONCEPTS.A.vars}}`}</style>
      </Head>
      <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--bg)',color:'var(--text)',fontFamily:'Pretendard,-apple-system,BlinkMacSystemFont,sans-serif'}}>
        {/* 헤더 + 상단 탭 */}
        <div style={{background:'var(--bg2)',paddingTop:'env(safe-area-inset-top)',borderBottom:'1px solid var(--line2)',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 14px',flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
              <span style={{fontSize:14,fontWeight:800,color:'var(--strong)'}}>📊 투자 대시보드</span>
              <div style={{display:'flex',gap:2,flexWrap:'wrap'}}>
                {TABS.map(t=>(
                  <span key={t.id} onClick={()=>goTab(t.id)} style={{padding:'5px 11px',borderRadius:8,fontSize:12,cursor:'pointer',fontWeight:tab===t.id&&!detail?700:400,color:tab===t.id&&!detail?'var(--blue)':'var(--dim2)',background:tab===t.id&&!detail?'var(--blue-bg)':'transparent',whiteSpace:'nowrap'}}>{t.label}</span>
                ))}
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              {fetchedAt&&<span style={{fontSize:9,color:'var(--dim)'}}>갱신 {fetchedAt}</span>}
              {loading&&<span style={{fontSize:11}}>⏳</span>}
              <button onClick={fetchAll} style={{background:'var(--bg3)',border:'1px solid var(--line2)',borderRadius:6,color:'var(--dim2)',fontSize:11,padding:'4px 9px',cursor:'pointer'}}>🔄</button>
            </div>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div style={{flex:1,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',paddingBottom:24}}>
          {detail && (
            <div style={{maxWidth:820,margin:'0 auto',width:'100%'}}>
              {detail.type==='stock' && <StockDetail sym={detail.sym} prices={prices} macro={macro} macroValues={macroValues} onBack={closeDetail}/>}
              {detail.type==='macro' && <MacroDetail mkey={detail.key} value={macroValues[detail.key]} onBack={closeDetail}/>}
            </div>
          )}
          {!detail && (
            <div style={{maxWidth:1280,margin:'0 auto',width:'100%'}}>
              {tab==='home'      && <HomeA prices={prices} loading={loading} macro={macro} openStock={openStock} openMacro={openMacro} goTab={goTab}/>}
              {tab==='stocks'    && <StocksPage prices={prices} loading={loading} macro={macro} openStock={openStock}/>}
              {tab==='ten'       && <TenBaggerPage prices={prices} openStock={openStock}/>}
              {tab==='macroguru' && <MacroGuruPage macro={macro} prices={prices} openMacro={openMacro}/>}
              {tab==='portfolio' && <PortfolioJournalPage prices={prices} trades={trades} setTrades={setTrades} journal={journal} setJournal={setJournal}/>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
