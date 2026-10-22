import React, {useEffect, useRef} from 'react';
import {cx, prefersReducedMotion} from '../core/utils.js';
import './Display.css';

const lerp=(a, b, t)=>a+(b-a)*t;

/* Smooth value noise: deterministic in t, so re-sampling the same instant never jitters */
const hash=(n)=>{ const s=Math.sin(n*127.1)*43758.5453; return s-Math.floor(s); };
export function smoothNoise(t){
  const i=Math.floor(t), f=t-i;
  const u=f*f*(3-2*f);
  return lerp(hash(i), hash(i+1), u)*2-1;
}

/* Demo signal: two sines plus low-frequency drift and a little fast texture */
export function demoSignal(t){
  return Math.sin(t*2.1)*.62
    + Math.sin(t*5.3+1.2)*.18
    + smoothNoise(t*1.6)*.28
    + smoothNoise(t*14)*.05;
}

function readInk(el){
  const cs=getComputedStyle(el);
  return {fg:cs.getPropertyValue('--nr-fg').trim()||'#fff', bg:cs.getPropertyValue('--nr-bg').trim()||'#000'};
}

/*
 * Live, continuously scrolling trace. `sample(t)` is evaluated every frame across
 * the visible window, so motion is sub-pixel smooth instead of stepping per tick.
 * Pausing eases time to a stop; the vertical range follows the data with damping.
 */
export function Waveform({sample=demoSignal, running=true, window:span=4, speed=1, fill=true, glow=true, strokeWidth=1.6, className, onStats, 'aria-label':ariaLabel='Live waveform'}){
  const wrapRef=useRef(null);
  const canvasRef=useRef(null);
  const live=useRef({});
  live.current={sample, running, span, speed, fill, glow, strokeWidth, onStats};
  useEffect(()=>{
    const canvas=canvasRef.current, wrap=wrapRef.current;
    const ctx=canvas.getContext('2d');
    const st={t:0, rate:running?1:0, last:performance.now(), lo:-1, hi:1, w:0, h:0, dpr:1, statsAt:0};
    const resize=()=>{
      const r=wrap.getBoundingClientRect();
      st.dpr=Math.min(2, window.devicePixelRatio||1);
      st.w=Math.max(1, r.width);
      st.h=Math.max(1, r.height);
      canvas.width=Math.round(st.w*st.dpr);
      canvas.height=Math.round(st.h*st.dpr);
    };
    resize();
    const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
    ro?.observe(wrap);
    const reduced=prefersReducedMotion();
    let raf=0;
    const frame=(now)=>{
      const p=live.current;
      const dt=Math.min(.05, (now-st.last)/1000);
      st.last=now;
      /* ease the clock's rate instead of hard-stopping it */
      st.rate=lerp(st.rate, p.running&&!reduced?1:0, 1-Math.exp(-dt*7));
      st.t+=dt*st.rate*p.speed;
      const {w, h, dpr}=st;
      const n=Math.max(2, Math.ceil(w/1.5));
      const ys=new Float32Array(n+1);
      let mn=Infinity, mx=-Infinity, sum=0;
      for(let i=0;i<=n;i++){
        const v=p.sample(st.t-p.span+(i/n)*p.span);
        ys[i]=v;
        if(v<mn) mn=v;
        if(v>mx) mx=v;
        sum+=v;
      }
      /* damped auto-range so the scale breathes rather than jumps */
      const pad=(mx-mn)*.18||.5;
      const k=1-Math.exp(-dt*3);
      st.lo=lerp(st.lo, mn-pad, k);
      st.hi=lerp(st.hi, mx+pad, k);
      const range=st.hi-st.lo||1;
      const sw=p.strokeWidth;
      const xOf=(i)=>(i/n)*(w-10);
      const yOf=(v)=>sw+(1-(v-st.lo)/range)*(h-sw*2);
      const ink=readInk(wrap);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      for(let i=0;i<=n;i++){ const x=xOf(i), y=yOf(ys[i]); if(i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      if(p.fill){
        ctx.save();
        ctx.lineTo(xOf(n), h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const g=ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, ink.fg);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha=.09;
        ctx.fillStyle=g;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        for(let i=0;i<=n;i++){ const x=xOf(i), y=yOf(ys[i]); if(i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      }
      ctx.lineWidth=sw;
      ctx.lineJoin='round';
      ctx.lineCap='round';
      ctx.strokeStyle=ink.fg;
      ctx.stroke();
      /* fade the trailing edge so the trace dissolves rather than being clipped */
      ctx.save();
      ctx.globalCompositeOperation='destination-out';
      const fade=ctx.createLinearGradient(0, 0, w*.22, 0);
      fade.addColorStop(0, 'rgba(0,0,0,1)');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle=fade;
      ctx.fillRect(0, 0, w*.22, h);
      ctx.restore();
      if(p.glow){
        const x=xOf(n), y=yOf(ys[n]);
        ctx.save();
        ctx.fillStyle=ink.fg;
        ctx.shadowColor=ink.fg;
        ctx.shadowBlur=14*st.rate+2;
        ctx.globalAlpha=.35+.65*st.rate;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
      if(p.onStats && now-st.statsAt>250){
        st.statsAt=now;
        p.onStats({last:ys[n], min:mn, max:mx, avg:sum/(n+1)});
      }
      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
    return ()=>{ cancelAnimationFrame(raf); ro?.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  return <div ref={wrapRef} className={cx('nr-wave', className)} role="img" aria-label={ariaLabel}>
    <canvas ref={canvasRef}/>
  </div>;
}
