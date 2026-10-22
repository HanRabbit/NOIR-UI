export const SMEAR_MS=260;

export const cx=(...parts)=>parts.filter(Boolean).join(' ');

export const clamp=(n, lo, hi)=>Math.min(hi, Math.max(lo, n));

export const isBrowser=typeof window!=='undefined';

export function prefersReducedMotion(){
  return isBrowser && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

/*
 * While a drag is held, stop the browser from selecting text the pointer passes
 * over. preventDefault on pointerdown alone doesn't do this in Chromium.
 * Returns the unlock function.
 */
export function lockSelection(){
  if(!isBrowser) return ()=>{};
  const block=(e)=>e.preventDefault();
  document.addEventListener('selectstart', block, true);
  document.addEventListener('dragstart', block, true);
  window.getSelection?.()?.removeAllRanges?.();
  const st=document.documentElement.style;
  const prev=[st.userSelect, st.webkitUserSelect];
  st.userSelect='none';
  st.webkitUserSelect='none';
  return ()=>{
    document.removeEventListener('selectstart', block, true);
    document.removeEventListener('dragstart', block, true);
    [st.userSelect, st.webkitUserSelect]=prev;
  };
}

export function cssTime(el, name, fallback){
  if(!el) return fallback;
  const raw=getComputedStyle(el).getPropertyValue(name).trim();
  if(!raw) return fallback;
  const n=parseFloat(raw);
  return raw.endsWith('ms')?n:n*1000;
}

let uid=0;
export const nextId=(prefix='nr')=>`${prefix}-${++uid}`;
