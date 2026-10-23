import {useCallback, useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {SMEAR_MS, prefersReducedMotion} from './utils.js';
import {DUR, EASE, cancelAll, lerp, sampleEase, smear} from './motion.js';

export function useControllable(value, defaultValue, onChange){
  const [inner,setInner]=useState(defaultValue);
  const controlled=value!==undefined;
  const current=controlled?value:inner;
  const set=useCallback((next)=>{
    if(!controlled) setInner(next);
    onChange?.(next);
  },[controlled, onChange]);
  return [current, set];
}

/* Mount → paint closed state → open; on close keep mounted until the exit smear ends */
export function usePresence(open, ms=SMEAR_MS){
  const [alive,setAlive]=useState(Boolean(open));
  const [shown,setShown]=useState(false);
  useLayoutEffect(()=>{
    if(open){
      setAlive(true);
      let b=0;
      const a=requestAnimationFrame(()=>{ b=requestAnimationFrame(()=>setShown(true)); });
      return ()=>{ cancelAnimationFrame(a); cancelAnimationFrame(b); };
    }
    setShown(false);
    const t=setTimeout(()=>setAlive(false), ms);
    return ()=>clearTimeout(t);
  },[open, ms]);
  return {alive, shown, leaving:alive && !open};
}

/* Freeze content while a surface is leaving so it does not flash empty */
export function useHold(value, open){
  const ref=useRef(value);
  if(open) ref.current=value;
  return ref.current;
}

export function useDismiss(open, refs, onDismiss, {escape=true, outside=true}={}){
  const cb=useRef(onDismiss);
  cb.current=onDismiss;
  useEffect(()=>{
    if(!open) return undefined;
    const inside=(t)=>refs.some((r)=>r.current?.contains(t));
    const onDown=(e)=>{ if(outside && !inside(e.target)) cb.current?.('outside', e); };
    const onKey=(e)=>{ if(escape && e.key==='Escape'){ e.stopPropagation(); cb.current?.('escape', e); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return ()=>{
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  },[open, escape, outside]);
}

/*
 * Fixed-position anchoring with flip. The side is locked for the lifetime of one
 * open so the surface never jumps sides while scrolling.
 */
export function useAnchor(open, anchorRef, {placement='bottom', align='start', offset=6, width, minWidth=0, maxHeight=280}={}){
  const [box,setBox]=useState(null);
  const lock=useRef(null);
  const place=useCallback(()=>{
    const el=anchorRef.current;
    if(!el) return;
    /* under CSS zoom, rects are zoomed but a fixed element's left/top get zoomed
       again: work in the portal's own (unzoomed) coordinate space */
    const z=document.body.currentCSSZoom||1;
    const rr=el.getBoundingClientRect();
    const r={left:rr.left/z, right:rr.right/z, top:rr.top/z, bottom:rr.bottom/z, width:rr.width/z, height:rr.height/z};
    const vw=window.innerWidth/z, vh=window.innerHeight/z;
    const vertical=placement==='top'||placement==='bottom';
    let side=lock.current;
    if(!side){
      side=placement;
      if(placement==='bottom' && vh-r.bottom<160 && r.top>vh-r.bottom) side='top';
      else if(placement==='top' && r.top<160 && vh-r.bottom>r.top) side='bottom';
      else if(placement==='right' && vw-r.right<220 && r.left>vw-r.right) side='left';
      else if(placement==='left' && r.left<220 && vw-r.right>r.left) side='right';
      lock.current=side;
    }
    const w=width==='anchor'?Math.max(r.width, minWidth):width;
    const next={side, width:w};
    if(vertical){
      const est=w||minWidth||0;
      if(!w && align==='end'){ next.right=Math.round(vw-r.right); }
      else if(!w && align==='center'){ next.left=Math.round(r.left+r.width/2); next.center=true; }
      else{
        let left=align==='end'?r.right-est:align==='center'?r.left+r.width/2-est/2:r.left;
        left=Math.max(8, Math.min(left, vw-est-8));
        next.left=Math.round(left);
      }
      if(side==='bottom'){ next.top=Math.round(r.bottom+offset); next.maxH=Math.min(maxHeight, vh-r.bottom-offset-12); }
      else { next.bottom=Math.round(vh-r.top+offset); next.maxH=Math.min(maxHeight, r.top-offset-12); }
    }else{
      next.top=Math.round(r.top+r.height/2);
      next.middle=true;
      if(side==='right') next.left=Math.round(r.right+offset);
      else next.right=Math.round(vw-r.left+offset);
      next.maxH=maxHeight;
    }
    setBox(next);
  },[anchorRef, placement, align, offset, width, minWidth, maxHeight]);
  useLayoutEffect(()=>{
    if(!open){ lock.current=null; return undefined; }
    place();
    const onMove=()=>place();
    window.addEventListener('resize', onMove);
    document.addEventListener('scroll', onMove, true);
    return ()=>{
      window.removeEventListener('resize', onMove);
      document.removeEventListener('scroll', onMove, true);
    };
  },[open, place]);
  return [box, place];
}

export function anchorStyle(box){
  if(!box) return {visibility:'hidden'};
  const s={position:'fixed', maxHeight:box.maxH};
  if(box.width) s.width=box.width;
  if(box.left!=null) s.left=box.left;
  if(box.right!=null) s.right=box.right;
  if(box.top!=null) s.top=box.top;
  if(box.bottom!=null) s.bottom=box.bottom;
  const tx=box.center?'-50%':'0';
  const ty=box.middle?'-50%':'0';
  if(box.center||box.middle) s.translate=`${tx} ${ty}`;
  return s;
}

/*
 * Indicator that travels between items. The outer box moves with EASE.travel over
 * a duration set by distance; the inner ink stretches toward its trailing edge and
 * blurs in proportion to the *instantaneous* speed sampled from that same curve,
 * so smear peaks exactly when the thumb is fastest and vanishes as it lands.
 */
export function useSmearIndicator(rootRef, selector, deps=[]){
  const outerRef=useRef(null);
  const inkRef=useRef(null);
  const last=useRef(null);
  const travel=useRef(null);
  const [on,setOn]=useState(false);
  const apply=(r)=>{
    const o=outerRef.current;
    if(!o) return;
    o.style.transform=`translate3d(${r.x}px,${r.y}px,0)`;
    o.style.width=`${r.w}px`;
    o.style.height=`${r.h}px`;
  };
  const place=useCallback((animate)=>{
    const root=rootRef.current, o=outerRef.current, ink=inkRef.current;
    if(!root || !o) return;
    const el=root.querySelector(selector);
    if(!el){
      if(last.current) last.current={...last.current, on:false};
      setOn(false);
      return;
    }
    /* offsetLeft/Top round to whole pixels; measure the sub-pixel centre instead
       (centre is stable while the target is scaled on :active); per-axis scale
       so a zoomed or layout-animating ancestor cancels out */
    const rr=root.getBoundingClientRect(), er=el.getBoundingClientRect();
    const kx=root.offsetWidth?rr.width/root.offsetWidth:1;
    const ky=root.offsetHeight?rr.height/root.offsetHeight:kx;
    const w=el.offsetWidth, h=el.offsetHeight;
    const to={
      x:(er.left+er.width/2-rr.left)/kx-root.clientLeft+root.scrollLeft-w/2,
      y:(er.top+er.height/2-rr.top)/ky-root.clientTop+root.scrollTop-h/2,
      w, h, on:true,
    };
    const prev=last.current;
    last.current=to;
    setOn(true);
    if(!animate || !prev || prefersReducedMotion() || typeof o.animate!=='function'){
      cancelAll(o); cancelAll(ink); apply(to);
      return;
    }
    if(!prev.on){
      cancelAll(o); apply(to);
      ink?.animate({opacity:[0, 1], transform:['scale(.92)', 'none'], filter:['blur(4px)', 'blur(0px)']}, {duration:160, easing:EASE.enter.css});
      return;
    }
    /* start from wherever an interrupted animation currently is */
    const cs=getComputedStyle(o);
    const m=new DOMMatrixReadOnly(cs.transform==='none'?undefined:cs.transform);
    const from={x:m.m41, y:m.m42, w:parseFloat(cs.width)||prev.w, h:parseFloat(cs.height)||prev.h};
    cancelAll(o); cancelAll(ink);
    apply(to);
    const dx=to.x-from.x, dy=to.y-from.y;
    const vertical=Math.abs(dy)>Math.abs(dx);
    const dist=Math.hypot(dx, dy);
    if(dist<1 && Math.abs(to.w-from.w)<1 && Math.abs(to.h-from.h)<1) return;
    const dur=DUR.travel;
    const frames=sampleEase(EASE.travel, dur);
    const ratio=ink&&o.offsetWidth?(vertical?ink.offsetHeight/o.offsetHeight:ink.offsetWidth/o.offsetWidth)||1:1;
    const ta=o.animate(frames.map((f)=>({
      offset:f.offset,
      transform:`translate3d(${lerp(from.x, to.x, f.p)}px,${lerp(from.y, to.y, f.p)}px,0)`,
      width:`${lerp(from.w, to.w, f.p)}px`,
      height:`${lerp(from.h, to.h, f.p)}px`,
    })), {duration:dur, easing:'linear'});
    travel.current=ta;
    ta.finished.then(()=>{ if(travel.current===ta){ travel.current=null; placeRef.current?.(false); } }, ()=>{});
    if(ink && dist>=1){
      const sign=vertical?Math.sign(dy):Math.sign(dx);
      /* anchor at the leading edge so the trail extends behind the motion */
      ink.style.transformOrigin=vertical?(sign>0?'50% 100%':'50% 0%'):(sign>0?'100% 50%':'0% 50%');
      ink.animate(frames.map((f)=>{
        const size=(vertical?lerp(from.h, to.h, f.p):lerp(from.w, to.w, f.p))*ratio;
        const k=smear(f.v*dist/dur, size, {covered:f.p*dist});
        return {
          offset:f.offset,
          transform:vertical?`scale(${k.squash},${k.stretch})`:`scale(${k.stretch},${k.squash})`,
          filter:`blur(${k.blur.toFixed(2)}px)`,
        };
      }), {duration:dur, easing:'linear'});
    }
  },[rootRef, selector]);
  const placeRef=useRef(null);
  placeRef.current=place;
  const mounted=useRef(false);
  const roRef=useRef(null);
  useLayoutEffect(()=>{
    place(mounted.current);
    mounted.current=true;
    /* items can move without the root resizing (e.g. a late web font widening a label) */
    const root=rootRef.current;
    if(root && roRef.current) for(const c of root.children) roRef.current.observe(c);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },deps);
  useLayoutEffect(()=>{
    const root=rootRef.current;
    if(!root) return undefined;
    const settle=()=>{ if(travel.current?.playState!=='running') place(false); };
    const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(settle);
    roRef.current=ro;
    if(ro){ ro.observe(root); for(const c of root.children) ro.observe(c); }
    document.fonts?.addEventListener?.('loadingdone', settle);
    return ()=>{ ro?.disconnect(); roRef.current=null; document.fonts?.removeEventListener?.('loadingdone', settle); };
  },[place, rootRef]);
  return {outerRef, inkRef, on, place};
}

/* Material-style ink, but monochrome and blurred out as it expands */
export function useRipple(disabled=false){
  return useCallback((e)=>{
    if(disabled || prefersReducedMotion()) return;
    const host=e.currentTarget;
    const r=host.getBoundingClientRect();
    const size=Math.hypot(r.width, r.height)*2.1;
    const dot=document.createElement('span');
    dot.className='nr-ripple';
    dot.style.width=dot.style.height=`${size}px`;
    dot.style.left=`${e.clientX-r.left}px`;
    dot.style.top=`${e.clientY-r.top}px`;
    host.appendChild(dot);
    dot.addEventListener('animationend', ()=>dot.remove(), {once:true});
  },[disabled]);
}

/* Writes pointer position into CSS vars for spotlight / sheen effects */
export function useSpotlight(){
  return useCallback((e)=>{
    const el=e.currentTarget;
    const r=el.getBoundingClientRect();
    el.style.setProperty('--nr-px', `${e.clientX-r.left}px`);
    el.style.setProperty('--nr-py', `${e.clientY-r.top}px`);
  },[]);
}

/* Pulls an element a few px toward the pointer; returns handlers */
export function useMagnetic(strength=0.22, enabled=true){
  const onPointerMove=useCallback((e)=>{
    if(!enabled || e.pointerType!=='mouse') return;
    const el=e.currentTarget;
    const r=el.getBoundingClientRect();
    const dx=(e.clientX-(r.left+r.width/2))*strength;
    const dy=(e.clientY-(r.top+r.height/2))*strength;
    el.style.setProperty('--nr-mag', `${dx.toFixed(1)}px ${dy.toFixed(1)}px`);
  },[strength, enabled]);
  const onPointerLeave=useCallback((e)=>{ e.currentTarget.style.setProperty('--nr-mag', '0px 0px'); },[]);
  return enabled?{onPointerMove, onPointerLeave}:{};
}

export function useInView(ref, {once=true, rootMargin='0px 0px -8% 0px'}={}){
  const [seen,setSeen]=useState(false);
  useEffect(()=>{
    const el=ref.current;
    if(!el) return undefined;
    if(typeof IntersectionObserver==='undefined'){ setSeen(true); return undefined; }
    const io=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){ setSeen(true); if(once) io.disconnect(); }
      else if(!once) setSeen(false);
    },{rootMargin});
    io.observe(el);
    return ()=>io.disconnect();
  },[ref, once, rootMargin]);
  return seen;
}

/* Restart a one-shot CSS animation by flipping between two class names */
export function useParity(){
  const [p,setP]=useState(0);
  const bump=useCallback(()=>setP((v)=>v===1?2:1),[]);
  return [p, bump];
}

export const useStableId=(prefix='nr')=>`${prefix}-${useId().replace(/:/g, '')}`;

/* "mod+k", "shift+/", "escape" — mod = ⌘ on mac, Ctrl elsewhere */
export function useHotkey(combo, handler, {enabled=true}={}){
  const cb=useRef(handler);
  cb.current=handler;
  useEffect(()=>{
    if(!enabled) return undefined;
    const parts=combo.toLowerCase().split('+');
    const key=parts.pop();
    const mod=parts.includes('mod'), shift=parts.includes('shift'), alt=parts.includes('alt');
    const on=(e)=>{
      if(mod!==(e.metaKey||e.ctrlKey) || shift!==e.shiftKey || alt!==e.altKey) return;
      if(e.key.toLowerCase()!==key) return;
      e.preventDefault();
      cb.current?.(e);
    };
    window.addEventListener('keydown', on);
    return ()=>window.removeEventListener('keydown', on);
  },[combo, enabled]);
}

/* Roving active index for listboxes / menus, with typeahead */
export function useListNav(items, {onPick, loop=true, typeahead=true}={}){
  const [active,setActive]=useState(-1);
  const buf=useRef({s:'', t:0});
  const ok=(i)=>Boolean(items[i]) && !items[i].disabled && !items[i].separator;
  const step=(from, d)=>{
    const n=items.length;
    let i=from;
    for(let k=0;k<n;k++){
      i+=d;
      if(i<0||i>=n){ if(!loop) return from; i=(i+n)%n; }
      if(ok(i)) return i;
    }
    return from;
  };
  const onKeyDown=(e)=>{
    const k=e.key;
    if(k==='ArrowDown'){ e.preventDefault(); setActive((a)=>step(a<0?-1:a, 1)); }
    else if(k==='ArrowUp'){ e.preventDefault(); setActive((a)=>step(a<0?items.length:a, -1)); }
    else if(k==='Home'){ e.preventDefault(); setActive(step(-1, 1)); }
    else if(k==='End'){ e.preventDefault(); setActive(step(items.length, -1)); }
    else if(k==='Enter' || (k===' ' && e.target.tagName!=='INPUT')){
      if(ok(active)){ e.preventDefault(); onPick?.(items[active], active); }
    }else if(typeahead && k.length===1 && !e.metaKey && !e.ctrlKey && e.target.tagName!=='INPUT'){
      const now=Date.now();
      buf.current.s=(now-buf.current.t>650?'':buf.current.s)+k.toLowerCase();
      buf.current.t=now;
      const i=items.findIndex((it, j)=>ok(j) && String(it.label??'').toLowerCase().startsWith(buf.current.s));
      if(i>=0) setActive(i);
    }
  };
  return {active, setActive, onKeyDown};
}
