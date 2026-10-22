import React, {useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import {cx, isBrowser, prefersReducedMotion} from '../core/utils.js';
import {DUR, EASE, cancelAll, sampleEase, smear} from '../core/motion.js';
import {Swap} from '../core/Swap.jsx';
import {IconMoon, IconSun} from '../core/icons.jsx';
import './Theme.css';

const KEY='noir.theme';
const subs=new Set();
const read=()=>(isBrowser && document.documentElement.dataset.theme)||'dark';
const subscribe=(f)=>{ subs.add(f); return ()=>subs.delete(f); };

function apply(next){
  document.documentElement.dataset.theme=next;
  try{ localStorage.setItem(KEY, next); }catch{ /* storage may be blocked */ }
  subs.forEach((f)=>f());
}

/* Call once before render to avoid a theme flash */
export function initTheme(fallback='dark'){
  if(!isBrowser) return;
  let t=fallback;
  try{ const s=localStorage.getItem(KEY); if(s==='light'||s==='dark') t=s; }catch{ /* ignore */ }
  document.documentElement.dataset.theme=t;
}

/*
 * setTheme(next, origin?) — with an origin {x, y} the new theme is revealed as a
 * circle growing from that point (View Transitions), otherwise it cross-fades.
 */
export function useTheme(){
  const theme=useSyncExternalStore(subscribe, read, ()=> 'dark');
  const setTheme=useCallback((next, origin)=>{
    if(next===read()) return;
    if(prefersReducedMotion() || typeof document.startViewTransition!=='function'){ apply(next); return; }
    const x=origin?.x??window.innerWidth/2;
    const y=origin?.y??0;
    const r=Math.hypot(Math.max(x, window.innerWidth-x), Math.max(y, window.innerHeight-y));
    const root=document.documentElement;
    root.classList.add('noir-theme-vt');
    const vt=document.startViewTransition(()=>{ flushSync(()=>apply(next)); });
    vt.ready.then(()=>{
      root.animate(
        {clipPath:[`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`], filter:['blur(6px)', 'blur(0px)']},
        {duration:620, easing:'cubic-bezier(.22, 1, .36, 1)', pseudoElement:'::view-transition-new(root)'},
      );
    }).catch(()=>{});
    vt.finished.finally(()=>root.classList.remove('noir-theme-vt'));
  },[]);
  const toggle=useCallback((origin)=>setTheme(read()==='dark'?'light':'dark', origin),[setTheme]);
  return {theme, setTheme, toggle};
}

export function ThemeToggle({className}){
  const {theme, toggle}=useTheme();
  return <button
    type="button"
    className={cx('nr-icon-btn nr-icon-btn-md nr-icon-btn-ghost nr-theme-toggle', className)}
    aria-label={theme==='dark'?'Switch to light theme':'Switch to dark theme'}
    title="Toggle theme"
    onClick={(e)=>{
      const r=e.currentTarget.getBoundingClientRect();
      toggle({x:r.left+r.width/2, y:r.top+r.height/2});
    }}
  >
    <Swap swapKey={theme} center>{theme==='dark'?<IconSun size={17}/>:<IconMoon size={17}/>}</Swap>
  </button>;
}

/*
 * Shared-axis page transition. Old and new pages ride the SAME travel curve in the
 * same direction, so they read as one strip sliding past; blur comes from that
 * shared velocity (zero at rest, strongest mid-flight) and the crossfade is centred
 * on peak speed, where the blur hides the overlap. Distance grows with how many
 * steps were jumped. resetScroll hands the scroll position to the leaving layer
 * before paint, so nothing jumps. Interrupting mid-flight continues from the
 * current frame instead of restarting.
 */
const smooth=(a, b, x)=>{ const t=Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };

export function PageTransition({pageKey, index=0, children, className, resetScroll=false}){
  const rootRef=useRef(null);
  const shown=useRef(children);
  const [st,setSt]=useState({key:pageKey, index, out:null, dir:1, dist:0, scroll:0, seq:0});
  if(st.key!==pageKey){
    const span=Math.abs(index-st.index)||1;
    setSt({
      key:pageKey,
      index,
      out:{key:st.key, node:shown.current},
      dir:index>=st.index?1:-1,
      dist:Math.min(120, 40+span*20),
      scroll:resetScroll&&typeof window!=='undefined'?window.scrollY:0,
      seq:st.seq+1,
    });
  }
  useLayoutEffect(()=>{ shown.current=children; });
  useLayoutEffect(()=>{
    if(!st.out) return undefined;
    const root=rootRef.current;
    const inEl=root?.querySelector(':scope > [data-page="in"]');
    const outEl=root?.querySelector(':scope > [data-page="out"]');
    if(resetScroll && st.scroll){
      window.scrollTo({top:0, behavior:'instant'});
      if(outEl) outEl.style.top=`${-st.scroll}px`;
    }
    const done=()=>setSt((s)=>s.seq===st.seq?{...s, out:null}:s);
    if(!inEl || prefersReducedMotion() || typeof inEl.animate!=='function'){ done(); return undefined; }
    /* where an interrupted page currently is, so the next move continues from there */
    const live=(el)=>{
      if(!el || !el.getAnimations().length) return null;
      const cs=getComputedStyle(el);
      const m=new DOMMatrixReadOnly(cs.transform==='none'?undefined:cs.transform);
      return {y:m.m42, o:parseFloat(cs.opacity)};
    };
    const fromOut=live(outEl);
    cancelAll(inEl); cancelAll(outEl);
    const {dir, dist}=st;
    const D=dist*dir;
    const dur=DUR.page;
    const frames=sampleEase(EASE.travel, dur);
    const y0=fromOut?fromOut.y:0, o0=fromOut?fromOut.o:1;
    const blurAt=(f)=>smear(f.v*dist/dur, 400, {maxBlur:12, gain:1.75, covered:f.p*dist}).blur;
    inEl.animate(frames.map((f)=>({
      offset:f.offset,
      transform:`translate3d(0,${(D*(1-f.p)).toFixed(2)}px,0)`,
      opacity:smooth(.04, .5, f.p),
      filter:`blur(${blurAt(f).toFixed(2)}px)`,
    })), {duration:dur, easing:'linear', fill:'backwards'});
    if(outEl){
      outEl.animate(frames.map((f)=>({
        offset:f.offset,
        transform:`translate3d(0,${(y0-D*f.p).toFixed(2)}px,0)`,
        opacity:o0*(1-smooth(.02, .42, f.p)),
        filter:`blur(${blurAt(f).toFixed(2)}px)`,
      })), {duration:dur, easing:'linear', fill:'forwards'});
    }
    const t=setTimeout(done, dur);
    return ()=>clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[st.seq]);
  return <div ref={rootRef} className={cx('nr-page', className)}>
    {/* leaving page first: on A→B→A the reused node never moves (a move would cancel its animation) */}
    {st.out&&<div data-page="out" key={`p-${String(st.out.key)}`} aria-hidden="true" inert>{st.out.node}</div>}
    <div data-page="in" key={`p-${String(st.key)}`}>{children}</div>
  </div>;
}
