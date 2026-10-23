import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {clamp, cx, lockSelection, prefersReducedMotion} from '../core/utils.js';
import {useControllable} from '../core/hooks.js';
import './Sidebar.css';

/* Past a limit the edge keeps following, but with growing resistance */
const rubber=(over, k=.55, dim=140)=>(1-1/((over*k/dim)+1))*dim;

/* matches below a viewport width (px); null when not requested or unsupported */
const below=(px)=>px && typeof matchMedia==='function'?matchMedia(`(max-width:${px-.02}px)`):null;

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
 * reflowRef: the region that reflows beside the panel; it gets a speed-matched blur.
 * collapseBelow: viewport width (px) under which it folds to the rail on the same
 *   spring, and reopens when the viewport grows back (unless toggled meanwhile).
 * hideBelow: viewport width (px) under which it slides away completely.
 */
export function Sidebar({children, defaultWidth=240, minWidth=200, maxWidth=380, railWidth=60, collapsed, defaultCollapsed=false, onCollapsedChange, storageKey, className, reflowRef, collapseBelow, hideBelow}){
  const saved=useRef(load(storageKey, {w:defaultWidth, c:defaultCollapsed})).current;
  const [isCollapsed,setCollapsed]=useControllable(collapsed, saved.c, onCollapsedChange);
  const asideRef=useRef(null);
  const bodyRef=useRef(null);
  const sim=useRef(null);
  /* auto: folded by collapseBelow (not by the user); hidden: under hideBelow */
  const auto=useRef(false);
  const hidden=useRef(false);
  if(!sim.current){
    const w=clamp(saved.w, minWidth, maxWidth);
    hidden.current=Boolean(below(hideBelow)?.matches);
    const x=hidden.current?0:isCollapsed||below(collapseBelow)?.matches?railWidth:w;
    sim.current={x, v:0, target:x, open:w, k:400, c:40, blur:0, rblur:0, raf:0, t:0, drag:null};
  }
  const [initStyle]=useState(()=>({width:sim.current.x}));
  const collapsedRef=useRef(isCollapsed);
  collapsedRef.current=isCollapsed;
  const [dragging,setDragging]=useState(false);
  /* every style written per frame goes through here: an unchanged value is not
     rewritten, so a settled label fade or blur costs no style recalculation
     (an inherited custom property re-styles the whole panel when touched) */
  const wrote=useRef(new WeakMap());
  const put=(el, k, v)=>{
    let m=wrote.current.get(el);
    if(!m) wrote.current.set(el, m={});
    if(m[k]===v) return;
    m[k]=v;
    if(k.startsWith('--')) el.style.setProperty(k, v);
    else if(k==='state') el.dataset.state=v;
    else el.style[k]=v;
  };
  const paint=useCallback(()=>{
    const s=sim.current, el=asideRef.current, body=bodyRef.current;
    if(!el) return;
    put(el, 'width', `${s.x.toFixed(2)}px`);
    const span=Math.max(1, minWidth-railWidth);
    const open=clamp((s.x-railWidth)/span, 0, 1);
    put(el, '--nr-side-open', open.toFixed(3));
    /* below the rail width the whole panel slides out: body travels left, clipped by the edge */
    const show=clamp(s.x/Math.max(1, railWidth), 0, 1);
    put(el, 'state', show<=.001&&hidden.current?'hidden':open>=.999?'open':open<=.001?'rail':'between');
    put(el, 'clipPath', show<1?'inset(0 -12px 0 0)':'');
    const blur=Math.max(s.blur, (1-show)*5);
    if(body){
      put(body, 'filter', blur>.05?`blur(${blur.toFixed(1)}px)`:'');
      put(body, 'transform', show<1?`translateX(${((show-1)*railWidth).toFixed(2)}px)`:'');
      put(body, 'minWidth', show<1?`${railWidth}px`:'');
    }
    const flow=reflowRef?.current;
    if(flow) put(flow, 'filter', s.rblur>.05?`blur(${s.rblur.toFixed(1)}px)`:'');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[minWidth, railWidth, reflowRef]);
  const persist=useCallback(()=>{
    if(!storageKey) return;
    try{ localStorage.setItem(storageKey, JSON.stringify({w:Math.round(sim.current.open), c:auto.current?false:collapsedRef.current})); }catch{ /* storage may be blocked */ }
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
    /* the content that reflows beside the edge blurs with the edge's speed, so
       re-wrapping lines read as motion instead of flicker; sharp below a crawl */
    const wantR=reflowRef?Math.min(2.4, Math.max(0, Math.abs(s.v)-90)*.002):0;
    s.rblur+=(wantR-s.rblur)*(1-Math.exp(-dt*(wantR>s.rblur?30:16)));
    const rest=!s.drag && Math.abs(s.x-s.target)<.15 && Math.abs(s.v)<4 && s.blur<.05 && s.rblur<.05;
    if(rest){
      s.x=s.target; s.v=0; s.blur=0; s.rblur=0; s.raf=0;
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
      s.x=s.target; s.v=0; s.blur=0; s.rblur=0;
      cancelAnimationFrame(s.raf); s.raf=0;
      paint(); persist();
      return;
    }
    if(!s.raf){ s.t=performance.now(); s.raf=requestAnimationFrame(tick); }
  },[tick, paint, persist]);
  useLayoutEffect(()=>{ paint(); },[paint]);
  const settle=useCallback(()=>{
    const s=sim.current;
    if(s.drag) return;
    const goal=hidden.current?0:collapsedRef.current?railWidth:s.open;
    if(Math.abs(s.target-goal)<.5 && Math.abs(s.x-goal)<.5) return;
    s.target=goal;
    kick(18, .86);
  },[railWidth, kick]);
  /* external toggle (button / hotkey / controlled prop) */
  useEffect(()=>{ if(!isCollapsed) auto.current=false; settle(); },[isCollapsed, settle]);
  /* responsive: crossing a breakpoint folds / hides on the same spring, never a cut */
  const setRef=useRef(setCollapsed);
  setRef.current=setCollapsed;
  useEffect(()=>{
    const c=below(collapseBelow), h=below(hideBelow);
    const onC=()=>{
      if(c.matches){ if(!collapsedRef.current){ auto.current=true; setRef.current(true); } }
      else if(auto.current){ auto.current=false; if(collapsedRef.current) setRef.current(false); }
    };
    const onH=()=>{ hidden.current=h.matches; settle(); paint(); };
    if(c){ onC(); c.addEventListener?.('change', onC); }
    if(h){ onH(); h.addEventListener?.('change', onH); }
    return ()=>{ c?.removeEventListener?.('change', onC); h?.removeEventListener?.('change', onH); };
  },[collapseBelow, hideBelow, settle, paint]);
  useEffect(()=>()=>{ cancelAnimationFrame(sim.current.raf); sim.current.drag?.unlock?.(); },[]);

  const onDown=(e)=>{
    if(e.button!==0 || hidden.current) return;
    auto.current=false;
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
  const toggle=()=>{ auto.current=false; setCollapsed(!collapsedRef.current); };
  const onKey=(e)=>{
    const s=sim.current;
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggle(); return; }
    const step=e.shiftKey?40:16;
    if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
    e.preventDefault();
    auto.current=false;
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
