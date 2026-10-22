import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
export {NumberFlow} from './NumberFlow.jsx';
import {cx} from '../core/utils.js';
import {useControllable, useInView, useSpotlight} from '../core/hooks.js';
import {Fold} from '../core/Swap.jsx';
import {IconChevron} from '../core/icons.jsx';
import {NumberFlow} from './NumberFlow.jsx';
import './Display.css';

/* Hairline surface; the border lights up under the pointer when `spotlight` */
export function Card({spotlight=true, interactive=false, className, children, as='section', onPointerMove, ...rest}){
  const Tag=as;
  const spot=useSpotlight();
  return <Tag className={cx('nr-card', spotlight&&'spot', interactive&&'interactive', className)} onPointerMove={(e)=>{ if(spotlight) spot(e); onPointerMove?.(e); }} {...rest}>
    {children}
  </Tag>;
}

export function CardHeader({title, meta, actions, className}){
  return <div className={cx('nr-card-head', className)}>
    <div className="nr-card-title">{title&&<h3>{title}</h3>}{meta&&<span>{meta}</span>}</div>
    {actions&&<div className="nr-card-actions">{actions}</div>}
  </div>;
}

export function Stat({label, value, sub, delta, icon, format, decimals, className}){
  const numeric=typeof value==='number';
  return <Card className={cx('nr-stat', className)}>
    <div className="nr-stat-top">
      <span className="nr-stat-label">{label}</span>
      {icon&&<span className="nr-stat-icon">{icon}</span>}
    </div>
    <div className="nr-stat-value">{numeric?<NumberFlow value={value} format={format} decimals={decimals}/>:value}</div>
    {(sub||delta!=null)&&<div className="nr-stat-sub">
      {delta!=null&&<span className={cx('nr-stat-delta', delta<0&&'neg')}>{delta>=0?'↑':'↓'} {Math.abs(delta).toFixed(1)}%</span>}
      {sub&&<span>{sub}</span>}
    </div>}
  </Card>;
}

/* Words resolve from blur one after another when scrolled into view */
export function BlurText({text, as='span', className, stagger=40, delay=0, by='word'}){
  const Tag=as;
  const ref=useRef(null);
  const seen=useInView(ref);
  const parts=by==='char'?Array.from(text):text.split(/(\s+)/);
  let n=0;
  return <Tag ref={ref} className={cx('nr-blurtext', seen&&'on', className)} aria-label={text}>
    {parts.map((p, i)=>/^\s+$/.test(p)
      ? <React.Fragment key={i}>{p}</React.Fragment>
      : <span key={i} aria-hidden="true" style={{'--d':`${delay+(n++)*stagger}ms`}}>{p}</span>)}
  </Tag>;
}

export function Accordion({items=[], value, defaultValue=[], onChange, multiple=false, className}){
  const [open,setOpen]=useControllable(value, defaultValue, onChange);
  const list=Array.isArray(open)?open:[open];
  const toggle=(id)=>{
    const on=list.includes(id);
    if(multiple) setOpen(on?list.filter((x)=>x!==id):[...list, id]);
    else setOpen(on?[]:[id]);
  };
  return <div className={cx('nr-accordion', className)}>
    {items.map((it)=>{
      const on=list.includes(it.value);
      return <div key={it.value} className={cx('nr-acc-item', on&&'open')}>
        <button type="button" className="nr-acc-trigger" aria-expanded={on} onClick={()=>toggle(it.value)}>
          <span>{it.title}</span>
          <IconChevron size={15} className="nr-acc-chev"/>
        </button>
        <Fold open={on}><div className="nr-acc-body">{it.content}</div></Fold>
      </div>;
    })}
  </div>;
}

export function Avatar({name='', src, size=32, status, letters=2, className}){
  const [loaded,setLoaded]=useState(false);
  const initials=name.split(/\s+/).filter(Boolean).slice(0, letters).map((w)=>w[0]).join('').toUpperCase();
  return <span className={cx('nr-avatar', className)} style={{width:size, height:size, fontSize:Math.round(size*.38)}} title={name}>
    <span className="nr-avatar-initials">{initials||'·'}</span>
    {src&&<img src={src} alt="" className={loaded?'on':''} onLoad={()=>setLoaded(true)}/>}
    {status&&<i className={cx('nr-avatar-status', status)}/>}
  </span>;
}

/* Overlapping stack that fans open on hover */
export function AvatarGroup({people=[], max=4, size=30, className}){
  const shown=people.slice(0, max);
  const extra=people.length-shown.length;
  return <div className={cx('nr-avatar-group', className)} style={{'--sz':`${size}px`}}>
    {/* stacked avatars overlap ~30%: one initial stays readable */}
    {shown.map((p, i)=><Avatar key={p.name+i} letters={1} {...p} size={size}/>)}
    {extra>0&&<span className="nr-avatar nr-avatar-more" style={{width:size, height:size, fontSize:Math.round(size*.34)}}>+{extra}</span>}
  </div>;
}

/* Line draws itself on mount; area fill fades in under it */
export function Sparkline({values=[], width=120, height=32, fill=true, className, strokeWidth=1.5}){
  const [drawn,setDrawn]=useState(false);
  useEffect(()=>{ const id=requestAnimationFrame(()=>setDrawn(true)); return ()=>cancelAnimationFrame(id); },[]);
  const d=useMemo(()=>{
    if(values.length<2) return {line:'', area:''};
    const lo=Math.min(...values), hi=Math.max(...values);
    const span=hi-lo||1;
    const pad=strokeWidth;
    const pts=values.map((v, i)=>[
      (i/(values.length-1))*width,
      pad+(1-(v-lo)/span)*(height-pad*2),
    ]);
    const line=pts.map(([x, y], i)=>`${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return {line, area:`${line} L${width} ${height} L0 ${height} Z`};
  },[values, width, height, strokeWidth]);
  return <svg className={cx('nr-spark', drawn&&'on', className)} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" preserveAspectRatio="none">
    {fill&&<path className="nr-spark-area" d={d.area}/>}
    <path className="nr-spark-line" d={d.line} pathLength="1" strokeWidth={strokeWidth}/>
  </svg>;
}

/* Monospace log stream (from LeapTracker's RTT terminal); new lines smear in */
export function LogView({lines=[], follow=true, cursor=false, height=220, className}){
  const ref=useRef(null);
  useLayoutEffect(()=>{
    const el=ref.current;
    if(follow && el) el.scrollTop=el.scrollHeight;
  },[lines.length, follow]);
  return <div ref={ref} className={cx('nr-log', className)} style={{height}} role="log" aria-live="polite">
    {lines.map((l, i)=><div className="nr-log-line" key={l.id??i}>
      {l.time&&<span className="nr-log-time">{l.time}</span>}
      {l.level&&<span className={cx('nr-log-tag', String(l.level).toLowerCase())}>{l.level}</span>}
      <span className="nr-log-msg">{l.text}</span>
    </div>)}
    {cursor&&<div className="nr-log-cursor"><span>›</span><i/></div>}
  </div>;
}
