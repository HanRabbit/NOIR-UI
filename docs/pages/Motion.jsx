import React, {useState} from 'react';
import {Swap, Fold, BlurText, Button, Segmented, Card, PageTransition} from '../../src/index.js';
import {Demo, PageHead, Row, Col} from '../kit.jsx';

const WORDS=['Monochrome', 'Minimal', 'Fluid', 'Motion-blur'];
const SLIDES=[
  ['01', 'Dashboard', 'Signal overview, active channels, RTT preview.'],
  ['02', 'Terminal', 'Inspect logs and send commands in real time.'],
  ['03', 'JScope', 'HSS samples memory; RTT plots key=value lines.'],
  ['04', 'Sessions', 'Review and reopen previous debugging sessions.'],
];

export function Motion(){
  const [w,setW]=useState(0);
  const [dir,setDir]=useState(1);
  const [fold,setFold]=useState(true);
  const [xfold,setXfold]=useState(false);
  const [slide,setSlide]=useState(0);
  const [k,setK]=useState(0);
  return <div className="doc-page">
    <PageHead eyebrow="Start" title="Motion">The primitives every component is built from. Use them directly to give your own UI the same physics.</PageHead>

    <Demo title="Swap" desc="Text morphs per character: glyphs the two labels share glide to their new place, the rest roll out and in with a stagger, each blurred by its own speed. Block content cross-smears as whole layers. Width glides either way." code={`<Swap swapKey={word} dir={1}>{word}</Swap>          // per-character
<Swap swapKey={id} axis="x" distance={28} block>{panel}</Swap>  // layer
<Swap mode="layer">…</Swap>                              // force layer mode`}>
      <Col gap={18}>
        <div className="mo-swap"><Swap swapKey={w} dir={dir}>{WORDS[w]}</Swap><span className="mo-dot">.</span></div>
        <Row>
          <Button size="sm" onClick={()=>{ setDir(-1); setW((v)=>(v+WORDS.length-1)%WORDS.length); }}>↑ Previous</Button>
          <Button size="sm" onClick={()=>{ setDir(1); setW((v)=>(v+1)%WORDS.length); }}>↓ Next</Button>
        </Row>
      </Col>
    </Demo>

    <Demo title="Fold" desc="Collapsible regions. axis='y' animates grid rows (no measuring); axis='x' measures width. Content blurs in after the space opens." code={`<Fold open={open}>…</Fold>
<Fold axis="x" open={open}>…</Fold>`}>
      <Col>
        <Row><Button size="sm" onClick={()=>setFold((v)=>!v)}>{fold?'Collapse':'Expand'} vertical</Button><Button size="sm" onClick={()=>setXfold((v)=>!v)}>{xfold?'Collapse':'Expand'} horizontal</Button></Row>
        <Fold open={fold}><Card spotlight={false} className="mo-fold">Trigger: <b>Normal</b> · Edge: <b>Rising</b> · Level: <b>4 000 rpm</b> · Source: <b>motor.rpm</b></Card></Fold>
        <Row gap={8} wrap={false}>
          <Button size="sm" variant="outline">HSS</Button>
          <Fold axis="x" open={xfold}><Row gap={8} wrap={false}><Button size="sm" variant="ghost">1 kHz</Button><Button size="sm" variant="ghost">2 000 sa</Button><Button size="sm" variant="ghost">f32</Button></Row></Fold>
          <Button size="sm" variant="primary">Arm</Button>
        </Row>
      </Col>
    </Demo>

    <Demo title="PageTransition" desc="Shared-axis transition: both pages ride the same curve in the same direction, blur from their shared speed, and crossfade at peak velocity — one continuous slide. Jumping farther travels farther in the same time, so it smears harder; try 01 → 04, and interrupt mid-flight." code={`<PageTransition pageKey={page} index={order.indexOf(page)}>
  <Page/>
</PageTransition>`}>
      <Col gap={16}>
        <Segmented value={slide} onChange={setSlide} options={SLIDES.map(([n], i)=>({value:i, label:n}))} aria-label="Slide"/>
        <div className="mo-stage">
          <PageTransition pageKey={slide} index={slide}>
            <div className="mo-slide"><span>{SLIDES[slide][0]}</span><h3>{SLIDES[slide][1]}</h3><p>{SLIDES[slide][2]}</p></div>
          </PageTransition>
        </div>
      </Col>
    </Demo>

    <Demo title="BlurText" desc="Words resolve from blur in sequence when they enter the viewport." code={`<BlurText as="h2" text="Quiet surfaces, loud motion."/>`}>
      <Col gap={14}>
        <BlurText key={k} as="h2" className="mo-blur" text="Quiet surfaces, loud motion."/>
        <BlurText key={`c${k}`} as="p" className="mo-blur-sub" by="char" stagger={14} delay={300} text="Every frame between two states is part of the design."/>
        <Row><Button size="sm" onClick={()=>setK((v)=>v+1)}>Replay</Button></Row>
      </Col>
    </Demo>

    <Demo title="Hooks" desc="Lower-level building blocks exported for custom components.">
      <div className="mo-hooks">
        {[
          ['useSmearIndicator + <Thumb>', 'Travelling indicator with velocity-sampled smear — Segmented, Tabs, NavList, ListBox, RadioGroup.'],
          ['usePresence', 'Mount → paint closed → open; keep mounted through the exit smear.'],
          ['useAnchor', 'Fixed positioning with side-flip locked per open.'],
          ['useRipple / useSpotlight / useMagnetic', 'Pointer-driven ink, sheen and lean.'],
          ['useListNav', 'Roving active index with typeahead for any list.'],
          ['useHotkey', "'mod+k' style global shortcuts."],
          ['DUR', 'Fixed rhythms: travel 280 · swap 260 · page 320 · roll 300 ms.'],
          ['smear(speed, size, {covered})', 'Virtual shutter: px/ms → {trail, stretch, squash, blur}, trail ≤ distance covered.'],
          ['sampleEase(ease, ms)', 'Keyframes with position and instantaneous velocity per frame.'],
        ].map(([n, d])=><div key={n}><code>{n}</code><span>{d}</span></div>)}
      </div>
    </Demo>
  </div>;
}
