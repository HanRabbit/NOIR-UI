import React, {forwardRef} from 'react';
import {cx} from '../core/utils.js';
import {useMagnetic, useRipple, useSpotlight} from '../core/hooks.js';
import {Fold, Swap} from '../core/Swap.jsx';
import {IconCheck} from '../core/icons.jsx';
import {Spinner} from './Feedback.jsx';
import './Button.css';

/*
 * variant: primary | secondary | ghost | outline
 * swapKey: change it to cross-smear the label (e.g. "Connect" → "Disconnect")
 */
export const Button=forwardRef(function Button({variant='secondary', size='md', loading=false, icon, iconRight, swapKey, magnetic=false, block=false, className, children, disabled, onPointerDown, onPointerMove, onPointerLeave, type='button', ...rest}, ref){
  const ripple=useRipple(disabled||loading);
  const spot=useSpotlight();
  const mag=useMagnetic(0.18, magnetic && !disabled);
  const key=loading?'__loading':(swapKey??'');
  return <button
    ref={ref}
    type={type}
    className={cx('nr-btn', `nr-btn-${variant}`, `nr-btn-${size}`, block&&'block', loading&&'loading', 'nr-ripple-host', className)}
    disabled={disabled||loading}
    aria-busy={loading||undefined}
    onPointerDown={(e)=>{ ripple(e); onPointerDown?.(e); }}
    onPointerMove={(e)=>{ spot(e); mag.onPointerMove?.(e); onPointerMove?.(e); }}
    onPointerLeave={(e)=>{ mag.onPointerLeave?.(e); onPointerLeave?.(e); }}
    {...rest}
  >
    <span className="nr-btn-sheen" aria-hidden="true"/>
    <Swap swapKey={key} className="nr-btn-label">
      {loading?<><Spinner size={size==='sm'?12:14}/>{children}</>:<>{icon}{children}{iconRight}</>}
    </Swap>
  </button>;
});

export const IconButton=forwardRef(function IconButton({label, size='md', variant='ghost', className, children, onPointerDown, swapKey, ...rest}, ref){
  const ripple=useRipple(rest.disabled);
  return <button
    ref={ref}
    type="button"
    aria-label={label}
    title={label}
    className={cx('nr-icon-btn', `nr-icon-btn-${size}`, `nr-icon-btn-${variant}`, 'nr-ripple-host', className)}
    onPointerDown={(e)=>{ ripple(e); onPointerDown?.(e); }}
    {...rest}
  >
    {swapKey!==undefined?<Swap swapKey={swapKey} center>{children}</Swap>:children}
  </button>;
});

/* Toggleable pill; a check folds in from zero width when selected */
export function Chip({selected=false, onToggle, check=true, className, children, icon, ...rest}){
  return <button
    type="button"
    aria-pressed={selected}
    className={cx('nr-chip', selected&&'on', className)}
    onClick={()=>onToggle?.(!selected)}
    {...rest}
  >
    {check&&<Fold as="span" axis="x" open={selected} className="nr-chip-check"><IconCheck size={12} strokeWidth={2.4}/></Fold>}
    {icon}
    <span>{children}</span>
  </button>;
}
