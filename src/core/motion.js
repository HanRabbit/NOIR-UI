import {clamp} from './utils.js';

/* Cubic-bezier as a function of progress, identical to the CSS timing function */
export function bezier(x1, y1, x2, y2){
  const cx=3*x1, bx=3*(x2-x1)-cx, ax=1-cx-bx;
  const cy=3*y1, by=3*(y2-y1)-cy, ay=1-cy-by;
  const sx=(t)=>((ax*t+bx)*t+cx)*t;
  const sy=(t)=>((ay*t+by)*t+cy)*t;
  const dsx=(t)=>(3*ax*t+2*bx)*t+cx;
  const solve=(x)=>{
    let t=x;
    for(let i=0;i<8;i++){
      const e=sx(t)-x;
      if(Math.abs(e)<1e-6) return t;
      const d=dsx(t);
      if(Math.abs(d)<1e-6) break;
      t-=e/d;
    }
    let lo=0, hi=1;
    t=x;
    for(let i=0;i<40 && hi-lo>1e-7;i++){
      if(sx(t)<x) lo=t; else hi=t;
      t=(lo+hi)/2;
    }
    return t;
  };
  const f=(x)=>x<=0?0:x>=1?1:sy(solve(x));
  f.css=`cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
  return f;
}

/*
 * travel: things that move between two rest points (thumbs, knobs) — short
 *         acceleration, long settle, so velocity (and therefore blur) rises and falls.
 * enter:  content arriving — fastest at the start, blur releases as it slows.
 * exit:   content leaving — accelerates away, blur grows as it fades.
 */
export const EASE={
  travel:bezier(.25, .35, .15, 1),
  enter:bezier(.16, 1, .3, 1),
  exit:bezier(.5, 0, .75, 0),
};

/*
 * Fixed durations per kind of motion. Everything of a kind keeps the same rhythm;
 * a longer move in the same time is simply faster - and because stretch and blur
 * come from instantaneous speed, it smears more, the way a real object would.
 */
export const DUR={travel:280, swap:260, page:320, roll:300};

/*
 * Virtual shutter. A moving object smears over the distance it covers while the
 * shutter is open: trail = speed x exposure, but never more than the distance it
 * has actually covered since it started - so nothing looks stretched before it
 * has really moved, and blur ramps in with the motion. Stretch is the trail
 * relative to the object's size with one cap for every control, so small knobs
 * and wide thumbs deform by the same proportion. Blur follows sqrt(trail).
 */
export const EXPOSURE_MS=48;
export function smear(speed, size, {maxBlur=6, gain=1, covered=Infinity}={}){
  const s=Math.max(1, size);
  const raw=Math.min(Math.abs(speed)*EXPOSURE_MS, Math.abs(covered));
  const trail=Math.min(raw, clamp(s*.42, 6, 48));
  /* below ~2 px of trail the eye reads "still": fade blur in so landings are crisp */
  const t=Math.min(1, Math.max(0, (raw-2)/8));
  const gate=t*t*(3-2*t);
  return {
    trail,
    stretch:1+trail/s,
    squash:1-Math.min(.08, (trail/s)*.16),
    blur:Math.min(maxBlur, gain*Math.sqrt(raw)*gate),
  };
}

/* Sample an easing at ~60 fps; v is dp/ds (1 = average speed) */
export function sampleEase(ease, dur, n=Math.max(8, Math.round(dur/16))){
  const out=[];
  const h=1/(n*6);
  for(let i=0;i<=n;i++){
    const s=i/n;
    const a=Math.max(0, s-h), b=Math.min(1, s+h);
    out.push({offset:s, p:ease(s), v:(ease(b)-ease(a))/(b-a)});
  }
  return out;
}

export const lerp=(a, b, t)=>a+(b-a)*t;

export function cancelAll(el){
  el?.getAnimations?.().forEach((a)=>a.cancel());
}
