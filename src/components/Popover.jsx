import React, {useEffect, useRef, useState} from 'react';
import {cx} from '../core/utils.js';
import {anchorStyle, useAnchor, useControllable, useDismiss, useHold, usePresence, useStableId} from '../core/hooks.js';
import {Portal} from '../core/Swap.jsx';
import './Overlay.css';

export function Popover({trigger, children, open, defaultOpen=false, onOpenChange, placement='bottom', align='start', width, className}){
  const [isOpen,setOpen]=useControllable(open, defaultOpen, onOpenChange);
  const anchorRef=useRef(null);
  const boxRef=useRef(null);
  const {alive, shown}=usePresence(isOpen);
  const [box]=useAnchor(isOpen, anchorRef, {placement, align, width, maxHeight:520});
  useDismiss(isOpen, [anchorRef, boxRef], ()=>setOpen(false));
  const close=()=>setOpen(false);
  const body=useHold(typeof children==='function'?children({close}):children, isOpen);
  return <>
    <span ref={anchorRef} className={cx('nr-anchor', isOpen&&'open')} onClick={()=>setOpen(!isOpen)}>{trigger}</span>
    {alive&&<Portal>
      <div ref={boxRef} role="dialog" className={cx('nr-float nr-popover', shown&&isOpen&&'open', className)} data-side={box?.side||placement} style={anchorStyle(box)}>
        {body}
      </div>
    </Portal>}
  </>;
}

/* Shared warm-up: once one tooltip has shown, neighbours open without delay */
let lastClose=0;

export function Tooltip({content, children, placement='top', delay=320, disabled=false, className}){
  const [open,setOpen]=useState(false);
  const anchorRef=useRef(null);
  const timer=useRef(0);
  const id=useStableId('tip');
  const {alive, shown}=usePresence(open, 180);
  const [box]=useAnchor(open, anchorRef, {placement, align:'center', offset:8});
  const show=()=>{
    if(disabled) return;
    clearTimeout(timer.current);
    const warm=Date.now()-lastClose<400;
    timer.current=setTimeout(()=>setOpen(true), warm?0:delay);
  };
  const hide=()=>{
    clearTimeout(timer.current);
    if(open) lastClose=Date.now();
    setOpen(false);
  };
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  useEffect(()=>{ if(disabled){ clearTimeout(timer.current); setOpen(false); } },[disabled]);
  const held=useHold(content, open);
  if(!content) return children;
  return <>
    <span
      ref={anchorRef}
      className="nr-anchor"
      aria-describedby={open?id:undefined}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={show}
      onBlur={hide}
    >{children}</span>
    {alive&&<Portal>
      <div id={id} role="tooltip" className={cx('nr-float nr-tooltip', shown&&open&&'open', className)} data-side={box?.side||placement} style={anchorStyle(box)}>{held}</div>
    </Portal>}
  </>;
}
