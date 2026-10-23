import React, {forwardRef, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cx, prefersReducedMotion} from '../core/utils.js';
import {DUR, EASE} from '../core/motion.js';
import {useControllable, useParity, useStableId} from '../core/hooks.js';
import {Swap} from '../core/Swap.jsx';
import {IconX} from '../core/icons.jsx';
import './Input.css';

/* Focus line grows outward from where the pointer landed, not from the centre */
function useFocusOrigin(){
  return (e)=>{
    const host=e.currentTarget;
    const r=host.getBoundingClientRect();
    const x=e.clientX?((e.clientX-r.left)/r.width)*100:50;
    host.style.setProperty('--nr-fx', `${x.toFixed(1)}%`);
  };
}

function useShake(invalid){
  const [p,bump]=useParity();
  const was=useRef(invalid);
  useEffect(()=>{ if(invalid && !was.current) bump(); was.current=invalid; },[invalid, bump]);
  return p;
}

export const Input=forwardRef(function Input({prefix, suffix, clearable=false, onClear, invalid=false, size='md', mono=false, className, value, onChange, disabled, ...rest}, ref){
  const local=useRef(null);
  const setRef=(el)=>{ local.current=el; if(typeof ref==='function') ref(el); else if(ref) ref.current=el; };
  const origin=useFocusOrigin();
  const shake=useShake(invalid);
  const hasValue=value!=null && String(value).length>0;
  return <div
    className={cx('nr-input', `nr-input-${size}`, invalid&&'invalid', disabled&&'disabled', shake&&`shake${shake}`, className)}
    onPointerDown={origin}
    onClick={()=>local.current?.focus()}
  >
    {prefix&&<span className="nr-input-affix">{prefix}</span>}
    <input ref={setRef} className={mono?'nr-mono':undefined} value={value} onChange={onChange} disabled={disabled} aria-invalid={invalid||undefined} {...rest}/>
    {clearable&&<button type="button" tabIndex={-1} aria-label="Clear" className={cx('nr-input-clear', hasValue&&'on')} onClick={(e)=>{ e.stopPropagation(); onClear?.(); local.current?.focus(); }}><IconX size={12} strokeWidth={2}/></button>}
    {suffix&&<span className="nr-input-affix">{suffix}</span>}
    <i className="nr-input-line" aria-hidden="true"/>
  </div>;
});

export const Textarea=forwardRef(function Textarea({invalid=false, className, autoGrow=true, rows=3, onInput, ...rest}, ref){
  const origin=useFocusOrigin();
  const shake=useShake(invalid);
  const grow=(e)=>{
    if(autoGrow){
      const el=e.currentTarget;
      el.style.height='auto';
      el.style.height=`${el.scrollHeight}px`;
    }
    onInput?.(e);
  };
  return <div className={cx('nr-input nr-textarea', invalid&&'invalid', shake&&`shake${shake}`, className)} onPointerDown={origin}>
    <textarea ref={ref} rows={rows} onInput={grow} aria-invalid={invalid||undefined} {...rest}/>
    <i className="nr-input-line" aria-hidden="true"/>
  </div>;
});

/* Label + control + hint/error; message cross-smears when it changes */
export function Field({label, hint, error, required=false, children, className, htmlFor}){
  const id=useStableId('field');
  const target=htmlFor||id;
  const child=React.isValidElement(children)&&!children.props.id
    ? React.cloneElement(children, {id:target, invalid:children.props.invalid??Boolean(error)})
    : children;
  const msg=error||hint;
  return <div className={cx('nr-field', error&&'has-error', className)}>
    {label&&<label htmlFor={target} className="nr-field-label">{label}{required&&<span aria-hidden="true"> *</span>}</label>}
    {child}
    <div className="nr-field-msg" aria-live="polite">
      <Swap swapKey={error?`e:${error}`:`h:${hint||''}`}>{msg||' '}</Swap>
    </div>
  </div>;
}

/*
 * Stepper: the value rolls in the direction it moved (Swap dir). - and + hold to
 * repeat after a beat and stop at the bounds. Arrow keys nudge; Home and End jump.
 */
export function NumberInput({value, defaultValue=0, onChange, min=-Infinity, max=Infinity, step=1, precision=0, format=(v)=>v.toFixed(precision), size='md', disabled=false, invalid=false, id, className, 'aria-label':ariaLabel}){
  const [val,setVal]=useControllable(value, defaultValue, onChange);
  /* the repeat timer reads the latest rendered value; it is not advanced here, so a parent that declines a change keeps display and repeat in step */
  const latest=useRef(val);
  latest.current=val;
  const dir=useRef(1);
  const hold=useRef({t:0, i:0});
  const origin=useFocusOrigin();
  const shake=useShake(invalid);
  const move=(next)=>{
    const n=Math.min(max, Math.max(min, Number(next.toFixed(precision))));
    if(n===latest.current) return false;
    dir.current=n>latest.current?1:-1;
    setVal(n);
    return true;
  };
  const stop=()=>{ clearTimeout(hold.current.t); clearInterval(hold.current.i); };
  const press=(d)=>(e)=>{
    if(e.button!==0 || disabled) return;
    stop();
    move(latest.current+d*step);
    hold.current.t=setTimeout(()=>{ hold.current.i=setInterval(()=>{ if(!move(latest.current+d*step)) stop(); }, 70); }, 380);
  };
  useEffect(()=>stop,[]);
  const onKey=(e)=>{
    if(disabled) return;
    const map={ArrowUp:1, ArrowRight:1, ArrowDown:-1, ArrowLeft:-1};
    if(e.key in map){ e.preventDefault(); move(latest.current+map[e.key]*step); }
    else if(e.key==='Home' && Number.isFinite(min)){ e.preventDefault(); move(min); }
    else if(e.key==='End' && Number.isFinite(max)){ e.preventDefault(); move(max); }
  };
  const atMin=val<=min, atMax=val>=max;
  return <div className={cx('nr-input nr-numin', `nr-input-${size}`, invalid&&'invalid', shake&&`shake${shake}`, disabled&&'disabled', className)} onPointerDown={origin}>
    <button type="button" tabIndex={-1} aria-label="Decrease" className="nr-numin-btn" disabled={disabled||atMin} onPointerDown={press(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>−</button>
    <span id={id} role="spinbutton" aria-label={ariaLabel} aria-valuenow={val} aria-valuemin={Number.isFinite(min)?min:undefined} aria-valuemax={Number.isFinite(max)?max:undefined} aria-disabled={disabled||undefined} tabIndex={disabled?-1:0} className="nr-numin-value" onKeyDown={onKey}>
      <Swap swapKey={String(val)} dir={dir.current} axis="y" center>{format(val)}</Swap>
    </span>
    <button type="button" tabIndex={-1} aria-label="Increase" className="nr-numin-btn" disabled={disabled||atMax} onPointerDown={press(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>+</button>
    <i className="nr-input-line" aria-hidden="true"/>
  </div>;
}

/*
 * Enter or comma commits a tag; Backspace on an empty field lifts the last one off.
 * New tags blur in from nothing. A removed tag blurs out where it sat while its box
 * closes up, so the tags after it slide across instead of jumping.
 */
/* A tag on its way out: it blurs away in place while its width collapses to nothing */
function TagGhost({text, onDone}){
  const ref=useRef(null);
  const done=useRef(onDone);
  done.current=onDone;
  useLayoutEffect(()=>{
    const el=ref.current;
    if(!el) return undefined;
    if(typeof el.animate!=='function'){ done.current(); return undefined; }
    const cs=getComputedStyle(el);
    const w=el.getBoundingClientRect().width;
    const pl=parseFloat(cs.paddingLeft)||0, pr=parseFloat(cs.paddingRight)||0;
    const gap=parseFloat(getComputedStyle(el.parentElement).columnGap)||0;
    /* the flex gap after it is cancelled too, so the neighbours close the whole distance */
    const anim=el.animate([
      {width:`${w}px`, paddingLeft:`${pl}px`, paddingRight:`${pr}px`, marginRight:'0px'},
      {width:'0px', paddingLeft:'0px', paddingRight:'0px', marginRight:`${-gap}px`},
    ], {duration:DUR.travel, easing:EASE.travel.css, fill:'forwards'});
    anim.finished.then(()=>done.current(), ()=>{});
    return ()=>anim.cancel();
  },[]);
  return <span ref={ref} className="nr-tag leaving" aria-hidden="true"><span>{text}</span><i className="nr-tag-x"><IconX size={9} strokeWidth={2.4}/></i></span>;
}

export function TagInput({value, defaultValue=[], onChange, placeholder='Add…', max=Infinity, size='md', invalid=false, disabled=false, id, className, 'aria-label':ariaLabel}){
  const [tags,setTags]=useControllable(value, defaultValue, onChange);
  const [draft,setDraft]=useState('');
  const [gone,setGone]=useState([]);
  const seq=useRef(0);
  /* a parent that declines the removal keeps the tag: drop its ghost rather than fade it over a live tag */
  useLayoutEffect(()=>{
    setGone((g)=>{ const k=g.filter((x)=>!tags.includes(x.text)); return k.length===g.length?g:k; });
  },[gone, tags]);
  const origin=useFocusOrigin();
  const shake=useShake(invalid);
  const ref=useRef(null);
  const full=tags.length>=max;
  const commit=()=>{
    const t=draft.trim();
    if(!t || full) return;
    if(!tags.includes(t)) setTags([...tags, t]);
    setDraft('');
  };
  /* the tag at i leaves: a ghost takes its slot; ghosts sitting behind it shift down one */
  const lift=(i)=>{
    if(!prefersReducedMotion()) setGone((g)=>[...g.map((x)=>(x.at>i?{...x, at:x.at-1}:x)), {id:++seq.current, text:tags[i], at:i}]);
    setTags(tags.filter((_, j)=>j!==i));
  };
  const onKey=(e)=>{
    if(e.key==='Enter' || e.key===','){ e.preventDefault(); commit(); }
    else if(e.key==='Backspace' && !draft && tags.length) lift(tags.length-1);
  };
  const ghost=(g)=><TagGhost key={`g${g.id}`} text={g.text} onDone={()=>setGone((all)=>all.filter((x)=>x.id!==g.id))}/>;
  return <div className={cx('nr-input nr-tagin', `nr-input-${size}`, invalid&&'invalid', shake&&`shake${shake}`, disabled&&'disabled', className)} onPointerDown={origin} onClick={()=>ref.current?.focus()}>
    {tags.flatMap((t, i)=>[
      ...gone.filter((g)=>g.at===i).map(ghost),
      <span className="nr-tag" key={`t${t}`}>
        <span>{t}</span>
        <button type="button" tabIndex={-1} disabled={disabled} aria-label={`Remove ${t}`} className="nr-tag-x" onClick={(e)=>{ e.stopPropagation(); lift(i); }}><IconX size={9} strokeWidth={2.4}/></button>
      </span>,
    ])}
    {gone.filter((g)=>g.at>=tags.length).map(ghost)}
    <input ref={ref} id={id} aria-label={ariaLabel} aria-invalid={invalid||undefined} value={draft} disabled={disabled} placeholder={full?'':placeholder} onChange={(e)=>setDraft(e.target.value)} onKeyDown={onKey}/>
    <i className="nr-input-line" aria-hidden="true"/>
  </div>;
}

const fmtBytes=(b)=>b<1024?`${b} B`:b<1048576?`${(b/1024).toFixed(1)} KB`:`${(b/1048576).toFixed(1)} MB`;

/*
 * Drop zone: a ring blurs in around the frame while a file is held over it. A depth
 * counter keeps it lit while the pointer crosses child elements. Enter or click opens the picker.
 */
export function FileDrop({onFiles, accept, multiple=true, label='Drop files here', hint, disabled=false, className}){
  const [over,setOver]=useState(false);
  const [files,setFiles]=useState([]);
  const picker=useRef(null);
  const depth=useRef(0);
  const take=(list)=>{
    const next=Array.from(list||[]).slice(0, multiple?Infinity:1);
    if(!next.length) return;
    setFiles((f)=>multiple?[...f, ...next]:next);
    onFiles?.(next);
  };
  const open=()=>{ if(!disabled) picker.current?.click(); };
  const drag=(on)=>{ depth.current=on?depth.current+1:Math.max(0, depth.current-1); setOver(depth.current>0 && !disabled); };
  return <div className={cx('nr-drop-wrap', className)}>
    <div
      role="button"
      tabIndex={disabled?-1:0}
      aria-disabled={disabled||undefined}
      className={cx('nr-drop', over&&'over', disabled&&'disabled')}
      onClick={open}
      onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); open(); } }}
      onDragEnter={(e)=>{ e.preventDefault(); drag(true); }}
      onDragLeave={()=>drag(false)}
      onDragOver={(e)=>e.preventDefault()}
      onDrop={(e)=>{ e.preventDefault(); depth.current=0; setOver(false); if(!disabled) take(e.dataTransfer.files); }}
    >
      <i className="nr-drop-ring" aria-hidden="true"/>
      <span className="nr-drop-label">{label}</span>
      {hint&&<span className="nr-drop-hint">{hint}</span>}
      <input ref={picker} type="file" hidden accept={accept} multiple={multiple} disabled={disabled} onClick={(e)=>e.stopPropagation()} onChange={(e)=>{ take(e.target.files); e.target.value=''; }}/>
    </div>
    {files.length>0&&<ul className="nr-drop-list">
      {files.map((f, i)=><li key={`${i}-${f.name}`}><span>{f.name}</span><em>{fmtBytes(f.size)}</em></li>)}
    </ul>}
  </div>;
}
