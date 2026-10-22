import React, {useRef, useState} from 'react';
import {Button, Card, Segmented, Thumb, useSmearIndicator} from '../../src/index.js';
import {Demo, PageHead, Row} from '../kit.jsx';

const INKS=[
  ['--nr-fg', 'Foreground', 'Primary text, solid fills, active thumbs'],
  ['--nr-fg-2', 'Secondary', 'Body copy, idle controls'],
  ['--nr-fg-3', 'Tertiary', 'Labels, meta, placeholders'],
  ['--nr-fg-4', 'Quaternary', 'Disabled marks'],
  ['--nr-line-strong', 'Line strong', 'Buttons, floating surfaces'],
  ['--nr-line', 'Line', 'Cards, inputs'],
  ['--nr-sep', 'Separator', 'Dividers inside surfaces'],
  ['--nr-fill-2', 'Fill 2', 'Hover highlight thumb'],
  ['--nr-fill', 'Fill', 'Tracks, soft badges'],
];

const CURVES=[
  ['--nr-ease-travel', 'cubic-bezier(.25, .35, .15, 1)', 'Travel — thumbs and knobs; moves on frame one, peaks early'],
  ['--nr-ease', 'cubic-bezier(.22, 1, .36, 1)', 'Enter — fastest at the start, long settle'],
  ['--nr-ease-exit', 'cubic-bezier(.5, 0, .75, 0)', 'Exit — accelerates away'],
  ['--nr-ease-spring', 'cubic-bezier(.34, 1.4, .64, 1)', 'Press / pop — small overshoot'],
  ['--nr-ease-inout', 'cubic-bezier(.65, 0, .35, 1)', 'Loops — spinners, shimmer'],
];

function CurveDemo(){
  const [k,setK]=useState(0);
  return <div className="fd-curves">
    {CURVES.map(([v, val, d])=><div key={v} className="fd-curve">
      <div className="fd-curve-meta"><code>{v}</code><small>{d}</small></div>
      <div className="fd-curve-track"><i key={k} style={{animationTimingFunction:`var(${v})`}}/></div>
    </div>)}
    <Button size="sm" onClick={()=>setK((x)=>x+1)}>Replay</Button>
  </div>;
}

/* Visualises the smear rule: blur and stretch scale with travel distance */
function SmearLab(){
  const [pos,setPos]=useState(0);
  const ref=useRef(null);
  const thumb=useSmearIndicator(ref, '.fd-lab-stop.on', [pos]);
  return <div className="fd-lab">
    <div className="fd-lab-track" ref={ref}>
      <Thumb thumb={thumb} className="fd-lab-ball"/>
      {[0, 1, 2, 3, 4].map((i)=><button type="button" key={i} className={'fd-lab-stop'+(pos===i?' on':'')} onClick={()=>setPos(i)} aria-label={`Stop ${i+1}`}/>)}
    </div>
    <Segmented block value={pos} onChange={setPos} options={[0, 1, 2, 3, 4].map((i)=>({value:i, label:`${i*25}%`}))}/>
    <p className="fd-note">Jump one step, then jump four. Each frame samples the travel curve's instantaneous speed; a virtual 48 ms shutter turns it into a trail <code>trail = min(speed × 48 ms, distance covered)</code>, which sets both stretch (toward the trailing edge, same proportion for every control) and blur. Smear peaks exactly when the thumb is fastest and is gone as it lands.</p>
  </div>;
}

export function Foundations(){
  return <div className="doc-page">
    <PageHead eyebrow="Start" title="Foundations">Tokens live in CSS custom properties prefixed <code>--nr-</code>. Themes swap the values on <code>[data-theme]</code>; components never hard-code ink.</PageHead>

    <Demo title="Ink" desc="Pure black and white with an alpha ladder. Light theme mirrors it exactly.">
      <div className="fd-inks">
        {INKS.map(([v, n, d])=><div key={v} className="fd-ink">
          <i style={{background:`var(${v})`}}/>
          <div><b>{n}</b><code>{v}</code><small>{d}</small></div>
        </div>)}
      </div>
    </Demo>

    <Demo title="Type" desc="Inter for UI, DM Mono for numbers and code. Tight negative tracking on display sizes.">
      <div className="fd-type">
        <div><span>Display · 44 / 650</span><p style={{font:'650 44px/1.05 var(--nr-font)', letterSpacing:'-1.6px'}}>Quiet surfaces</p></div>
        <div><span>Title · 22 / 560</span><p style={{font:'560 22px/1.2 var(--nr-font)', letterSpacing:'-.4px'}}>Connection settings</p></div>
        <div><span>Body · 13.5 / 400</span><p style={{font:'13.5px/1.55 var(--nr-font)', color:'var(--nr-fg-2)'}}>These values are sent to the J-Link SDK on connect.</p></div>
        <div><span>Mono · 12 / 400</span><p style={{font:'12px/1.6 var(--nr-mono)'}}>0x2000_0410 · imu.ax=0.982</p></div>
      </div>
    </Demo>

    <Demo title="Radii & elevation" desc="Elevation is a hairline, never a coloured shadow. Floating surfaces add a single deep, soft shadow.">
      <Row gap={14}>
        {[['xs', 5], ['sm', 7], ['md', 12], ['lg', 16], ['pill', 999]].map(([n, r])=><Card key={n} spotlight={false} className="fd-radius" style={{borderRadius:r}}><code>--nr-r-{n}</code><small>{r===999?'999':r}px</small></Card>)}
      </Row>
    </Demo>

    <Demo title="Easing & duration" desc="One rhythm per kind of motion: travel 280 ms, content swap 260 ms, page 320 ms, digit roll 300 ms. A longer move in the same time is simply faster, and because blur and stretch come from instantaneous speed it smears more — like a real object. The travel curve responds on the first frame and peaks early, so clicks never hang.">
      <CurveDemo/>
    </Demo>

    <Demo title="The smear rule" desc="The signature of NOIR: motion blur is derived from velocity, never keyframed separately — so blur and movement can't drift apart.">
      <SmearLab/>
    </Demo>
  </div>;
}
