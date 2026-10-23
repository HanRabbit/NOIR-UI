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

/* Words are atoms; a run with no whitespace (`--nr-` + ".") stays one atom so
   punctuation never wraps away from what it follows */
const text=(n)=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
function atoms(children){
  const out=[];
  let run=[], k=0;
  const flush=()=>{ if(run.length){ out.push(<span key={k++} className="nr-flow-w">{run}</span>); run=[]; } };
  React.Children.toArray(children).forEach((c, i)=>{
    if(typeof c==='string' || typeof c==='number'){
      String(c).split(/(\s+)/).forEach((part, j)=>{
        if(!part) return;
        if(/^\s+$/.test(part)){ flush(); out.push(part); }
        else run.push(<React.Fragment key={`${i}.${j}`}>{part}</React.Fragment>);
      });
    }else if(/\s/.test(text(c))){ flush(); out.push(c); }  // a phrase must still be able to wrap
    else run.push(c);
  });
  flush();
  return out;
}

/*
 * Text that reflows in motion. When its line breaks change (a breakpoint, the
 * sidebar, a window resize), every word that moved glides to its new line,
 * blurred by its own speed, instead of jumping. The root must be a block box.
 */
export function FlowText({as='p', className, children, disabled, stagger=4, maxBlur=4, ...rest}){
  const Tag=as;
  const ref=useRef(null);
  useLayoutMotion(ref, {disabled, scale:false, stagger, maxBlur});
  return <Tag ref={ref} className={cx('nr-flow', className)} {...rest}>{atoms(children)}</Tag>;
}
