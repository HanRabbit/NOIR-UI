import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {prefersReducedMotion} from './utils.js';
import {DUR, EASE, sampleEase, smear} from './motion.js';

/*
 * Per-character morph for text-like content (strings + inline icons).
 *
 * At rest the label is plain text, so kerning, selection and screen readers are
 * untouched. On a swap the old layout (snapshotted before the commit) and the new
 * one are measured glyph by glyph; characters the two labels share (LCS) glide to
 * their new place, the rest roll out / in with a stagger. Every glyph's blur and
 * stretch come from its own instantaneous speed. An absolutely positioned overlay
 * draws the moving glyphs while the real text is transparent; when the last one
 * lands the overlay is removed in the same frame and the text reappears in place.
 */
const MAX_CHARS=64;
const D=11;
const OUT_MS=150, IN_MS=180, IN_AT=55, STAGGER_MAX=96, STAGGER_STEP=14;
const smoothstep=(a, b, x)=>{ const t=Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };
const strip=(fr)=>fr.map(({o, tx, ty, ...k})=>k);

const segmenter=typeof Intl!=='undefined' && Intl.Segmenter?new Intl.Segmenter(undefined, {granularity:'grapheme'}):null;
const graphemes=(s)=>segmenter?Array.from(segmenter.segment(s), (x)=>x.segment):Array.from(s);

/* children -> [{kind:'c', ch} | {kind:'e', el}] or null when not text-like */
export function toAtoms(children){
  const out=[];
  let ok=true;
  const walk=(n)=>{
    if(!ok || n==null || typeof n==='boolean') return;
    if(typeof n==='string' || typeof n==='number'){ for(const g of graphemes(String(n))) out.push({kind:'c', ch:g}); return; }
    if(Array.isArray(n)){ n.forEach(walk); return; }
    if(React.isValidElement(n)){
      if(n.type===React.Fragment){ React.Children.forEach(n.props.children, walk); return; }
      out.push({kind:'e', el:n});
      return;
    }
    ok=false;
  };
  walk(children);
  if(!ok || out.filter((a)=>a.kind==='c').length>MAX_CHARS) return null;
  return out;
}

const shallow=(a, b)=>{
  const ka=Object.keys(a).filter((k)=>k!=='children'), kb=Object.keys(b).filter((k)=>k!=='children');
  if(ka.length!==kb.length) return false;
  return ka.every((k)=>Object.is(a[k], b[k]));
};
const same=(a, b)=>a.kind===b.kind && (a.kind==='c'?a.ch===b.ch:(a.el.type===b.el.type && a.el.key===b.el.key && shallow(a.el.props, b.el.props)));

function lcs(a, b){
  const n=a.length, m=b.length;
  const dp=Array.from({length:n+1}, ()=>new Uint16Array(m+1));
  for(let i=n-1;i>=0;i--) for(let j=m-1;j>=0;j--) dp[i][j]=same(a[i], b[j])?dp[i+1][j+1]+1:Math.max(dp[i+1][j], dp[i][j+1]);
  const pairs=[];
  let i=0, j=0;
  while(i<n && j<m){
    if(same(a[i], b[j])){ pairs.push([i, j]); i++; j++; }
    else if(dp[i+1][j]>=dp[i][j+1]) i++;
    else j++;
  }
  return pairs;
}

function measure(layer){
  const map=new Map();
  if(!layer) return {map, w:0, h:0};
  const box=layer.getBoundingClientRect();
  /* range rects are zoomed; overlay left/width are applied inside the same zoom */
  const z=layer.currentCSSZoom||1;
  for(const run of layer.querySelectorAll(':scope > .nr-swap-run')){
    const node=run.firstChild;
    const ids=(run.dataset.ids||'').split(',');
    if(!node || node.nodeType!==3){ continue; }
    const text=node.data, top=run.offsetTop, h=run.offsetHeight;
    const range=document.createRange();
    let off=0;
    graphemes(text).forEach((g, i)=>{
      range.setStart(node, off); range.setEnd(node, off+g.length);
      const r=range.getBoundingClientRect();
      map.set(ids[i], {kind:'c', ch:g, x:(r.left-box.left)/z, y:top, w:r.width/z, h});
      off+=g.length;
    });
  }
  for(const el of layer.querySelectorAll(':scope > .nr-swap-el')){
    map.set(el.dataset.a, {kind:'e', x:el.offsetLeft, y:el.offsetTop, w:el.offsetWidth, h:el.offsetHeight, clone:el.cloneNode(true)});
  }
  return {map, w:layer.offsetWidth, h:layer.offsetHeight};
}

/* Current visual offset/opacity of an animated overlay glyph, from its own record */
function sample(rec){
  const t=rec?.anim?.effect?.getComputedTiming?.();
  if(!t || t.progress==null || rec.anim.playState==='idle') return {tx:0, ty:0, o:1};
  const fr=rec.frames;
  const i=Math.min(fr.length-2, Math.max(0, Math.floor(t.progress*(fr.length-1))));
  const a=fr[i], b=fr[i+1];
  const k=(t.progress-a.offset)/Math.max(1e-6, b.offset-a.offset);
  return {tx:a.tx+(b.tx-a.tx)*k, ty:a.ty+(b.ty-a.ty)*k, o:a.o+(b.o-a.o)*k};
}

/* Roll in / out along the swap axis: speed → blur + a trailing stretch, opacity on time */
function rollFrames(kind, axis, d, dur, size, from){
  const ease=kind==='out'?EASE.travel:EASE.enter;
  const ad=Math.abs(d);
  return sampleEase(ease, dur).map((f)=>{
    let tx, ty, o;
    if(kind==='out'){
      const x0=from?.tx||0, y0=from?.ty||0;
      tx=axis==='x'?x0+(-d-x0)*f.p:x0*(1-f.p);
      ty=axis==='x'?y0*(1-f.p):y0+(-d-y0)*f.p;
      o=(from?from.o:1)*(1-smoothstep(.04, .82, f.offset));
    }else{
      tx=axis==='x'?d*(1-f.p):0;
      ty=axis==='x'?0:d*(1-f.p);
      o=smoothstep(.1, .68, f.offset);
    }
    const k=smear(f.v*ad/dur, size, {maxBlur:4.5, gain:1.3, covered:Math.abs(f.p*ad)});
    const blur=Math.min(6, k.blur+(1-o)*2.6);
    const st=Math.min(1.22, 1+(k.stretch-1)*.7);
    return {o, tx, ty, offset:f.offset, opacity:o,
      transform:`translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) ${axis==='x'?`scale(${st.toFixed(3)},1)`:`scale(1,${st.toFixed(3)})`}`,
      filter:`blur(${blur.toFixed(2)}px)`};
  });
}

/* A shared glyph sliding to its new slot: blur and stretch from its own speed */
function glideFrames(dx, dy, o0, size){
  const dist=Math.hypot(dx, dy);
  const dur=DUR.travel;
  return {dur, frames:sampleEase(EASE.travel, dur).map((f)=>{
    const tx=dx*(1-f.p), ty=dy*(1-f.p);
    const o=o0+(1-o0)*smoothstep(0, .5, f.offset);
    const k=smear(f.v*dist/dur, size, {maxBlur:3.5, gain:.9, covered:f.p*dist});
    const st=Math.min(1.2, 1+(k.stretch-1)*.5);
    return {o, tx, ty, offset:f.offset, opacity:o,
      transform:`translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${st.toFixed(3)},1)`,
      filter:`blur(${k.blur.toFixed(2)}px)`};
  })};
}

function makeGlyph(fx, a){
  const s=document.createElement('span');
  s.className='nr-swap-ch';
  s.textContent=a.ch;
  s.style.left=`${a.x}px`;
  s.style.top=`${a.y}px`;
  s.style.width=`${a.w}px`;
  s.style.height=`${a.h}px`;
  s.style.lineHeight=`${a.h}px`;
  fx.appendChild(s);
  return s;
}

function makeGhost(fx, a){
  const s=a.clone.cloneNode(true);
  s.className='nr-swap-ghost';
  s.removeAttribute('data-a');
  s.style.left=`${a.x}px`;
  s.style.top=`${a.y}px`;
  s.style.width=`${a.w}px`;
  s.style.height=`${a.h}px`;
  fx.appendChild(s);
  return s;
}

const segmentsOf=(view)=>{
  const segs=[];
  view.forEach((a)=>{
    const last=segs[segs.length-1];
    if(a.kind==='c'){
      if(last && last.kind==='run') { last.text+=a.ch; last.ids.push(a.id); }
      else segs.push({kind:'run', text:a.ch, ids:[a.id]});
    }else segs.push({kind:'el', el:a.el, id:a.id});
  });
  return segs;
};

export function SwapChars({swapKey, atoms, dir=1, axis='y', distance=D, Tag, className, rootProps}){
  const rootRef=useRef(null);
  const layerRef=useRef(null);
  const fxRef=useRef(null);
  const snap=useRef(null);
  const recs=useRef(new Map());
  const seqRef=useRef(0);
  const boxAnim=useRef(null);
  const [st,setSt]=useState(()=>{
    let n=0;
    return {key:swapKey, seq:0, n:atoms.length, view:atoms.map((a)=>({...a, id:`a${n++}`}))};
  });
  let view=st.view;
  if(st.key!==swapKey){
    /* still showing the old label: snapshot its layout before the commit replaces it */
    if(layerRef.current && snap.current?.seq!==st.seq) snap.current={seq:st.seq, ...measure(layerRef.current)};
    const pairs=lcs(st.view, atoms);
    const m=new Map(pairs.map(([i, j])=>[j, i]));
    /* lone shared glyphs that would fly across the label read as noise: let them roll */
    const isolated=(j)=>{ const i=m.get(j); return !(m.get(j-1)===i-1 || m.get(j+1)===i+1); };
    let n=st.n;
    const next=atoms.map((a, j)=>{
      const i=m.get(j);
      const keep=i!=null && (a.kind==='e' || !isolated(j) || Math.abs(i-j)<=1);
      return {...a, id:keep?st.view[i].id:`a${n++}`};
    });
    setSt({key:swapKey, seq:st.seq+1, n, view:next, prev:st.view});
    view=next;
  }else if(atoms.length===st.view.length && atoms.every((a, i)=>a.kind===st.view[i].kind)){
    view=atoms.map((a, i)=>({...a, id:st.view[i].id}));
  }else{
    view=atoms.map((a, i)=>({...a, id:`u${i}`}));
  }

  const clearFx=()=>{
    const fx=fxRef.current;
    recs.current.forEach((r)=>{ r.anim?.cancel(); r.node?.remove(); });
    recs.current=new Map();
    layerRef.current?.querySelectorAll(':scope > .nr-swap-el').forEach((el)=>el.getAnimations().forEach((a)=>a.cancel()));
    if(layerRef.current) delete layerRef.current.dataset.fx;
    if(fx) fx.querySelectorAll('.nr-swap-ch').forEach((n)=>n.remove());
  };

  useLayoutEffect(()=>{
    if(!st.seq) return;
    const old=snap.current?.seq===st.seq-1?snap.current:null;
    snap.current=null;
    const layer=layerRef.current, fx=fxRef.current, root=rootRef.current;
    if(!layer || !fx) return;
    if(!old || prefersReducedMotion() || typeof layer.animate!=='function'){ clearFx(); return; }
    const seq=++seqRef.current;
    const now=measure(layer);
    const R=recs.current;
    /* live position of every old atom (interrupted glyphs continue from where they are) */
    const live=new Map();
    (st.prev||[]).forEach((a)=>{
      const base=old.map.get(a.id);
      if(!base) return;
      const s=R.get(a.id)?sample(R.get(a.id)):{tx:0, ty:0, o:1};
      live.set(a.id, {...base, tx:s.tx, ty:s.ty, o:s.o});
    });
    const nextIds=new Set(view.map((a)=>a.id));
    const sign=Math.sign(dir*distance)||1;
    const d=dir*distance;
    const ordered=(arr)=>arr.sort((p, q)=>(sign>0?p.x-q.x:q.x-p.x));
    const step=(count)=>Math.min(STAGGER_STEP, STAGGER_MAX/Math.max(1, count-1));
    const lead=axis==='x'?(sign>0?'0% 50%':'100% 50%'):(sign>0?'50% 0%':'50% 100%');
    const nextR=new Map();
    const used=new Set();
    layer.dataset.fx='1';

    /* exits */
    const exits=ordered([...live.entries()].filter(([id])=>!nextIds.has(id)).map(([id, a])=>({id, ...a})));
    const es=step(exits.length);
    exits.forEach((a, i)=>{
      const rec=R.get(a.id);
      let node=rec?.node;
      rec?.anim?.cancel();
      if(rec) used.add(a.id);
      if(!node) node=a.kind==='c'?makeGlyph(fx, a):(a.clone?makeGhost(fx, a):null);
      if(!node) return;
      node.classList.add('leaving');
      node.style.transformOrigin=lead;
      const size=axis==='x'?Math.max(a.w, 1):Math.max(a.h, 1);
      const anim=node.animate(strip(rollFrames('out', axis, d, OUT_MS, size, a)), {duration:OUT_MS, delay:Math.round(i*es), easing:'linear', fill:'both'});
      anim.finished.then(()=>node.remove(), ()=>{});
    });

    /* shared atoms glide; new ones roll in */
    const enters=[];
    const waits=[];
    view.forEach((a)=>{
      const to=now.map.get(a.id);
      if(!to) return;
      const from=live.get(a.id);
      if(!from){ enters.push({...a, ...to}); return; }
      const rec=R.get(a.id);
      rec?.anim?.cancel();
      if(rec) used.add(a.id);
      const dx=from.x+from.tx-to.x, dy=from.y+from.ty-to.y;
      const target=a.kind==='c'?(rec?.node||makeGlyph(fx, to)):layer.querySelector(`:scope > .nr-swap-el[data-a="${a.id}"]`);
      if(!target) return;
      if(a.kind==='c'){
        target.classList.remove('leaving');
        Object.assign(target.style, {left:`${to.x}px`, top:`${to.y}px`, width:`${to.w}px`, height:`${to.h}px`, lineHeight:`${to.h}px`});
      }
      if(Math.hypot(dx, dy)<.5 && from.o>.99){
        if(a.kind==='c') nextR.set(a.id, {node:target});
        return;
      }
      target.style.transformOrigin=dx<0?'100% 50%':'0% 50%';
      const g=glideFrames(dx, dy, from.o, Math.max(to.w, 1));
      const anim=target.animate(strip(g.frames), {duration:g.dur, easing:'linear', fill:'backwards'});
      nextR.set(a.id, {node:a.kind==='c'?target:null, anim, frames:g.frames});
      waits.push(anim.finished);
    });
    ordered(enters);
    const is=step(enters.length);
    enters.forEach((a, i)=>{
      const node=a.kind==='c'?makeGlyph(fx, a):layer.querySelector(`:scope > .nr-swap-el[data-a="${a.id}"]`);
      if(!node) return;
      node.style.transformOrigin=lead;
      const size=axis==='x'?Math.max(a.w, 1):Math.max(a.h, 1);
      const fr=rollFrames('in', axis, d, IN_MS, size);
      const anim=node.animate(strip(fr), {duration:IN_MS, delay:IN_AT+Math.round(i*is), easing:'linear', fill:'backwards'});
      nextR.set(a.id, {node:a.kind==='c'?node:null, anim, frames:fr});
      waits.push(anim.finished);
    });
    /* anything left from an interrupted swap that is neither leaving nor reused */
    R.forEach((r, id)=>{ if(!used.has(id)){ r.anim?.cancel(); r.node?.remove(); } });
    recs.current=nextR;

    /* the box glides to the new width so neighbours move smoothly */
    if(root && (Math.abs(old.w-now.w)>.5 || Math.abs(old.h-now.h)>.5)){
      const cs=getComputedStyle(root);
      const running=boxAnim.current?.playState==='running';
      const cw=running?parseFloat(cs.width):old.w, ch=running?parseFloat(cs.height):old.h;
      boxAnim.current?.cancel();
      boxAnim.current=root.animate([{width:`${cw}px`, height:`${ch}px`}, {width:`${now.w}px`, height:`${now.h}px`}], {duration:DUR.travel, easing:EASE.enter.css});
    }

    Promise.all(waits).then(()=>{
      if(seqRef.current!==seq) return;
      recs.current.forEach((r)=>r.node?.remove());
      recs.current=new Map();
      delete layer.dataset.fx;
    }, ()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[st.seq]);

  /* content changed without a new swapKey: finish any morph instantly */
  const sig=view.map((a)=>(a.kind==='c'?a.ch:'\u0000')).join('');
  const sigRef=useRef({sig, seq:st.seq});
  useLayoutEffect(()=>{
    const prev=sigRef.current;
    sigRef.current={sig, seq:st.seq};
    if(prev.seq!==st.seq || prev.sig===sig) return;
    if(layerRef.current?.dataset.fx){ seqRef.current++; clearFx(); }
  });
  useEffect(()=>()=>{ recs.current.forEach((r)=>{ r.anim?.cancel(); r.node?.remove(); }); boxAnim.current?.cancel(); },[]);

  const segs=segmentsOf(view);
  return <Tag ref={rootRef} className={className} {...rootProps}>
    <span ref={layerRef} className="nr-swap-layer nr-swap-chars">
      {segs.map((s, i)=>s.kind==='run'
        ? <span key={`r${i}-${s.ids[0]}`} className="nr-swap-run" data-ids={s.ids.join(',')}>{s.text}</span>
        : <span key={s.id} className="nr-swap-el" data-a={s.id}>{s.el}</span>)}
      <span ref={fxRef} className="nr-swap-fx" aria-hidden="true"/>
    </span>
  </Tag>;
}
