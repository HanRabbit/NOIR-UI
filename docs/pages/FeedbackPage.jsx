import React, {useEffect, useState} from 'react';
import {Button, toast, Progress, ProgressRing, Spinner, Skeleton, Badge, StatusDot, Kbd, Divider, Card} from '../../src/index.js';
import {Demo, PageHead, Row, Col, Label} from '../kit.jsx';

export function FeedbackPage(){
  const [p,setP]=useState(32);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ const t=setInterval(()=>setP((v)=>(v>=100?0:Math.min(100, v+7+Math.random()*12))), 900); return ()=>clearInterval(t); },[]);
  return <div className="doc-page">
    <PageHead eyebrow="Components" title="Feedback">Status should be felt peripherally. Edges glow, loops breathe, and toasts stack like cards you can fan open.</PageHead>

    <Demo title="Toast" desc="Stack collapses into a deck — hover to fan it out. Swipe sideways to dismiss. Timers pause while you look." code={`toast('Saved');
toast.success('Connected', {description:'SWD @ 4 MHz'});
toast.error('Probe lost', {action:{label:'Retry', onClick}});
toast.promise(fetchThing(), {loading:'…', success:'Done', error:'Failed'});`}>
      <Row>
        <Button onClick={()=>toast('Capture saved', {description:'2 048 samples · 4 channels'})}>Default</Button>
        <Button onClick={()=>toast.success('Connected', {description:'J-Link V11 · SWD @ 4 MHz'})}>Success</Button>
        <Button onClick={()=>toast.error('Probe disconnected', {description:'USB 0x1366:0x0105', action:{label:'Retry', onClick:()=>toast.success('Reconnected')}})}>Error + action</Button>
        <Button onClick={()=>toast.info('RTT control block found', {description:'@ 0x2000_0410'})}>Info</Button>
        <Button variant="primary" onClick={()=>toast.promise(new Promise((r)=>setTimeout(r, 1800)), {loading:'Flashing firmware…', success:'Flashed 214 KB in 1.8 s', error:'Verify failed'})}>Promise</Button>
        <Button variant="ghost" onClick={()=>{ for(let i=0;i<4;i++) setTimeout(()=>toast(`Event ${i+1}`, {description:'Stacked'}), i*160); }}>Burst ×4</Button>
      </Row>
    </Demo>

    <Demo title="Progress" desc="The leading edge carries a soft glow so progress reads as motion. Indeterminate sweeps with blur." code={`<Progress value={64}/>
<Progress/>               // indeterminate
<ProgressRing value={64}>64</ProgressRing>`}>
      <Col gap={20}>
        <div className="fb-prog"><Label>Flashing · {Math.round(p)}%</Label><Progress value={p}/></div>
        <div className="fb-prog"><Label>Searching RTT control block</Label><Progress/></div>
        <Row gap={20}>
          <ProgressRing value={p}>{Math.round(p)}</ProgressRing>
          <ProgressRing value={72} size={56} stroke={2}>72</ProgressRing>
          <Spinner size={16}/><Spinner size={22}/><Spinner size={30}/>
        </Row>
      </Col>
    </Demo>

    <Demo title="Skeleton" desc="A blurred band of light passes across placeholders." code={`<Skeleton width={180} height={12}/>`}>
      <Row gap={24} align="flex-start">
        <Card spotlight={false} className="fb-skel">
          {loading?<>
            <Row gap={12}><Skeleton circle height={36}/><Col gap={8} style={{flex:1}}><Skeleton width="60%"/><Skeleton width="38%" height={10}/></Col></Row>
            <Skeleton height={86} radius={8}/>
            <Row gap={8}><Skeleton width={64} height={24} radius={999}/><Skeleton width={64} height={24} radius={999}/></Row>
          </>:<div className="fb-loaded"><b>Session #482</b><p>STM32H743ZI · 12 min · 4 channels</p></div>}
        </Card>
        <Button size="sm" onClick={()=>setLoading((v)=>!v)}>{loading?'Resolve':'Reload'}</Button>
      </Row>
    </Demo>

    <Demo title="Badge, StatusDot, Kbd" desc="Small, honest signals. Live dots ping; idle dots go hollow." code={`<Badge variant="solid">v11</Badge>
<StatusDot status="live" label="Streaming"/>
<Kbd>⌘</Kbd><Kbd>K</Kbd>`}>
      <Col gap={18}>
        <Row gap={8}><Badge variant="solid">J-Link V11</Badge><Badge>SWD</Badge><Badge variant="soft">4 MHz</Badge><Badge dot>Live</Badge></Row>
        <Row gap={22}><StatusDot status="live" label="Streaming"/><StatusDot status="busy" label="Connecting"/><StatusDot status="idle" label="Idle"/><StatusDot status="off" label="Offline"/></Row>
        <Divider label="SHORTCUTS"/>
        <Row gap={18}><span className="fb-k"><Kbd>⌘</Kbd><Kbd>K</Kbd> Command</span><span className="fb-k"><Kbd>⇧</Kbd><Kbd>T</Kbd> Theme</span><span className="fb-k"><Kbd>esc</Kbd> Close</span></Row>
      </Col>
    </Demo>
  </div>;
}
