import React, {useRef} from 'react';
import {cx} from '../core/utils.js';
import {useControllable, useSmearIndicator} from '../core/hooks.js';
import {Swap, Thumb} from '../core/Swap.jsx';
import {Tooltip} from './Popover.jsx';
import './Segmented.css';

const norm=(o)=>typeof o==='object'?o:{value:o, label:String(o)};

function moveFocus(e, root, onPick){
  const keys={ArrowRight:1, ArrowDown:1, ArrowLeft:-1, ArrowUp:-1};
  if(!(e.key in keys)) return;
  e.preventDefault();
  const btns=[...root.querySelectorAll('[role="tab"]:not(:disabled),[role="radio"]:not(:disabled)')];
  const i=btns.indexOf(document.activeElement);
  const next=btns[(i+keys[e.key]+btns.length)%btns.length];
  next?.focus();
  next?.click();
}

/* Segmented control; the white thumb smears between segments */
export function Segmented({value, defaultValue, onChange, options=[], size='md', disabled=false, block=false, className, 'aria-label':ariaLabel}){
  const opts=options.map(norm);
  const [val,setVal]=useControllable(value, defaultValue??opts[0]?.value, onChange);
  const rootRef=useRef(null);
  const thumb=useSmearIndicator(rootRef, '[aria-checked="true"]', [val, opts.length]);
  return <div ref={rootRef} role="radiogroup" aria-label={ariaLabel} className={cx('nr-seg', `nr-seg-${size}`, block&&'block', disabled&&'disabled', className)} onKeyDown={(e)=>moveFocus(e, rootRef.current)}>
    <Thumb thumb={thumb} invert/>
    {opts.map((o)=>{
      const on=String(o.value)===String(val);
      return <button
        type="button"
        role="radio"
        key={o.value}
        aria-checked={on}
        tabIndex={on?0:-1}
        disabled={disabled||o.disabled}
        className={on?'on':''}
        onClick={()=>!on&&setVal(o.value)}
      >{o.icon}{o.label!=null&&<span>{o.label}</span>}</button>;
    })}
  </div>;
}

/*
 * Tabs: variant "pill" (filled thumb) or "line" (underline that stretches).
 * When items carry `content`, the panel smears in the direction of travel.
 */
export function Tabs({value, defaultValue, onChange, items=[], variant='line', className, panelClassName, children}){
  const [val,setVal]=useControllable(value, defaultValue??items[0]?.value, onChange);
  const rootRef=useRef(null);
  const prevIdx=useRef(0);
  const idx=Math.max(0, items.findIndex((t)=>t.value===val));
  const dir=idx>=prevIdx.current?1:-1;
  const lastDir=useRef(dir);
  if(idx!==prevIdx.current){ lastDir.current=dir; prevIdx.current=idx; }
  const thumb=useSmearIndicator(rootRef, '[aria-selected="true"]', [val, items.length]);
  const active=items[idx];
  return <div className={cx('nr-tabs', className)}>
    <div ref={rootRef} role="tablist" className={cx('nr-tablist', `nr-tablist-${variant}`)} onKeyDown={(e)=>moveFocus(e, rootRef.current)}>
      <Thumb thumb={thumb} invert={variant==='pill'}/>
      {items.map((t)=>{
        const on=t.value===val;
        return <button type="button" role="tab" key={t.value} aria-selected={on} tabIndex={on?0:-1} disabled={t.disabled} className={on?'on':''} onClick={()=>!on&&setVal(t.value)}>
          {t.icon}<span>{t.label}</span>{t.badge!=null&&<em>{t.badge}</em>}
        </button>;
      })}
    </div>
    {active?.content!==undefined&&<div role="tabpanel" className={cx('nr-tabpanel', panelClassName)}>
      <Swap block as="div" axis="x" distance={28} dir={lastDir.current} swapKey={String(val)}>{active.content}</Swap>
    </div>}
    {children}
  </div>;
}

/* Vertical navigation; the active row glides and stretches vertically */
export function NavList({value, onChange, items=[], tooltips=false, className}){
  const rootRef=useRef(null);
  const thumb=useSmearIndicator(rootRef, '[aria-current="page"]', [value, items.length]);
  return <nav ref={rootRef} className={cx('nr-nav', className)}>
    <Thumb thumb={thumb} invert/>
    {items.map((it)=>{
      if(it.section) return <div className="nr-nav-section" key={`s-${it.section}`}>{it.section}</div>;
      const on=it.value===value;
      return <Tooltip key={it.value} content={it.label} placement="right" delay={120} disabled={!tooltips}>
        <button type="button" aria-current={on?'page':undefined} className={cx('nr-nav-item', on&&'on')} onClick={()=>onChange?.(it.value)}>
          {it.icon}<span>{it.label}</span>{it.badge!=null&&<em>{it.badge}</em>}
        </button>
      </Tooltip>;
    })}
  </nav>;
}
