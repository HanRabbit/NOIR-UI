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

/* Line boxes of the text, as a signature: rewrapping changes it, a width change
   that keeps every line intact (or a move) does not */
function lines(el){
  const r=document.createRange();
  r.selectNodeContents(el);
  const top=el.getBoundingClientRect().top;
  let sig='';
  for(const b of r.getClientRects()) if(b.width>0) sig+=`${Math.round(b.width)},${Math.round(b.top-top)};`;
  return sig;
}
const CJK=/[⺀-鿿가-힯豈-﫿＀-￯]/;
const SPACE=/\s/, SOFT=/[\s\-‐-—/]/;
const PAD=8;          // px a piece's clip reaches past its line, for overhangs and descenders
const MAX_PIECES=32;  // beyond this a paragraph just rewraps
function textNodes(root){
  const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out=[];
  for(let n=w.nextNode();n;n=w.nextNode()) out.push(n);
  return out;
}
/* every place a line can begin: word starts, after a hyphen or dash, each CJK character */
function starts(nodes){
  const out=[];
  let prev=' ';
  nodes.forEach((n, i)=>{
    const s=n.data;
    for(let k=0;k<s.length;k++){
      const c=s[k];
      if(!SPACE.test(c) && (k===0 || SOFT.test(prev) || CJK.test(c) || CJK.test(prev))) out.push([i, k]);
      prev=c;
    }
  });
  return out;
}
/* where each of those is drawn, in the content box of `el`, and on which line */
function place(el, nodes, at){
  const r=document.createRange();
  const eb=el.getBoundingClientRect(), k=eb.width/el.offsetWidth||1, cs=getComputedStyle(el);
  const ox=eb.left+(el.clientLeft+parseFloat(cs.paddingLeft))*k, oy=eb.top+(el.clientTop+parseFloat(cs.paddingTop))*k;
  let line=-1, mid=-Infinity;
  return at.map(([i, o])=>{
    r.setStart(nodes[i], o);
    r.setEnd(nodes[i], Math.min(nodes[i].length, o+1));
    const b=r.getClientRects()[0]||r.getBoundingClientRect();
    const y=(b.top-oy)/k, y1=(b.bottom-oy)/k;
    if(y>mid) line++;
    mid=(y+y1)/2;
    return {x:(b.left-ox)/k, y, y1, line};
  });
}

/*
 * Text that reflows in motion. When its line breaks change (a breakpoint, the
 * sidebar, a window resize), the paragraph is cut, for the length of one move,
 * into the pieces that stay together across both layouts - runs of text sharing
 * a line before and after - and each piece travels from where it was drawn to
 * where it now sits, on the travel curve, blurred by its own speed. Words that
 * drop to the next line slide down and back to its start while the rest of the
 * line shifts along; nothing fades in place, the text visibly moves.
 * The pieces are clipped copies that exist only while moving; the real text stays
 * in place underneath (invisible, still selectable and read out) and is back,
 * pixel-identical, when they land. Rewraps during a move wait for it to land and
 * continue from there, so a long drag flows from layout to layout instead of
 * strobing. The paragraph's height eases too, so what follows glides. The root
 * must be a block box.
 */
export function FlowText({as='p', className, children, disabled, maxBlur=4, ...rest}){
  const Tag=as;
  const ref=useRef(null);
  const textRef=useRef(null);
  const mb=useRef(maxBlur);
  mb.current=maxBlur;
  useLayoutEffect(()=>{
    const el=ref.current, txt=textRef.current;
    if(!el || !txt || disabled || typeof ResizeObserver==='undefined') return undefined;
    let last=null, ready=false, dead=false, fontsAt=-Infinity, visible=true;
    let flight=null, tall=null;
    const measure=()=>({sig:lines(txt), w:el.clientWidth, h:el.offsetHeight, text:txt.textContent});
    const base=()=>{ last=visible?measure():null; };
    const allowed=()=>performance.now()-fontsAt>=150 && mb.current>0 && !prefersReducedMotion() && typeof el.animate==='function';

    /* an inert copy of the text laid out at a given width, over the real one.
       Custom tags, so no page selector meant for spans (or anything) restyles them */
    const copy=(left, top, width)=>{
      const o=document.createElement('nr-flow-piece');
      o.className='nr-flow-piece';
      o.setAttribute('aria-hidden', 'true');
      o.style.left=`${left}px`;
      o.style.top=`${top}px`;
      o.style.width=`${width}px`;
      const inner=document.createElement('nr-flow-line');
      for(const n of txt.childNodes) inner.appendChild(n.cloneNode(true));
      inner.querySelectorAll('[id]').forEach((n)=>n.removeAttribute('id'));
      o.appendChild(inner);
      return o;
    };

    /* move from the layout drawn at width `fromW` to the current one */
    const build=(fromW)=>{
      const cs=getComputedStyle(el);
      const pl=parseFloat(cs.paddingLeft), pr=parseFloat(cs.paddingRight), pt=parseFloat(cs.paddingTop);
      const cw=el.clientWidth-pl-pr;
      const ghost=copy(pl, pt, fromW-pl-pr);
      ghost.style.visibility='hidden';
      el.appendChild(ghost);
      const nodes=textNodes(txt), was=textNodes(ghost);
      const at=starts(nodes);
      const N=at.length>1 && was.length===nodes.length?place(el, nodes, at):null;
      const O=N && place(el, was, at);
      ghost.remove();
      if(!N) return false;

      /* pieces: runs that share a line in both layouts and so move as one */
      const pieces=[];
      for(let j=0;j<N.length;j++){
        const dx=O[j].x-N[j].x, dy=O[j].y-N[j].y;
        const p=pieces[pieces.length-1];
        if(!p || p.line!==N[j].line || p.was!==O[j].line || Math.abs(dx-p.dx)>1 || Math.abs(dy-p.dy)>1) pieces.push({j, line:N[j].line, was:O[j].line, dx, dy});
      }
      if(pieces.length>MAX_PIECES || !pieces.some((p)=>Math.hypot(p.dx, p.dy)>=.75)) return false;
      /* each line's band reaches halfway to its neighbours, so the clips tile the text */
      const top=[], bot=[];
      for(const n of N){ top[n.line]=Math.min(top[n.line]??Infinity, n.y); bot[n.line]=Math.max(bot[n.line]??-Infinity, n.y1); }
      const L=top.length;
      const y0=(l)=>l===0?top[0]-PAD:(bot[l-1]+top[l])/2, y1=(l)=>l===L-1?bot[l]+PAD:(bot[l]+top[l+1])/2;

      const dur=DUR.travel, B=mb.current;
      const fr=sampleEase(EASE.travel, dur);
      const layers=[], anims=[];
      pieces.forEach((p, i)=>{
        const next=pieces[i+1];
        const x0=i===0||pieces[i-1].line!==p.line?-1e4:N[p.j].x;
        const x1=next && next.line===p.line?N[next.j].x:1e4;
        const o=copy(pl, pt, cw);
        o.firstChild.style.clipPath=`polygon(${x0}px ${y0(p.line)}px,${x1}px ${y0(p.line)}px,${x1}px ${y1(p.line)}px,${x0}px ${y1(p.line)}px)`;
        el.appendChild(o);
        layers.push(o);
        const dist=Math.hypot(p.dx, p.dy);
        if(dist<.75) return;
        const size=Math.max(8, Math.min(cw, x1)-Math.max(0, x0));
        anims.push(o.animate(fr.map((f)=>({
          offset:f.offset,
          transform:`translate3d(${(p.dx*(1-f.p)).toFixed(2)}px,${(p.dy*(1-f.p)).toFixed(2)}px,0)`,
          filter:`blur(${smear(f.v*dist/dur, size, {maxBlur:B, covered:f.p*dist}).blur.toFixed(2)}px)`,
        })), {duration:dur, delay:Math.min(p.line*14, 56), easing:'linear', fill:'backwards'}));
      });
      txt.style.opacity='0';
      const rec={layers, w:el.clientWidth, sig:lines(txt), text:txt.textContent};
      flight=rec;
      /* cancelled from outside: never leave the real text hidden */
      Promise.all(anims.map((a)=>a.finished)).then(()=>{ if(flight===rec) land(true); }, ()=>{ if(flight===rec) land(false); });
      /* and if a promise never settles (paused or seeked by someone else), land once nothing runs */
      const watch=()=>{ if(flight!==rec) return; if(anims.some((a)=>a.playState==='running')) rec.timer=setTimeout(watch, 200); else land(true); };
      rec.timer=setTimeout(watch, DUR.travel+200);
      return true;
    };

    /* the pieces landed: hand back to the real text, or move on if it rewrapped meanwhile */
    const land=(go)=>{
      const f=flight;
      if(!f) return;
      flight=null;
      clearTimeout(f.timer);
      if(go && !dead && visible && allowed()){
        const now=measure();
        last=now;
        if(now.sig!==f.sig && now.text===f.text) build(f.w);
      }
      f.layers.forEach((l)=>l.remove());
      if(!flight) txt.style.opacity='';
    };

    /* height eases from what was drawn to the new natural height */
    const grow=(prev)=>{
      const drawnH=tall?.playState==='running'?el.offsetHeight:prev.h;
      tall?.cancel();
      const h=parseFloat(getComputedStyle(el).height);
      const from=h+(drawnH-el.offsetHeight);
      if(Math.abs(from-h)>=1) tall=el.animate({height:[`${from.toFixed(2)}px`, `${h.toFixed(2)}px`]}, {duration:DUR.travel, easing:EASE.travel.css});
    };

    const check=()=>{
      if(dead) return;
      if(!visible){ land(false); last=null; return; }   // off screen: re-baseline when it comes back
      const now=measure();
      const prev=last;
      last=now;
      if(!prev || prev.sig===now.sig) return;
      if(flight){
        if(now.text!==flight.text) land(false);
        else grow(prev);
        return;
      }
      /* only rewraps the layout caused: its own width changed. A font swapping in
         (same width, new breaks) or new text just takes its place */
      if(!ready || prev.text!==now.text || prev.w===now.w || !allowed()) return;
      build(prev.w);
      grow(prev);
    };
    base();
    const ro=new ResizeObserver(check);
    ro.observe(el);
    const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([e])=>{ visible=e.isIntersecting; if(!visible) land(false); else if(!last) base(); });
    io?.observe(el);
    let raf=requestAnimationFrame(()=>{ raf=requestAnimationFrame(()=>{ if(!dead){ base(); ready=true; } }); });
    const onFonts=()=>{ fontsAt=performance.now(); base(); };
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    return ()=>{
      dead=true;
      cancelAnimationFrame(raf);
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      ro.disconnect();
      io?.disconnect();
      land(false);
      tall?.cancel();
    };
  },[disabled]);
  return <Tag ref={ref} className={cx('nr-flow', className)} {...rest}><nr-flow-text ref={textRef} class="nr-flow-text">{children}</nr-flow-text></Tag>;
}
