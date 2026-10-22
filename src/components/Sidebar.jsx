import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {clamp, cx, lockSelection, prefersReducedMotion} from '../core/utils.js';
import {useControllable} from '../core/hooks.js';
import './Sidebar.css';

/* Past a limit the edge keeps following, but with growing resistance */
const rubber=(over, k=.55, dim=140)=>(1-1/((over*k/dim)+1))*dim;

function load(key, fallback){
  if(!key) return fallback;
  try{ const v=JSON.parse(localStorage.getItem(key)); return v&&typeof v==='object'?{...fallback, ...v}:fallback; }catch{ return fallback; }
}

/*
 * Resizable, collapsible side panel.
 * - The width is a damped spring that chases the pointer: it trails a fast drag
 *   and settles softly, so the edge feels weighty rather than glued to the cursor.
 * - Content blurs with the edge's velocity while dragging and sharpens on release.
 * - Past minWidth / maxWidth it rubber-bands; release below the midpoint between
 *   rail and minWidth collapses to an icon rail (or fully when railWidth=0).
 * - Double-click the handle, or press Enter on it, to toggle. Arrow keys resize.
 * Children can read --nr-side-open (0 = rail, 1 = open) to fade labels.
 */
export function Sidebar({children, defaultWidth=240, minWidth=200, maxWidth=380, railWidth=60, collapsed, defaultCollapsed=false, onCollapsedChange, storageKey, className}){
  const saved=useRef(load(storageKey, {w:defaultWidth, c:defaultCollapsed})).current;
  const [isCollapsed,setCollapsed]=useControllable(collapsed, saved.c, onCollapsedChange);
  const asideRef=useRef(null);
  const bodyRef=useRef(null);
  const sim=useRef(null);
  if(!sim.current){
    const w=clamp(saved.w, minWidth, maxWidth);
    sim.current={x:isCollapsed?railWidth:w, v:0, target:isCollapsed?railWidth:w, open:w, k:400, c:40, blur:0, raf:0, t:0, drag:null};
  }
  const [initStyle]=useState(()=>({width:sim.current.x}));
  const collapsedRef=useRef(isCollapsed);
  collapsedRef.current=isCollapsed;
  const [dragging,setDragging]=useState(false);
  const paint=useCallback(()=>{
    const s=sim.current, el=asideRef.current, body=bodyRef.current;
    if(!el) return;
    el.style.width=`${s.x.toFixed(2)}px`;
    const span=Math.max(1, minWidth-railWidth);
    const open=clamp((s.x-railWidth)/span, 0, 1);
    el.style.setProperty('--nr-side-open', open.toFixed(3));
    el.style.setProperty('--nr-side-w', `${s.x.toFixed(1)}px`);
    el.dataset.state=open>=.999?'open':open<=.001?'rail':'between';
    if(body) body.style.filter=s.blur>.05?`blur(${s.blur.toFixed(2)}px)`:'';
  },[minWidth, railWidth]);
  const persist=useCallback(()=>{
    if(!storageKey) return;
    try{ localStorage.setItem(storageKey, JSON.stringify({w:Math.round(sim.current.open), c:collapsedRef.current})); }catch{ /* storage may be blocked */ }
  },[storageKey]);
  const tick=useCallback((now)=>{
    const s=sim.current;
    const dt=Math.min(.034, (now-s.t)/1000);
    s.t=now;
    const n=Math.max(1, Math.ceil(dt/.004)), h=dt/n;
    for(let i=0;i<n;i++){
      const a=-s.k*(s.x-s.target)-s.c*s.v;
      s.v+=a*h;
      s.x+=s.v*h;
    }
    /* blur follows edge speed while held; on release it eases back to sharp */
    const want=s.drag?Math.min(6, Math.abs(s.v)*.006+.8):0;
    s.blur+=(want-s.blur)*(1-Math.exp(-dt*(s.drag?22:14)));
    const rest=!s.drag && Math.abs(s.x-s.target)<.15 && Math.abs(s.v)<4 && s.blur<.05;
    if(rest){
      s.x=s.target; s.v=0; s.blur=0; s.raf=0;
      paint();
      persist();
      return;
    }
    paint();
    s.raf=requestAnimationFrame(tick);
  },[paint, persist]);
  const kick=useCallback((omega, zeta)=>{
    const s=sim.current;
    s.k=omega*omega;
    s.c=2*zeta*omega;
    if(prefersReducedMotion() && !s.drag){
      s.x=s.target; s.v=0; s.blur=0;
      cancelAnimationFrame(s.raf); s.raf=0;
      paint(); persist();
      return;
    }
    if(!s.raf){ s.t=performance.now(); s.raf=requestAnimationFrame(tick); }
  },[tick, paint, persist]);
  useLayoutEffect(()=>{ paint(); },[paint]);
  /* external toggle (button / hotkey / controlled prop) */
  useEffect(()=>{
    const s=sim.current;
    if(s.drag) return;
    const goal=isCollapsed?railWidth:s.open;
    if(Math.abs(s.target-goal)<.5 && Math.abs(s.x-goal)<.5) return;
    s.target=goal;
    kick(18, .86);
  },[isCollapsed, railWidth, kick]);
  useEffect(()=>()=>{ cancelAnimationFrame(sim.current.raf); sim.current.drag?.unlock?.(); },[]);

  const onDown=(e)=>{
    if(e.button!==0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s=sim.current;
    s.drag={x0:e.clientX, w0:s.target, moved:false, unlock:lockSelection()};
    document.documentElement.classList.add('nr-resizing');
    setDragging(true);
    kick(26, 1);
  };
  const onMove=(e)=>{
    const s=sim.current;
    if(!s.drag) return;
    const raw=s.drag.w0+(e.clientX-s.drag.x0);
    if(Math.abs(e.clientX-s.drag.x0)>2) s.drag.moved=true;
    let w=raw;
    if(raw>maxWidth) w=maxWidth+rubber(raw-maxWidth);
    else if(raw<railWidth) w=railWidth-rubber(railWidth-raw, .5, 40);
    s.target=w;
    s.drag.raw=raw;
    kick(26, 1);
  };
  const onUp=()=>{
    const s=sim.current;
    if(!s.drag) return;
    const {raw, moved}=s.drag;
    s.drag.unlock?.();
    s.drag=null;
    document.documentElement.classList.remove('nr-resizing');
    setDragging(false);
    if(!moved){ kick(18, .86); return; }
    const mid=(railWidth+minWidth)/2;
    if(raw<mid){
      s.target=railWidth;
      if(!collapsedRef.current) setCollapsed(true);
    }else{
      s.open=clamp(raw, minWidth, maxWidth);
      s.target=s.open;
      if(collapsedRef.current) setCollapsed(false);
    }
    /* slightly under-damped on release: the edge lands with a soft settle */
    kick(17, .78);
  };
  const toggle=()=>setCollapsed(!collapsedRef.current);
  const onKey=(e)=>{
    const s=sim.current;
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggle(); return; }
    const step=e.shiftKey?40:16;
    if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
    e.preventDefault();
    if(collapsedRef.current){ if(e.key==='ArrowRight') setCollapsed(false); return; }
    const next=s.open+(e.key==='ArrowRight'?step:-step);
    if(next<minWidth){ setCollapsed(true); return; }
    s.open=clamp(next, minWidth, maxWidth);
    s.target=s.open;
    kick(18, .86);
  };
  return <aside ref={asideRef} style={initStyle} className={cx('nr-side', dragging&&'dragging', className)} data-collapsed={isCollapsed||undefined}>
    <div ref={bodyRef} className="nr-side-body">{typeof children==='function'?children({collapsed:isCollapsed, toggle}):children}</div>
    <div
      className="nr-side-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={railWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={Math.round(isCollapsed?railWidth:sim.current.open)}
      tabIndex={0}
      title="Drag to resize · double-click to collapse"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={toggle}
      onKeyDown={onKey}
    ><i/></div>
  </aside>;
}
