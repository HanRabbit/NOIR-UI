import React, {useId, useState} from 'react';
import {Card, FlowText, LayoutGroup, Swap, toast} from '../src/index.js';
import {Check, Copy} from 'lucide-react';

/* Continuous-corner squircle (superellipse, n=5) on a 1024 grid */
function squircle(inset=0, n=5){
  const r=512-inset, pts=[];
  for(let i=0;i<160;i++){
    const t=(i/160)*Math.PI*2, c=Math.cos(t), s=Math.sin(t);
    pts.push(`${(512+Math.sign(c)*Math.abs(c)**(2/n)*r).toFixed(1)} ${(512+Math.sign(s)*Math.abs(s)**(2/n)*r).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}
const SQ=squircle();
const SQ_IN=squircle(10);
const N='M356 712V312L692 712V312';
/* the N has just arrived from the left: three echoes trailing behind, falling off fast */
const ECHO=[[84, .07], [54, .16], [26, .34]];

export function Mark({size=30}){
  const id=`mk${useId().replace(/:/g, '')}`;
  return <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
    <defs><filter id={id} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12 .6"/></filter></defs>
    <path d={SQ} fill="#0A0A0A"/>
    <path d={SQ_IN} fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="6"/>
    <g filter={`url(#${id})`} fill="none" stroke="#fff" strokeWidth="60" strokeLinecap="round" strokeLinejoin="round">
      {ECHO.map(([dx, o])=><path key={dx} d={N} transform={`translate(${-dx} 0)`} opacity={o}/>)}
    </g>
    <path d={N} fill="none" stroke="#fff" strokeWidth="60" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

export function PageHead({eyebrow, title, children}){
  return <header className="doc-head">
    {eyebrow&&<div className="doc-eyebrow">{eyebrow}</div>}
    <FlowText as="h1">{title}</FlowText>
    {children&&<FlowText>{children}</FlowText>}
  </header>;
}

export function Code({children}){
  const [done,setDone]=useState(false);
  const copy=async()=>{
    try{ await navigator.clipboard.writeText(children); }catch{ /* clipboard may be blocked */ }
    setDone(true);
    toast.success('Copied to clipboard');
    setTimeout(()=>setDone(false), 1600);
  };
  return <div className="doc-code">
    <pre><code>{children}</code></pre>
    <button type="button" className="doc-copy" onClick={copy} aria-label="Copy code">
      <Swap swapKey={done?'y':'n'} center>{done?<Check size={13}/>:<Copy size={13}/>}</Swap>
    </button>
  </div>;
}

/* One specimen: heading, live stage, optional snippet */
export function Demo({title, desc, code, children, stage='', id}){
  const [showCode,setShowCode]=useState(false);
  return <section className="doc-demo" id={id}>
    <div className="doc-demo-head">
      <div>
        <FlowText as="h2">{title}</FlowText>
        {desc&&<FlowText>{desc}</FlowText>}
      </div>
      {code&&<button type="button" className="doc-code-toggle" aria-expanded={showCode} onClick={()=>setShowCode((v)=>!v)}>
        <Swap swapKey={showCode?'h':'s'}>{showCode?'Hide code':'View code'}</Swap>
      </button>}
    </div>
    <Card className={'doc-stage '+stage}>{children}</Card>
    {code&&<div className={'doc-code-fold'+(showCode?' open':'')}><div><Code>{code}</Code></div></div>}
  </section>;
}

export const Row=({children, gap=10, wrap=true, align='center', style})=>
  <LayoutGroup className="doc-row" style={{gap, flexWrap:wrap?'wrap':'nowrap', alignItems:align, ...style}}>{children}</LayoutGroup>;

export const Col=({children, gap=14, style})=>
  <div className="doc-col" style={{gap, ...style}}>{children}</div>;

export const Label=({children})=><div className="doc-label">{children}</div>;
