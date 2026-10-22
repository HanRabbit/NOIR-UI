import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {clamp, cx, lockSelection, prefersReducedMotion} from '../core/utils.js';
import {DUR, EASE, cancelAll, lerp, sampleEase, smear} from '../core/motion.js';
import {Thumb} from '../core/Swap.jsx';
import {useControllable, useSmearIndicator, useStableId} from '../core/hooks.js';
import './Controls.css';

/*
 * Knob travels with EASE.travel over a sqrt(distance) duration; its ink stretches
 * toward the trailing side and blurs by the sampled instantaneous speed.
 * Pressing widens the ink toward the travel direction (anticipation).
 */
export function Switch({checked, defaultChecked=false, onChange, disabled=false, size='md', label, description, className}){
  const [on,setOn]=useControllable(checked, defaultChecked, onChange);
  const id=useStableId('sw');
  const knobRef=useRef(null);
  const inkRef=useRef(null);
  const was=useRef(on);
  useLayoutEffect(()=>{
    const knob=knobRef.current, ink=inkRef.current;
    if(was.current===on || !knob){ was.current=on; return; }
    was.current=on;
    if(prefersReducedMotion() || typeof knob.animate!=='function') return;
    const track=knob.parentElement;
    const pad=parseFloat(getComputedStyle(knob).left)||3;
    const travel=track.clientWidth-knob.offsetWidth-pad*2;
    const running=knob.getAnimations().length>0;
    const cur=running?new DOMMatrixReadOnly(getComputedStyle(knob).transform).m41:(on?0:travel);
    cancelAll(knob); cancelAll(ink);
    const to=on?travel:0;
    const dist=Math.abs(to-cur);
    if(dist<.5) return;
    const dur=DUR.travel;
    const frames=sampleEase(EASE.travel, dur);
    knob.animate(frames.map((f)=>({offset:f.offset, transform:`translateX(${lerp(cur, to, f.p)}px)`})), {duration:dur, easing:'linear'});
    ink.style.transformOrigin=to>cur?'100% 50%':'0% 50%';
    ink.animate(frames.map((f)=>{
      const k=smear(f.v*dist/dur, knob.offsetWidth, {covered:f.p*dist});
      return {offset:f.offset, transform:`scale(${k.stretch},${k.squash})`, filter:`blur(${k.blur.toFixed(2)}px)`};
    }), {duration:dur, easing:'linear'});
  },[on]);
  return <label className={cx('nr-switch-row', disabled&&'disabled', className)} htmlFor={id}>
    <span className={cx('nr-switch', `nr-switch-${size}`, on&&'on')}>
      <input id={id} type="checkbox" role="switch" checked={on} disabled={disabled} onChange={(e)=>setOn(e.target.checked)}/>
      <i ref={knobRef} className="nr-switch-knob" aria-hidden="true"><i ref={inkRef} className="nr-switch-ink"/></i>
    </span>
    {(label||description)&&<span className="nr-control-text">{label&&<b>{label}</b>}{description&&<small>{description}</small>}</span>}
  </label>;
}

export function Checkbox({checked, defaultChecked=false, indeterminate=false, onChange, disabled=false, label, description, className}){
  const [on,setOn]=useControllable(checked, defaultChecked, onChange);
  const ref=useRef(null);
  const id=useStableId('cb');
  useEffect(()=>{ if(ref.current) ref.current.indeterminate=indeterminate; },[indeterminate]);
  const state=indeterminate?'mixed':on?'on':'off';
  return <label className={cx('nr-check-row', disabled&&'disabled', className)} htmlFor={id}>
    <span className={cx('nr-check', `is-${state}`)}>
      <input ref={ref} id={id} type="checkbox" checked={on} disabled={disabled} onChange={(e)=>setOn(e.target.checked)}/>
      <i className="nr-check-fill" aria-hidden="true"/>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path className="nr-check-tick" d="M3.5 8.4l3 3 6-6.6" pathLength="24"/>
        <path className="nr-check-dash" d="M4 8h8" pathLength="24"/>
      </svg>
    </span>
    {(label||description)&&<span className="nr-control-text">{label&&<b>{label}</b>}{description&&<small>{description}</small>}</span>}
  </label>;
}

/* One shared dot travels between rings instead of each ring filling in place */
export function RadioGroup({value, defaultValue, onChange, options=[], name, direction='column', disabled=false, className, 'aria-label':ariaLabel}){
  const [val,setVal]=useControllable(value, defaultValue, onChange);
  const rootRef=useRef(null);
  const gid=useStableId('rg');
  const thumb=useSmearIndicator(rootRef, '.nr-radio.on .nr-radio-ring', [val, options.length]);
  return <div ref={rootRef} role="radiogroup" aria-label={ariaLabel} className={cx('nr-radio-group', direction==='row'&&'row', className)}>
    <Thumb thumb={thumb} className="nr-radio-thumb"/>
    {options.map((o)=>{
      const on=String(o.value)===String(val);
      const id=`${gid}-${o.value}`;
      return <label key={o.value} htmlFor={id} className={cx('nr-radio', on&&'on', (disabled||o.disabled)&&'disabled')}>
        <span className="nr-radio-ring">
          <input id={id} type="radio" name={name||gid} value={o.value} checked={on} disabled={disabled||o.disabled} onChange={()=>setVal(o.value)}/>
        </span>
        <span className="nr-control-text"><b>{o.label}</b>{o.description&&<small>{o.description}</small>}</span>
      </label>;
    })}
  </div>;
}

/*
 * Every step change - drag, click, keyboard - glides on a critically damped spring
 * that settles in DUR.travel, the same rhythm as every other travelling control.
 * The knob's stretch and blur come from the spring's own velocity, so the smear is
 * exactly as strong as the motion actually on screen.
 */
export function Slider({value, defaultValue=50, onChange, min=0, max=100, step=1, disabled=false, format=(v)=>v, className, 'aria-label':ariaLabel}){
  const [val,setVal]=useControllable(value, defaultValue, onChange);
  const rootRef=useRef(null);
  const trackRef=useRef(null);
  const knobRef=useRef(null);
  const sim=useRef({x:null, v:0, target:0, from:0, w:20, raf:0, t:0});
  const unlock=useRef(null);
  const [drag,setDrag]=useState(false);
  const pct=(clamp(val, min, max)-min)/(max-min)*100;
  const snap=useCallback((n)=>{
    const s=Math.round((n-min)/step)*step+min;
    return clamp(Number(s.toFixed(6)), min, max);
  },[min, max, step]);
  const paint=(x, v, moved=0)=>{
    const root=rootRef.current, knob=knobRef.current;
    if(!root || !knob) return;
    root.style.setProperty('--nr-pct', `${x}%`);
    const width=trackRef.current?.clientWidth||200;
    const size=knob.offsetWidth||16;
    const k=smear((v/100)*width/1000, size, {covered:moved/100*width});
    knob.style.setProperty('--nr-kx', k.stretch.toFixed(3));
    knob.style.setProperty('--nr-ky', k.squash.toFixed(3));
    knob.style.setProperty('--nr-kb', `${k.blur.toFixed(2)}px`);
    knob.style.setProperty('--nr-ko', v>=0?'100% 50%':'0% 50%');
  };
  const tick=(now)=>{
    const s=sim.current;
    const dt=Math.min(.032, (now-s.t)/1000);
    s.t=now;
    /* exact critically damped step: stable at any dt, never overshoots */
    const e=s.x-s.target;
    const ex=Math.exp(-s.w*dt);
    const c=s.v+s.w*e;
    s.x=s.target+(e+c*dt)*ex;
    s.v=(s.v-s.w*c*dt)*ex;
    if(Math.abs(s.x-s.target)<.01 && Math.abs(s.v)<.5){
      s.x=s.target; s.v=0; s.raf=0;
      paint(s.x, 0);
      return;
    }
    paint(s.x, s.v, Math.abs(s.x-s.from));
    s.raf=requestAnimationFrame(tick);
  };
  useLayoutEffect(()=>{
    const s=sim.current;
    if(s.x==null || prefersReducedMotion()){
      s.x=pct; s.v=0; s.target=pct;
      paint(pct, 0);
      return;
    }
    if(s.target===pct) return;
    /* critically damped is within ~1% at 6.6/w: every step lands in DUR.travel */
    s.w=6.6/(DUR.travel/1000);
    /* retargeting mid-flight: if current speed would carry past the new target,
       raise w until it can't (critical damping overshoots only when |v| > w|e|) */
    const e=s.x-pct;
    if(e && Math.sign(s.v)===-Math.sign(e)) s.w=Math.max(s.w, Math.abs(s.v/e)*1.05);
    s.target=pct;
    s.from=s.x;
    if(!s.raf){ s.t=performance.now(); s.raf=requestAnimationFrame(tick); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pct]);
  useEffect(()=>()=>{ cancelAnimationFrame(sim.current.raf); unlock.current?.(); },[]);
  const fromPointer=(e)=>{
    const r=trackRef.current.getBoundingClientRect();
    return snap(min+clamp((e.clientX-r.left)/r.width, 0, 1)*(max-min));
  };
  const onDown=(e)=>{
    if(disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    knobRef.current?.focus({preventScroll:true});
    unlock.current?.();
    unlock.current=lockSelection();
    setDrag(true);
    setVal(fromPointer(e));
  };
  const onMove=(e)=>{
    if(!drag) return;
    const next=fromPointer(e);
    if(next!==val) setVal(next);
  };
  const onUp=()=>{ unlock.current?.(); unlock.current=null; setDrag(false); };
  const onKey=(e)=>{
    const big=(max-min)/10;
    const map={ArrowRight:step, ArrowUp:step, ArrowLeft:-step, ArrowDown:-step, PageUp:big, PageDown:-big};
    let next=null;
    if(e.key in map) next=snap(val+map[e.key]);
    else if(e.key==='Home') next=min;
    else if(e.key==='End') next=max;
    if(next==null) return;
    e.preventDefault();
    setVal(next);
  };
  return <div
    ref={rootRef}
    className={cx('nr-slider', drag&&'dragging', disabled&&'disabled', className)}
    onPointerDown={onDown}
    onPointerMove={onMove}
    onPointerUp={onUp}
    onPointerCancel={onUp}
  >
    <div className="nr-slider-track" ref={trackRef}>
      <i className="nr-slider-fill"/>
    </div>
    <span
      ref={knobRef}
      className="nr-slider-knob"
      role="slider"
      tabIndex={disabled?-1:0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={val}
      aria-valuetext={String(format(val))}
      aria-disabled={disabled||undefined}
      onKeyDown={onKey}
    >
      <i className="nr-slider-dot"/>
      <span className="nr-slider-bubble">{format(val)}</span>
    </span>
  </div>;
}
