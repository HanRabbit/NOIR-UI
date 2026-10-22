import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {cx} from '../core/utils.js';
import {useHold, useListNav, usePresence, useStableId} from '../core/hooks.js';
import {Portal} from '../core/Swap.jsx';
import {IconSearch, IconX} from '../core/icons.jsx';
import {ListBox} from './ListBox.jsx';
import {Kbd} from './Feedback.jsx';
import './Overlay.css';

/* Escape and focus trap only act on the top-most modal */
const stack=[];
const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useModal(open, panelRef, onClose){
  const presence=usePresence(open, 320);
  const token=useRef({});
  const cb=useRef(onClose);
  cb.current=onClose;
  useLayoutEffect(()=>{
    if(!open) return undefined;
    const me=token.current;
    const restore=document.activeElement;
    const root=document.documentElement;
    stack.push(me);
    root.dataset.nrModal=String(stack.length);
    const prevOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKey=(e)=>{
      if(stack[stack.length-1]!==me) return;
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); cb.current?.(); return; }
      if(e.key!=='Tab' || !panelRef.current) return;
      const f=[...panelRef.current.querySelectorAll(FOCUSABLE)].filter((el)=>el.offsetParent!==null);
      if(!f.length){ e.preventDefault(); return; }
      const first=f[0], last=f[f.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return ()=>{
      document.removeEventListener('keydown', onKey, true);
      const i=stack.indexOf(me);
      if(i>=0) stack.splice(i, 1);
      if(stack.length) root.dataset.nrModal=String(stack.length);
      else delete root.dataset.nrModal;
      document.body.style.overflow=prevOverflow;
      if(restore && typeof restore.focus==='function') restore.focus({preventScroll:true});
    };
  },[open, panelRef]);
  useEffect(()=>{
    if(!presence.shown || !open) return;
    const el=panelRef.current;
    if(!el || el.contains(document.activeElement)) return;
    (el.querySelector('[data-autofocus]')||el.querySelector(FOCUSABLE)||el).focus({preventScroll:true});
  },[presence.shown, open, panelRef]);
  return presence;
}

export function Dialog({open, onClose, title, description, children, footer, size='md', dismissible=true, className}){
  const panelRef=useRef(null);
  const {alive, shown, leaving}=useModal(open, panelRef, dismissible?onClose:undefined);
  const tid=useStableId('dlg');
  const view=useHold({title, description, children, footer}, open);
  if(!alive) return null;
  return <Portal>
    <div className={cx('nr-overlay nr-dialog-wrap', shown&&open&&'open', leaving&&'leave')} onPointerDown={(e)=>{ if(dismissible && e.target===e.currentTarget) onClose?.(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={view.title?`${tid}-t`:undefined} aria-describedby={view.description?`${tid}-d`:undefined} tabIndex={-1} className={cx('nr-dialog', `nr-dialog-${size}`, className)}>
        {(view.title||dismissible)&&<div className="nr-dialog-head">
          <div>
            {view.title&&<h2 id={`${tid}-t`}>{view.title}</h2>}
            {view.description&&<p id={`${tid}-d`}>{view.description}</p>}
          </div>
          {dismissible&&<button type="button" className="nr-icon-btn nr-icon-btn-sm nr-icon-btn-ghost" aria-label="Close" onClick={onClose}><IconX size={15}/></button>}
        </div>}
        {view.children!=null&&<div className="nr-dialog-body">{view.children}</div>}
        {view.footer&&<div className="nr-dialog-foot">{view.footer}</div>}
      </div>
    </div>
  </Portal>;
}

/* side: right | left | bottom */
export function Drawer({open, onClose, side='right', size=380, title, children, footer, className}){
  const panelRef=useRef(null);
  const {alive, shown, leaving}=useModal(open, panelRef, onClose);
  const view=useHold({title, children, footer}, open);
  if(!alive) return null;
  const dim=side==='bottom'?{height:size}:{width:size};
  return <Portal>
    <div className={cx('nr-overlay nr-drawer-wrap', `side-${side}`, shown&&open&&'open', leaving&&'leave')} onPointerDown={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <aside ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} className={cx('nr-drawer', className)} style={dim}>
        <div className="nr-drawer-head">
          {view.title&&<h2>{view.title}</h2>}
          <button type="button" className="nr-icon-btn nr-icon-btn-sm nr-icon-btn-ghost" aria-label="Close" onClick={onClose}><IconX size={15}/></button>
        </div>
        <div className="nr-drawer-body">{view.children}</div>
        {view.footer&&<div className="nr-drawer-foot">{view.footer}</div>}
      </aside>
    </div>
  </Portal>;
}

/* Subsequence match; consecutive and early hits score higher */
function score(q, text){
  if(!q) return 1;
  const t=String(text).toLowerCase();
  let ti=0, s=0, run=0;
  for(const ch of q){
    const at=t.indexOf(ch, ti);
    if(at<0) return 0;
    run=at===ti?run+1:0;
    s+=1+run*2+(at===0?3:0);
    ti=at+1;
  }
  return s/(t.length+1);
}

/* Command palette: fuzzy filter, gliding highlight, height tweens with result count */
export function Command({open, onClose, items=[], placeholder='Type a command or search…', empty='No results', footer=true}){
  const [q,setQ]=useState('');
  const panelRef=useRef(null);
  const listRef=useRef(null);
  const [h,setH]=useState(null);
  const {alive, shown, leaving}=useModal(open, panelRef, onClose);
  const lid=useStableId('cmd');
  const results=useMemo(()=>{
    const query=q.trim().toLowerCase();
    if(!query) return items;
    return items
      .map((it)=>({it, s:Math.max(score(query, it.label), score(query, it.keywords||'')*.8)}))
      .filter((r)=>r.s>0)
      .sort((a, b)=>b.s-a.s)
      .map((r)=>({...r.it, group:undefined}));
  },[q, items]);
  const pick=(it)=>{ onClose?.(); it.onSelect?.(); };
  const nav=useListNav(results, {onPick:pick, typeahead:false});
  useLayoutEffect(()=>{ nav.setActive(results.length?0:-1); },[q, results.length, open]);
  useEffect(()=>{ if(!open){ const t=setTimeout(()=>setQ(''), 320); return ()=>clearTimeout(t); } return undefined; },[open]);
  useLayoutEffect(()=>{
    const el=listRef.current;
    if(!el || typeof ResizeObserver==='undefined') return undefined;
    const ro=new ResizeObserver(()=>setH(Math.min(el.scrollHeight, 360)));
    ro.observe(el);
    return ()=>ro.disconnect();
  },[alive]);
  if(!alive) return null;
  return <Portal>
    <div className={cx('nr-overlay nr-cmd-wrap', shown&&open&&'open', leaving&&'leave')} onPointerDown={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div ref={panelRef} className="nr-cmd" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="nr-cmd-search">
          <IconSearch size={17}/>
          <input
            data-autofocus
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            onKeyDown={nav.onKeyDown}
            placeholder={placeholder}
            role="combobox"
            aria-expanded="true"
            aria-controls={lid}
            aria-activedescendant={nav.active>=0?`${lid}-${nav.active}`:undefined}
            spellCheck={false}
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="nr-cmd-list" style={{height:h??undefined}}>
          <div ref={listRef}>
            {results.length
              ? <ListBox id={lid} items={results} active={nav.active} onActive={nav.setActive} onPick={pick}/>
              : <div className="nr-cmd-empty">{empty}</div>}
          </div>
        </div>
        {footer&&<div className="nr-cmd-foot"><span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span><span><Kbd>↵</Kbd> select</span><span className="push">{results.length} {results.length===1?'result':'results'}</span></div>}
      </div>
    </div>
  </Portal>;
}
