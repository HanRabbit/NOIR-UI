import React, {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {cx, prefersReducedMotion} from '../core/utils.js';
import {DUR, EASE, cancelAll, lerp, sampleEase, smear} from '../core/motion.js';
import './Display.css';

/*
 * Odometer. Every digit is a wheel (0-9 repeated three times) that turns in the
 * direction the number's magnitude moved, so 9 -> 0 on a carry rolls forward one
 * notch instead of spinning back through eight digits. Columns that appear or
 * vanish on a carry / borrow (a new leading digit, the thousands comma) open or
 * close their width while the glyph scales and fades in place, so the number
 * never jumps and never shows a half-clipped digit.
 * Blur on each wheel comes from its own roll speed.
 */
const STRIP=Array.from({length:30}, (_, i)=>i%10);

function cellH(el){ return el?.firstElementChild?.offsetHeight||16; }

function Wheel({d, dir, state, delay}){
  const ref=useRef(null);
  const pos=useRef(null);
  /* appearing / disappearing columns don't roll: they scale and fade in place */
  const [initial]=useState(()=>10+d);
  useLayoutEffect(()=>{
    const el=ref.current;
    if(!el) return;
    const h=cellH(el);
    if(pos.current==null){
      pos.current=initial;
      el.style.transform=`translateY(${-initial*h}px)`;
      return;
    }
    if(state==='leave') return;
    const target=d;
    let from=pos.current;
    if(el.getAnimations().length){
      const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);
      from=-m.m42/h;
    }
    cancelAll(el);
    /* re-centre into the middle block so the wheel never runs off either end */
    const base=((Math.round(from)%10)+10)%10+10;
    from=from-Math.round(from)+base;
    const cur=((Math.round(from)%10)+10)%10;
    const steps=dir>=0?(target-cur+10)%10:-((cur-target+10)%10);
    const to=Math.round(from)+steps;
    pos.current=((to%10)+10)%10+10;
    el.style.transform=`translateY(${-pos.current*h}px)`;
    if(prefersReducedMotion() || Math.abs(to-from)<.01) return;
    const dist=Math.abs(to-from)*h;
    const dur=DUR.roll;
    el.animate(sampleEase(EASE.travel, dur).map((f)=>{
      const y=-lerp(from, to, f.p)*h;
      const b=smear(f.v*dist/dur, h, {maxBlur:2.2, gain:.55, covered:f.p*dist}).blur;
      return {offset:f.offset, transform:`translateY(${y.toFixed(2)}px)`, filter:`blur(${b.toFixed(2)}px)`};
    }), {duration:dur, delay, easing:'linear', fill:'backwards'});
  },[d, dir, state, delay, initial]);
  return <span className="nr-digit-strip" ref={ref}>
    {STRIP.map((n, i)=><span key={i}>{n}</span>)}
  </span>;
}

/*
 * A column that appears or disappears on a carry / borrow. Its width opens from 0
 * (pushing neighbours aside) while the glyph stays centred and un-clipped, scaling,
 * fading and un-blurring in - so you never see half a digit at the column edge.
 */
function Column({state, kind, children}){
  const ref=useRef(null);
  const mounted=useRef(false);
  useLayoutEffect(()=>{
    const el=ref.current, inner=el?.firstElementChild;
    if(!el || !inner) return;
    const first=!mounted.current;
    mounted.current=true;
    if(prefersReducedMotion()) return;
    if(first && state!=='enter') return;
    const running=el.getAnimations().length>0;
    if(state==='idle' && !running) return;
    const w=inner.offsetWidth;
    const cw=running?parseFloat(getComputedStyle(el).width):(state==='leave'?w:0);
    const ics=getComputedStyle(inner);
    const co=running?parseFloat(ics.opacity):(state==='leave'?1:0);
    cancelAll(el); cancelAll(inner);
    const out=state==='leave';
    const dur=out?DUR.travel-40:DUR.travel;
    const fill=out?'forwards':'none';
    el.animate([{width:`${cw}px`}, {width:`${out?0:w}px`}], {duration:dur, easing:EASE.travel.css, fill});
    inner.animate([
      {opacity:co, transform:`scale(${out?1:.55})`, filter:`blur(${out?0:4}px)`},
      {opacity:out?0:1, transform:`scale(${out?.55:1})`, filter:`blur(${out?4:0}px)`},
    ], {duration:dur, easing:out?EASE.exit.css:EASE.enter.css, fill});
  },[state]);
  return <span ref={ref} className={cx('nr-numcol', kind)}>{children}</span>;
}

function layout(text){
  const chars=text.split('');
  let digit=0, sym=0;
  const cols=[];
  for(let i=chars.length-1;i>=0;i--){
    const c=chars[i];
    if(/\d/.test(c)) cols.unshift({key:`d${digit++}`, ch:c, kind:'digit'});
    else cols.unshift({key:`s${sym++}:${c}`, ch:c, kind:'sym'});
  }
  return cols;
}

export function NumberFlow({value=0, format, decimals=0, prefix='', suffix='', className}){
  const text=useMemo(()=>{
    if(format) return format(value);
    return Number(value).toLocaleString('en-US', {minimumFractionDigits:decimals, maximumFractionDigits:decimals});
  },[value, format, decimals]);
  const [st,setSt]=useState(()=>({text, value, dir:1, seq:0, cols:layout(text).map((c)=>({...c, state:'idle'}))}));
  if(st.text!==text){
    const next=layout(text);
    const nextKeys=new Set(next.map((c)=>c.key));
    const prevByKey=new Map(st.cols.map((c)=>[c.key, c]));
    const merged=[];
    /* walk both lists right-to-left so leaving columns stay where they were */
    let i=st.cols.length-1, j=next.length-1;
    const tmp=[];
    while(i>=0 || j>=0){
      const a=st.cols[i], b=next[j];
      if(b && a && a.key===b.key){ tmp.push({...b, state:'idle'}); i--; j--; }
      else if(a && !nextKeys.has(a.key)){ tmp.push({...a, state:'leave'}); i--; }
      else if(b){ tmp.push({...b, state:prevByKey.has(b.key)?'idle':'enter'}); j--; }
      else i--;
    }
    merged.push(...tmp.reverse());
    /* roll by magnitude, so displayed digits turn the way they change (also for negatives) */
    const dir=Math.abs(Number(value))>=Math.abs(Number(st.value))?1:-1;
    setSt({text, value, dir, seq:st.seq+1, cols:merged});
  }
  useLayoutEffect(()=>{
    if(!st.cols.some((c)=>c.state!=='idle')) return undefined;
    const seq=st.seq;
    const t=setTimeout(()=>setSt((s)=>s.seq!==seq?s:{...s, cols:s.cols.filter((c)=>c.state!=='leave').map((c)=>c.state==='enter'?{...c, state:'idle'}:c)}), 460);
    return ()=>clearTimeout(t);
  },[st.seq]);
  /* carries ripple from the ones place leftward */
  let rank=0;
  const ranks=new Map();
  for(let k=st.cols.length-1;k>=0;k--) if(st.cols[k].kind==='digit') ranks.set(st.cols[k].key, rank++);
  return <span className={cx('nr-numflow', className)} role="img" aria-label={`${prefix}${text}${suffix}`}>
    {prefix&&<span className="nr-numflow-affix" aria-hidden="true">{prefix}</span>}
    <span className="nr-numflow-cols" aria-hidden="true">
      <span className="nr-numflow-ghost">0</span>
      {st.cols.map((c)=>c.kind==='digit'
        ? <Column key={c.key} state={c.state} kind="digit"><span className="nr-digit"><Wheel d={Number(c.ch)} dir={st.dir} state={c.state} delay={(ranks.get(c.key)||0)*24}/></span></Column>
        : <Column key={c.key} state={c.state} kind="sym"><span className="nr-numflow-sym">{c.ch}</span></Column>)}
    </span>
    {suffix&&<span className="nr-numflow-affix" aria-hidden="true">{suffix}</span>}
  </span>;
}
