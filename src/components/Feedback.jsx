import React from 'react';
import {clamp, cx} from '../core/utils.js';
import {IconCheck} from '../core/icons.jsx';
import './Feedback.css';

export function Spinner({size=16, className, label='Loading'}){
  return <svg className={cx('nr-spinner', className)} width={size} height={size} viewBox="0 0 50 50" role="status" aria-label={label}>
    <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4.5" stroke="currentColor" strokeLinecap="round"/>
  </svg>;
}

/* value=null → indeterminate smear sweep */
export function Progress({value=null, max=100, size='md', className, label}){
  const pct=value==null?null:clamp((value/max)*100, 0, 100);
  return <div
    className={cx('nr-progress', `nr-progress-${size}`, pct==null&&'indeterminate', className)}
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={value??undefined}
  >
    <i className="nr-progress-bar" style={pct==null?undefined:{transform:`scaleX(${pct/100})`}}/>
    {pct!=null&&<i className="nr-progress-head" style={{left:`${pct}%`, opacity:pct>0&&pct<100?1:0}}/>}
  </div>;
}

export function ProgressRing({value=0, max=100, size=44, stroke=3, children, className}){
  const r=(size-stroke)/2;
  const c=2*Math.PI*r;
  const pct=clamp(value/max, 0, 1);
  return <div className={cx('nr-ring', className)} style={{width:size, height:size}} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle className="nr-ring-track" cx={size/2} cy={size/2} r={r} strokeWidth={stroke} fill="none"/>
      <circle className="nr-ring-bar" cx={size/2} cy={size/2} r={r} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c*(1-pct)} strokeLinecap="round"/>
    </svg>
    {children!=null&&<span className="nr-ring-label">{children}</span>}
  </div>;
}

export function Skeleton({width, height=12, radius, circle=false, className, style}){
  return <span
    className={cx('nr-skeleton', circle&&'circle', className)}
    style={{width:circle?height:width, height, borderRadius:radius, ...style}}
    aria-hidden="true"
  />;
}

/* variant: solid | outline | soft */
export function Badge({variant='outline', className, children, dot=false}){
  return <span className={cx('nr-badge', `nr-badge-${variant}`, className)}>{dot&&<i className="nr-badge-dot"/>}{children}</span>;
}

/* status: live | idle | busy | off */
export function StatusDot({status='live', label, className}){
  return <span className={cx('nr-status', `nr-status-${status}`, className)} role={label?'status':undefined}>
    <i className="nr-status-dot"/>
    {label&&<span>{label}</span>}
  </span>;
}

export function Kbd({children, className}){
  return <kbd className={cx('nr-kbd', className)}>{children}</kbd>;
}

export function Divider({vertical=false, label, className}){
  if(label) return <div className={cx('nr-divider labeled', className)} role="separator"><span>{label}</span></div>;
  return <div className={cx('nr-divider', vertical&&'v', className)} role="separator" aria-orientation={vertical?'vertical':'horizontal'}/>;
}

/* Rail fills toward the current step, which pings; finished steps settle into solid ink */
export function Steps({steps=[], current=0, className, 'aria-label':ariaLabel='Progress'}){
  const n=steps.length;
  const pct=n>1?clamp(current/(n-1), 0, 1):0;
  return <div className={cx('nr-steps', className)} style={{'--n':Math.max(1, n)}}>
    <i className="nr-steps-rail" aria-hidden="true"><i className="nr-steps-fill" style={{transform:`scaleX(${pct})`}}/></i>
    <ol className="nr-steps-list" aria-label={ariaLabel}>
      {steps.map((s, i)=>{
        const state=i<current?'done':i===current?'active':'todo';
        return <li key={i} className={cx('nr-step', state)} aria-current={state==='active'?'step':undefined}>
          <span className="nr-step-dot"><i className="nr-step-ping" aria-hidden="true"/>{state==='done'?<IconCheck size={11} strokeWidth={2.6}/>:i+1}</span>
          <span className="nr-step-text"><b>{s.label}</b>{s.hint&&<small>{s.hint}</small>}</span>
        </li>;
      })}
    </ol>
  </div>;
}
