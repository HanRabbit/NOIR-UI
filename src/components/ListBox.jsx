import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cx} from '../core/utils.js';
import {anchorStyle, useAnchor, useControllable, useDismiss, useListNav, usePresence, useSmearIndicator, useStableId} from '../core/hooks.js';
import {Portal, Swap, Thumb} from '../core/Swap.jsx';
import {IconCheck, IconChevron} from '../core/icons.jsx';
import './Overlay.css';

const norm=(o)=>typeof o==='object'?o:{value:o, label:String(o)};

/*
 * Items: {value, label, hint, icon, shortcut, group, disabled, danger, separator}
 * The highlight is a single thumb that glides (and smears) to the active row.
 */
export function ListBox({items=[], active=-1, onActive, onPick, selected, role='listbox', itemRole='option', stagger=true, id, className, ...rest}){
  const rootRef=useRef(null);
  const sig=items.map((it)=>it.value).join('|');
  const thumb=useSmearIndicator(rootRef, '[data-active="true"]', [active, sig]);
  useEffect(()=>{
    rootRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:'nearest'});
  },[active]);
  const showCheck=selected!==undefined;
  let lastGroup;
  return <div ref={rootRef} role={role} id={id} className={cx('nr-lb', stagger&&'stagger', className)} {...rest}>
    <Thumb thumb={thumb}/>
    {items.map((it, i)=>{
      const head=it.group && it.group!==lastGroup;
      lastGroup=it.group;
      const key=it.value??`i${i}`;
      if(it.separator) return <div key={`sep-${i}`} className="nr-lb-sep" role="separator"/>;
      const isSel=showCheck && (Array.isArray(selected)?selected.includes(it.value):String(selected)===String(it.value));
      return <React.Fragment key={key}>
        {head&&<div className="nr-lb-group" role="presentation">{it.group}</div>}
        <div
          role={itemRole}
          id={id?`${id}-${i}`:undefined}
          aria-selected={itemRole==='option'?isSel:undefined}
          aria-disabled={it.disabled||undefined}
          data-active={i===active||undefined}
          className={cx('nr-lb-item', isSel&&'sel', it.danger&&'danger', it.disabled&&'disabled')}
          style={{'--i':Math.min(i, 12)}}
          onPointerMove={()=>{ if(!it.disabled && i!==active) onActive?.(i); }}
          onClick={()=>{ if(!it.disabled) onPick?.(it, i); }}
        >
          {it.icon&&<span className="nr-lb-icon">{it.icon}</span>}
          <span className="nr-lb-label">{it.label}</span>
          {it.hint&&<small className="nr-lb-hint">{it.hint}</small>}
          {it.shortcut&&<span className="nr-lb-kbd">{it.shortcut}</span>}
          {showCheck&&<IconCheck className="nr-lb-check" size={14} strokeWidth={2.2}/>}
        </div>
      </React.Fragment>;
    })}
  </div>;
}

export function Select({value, defaultValue, onChange, options=[], placeholder='Select…', size='md', disabled=false, block=false, menuWidth, className, 'aria-label':ariaLabel}){
  const opts=options.map(norm);
  const [val,setVal]=useControllable(value, defaultValue, onChange);
  const [open,setOpen]=useState(false);
  const btnRef=useRef(null);
  const menuRef=useRef(null);
  const lid=useStableId('sel');
  const {alive, shown}=usePresence(open);
  const [box]=useAnchor(open, btnRef, {width:menuWidth||'anchor', minWidth:size==='sm'?120:150, maxHeight:280});
  const selIdx=opts.findIndex((o)=>String(o.value)===String(val));
  const close=(refocus=true)=>{ setOpen(false); if(refocus) btnRef.current?.focus({preventScroll:true}); };
  const pick=(o)=>{ setVal(o.value); close(); };
  const nav=useListNav(opts, {onPick:pick});
  useDismiss(open, [btnRef, menuRef], (why)=>close(why==='escape'));
  useLayoutEffect(()=>{ if(open) nav.setActive(selIdx>=0?selIdx:0); },[open]);
  useEffect(()=>{ if(shown && open) menuRef.current?.focus({preventScroll:true}); },[shown, open]);
  const sel=opts[selIdx];
  return <div className={cx('nr-select', `nr-select-${size}`, block&&'block', open&&'open', disabled&&'disabled', className)}>
    <button
      ref={btnRef}
      type="button"
      className="nr-select-btn"
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open?lid:undefined}
      aria-label={ariaLabel}
      onClick={()=>setOpen((v)=>!v)}
      onKeyDown={(e)=>{ if(!open && (e.key==='ArrowDown'||e.key==='ArrowUp')){ e.preventDefault(); setOpen(true); } }}
    >
      <span className={cx('nr-select-value', !sel&&'placeholder')}><Swap swapKey={String(sel?.value??'__none')}>{sel?<>{sel.icon}{sel.label}</>:placeholder}</Swap></span>
      <IconChevron className="nr-select-chev" size={size==='sm'?13:14}/>
    </button>
    {alive&&<Portal>
      <div
        ref={menuRef}
        tabIndex={-1}
        className={cx('nr-float nr-menu', `nr-menu-${size}`, shown&&open&&'open')}
        data-side={box?.side||'bottom'}
        style={anchorStyle(box)}
        aria-activedescendant={nav.active>=0?`${lid}-${nav.active}`:undefined}
        onKeyDown={(e)=>{ if(e.key==='Tab'){ close(false); return; } nav.onKeyDown(e); }}
      >
        <ListBox id={lid} items={opts} active={nav.active} onActive={nav.setActive} onPick={pick} selected={val}/>
      </div>
    </Portal>}
  </div>;
}

/* Action menu attached to any trigger element */
export function Menu({trigger, items=[], placement='bottom', align='start', width=208, className}){
  const [open,setOpen]=useState(false);
  const anchorRef=useRef(null);
  const menuRef=useRef(null);
  const {alive, shown}=usePresence(open);
  const [box]=useAnchor(open, anchorRef, {placement, align, width});
  const close=(refocus)=>{
    setOpen(false);
    if(refocus) anchorRef.current?.querySelector('button,[tabindex]')?.focus({preventScroll:true});
  };
  const pick=(it)=>{ close(true); it.onSelect?.(); };
  const nav=useListNav(items, {onPick:pick});
  useDismiss(open, [anchorRef, menuRef], (why)=>close(why==='escape'));
  useLayoutEffect(()=>{ if(open) nav.setActive(-1); },[open]);
  useEffect(()=>{ if(shown && open) menuRef.current?.focus({preventScroll:true}); },[shown, open]);
  return <>
    <span ref={anchorRef} className={cx('nr-anchor', open&&'open')} onClick={()=>setOpen((v)=>!v)} onKeyDown={(e)=>{ if(!open && e.key==='ArrowDown'){ e.preventDefault(); setOpen(true); } }}>{trigger}</span>
    {alive&&<Portal>
      <div
        ref={menuRef}
        tabIndex={-1}
        className={cx('nr-float nr-menu', shown&&open&&'open', className)}
        data-side={box?.side||placement}
        style={anchorStyle(box)}
        onKeyDown={(e)=>{ if(e.key==='Tab'){ close(false); return; } nav.onKeyDown(e); }}
      >
        <ListBox role="menu" itemRole="menuitem" items={items} active={nav.active} onActive={nav.setActive} onPick={pick}/>
      </div>
    </Portal>}
  </>;
}
