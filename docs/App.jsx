import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Command as CmdIcon, Sparkles, Palette, MousePointerClick, ToggleRight, TextCursorInput, Layers, BellRing, LayoutGrid, Wind, BookOpen, Search, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen} from 'lucide-react';
import {NavList, PageTransition, ThemeToggle, Toaster, Command, Kbd, IconButton, Tooltip, Badge, Drawer, Sidebar, useHotkey, useTheme} from '../src/index.js';
import {Mark} from './kit.jsx';
import {Overview} from './pages/Overview.jsx';
import {Foundations} from './pages/Foundations.jsx';
import {Actions} from './pages/Actions.jsx';
import {Selection} from './pages/Selection.jsx';
import {Inputs} from './pages/Inputs.jsx';
import {Overlays} from './pages/Overlays.jsx';
import {FeedbackPage} from './pages/FeedbackPage.jsx';
import {DataDisplay} from './pages/DataDisplay.jsx';
import {Motion} from './pages/Motion.jsx';

export const PAGES=[
  {value:'overview', label:'Overview', icon:Sparkles, section:'Start', el:Overview},
  {value:'foundations', label:'Foundations', icon:Palette, section:'Start', el:Foundations},
  {value:'motion', label:'Motion', icon:Wind, section:'Start', el:Motion, badge:'new'},
  {value:'actions', label:'Actions', icon:MousePointerClick, section:'Components', el:Actions},
  {value:'selection', label:'Selection', icon:ToggleRight, section:'Components', el:Selection},
  {value:'inputs', label:'Inputs', icon:TextCursorInput, section:'Components', el:Inputs},
  {value:'overlays', label:'Overlays', icon:Layers, section:'Components', el:Overlays},
  {value:'feedback', label:'Feedback', icon:BellRing, section:'Components', el:FeedbackPage},
  {value:'display', label:'Data display', icon:LayoutGrid, section:'Components', el:DataDisplay},
];

function readHash(){
  const h=window.location.hash.replace('#/', '');
  return PAGES.some((p)=>p.value===h)?h:'overview';
}

function SideNav({page, go, rail=false}){
  const items=[];
  let sec;
  PAGES.forEach((p)=>{
    if(p.section!==sec){ sec=p.section; items.push({section:sec}); }
    items.push({value:p.value, label:p.label, icon:<p.icon size={16} strokeWidth={1.75}/>, badge:p.badge});
  });
  return <>
    <div className="doc-brand">
      <Mark/>
      <div className="nr-side-fade"><b>NOIR<span> UI</span></b><small>v0.1 · Monochrome motion</small></div>
    </div>
    <NavList value={page} onChange={go} items={items} tooltips={rail}/>
    <div className="doc-side-foot nr-side-fade">
      <span>Extracted from</span>
      <b>LeapTracker</b>
    </div>
  </>;
}

export default function App(){
  const [page,setPage]=useState(readHash);
  const [cmd,setCmd]=useState(false);
  const [mobileNav,setMobileNav]=useState(false);
  const [rail,setRail]=useState(()=>{ try{ return JSON.parse(localStorage.getItem('noir.docs.side'))?.c===true; }catch{ return false; } });
  const mainRef=useRef(null);
  const contentRef=useRef(null);
  const {toggle}=useTheme();
  const index=PAGES.findIndex((p)=>p.value===page);
  const Current=PAGES[index].el;
  const go=(id)=>{
    if(id===page) return;
    window.history.pushState(null, '', `#/${id}`);
    setPage(id);
    setMobileNav(false);
  };
  useEffect(()=>{
    const on=()=>setPage(readHash());
    window.addEventListener('popstate', on);
    return ()=>window.removeEventListener('popstate', on);
  },[]);
  useHotkey('mod+k', ()=>setCmd((v)=>!v));
  useHotkey('mod+\\', ()=>setRail((v)=>!v));
  const commands=useMemo(()=>[
    ...PAGES.map((p)=>({value:`go-${p.value}`, label:p.label, group:'Pages', icon:<p.icon size={15}/>, keywords:p.section, onSelect:()=>go(p.value)})),
    {value:'theme', label:'Toggle theme', group:'Preferences', icon:<Palette size={15}/>, shortcut:'⇧T', onSelect:()=>toggle()},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ],[page]);
  useHotkey('shift+t', (e)=>{ if(!/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) toggle(); });
  return <div className="doc-app">
    <Sidebar className="doc-side" storageKey="noir.docs.side" collapsed={rail} onCollapsedChange={setRail} defaultWidth={240} minWidth={200} maxWidth={360} railWidth={64} reflowRef={contentRef}>
      <SideNav page={page} go={go} rail={rail}/>
    </Sidebar>
    <div className="doc-main" data-nr-depth ref={mainRef}>
      <header className="doc-top">
        <div className="doc-mobile-nav"><IconButton label="Menu" onClick={()=>setMobileNav(true)}><MenuIcon size={17}/></IconButton></div>
        <div className="doc-side-toggle"><Tooltip content={rail?'Expand sidebar  ⌘\\':'Collapse sidebar  ⌘\\'} placement="bottom"><IconButton label={rail?'Expand sidebar':'Collapse sidebar'} swapKey={rail?'o':'c'} onClick={()=>setRail((v)=>!v)}>{rail?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</IconButton></Tooltip></div>
        <div className="doc-crumb"><span>NOIR UI</span><span>/</span><b>{PAGES[index].label}</b></div>
        <button type="button" className="doc-search" onClick={()=>setCmd(true)}>
          <Search size={14}/><span>Search components…</span><span className="doc-search-k"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        </button>
        <div className="doc-top-actions">
          <Badge variant="outline" dot>Live</Badge>
          <Tooltip content="Command menu"><IconButton label="Command menu" onClick={()=>setCmd(true)}><CmdIcon size={16}/></IconButton></Tooltip>
          <Tooltip content="Toggle theme  ⇧T"><ThemeToggle/></Tooltip>
          <Tooltip content="Docs"><IconButton label="Docs" onClick={()=>go("foundations")}><BookOpen size={16}/></IconButton></Tooltip>
        </div>
      </header>
      <main className="doc-content" ref={contentRef}>
        <PageTransition pageKey={page} index={index} resetScroll>
          <Current go={go} openCommand={()=>setCmd(true)}/>
        </PageTransition>
      </main>
    </div>
    <Drawer open={mobileNav} onClose={()=>setMobileNav(false)} side="left" size={260}>
      <SideNav page={page} go={go}/>
    </Drawer>
    <Command open={cmd} onClose={()=>setCmd(false)} items={commands}/>
    <Toaster position="bottom-right"/>
  </div>;
}
