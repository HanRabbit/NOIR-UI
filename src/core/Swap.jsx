import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {cx, prefersReducedMotion} from './utils.js';
import {DUR, EASE, sampleEase, smear} from './motion.js';
import {SwapChars, toAtoms} from './SwapChars.jsx';

/*
 * Rolling cross-smear. The old layer leaves first (accelerating, so its blur and
 * stretch grow as it goes); the new one starts a beat later and decelerates in.
 * They only coexist while both are faint and heavily smeared, so text never reads
 * as two labels stacked on top of each other. Blur = motion blur from the sampled
 * speed + defocus tied to opacity; a small stretch along the travel axis makes it
 * read as directional motion rather than a soft focus pull.
 * Interrupting mid-swap continues from the live frame instead of restarting.
 * dir: 1 = new enters from below / right, -1 = from above / left.
 */
const SWAP_D=12;
const OUT_SPAN=.54;
const IN_AT=.27;
const smoothstep=(a, b, x)=>{ const t=Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };
const kf=(fr)=>fr.map(({o, off, ...k})=>k);

/*
 * Where a layer is right now, read from our own animation record rather than
 * getComputedStyle / getAnimations(): an animation still in its delay phase with
 * fill:backwards is not always reported by Chromium, which made an interrupted
 * entering label snap to full opacity.
 */
function liveState(rec){
  if(!rec) return null;
  const t=rec.anim.effect?.getComputedTiming?.();
  if(!t || t.progress==null || rec.anim.playState==='idle') return null;
  const fr=rec.frames;
  const i=Math.min(fr.length-2, Math.max(0, Math.floor(t.progress*(fr.length-1))));
  const a=fr[i], b=fr[i+1];
  const k=(t.progress-a.offset)/Math.max(1e-6, b.offset-a.offset);
  return {o:a.o+(b.o-a.o)*k, x:rec.axis==='x'?a.off+(b.off-a.off)*k:0, y:rec.axis==='x'?0:a.off+(b.off-a.off)*k};
}

/*
 * Opacity runs on time (smoothstep), position on the curve: the old layer starts
 * moving on frame one (travel curve) and is gone by ~80% of its span; the new one
 * only becomes visible once the old is nearly out. Both are at their blurriest
 * across that handoff.
 */
function frames(kind, axis, d, dur, size, from){
  const ease=kind==='out'?EASE.travel:EASE.enter;
  const ad=Math.abs(d);
  return sampleEase(ease, dur).map((f)=>{
    let off, opacity;
    if(kind==='out'){
      const start=from?(axis==='x'?from.x:from.y):0;
      off=start+(-d-start)*f.p;
      opacity=(from?from.o:1)*(1-smoothstep(.05, .8, f.offset));
    }else{
      off=d*(1-f.p);
      opacity=smoothstep(.12, .7, f.offset);
    }
    const k=smear(f.v*ad/dur, size, {maxBlur:5, gain:1.25, covered:Math.abs(f.p*ad)});
    const blur=Math.min(8, k.blur+(1-opacity)*(2.4+ad*.12));
    const st=1+(k.stretch-1)*.6;
    const sq=1-(1-k.squash)*.5;
    return {
      o:opacity,
      off,
      offset:f.offset,
      opacity,
      transform:axis==='x'
        ?`translate3d(${off.toFixed(2)}px,0,0) scale(${st.toFixed(3)},${sq.toFixed(3)})`
        :`translate3d(0,${off.toFixed(2)}px,0) scale(${sq.toFixed(3)},${st.toFixed(3)})`,
      filter:`blur(${blur.toFixed(2)}px)`,
    };
  });
}

/*
 * Every leaving layer keeps its own exit until it is fully gone, so rapid changes
 * never cut a still-visible label; the layer that was entering when interrupted
 * becomes the next leaving one and continues from its live frame.
 */
/*
 * Swap. Text-like content (strings, numbers, inline icons) morphs per character
 * with motion blur (SwapChars); block or rich content cross-smears as whole layers.
 * mode: 'auto' | 'chars' | 'layer'
 */
export function Swap({mode='auto', ...props}){
  const atoms=mode!=='layer' && !props.block && props.as!=='div'?toAtoms(props.children):null;
  if(atoms && (mode==='chars' || mode==='auto')){
    const {swapKey, className, as='span', dir=1, axis='y', distance, center=false}=props;
    return <SwapChars swapKey={swapKey} atoms={atoms} dir={dir} axis={axis} distance={distance??11} Tag={as} className={cx('nr-swap', center&&'center', className)}/>;
  }
  return <SwapLayers {...props}/>;
}

function SwapLayers({swapKey, children, className, as='span', dir=1, axis='y', distance=SWAP_D, center=false, block=false}){
  const Tag=as;
  const Layer=as==='div'||block?'div':'span';
  const rootRef=useRef(null);
  const sizeRef=useRef(null);
  const shownRef=useRef(children);
  const timers=useRef(new Set());
  const boxAnim=useRef(null);
  const recs=useRef(new Map());
  const [st,setSt]=useState({key:swapKey, seq:0, outs:[]});
  if(st.key!==swapKey){
    setSt({key:swapKey, seq:st.seq+1, outs:[{node:shownRef.current, seq:st.seq}, ...st.outs]});
  }
  useLayoutEffect(()=>{ shownRef.current=children; });
  const d=dir*distance;
  const dur=DUR.swap;
  const outDur=Math.round(dur*OUT_SPAN), inDelay=Math.round(dur*IN_AT), inDur=dur-inDelay;
  useLayoutEffect(()=>{
    const el=rootRef.current;
    const inn=el?.querySelector(`:scope > [data-seq="${st.seq}"]`);
    if(!el||!inn) return;
    const next={w:inn.offsetWidth, h:inn.offsetHeight};
    const prev=sizeRef.current;
    sizeRef.current=next;
    if(!st.outs.length) return;
    const outEl=el.querySelector(`:scope > [data-seq="${st.seq-1}"]`);
    const rec=recs.current.get(st.seq-1);
    const from=liveState(rec);
    rec?.anim.cancel();
    recs.current.delete(st.seq-1);
    const seq=st.seq-1;
    const t=setTimeout(()=>{ timers.current.delete(t); setSt((s)=>({...s, outs:s.outs.filter((o)=>o.seq!==seq)})); }, outDur+20);
    timers.current.add(t);
    if(prefersReducedMotion() || typeof inn.animate!=='function') return;
    const size=axis==='x'?Math.max(next.w, 1):Math.max(next.h, 1);
    const sign=Math.sign(d)||1;
    const lead=axis==='x'?(sign>0?'0% 50%':'100% 50%'):(sign>0?'50% 0%':'50% 100%');
    inn.style.transformOrigin=lead;
    const inFr=frames('in', axis, d, inDur, size);
    recs.current.set(st.seq, {anim:inn.animate(kf(inFr), {duration:inDur, delay:inDelay, easing:'linear', fill:'backwards'}), frames:inFr, axis});
    if(outEl){
      outEl.style.transformOrigin=lead;
      outEl.animate(kf(frames('out', axis, d, outDur, size, from)), {duration:outDur, easing:'linear', fill:'forwards'});
    }
    if(prev && !((block||prev.w===next.w) && prev.h===next.h)){
      const cs=getComputedStyle(el);
      const cw=parseFloat(cs.width)||prev.w, ch=parseFloat(cs.height)||prev.h;
      boxAnim.current?.cancel();
      el.style.overflow='hidden';
      const fromBox={height:`${ch}px`}, toBox={height:`${next.h}px`};
      if(!block){ fromBox.width=`${cw}px`; toBox.width=`${next.w}px`; }
      const a=el.animate([fromBox, toBox], {duration:DUR.travel, easing:EASE.travel.css});
      boxAnim.current=a;
      a.finished.then(()=>{ if(boxAnim.current===a) el.style.overflow=''; }, ()=>{});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[st.seq]);
  useEffect(()=>()=>{ timers.current.forEach(clearTimeout); boxAnim.current?.cancel(); recs.current.forEach((r)=>r.anim.cancel()); },[]);
  /* Layers render in creation order, so a new one only ever appends: a node that
     goes from entering to leaving is never moved in the DOM (moving it would cancel
     its running animation in Chromium). Stacking is done with z-index instead. */
  return <Tag ref={rootRef} className={cx('nr-swap', center&&'center', block&&'block', className)}>
    {[...st.outs].reverse().map((o)=><Layer className="nr-swap-layer out" aria-hidden="true" data-seq={o.seq} key={`l-${o.seq}`}>{o.node}</Layer>)}
    <Layer className="nr-swap-layer in" data-seq={st.seq} key={`l-${st.seq}`}>{children}</Layer>
  </Tag>;
}

/*
 * Collapsible region. axis="y" animates grid rows 0fr -> 1fr (no measuring);
 * axis="x" measures scrollWidth because grid columns can't animate intrinsic width.
 */
export function Fold({open, axis='y', className, children, as='div'}){
  const Tag=as;
  const ref=useRef(null);
  const [px,setPx]=useState(0);
  useLayoutEffect(()=>{
    const el=ref.current;
    if(!el) return undefined;
    if(axis!=='x') return undefined;
    const read=()=>{ const n=el.scrollWidth; if(n>1) setPx((v)=>v===n?v:n); };
    read();
    if(typeof ResizeObserver==='undefined') return undefined;
    const ro=new ResizeObserver(read);
    ro.observe(el.firstElementChild||el);
    return ()=>ro.disconnect();
  },[axis]);
  const style=axis==='x'?{width:open?(px||'auto'):0, maxWidth:open?(px||'none'):0}:undefined;
  const In=as==='span'?'span':'div';
  return <Tag className={cx('nr-fold', axis==='x'&&'x', open&&'open', className)} style={style} inert={!open||undefined} aria-hidden={!open||undefined}>
    <In className="nr-fold-inner" ref={ref}><In className="nr-fold-body">{children}</In></In>
  </Tag>;
}

export function Portal({children}){
  if(typeof document==='undefined') return null;
  return createPortal(children, document.body);
}

/* Renders a useSmearIndicator(): outer box travels, inner ink smears */
export function Thumb({thumb, className, invert=false}){
  return <i ref={thumb.outerRef} className={cx('nr-thumb', invert&&'invert', !thumb.on&&'off', className)} aria-hidden="true">
    <i ref={thumb.inkRef} className="nr-thumb-ink"/>
  </i>;
}
