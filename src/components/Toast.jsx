import React, {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {cx} from '../core/utils.js';
import {Portal, Swap} from '../core/Swap.jsx';
import {IconAlert, IconCheck, IconInfo, IconX} from '../core/icons.jsx';
import {Spinner} from './Feedback.jsx';
import './Toast.css';

/* Module-level store so toast() can be called from anywhere */
let toasts=[];
let seq=0;
const subs=new Set();
const emit=()=>{ toasts=[...toasts]; subs.forEach((f)=>f()); };
const subscribe=(f)=>{ subs.add(f); return ()=>subs.delete(f); };
const snapshot=()=>toasts;
const MAX_LIVE=6;
const LEAVE_MS=280;

function upsert(opts){
  const id=opts.id??`t${++seq}`;
  const i=toasts.findIndex((t)=>t.id===id);
  const base={type:'default', duration:opts.type==='loading'?0:4200};
  if(i>=0){
    toasts=toasts.map((t, j)=>j===i?{...t, ...base, ...opts, id, rev:(t.rev||0)+1, leaving:false}:t);
  }else{
    toasts=[{...base, ...opts, id, rev:0, created:Date.now()}, ...toasts];
    toasts.filter((t)=>!t.leaving).slice(MAX_LIVE).forEach((t)=>dismiss(t.id));
  }
  emit();
  return id;
}

function dismiss(id, how='fade'){
  const t=toasts.find((x)=>x.id===id);
  if(!t || t.leaving) return;
  toasts=toasts.map((x)=>x.id===id?{...x, leaving:how}:x);
  emit();
  setTimeout(()=>{ toasts=toasts.filter((x)=>x.id!==id); emit(); }, LEAVE_MS);
}

export function toast(title, opts={}){ return upsert({title, ...opts}); }
toast.success=(title, opts)=>toast(title, {...opts, type:'success'});
toast.error=(title, opts)=>toast(title, {...opts, type:'error'});
toast.info=(title, opts)=>toast(title, {...opts, type:'info'});
toast.loading=(title, opts)=>toast(title, {...opts, type:'loading'});
toast.dismiss=dismiss;
/* One toast morphs loading → success / error in place */
toast.promise=(promise, {loading='Working…', success='Done', error='Something went wrong'}={})=>{
  const id=toast.loading(loading);
  const msg=(m, v)=>typeof m==='function'?m(v):m;
  Promise.resolve(promise).then(
    (v)=>upsert({id, type:'success', title:msg(success, v), duration:3600}),
    (e)=>upsert({id, type:'error', title:msg(error, e), duration:5200}),
  );
  return promise;
};

const ICONS={
  success:<IconCheck size={15} strokeWidth={2.2}/>,
  error:<IconAlert size={15}/>,
  info:<IconInfo size={15}/>,
  loading:<Spinner size={14}/>,
};

function ToastItem({t, index, front, frontH, offset, expanded, position, onHeight}){
  const ref=useRef(null);
  const innerRef=useRef(null);
  const [mounted,setMounted]=useState(false);
  const [dx,setDx]=useState(0);
  const drag=useRef(null);
  const lastIndex=useRef(index);
  if(index>=0) lastIndex.current=index;
  const i=lastIndex.current;
  useLayoutEffect(()=>{
    const el=innerRef.current;
    if(!el) return undefined;
    const read=()=>onHeight(t.id, el.offsetHeight);
    read();
    if(typeof ResizeObserver==='undefined') return undefined;
    const ro=new ResizeObserver(read);
    ro.observe(el);
    return ()=>ro.disconnect();
  },[t.id, onHeight]);
  useEffect(()=>{ const id=requestAnimationFrame(()=>setMounted(true)); return ()=>cancelAnimationFrame(id); },[]);
  const up=position.startsWith('top')?1:-1;
  const hidden=i>=3 && !expanded;
  let y, scale=1, opacity=1;
  if(expanded){ y=offset*up; }
  else{ y=i*10*up; scale=1-i*0.05; opacity=i>=3?0:1-i*0.12; }
  const style={
    '--y':`${y}px`,
    '--s':scale,
    '--o':opacity,
    '--dx':`${dx}px`,
    zIndex:100-i,
    height:expanded||front?undefined:frontH||undefined,
    pointerEvents:hidden||t.leaving?'none':undefined,
  };
  const onDown=(e)=>{
    if(e.button!==0 || e.target.closest('button')) return;
    drag.current={x:e.clientX};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove=(e)=>{ if(drag.current) setDx(e.clientX-drag.current.x); };
  const onUp=()=>{
    if(!drag.current) return;
    drag.current=null;
    if(Math.abs(dx)>90) dismiss(t.id, dx>0?'swipe-r':'swipe-l');
    else setDx(0);
  };
  return <li
    ref={ref}
    className={cx('nr-toast', `type-${t.type}`, mounted&&'in', t.leaving&&`leave ${t.leaving}`, dx!==0&&'dragging', !front&&!expanded&&'behind')}
    style={style}
    role={t.type==='error'?'alert':'status'}
    onPointerDown={onDown}
    onPointerMove={onMove}
    onPointerUp={onUp}
    onPointerCancel={onUp}
  >
    <div ref={innerRef} className="nr-toast-inner">
      <Swap block as="div" swapKey={`${t.type}:${t.title}:${t.description||''}`}>
        <div className="nr-toast-row">
          {ICONS[t.type]&&<span className="nr-toast-icon">{ICONS[t.type]}</span>}
          <div className="nr-toast-text">
            <b>{t.title}</b>
            {t.description&&<p>{t.description}</p>}
          </div>
          {t.action&&<button type="button" className="nr-toast-action" onClick={()=>{ t.action.onClick?.(); dismiss(t.id); }}>{t.action.label}</button>}
        </div>
      </Swap>
      <button type="button" className="nr-toast-close" aria-label="Dismiss" onClick={()=>dismiss(t.id)}><IconX size={12} strokeWidth={2}/></button>
    </div>
    {t.duration>0&&!t.leaving&&<i
      key={t.rev}
      className="nr-toast-timer"
      style={{'--d':`${t.duration}ms`, animationPlayState:expanded||dx?'paused':'running'}}
      onAnimationEnd={()=>dismiss(t.id)}
    />}
  </li>;
}

/* position: bottom-right | bottom-left | top-right | top-left | bottom-center | top-center */
export function Toaster({position='bottom-right', gap=10}){
  const list=useSyncExternalStore(subscribe, snapshot, snapshot);
  const [expanded,setExpanded]=useState(false);
  const [heights,setHeights]=useState({});
  const onHeight=useRef((id, h)=>setHeights((m)=>m[id]===h?m:{...m, [id]:h})).current;
  const live=list.filter((t)=>!t.leaving);
  useEffect(()=>{ if(!live.length) setExpanded(false); },[live.length]);
  const frontH=heights[live[0]?.id]||0;
  let acc=0;
  const offsets={};
  live.forEach((t)=>{ offsets[t.id]=acc; acc+=(heights[t.id]||0)+gap; });
  return <Portal>
    <ol
      className={cx('nr-toaster', `pos-${position}`, expanded&&'expanded')}
      style={{'--stack-h':`${expanded?Math.max(0, acc-gap):frontH+20}px`}}
      onPointerEnter={()=>setExpanded(true)}
      onPointerLeave={()=>setExpanded(false)}
      aria-live="polite"
    >
      {list.map((t)=>{
        const index=live.indexOf(t);
        return <ToastItem key={t.id} t={t} index={index} front={index===0} frontH={frontH} offset={offsets[t.id]??0} expanded={expanded} position={position} onHeight={onHeight}/>;
      })}
    </ol>
  </Portal>;
}
