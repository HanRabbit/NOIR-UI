import React, {forwardRef, useEffect, useRef} from 'react';
import {cx} from '../core/utils.js';
import {useParity, useStableId} from '../core/hooks.js';
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
      <Swap swapKey={error?`e:${error}`:`h:${hint||''}`}>{msg||' '}</Swap>
    </div>
  </div>;
}
