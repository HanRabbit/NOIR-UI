import React, {useEffect, useState} from 'react';
import {Cpu, Zap, MemoryStick, Clock3, Terminal} from 'lucide-react';
import {Card, CardHeader, Stat, NumberFlow, Accordion, Avatar, AvatarGroup, Sparkline, Waveform, LogView, Button, Switch} from '../../src/index.js';
import {Demo, PageHead, Row, Col} from '../kit.jsx';

const PEOPLE=['Ada Lovelace', 'Linus Torvalds', 'Grace Hopper', 'Dennis Ritchie', 'Margaret Hamilton', 'Ken Thompson', 'Barbara Liskov'].map((name, i)=>({name, status:i===0?'live':i===2?'idle':undefined}));

export function DataDisplay(){
  const [n,setN]=useState(48213);
  const [odo,setOdo]=useState(998);
  const [price,setPrice]=useState(1289.5);
  const [series,setSeries]=useState(()=>Array.from({length:32}, (_, i)=>40+Math.sin(i/3)*18+Math.random()*8));
  const [lines,setLines]=useState([{id:0, time:'12:04:11.209', level:'INFO', text:'Session started'}]);
  const [tput,setTput]=useState(1240);
  const [live,setLive]=useState(true);
  useEffect(()=>{
    const t=setInterval(()=>setTput((v)=>Math.max(400, Math.round(v+(Math.random()-.5)*180))), 1200);
    return ()=>clearInterval(t);
  },[]);
  const push=(level, text)=>setLines((l)=>[...l.slice(-30), {id:l.length+Date.now(), time:new Date().toTimeString().slice(0, 8)+'.000', level, text}]);
  return <div className="doc-page">
    <PageHead eyebrow="Components" title="Data display">Numbers roll rather than flip — each digit travels its own distance and blurs accordingly. Lines draw themselves. Borders light where you look.</PageHead>

    <Demo title="NumberFlow" desc="Odometer wheels: digits turn in the direction the number moved, so 9 → 0 on a carry rolls forward one notch. New columns and the thousands comma grow in on a carry and collapse on a borrow. Try 999 ↔ 1,000." code={`<NumberFlow value={n}/>
<NumberFlow value={price} decimals={2} prefix="$"/>`}>
      <Col gap={18}>
        <Row gap={28} align="baseline">
          <span className="dd-big dd-odo"><NumberFlow value={odo}/></span>
          <span className="dd-big"><NumberFlow value={n}/></span>
          <span className="dd-mid"><NumberFlow value={price} decimals={2} prefix="$"/></span>
        </Row>
        <Row gap={8}>
          <Button size="sm" variant="primary" onClick={()=>setOdo((v)=>v+1)}>+1</Button>
          <Button size="sm" variant="primary" onClick={()=>setOdo((v)=>Math.max(0, v-1))}>−1</Button>
          <span className="doc-sep"/>
          <Button size="sm" onClick={()=>setN((v)=>v+Math.round(Math.random()*90+1))}>+ small</Button>
          <Button size="sm" onClick={()=>setN((v)=>v+Math.round(Math.random()*90000))}>+ large</Button>
          <Button size="sm" onClick={()=>setN((v)=>Math.max(0, v-Math.round(Math.random()*40000)))}>− large</Button>
          <Button size="sm" variant="ghost" onClick={()=>setPrice(+(Math.random()*4000).toFixed(2))}>Shuffle price</Button>
        </Row>
      </Col>
    </Demo>

    <Demo title="Card & Stat" desc="Cards carry a pointer spotlight: a faint inner glow plus a brighter arc on the hairline." stage="flush">
      <div className="dd-stats">
        <Stat label="Target status" value="Halted" sub="STM32H743ZI" icon={<Zap size={15}/>}/>
        <Stat label="SDK" value="V7.94e" sub="11 214 chips" icon={<Cpu size={15}/>}/>
        <Stat label="Throughput" value={tput} sub="B/s" delta={(tput-1240)/12.4} icon={<MemoryStick size={15}/>}/>
        <Stat label="Uptime" value={n%3600} sub="seconds" icon={<Clock3 size={15}/>}/>
      </div>
    </Demo>

    <Demo title="Waveform" desc="Live trace on canvas, re-sampled every frame so it scrolls sub-pixel smooth. Pausing eases the clock to a stop; the range follows the data with damping." code={`<Waveform running={live} window={4} sample={(t)=>Math.sin(t*2)}/>`}>
      <Col gap={14}>
        <div className="dd-wave"><Waveform running={live} window={4}/></div>
        <Switch checked={live} onChange={setLive} label="Streaming"/>
      </Col>
    </Demo>

    <Demo title="Sparkline" desc="Static mini chart. Draws itself on mount; morphs when the data set changes." code={`<Sparkline values={[...]}/>`}>
      <Row gap={24}>
        <Card spotlight={false} className="dd-spark"><span>imu.ax</span><Sparkline values={series} width={220} height={48}/></Card>
        <Card spotlight={false} className="dd-spark"><span>motor.rpm</span><Sparkline values={series.map((v)=>100-v)} width={220} height={48} fill={false}/></Card>
        <Button size="sm" variant="ghost" onClick={()=>setSeries(Array.from({length:32}, (_, i)=>40+Math.sin(i/3+Math.random()*3)*18+Math.random()*10))}>Shuffle</Button>
      </Row>
    </Demo>

    <Demo title="LogView" desc="LeapTracker's RTT terminal, generalised. New lines smear up into place." code={`<LogView lines={[{time, level:'INFO', text}]} cursor/>`} stage="flush">
      <Card spotlight={false} className="dd-log">
        <CardHeader title="RTT Terminal" meta="Channel 0" actions={<>
          <Button size="sm" variant="ghost" onClick={()=>push('INFO', 'Halt → Go')}>Info</Button>
          <Button size="sm" variant="ghost" onClick={()=>push('WARN', 'HSS overrun, dropped 12 frames')}>Warn</Button>
          <Button size="sm" variant="ghost" onClick={()=>push('ERROR', 'Target voltage < 1.6 V')}>Error</Button>
          <Button size="sm" icon={<Terminal size={13}/>} onClick={()=>push('DATA', `imu.ax=${(Math.random()*2-1).toFixed(3)}`)}>Data</Button>
        </>}/>
        <LogView lines={lines} cursor height={180}/>
      </Card>
    </Demo>

    <Demo title="Accordion" desc="Height folds via grid rows; content resolves from blur as it opens.">
      <Accordion defaultValue={['a']} items={[
        {value:'a', title:'Why only black and white?', content:'Colour is the loudest signal a UI has. Removing it forces hierarchy into weight, spacing and motion — and makes the few things that do move impossible to miss.'},
        {value:'b', title:'Does motion blur hurt performance?', content:'Blur runs on the compositor via filter on promoted layers, and releases before the animation ends so text never sits blurred. prefers-reduced-motion collapses it all.'},
        {value:'c', title:'Can I theme it?', content:'Every ink, radius, curve and duration is a --nr- custom property. Override them on :root or any subtree.'},
      ]}/>
    </Demo>

    <Demo title="Avatar" desc="Images resolve from blur in greyscale. Groups fan open on hover.">
      <Row gap={28}>
        <Row gap={10}><Avatar name="Ada Lovelace" status="live" size={40}/><Avatar name="Grace Hopper" status="idle"/><Avatar name="Ken Thompson" size={26}/></Row>
        <AvatarGroup people={PEOPLE} max={5} size={32}/>
      </Row>
    </Demo>
  </div>;
}
