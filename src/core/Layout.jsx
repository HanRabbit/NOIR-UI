import React, {useLayoutEffect, useRef} from 'react';
import {cx, prefersReducedMotion} from './utils.js';
import {DUR, EASE, lerp, sampleEase, smear} from './motion.js';

/*
 * Layout motion. Children of the group never teleport when the layout reflows -
 * a breakpoint changing the column count, a row wrapping, a sibling appearing or
 * leaving: each child travels FLIP-style from where it was drawn to its new box on
 * the travel curve, blurred by its own sampled speed, so a reflow reads as one
 * motion-blurred move instead of a cut.
 *
 * Continuous change is left alone so direct manipulation stays crisp: a container
 * resizing smoothly (sidebar spring, window drag), or a layout CSS transition /
 * animation running inside the group, moves children a little every frame - only
 * a discontinuity (a large jump, or one out of a still layout) animates.
 * Interrupting mid-flight continues from the drawn frame.
 */
const STILL=8;      // px a child must jump, beyond what the container's own resize explains
const LEAP=48;      // jumps this large animate even while the layout is already moving
const QUIET_MS=60;  // a child that changed this recently is in continuous motion
const LAYOUT_PROPS=/^(width|height|min-|max-|grid-template|margin|padding|flex|gap|inset|top|left|right|bottom|all)/;

/* Layout position through the offsetParent chain: transforms (ours, or a page
   transition on an ancestor) never leak in */
function origin(el){
  let x=0, y=0;
  for(let n=el;n;n=n.offsetParent){ x+=n.offsetLeft+(n===el?0:n.clientLeft); y+=n.offsetTop+(n===el?0:n.clientTop); }
  return {x, y};
}
function box(el, base){
  if(!(el instanceof HTMLElement) || !el.offsetParent) return null;
  const o=origin(el);
  return {x:o.x-base.x, y:o.y-base.y, w:el.offsetWidth, h:el.offsetHeight};
}

/* Is something inside the group already animating layout (Fold, Swap width, accordion…)? */
function layoutBusy(root, own){
  for(const a of root.getAnimations?.({subtree:true})??[]){
    if(a.playState!=='running' || own.has(a)) continue;
    if(a.transitionProperty){ if(LAYOUT_PROPS.test(a.transitionProperty)) return true; continue; }
    const kf=a.effect?.getKeyframes?.()?.[0];
    if(kf && Object.keys(kf).some((k)=>LAYOUT_PROPS.test(k.replace(/[A-Z]/g, (c)=>`-${c.toLowerCase()}`)))) return true;
  }
  return false;
}

/* The frame a child is drawn at right now, from our own record (origin 0 0) */
function drawn(rec){
  const t=rec?.anim.effect?.getComputedTiming?.();
  if(!t || t.progress==null || rec.anim.playState==='idle' || rec.anim.playState==='finished') return null;
  const fr=rec.frames;
  const i=Math.min(fr.length-2, Math.max(0, Math.floor(t.progress*(fr.length-1))));
  const a=fr[i], b=fr[i+1];
  const k=(t.progress-a.offset)/Math.max(1e-6, b.offset-a.offset);
  return {tx:lerp(a.tx, b.tx, k), ty:lerp(a.ty, b.ty, k), sx:lerp(a.sx, b.sx, k), sy:lerp(a.sy, b.sy, k)};
}

/* Children that can carry a counter-transform: only when every piece of content
   is a transformable box (no bare text, no inline elements) */
function correctable(el){
  const out=[];
  for(const n of el.childNodes){
    if(n.nodeType===3){ if(n.data.trim()) return []; continue; }
    if(!(n instanceof HTMLElement)) continue;
    const d=getComputedStyle(n).display;
    if(d==='none' || d==='contents') continue;
    if(d==='inline') return [];
    out.push(n);
  }
  return out;
}

/*
 * scale: true  - size changes are part of the move (FLIP scale); the box's element
 *                children are counter-scaled so their text keeps its proportions
 *                (bare text that can't be corrected is defocused while deformed).
 *        false - position only (for tall sections whose own children animate).
 */
export function useLayoutMotion(ref, {disabled=false, scale=true, stagger=10, maxBlur=5}={}){
  const opts=useRef({scale, stagger, maxBlur});
  opts.current={scale, stagger, maxBlur};
  useLayoutEffect(()=>{
    const root=ref.current;
    if(!root || disabled || typeof ResizeObserver==='undefined') return undefined;
    const cache=new Map();
    const recs=new Map();
    const own=new Set();
    let size={w:root.clientWidth, h:root.clientHeight};
    let ready=false, dead=false, fontsAt=-Infinity;
    const added=new Set();
    const kids=()=>[...root.children];

    const animate=(el, from, to, i)=>{
      const prev=recs.get(el);
      const live=drawn(prev);
      if(prev){ for(const a of prev.all){ own.delete(a); a.cancel(); } recs.delete(el); }
      /* the old box as it is drawn now, expressed against the new layout box */
      const ox=live?from.x+live.tx:from.x, oy=live?from.y+live.ty:from.y;
      const ow=live?from.w*live.sx:from.w, oh=live?from.h*live.sy:from.h;
      const {scale:resize, maxBlur:mb}=opts.current;
      const sx=resize&&to.w?ow/to.w:1, sy=resize&&to.h?oh/to.h:1;
      const tx=ox-to.x, ty=oy-to.y;
      const dcx=tx+(to.w*sx-to.w)/2, dcy=ty+(to.h*sy-to.h)/2;
      const dist=Math.hypot(dcx, dcy, Math.max(Math.abs(to.w*sx-to.w), Math.abs(to.h*sy-to.h))/2);
      if(dist<.75) return;
      const dur=DUR.travel;
      const along=Math.abs(dcx)>=Math.abs(dcy)?to.w:to.h;
      /* content is counter-scaled so text keeps its proportions and rides along;
         only a box whose content can't be corrected (bare text) defocuses instead */
      const inner=sx!==1||sy!==1?correctable(el):[];
      const frames=sampleEase(EASE.travel, dur).map((f)=>{
        const fsx=lerp(sx, 1, f.p), fsy=lerp(sy, 1, f.p);
        const motion=smear(f.v*dist/dur, along, {maxBlur:mb, covered:f.p*dist}).blur;
        /* defocus while deformed; ramps in so the first frame matches the old box */
        const dev=Math.max(Math.abs(Math.log(fsx)), Math.abs(Math.log(fsy)));
        const ramp=Math.min(1, f.offset/.16);
        const defocus=inner.length?0:Math.min(2.5, dev*6)*ramp*ramp*(3-2*ramp);
        return {offset:f.offset, tx:tx*(1-f.p), ty:ty*(1-f.p), sx:fsx, sy:fsy, blur:Math.min(mb, Math.hypot(motion, defocus))};
      });
      const timing={duration:dur, delay:Math.min(i*opts.current.stagger, 60), easing:'linear', fill:'backwards'};
      const anim=el.animate(frames.map((f)=>({
        offset:f.offset,
        transformOrigin:'0 0',
        transform:`translate3d(${f.tx.toFixed(2)}px,${f.ty.toFixed(2)}px,0) scale(${f.sx.toFixed(4)},${f.sy.toFixed(4)})`,
        filter:`blur(${f.blur.toFixed(2)}px)`,
      })), timing);
      /* scale about the child's own top-left, added on top of whatever transform it has */
      const counter=inner.map((c)=>{
        const [ox, oy]=getComputedStyle(c).transformOrigin.split(' ').map(parseFloat);
        return c.animate(frames.map((f)=>{
          const kx=1/f.sx, ky=1/f.sy;
          return {offset:f.offset, transform:`translate(${((kx-1)*(ox||0)).toFixed(2)}px,${((ky-1)*(oy||0)).toFixed(2)}px) scale(${kx.toFixed(4)},${ky.toFixed(4)})`};
        }), {...timing, composite:'add'});
      });
      const rec={anim, frames, all:[anim, ...counter]};
      recs.set(el, rec);
      for(const a of rec.all){
        own.add(a);
        a.finished.then(()=>own.delete(a), ()=>own.delete(a));
      }
      anim.finished.then(()=>{ if(recs.get(el)===rec) recs.delete(el); }, ()=>{});
    };

    const snapshot=()=>{
      const base=origin(root);
      cache.clear();
      for(const el of kids()){ const b=box(el, base); if(b) cache.set(el, {...b, t:0}); }
      size={w:root.clientWidth, h:root.clientHeight};
    };

    const check=()=>{
      if(dead) return;
      if(!ready || document.fonts?.status==='loading' || performance.now()-fontsAt<150 || prefersReducedMotion() || typeof root.animate!=='function'){ snapshot(); return; }
      const now=performance.now();
      const W=root.clientWidth, H=root.clientHeight;
      const base=origin(root);
      /* how much of a move the container's own resize explains (grids scale, rows don't) */
      const rx=size.w?W/size.w:1, ry=size.h?H/size.h:1;
      const changed=[];
      let jump=0, quiet=true;
      const seen=new Set();
      for(const el of kids()){
        const b=box(el, base);
        seen.add(el);
        if(!b){ cache.delete(el); continue; }
        const a=cache.get(el);
        if(!a){
          cache.set(el, {...b, t:now});
          /* a newcomer resolves out of blur in place while the others make room */
          if(added.has(el)) el.animate({opacity:[0, 1], transform:['scale(.94)', 'none'], filter:['blur(6px)', 'blur(0px)']}, {duration:DUR.travel, delay:60, easing:EASE.enter.css, fill:'backwards'});
          continue;
        }
        const d=Math.max(Math.abs(b.x-a.x), Math.abs(b.y-a.y), Math.abs(b.w-a.w), Math.abs(b.h-a.h));
        if(d<.5) continue;
        const res=Math.max(
          Math.min(Math.abs(b.x-a.x), Math.abs(b.x-a.x*rx)),
          Math.min(Math.abs(b.y-a.y), Math.abs(b.y-a.y*ry)),
          Math.min(Math.abs(b.w-a.w), Math.abs(b.w-a.w*rx)),
          Math.min(Math.abs(b.h-a.h), Math.abs(b.h-a.h*ry)),
        );
        if(now-a.t<QUIET_MS) quiet=false;
        jump=Math.max(jump, res);
        changed.push([el, a, b]);
      }
      for(const el of cache.keys()) if(!seen.has(el)) cache.delete(el);
      added.clear();
      size={w:W, h:H};
      if(!changed.length) return;
      /* one decision per group, so neighbours always glide together */
      const go=jump>=LEAP || (jump>=STILL && quiet && !layoutBusy(root, own));
      changed.forEach(([el, a, b], i)=>{
        if(go) animate(el, a, b, i);
        cache.set(el, {...b, t:now});
      });
    };

    snapshot();
    const ro=new ResizeObserver(check);
    ro.observe(root);
    for(const el of kids()) ro.observe(el);
    /* children added / removed: the rest close or open the gap */
    const mo=new MutationObserver((list)=>{
      for(const m of list) for(const n of m.addedNodes) if(n instanceof Element){ ro.observe(n); if(ready) added.add(n); }
      check();
    });
    mo.observe(root, {childList:true});
    /* armed from the second frame (mount / first paint is not a change); a web
       font finishing later re-baselines instead of animating its reflow */
    let raf=requestAnimationFrame(()=>{ raf=requestAnimationFrame(()=>{ if(!dead){ snapshot(); ready=true; } }); });
    const onFonts=()=>{ fontsAt=performance.now(); snapshot(); };
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    return ()=>{
      dead=true;
      cancelAnimationFrame(raf);
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      ro.disconnect();
      mo.disconnect();
      recs.forEach((r)=>r.all.forEach((a)=>a.cancel()));
    };
  },[ref, disabled]);
}

/* A container whose direct children travel, motion-blurred, whenever the layout reflows */
export function LayoutGroup({as='div', className, style, children, disabled, scale, stagger, maxBlur, ...rest}){
  const Tag=as;
  const ref=useRef(null);
  useLayoutMotion(ref, {disabled, scale, stagger, maxBlur});
  return <Tag ref={ref} className={className} style={style} {...rest}>{children}</Tag>;
}

/* Line boxes of a block's text, as a signature: rewrapping changes it, a width
   change that keeps every line intact (or a move) does not */
function lines(el){
  const r=document.createRange();
  r.selectNodeContents(el);
  const top=el.getBoundingClientRect().top;
  let sig='';
  for(const b of r.getClientRects()) if(b.width>0) sig+=`${Math.round(b.width)},${Math.round(b.top-top)};`;
  return sig;
}

/*
 * Text that reflows in motion. When its line breaks change (a breakpoint, the
 * sidebar, a window resize), the paragraph as a whole passes through a short
 * speed-shaped defocus instead of cutting to the new wrap. One animation on one
 * element, composited - no per-word boxes. A rewrap during the pulse continues
 * from the blur currently drawn. The root must be a block box.
 */
export function FlowText({as='p', className, children, disabled, maxBlur=3, ...rest}){
  const Tag=as;
  const ref=useRef(null);
  const mb=useRef(maxBlur);
  mb.current=maxBlur;
  useLayoutEffect(()=>{
    const el=ref.current;
    if(!el || disabled || typeof ResizeObserver==='undefined') return undefined;
    let sig=null, ready=false, dead=false, fontsAt=-Infinity, visible=true, anim=null, peak=0, last=-Infinity, rebase=0;
    /* blur the paragraph is drawn with right now, read from our own curve */
    const level=()=>{
      const p=anim?.effect?.getComputedTiming?.().progress;
      if(p==null || anim.playState!=='running') return 0;
      return p<.3?lerp(anim.from, peak, p/.3):lerp(peak, 0, (p-.3)/.7);
    };
    const pulse=()=>{
      const from=level();
      peak=mb.current;
      if(!(peak>0)) return;
      anim?.cancel();
      anim=el.animate([
        {offset:0, filter:`blur(${from.toFixed(2)}px)`, opacity:1-Math.min(1, from/peak)*.18},
        {offset:.3, filter:`blur(${peak}px)`, opacity:.82, easing:EASE.enter.css},
        {offset:1, filter:'blur(0px)', opacity:1},
      ], {duration:DUR.travel, easing:'linear'});
      anim.from=from;
    };
    const base=()=>{ sig=visible?lines(el):null; };
    const check=()=>{
      if(dead) return;
      if(!visible){ sig=null; return; }   // off screen: re-baseline when it comes back
      /* a continuous resize (sidebar spring, window drag) stays crisp and costs
         nothing per frame; the wrap is re-read once it has settled */
      const now=performance.now();
      const moving=now-last<QUIET_MS;
      last=now;
      clearTimeout(rebase);
      if(moving){ sig=null; rebase=setTimeout(base, QUIET_MS*2); return; }
      const next=lines(el);
      const prev=sig;
      sig=next;
      if(prev==null || prev===next || !ready) return;
      if(document.fonts?.status==='loading' || performance.now()-fontsAt<150 || prefersReducedMotion() || typeof el.animate!=='function') return;
      pulse();
    };
    sig=lines(el);
    const ro=new ResizeObserver(check);
    ro.observe(el);
    const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([e])=>{ visible=e.isIntersecting; if(visible && sig==null) base(); });
    io?.observe(el);
    let raf=requestAnimationFrame(()=>{ raf=requestAnimationFrame(()=>{ if(!dead){ base(); ready=true; } }); });
    const onFonts=()=>{ fontsAt=performance.now(); base(); };
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    return ()=>{
      dead=true;
      cancelAnimationFrame(raf);
      clearTimeout(rebase);
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      ro.disconnect();
      io?.disconnect();
      anim?.cancel();
    };
  },[disabled]);
  return <Tag ref={ref} className={cx('nr-flow', className)} {...rest}>{children}</Tag>;
}
