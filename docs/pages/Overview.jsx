import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, Cpu, Zap, Activity, Gauge, Play, Pause, Plug} from 'lucide-react';
import {BlurText, Button, Card, CardHeader, Stat, Waveform, NumberFlow, LogView, Segmented, Switch, Slider, StatusDot, Chip, Kbd, toast, Swap, Progress} from '../../src/index.js';

const MSGS=[
  ['INFO', 'RTT control block found @ 0x2000_0410'],
  ['DATA', 'imu.ax=0.982 imu.ay=-0.114 imu.az=9.806'],
  ['DATA', 'motor.rpm=4120 motor.temp=41.2'],
  ['WARN', 'HSS sample overrun, dropped 12 frames'],
  ['DATA', 'pid.err=-0.0031 pid.out=0.448'],
  ['INFO', 'Halt → Go  (JLINKARM_Go)'],
  ['DATA', 'bat.v=11.92 bat.i=1.84'],
  ['ERROR', 'Target voltage dipped below 1.6 V'],
];
const stamp=()=>{
  const d=new Date();
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

function useLive(running){
  const [rpm,setRpm]=useState(4120);
  const [lat,setLat]=useState(1.82);
  const [lines,setLines]=useState(()=>MSGS.slice(0, 4).map(([level, text], i)=>({id:i, time:stamp(), level, text})));
  const seq=useRef(10);
  useEffect(()=>{
    if(!running) return undefined;
    const a=setInterval(()=>{
      setRpm((v)=>Math.max(3600, Math.min(4800, Math.round(v+(Math.random()-.5)*260))));
      setLat((v)=>Math.max(.8, Math.min(3.4, +(v+(Math.random()-.5)*.4).toFixed(2))));
    }, 900);
    const b=setInterval(()=>{
      const [level, text]=MSGS[Math.floor(Math.random()*MSGS.length)];
      setLines((l)=>[...l.slice(-40), {id:seq.current++, time:stamp(), level, text}]);
    }, 1500);
    return ()=>{ clearInterval(a); clearInterval(b); };
  },[running]);
  return {rpm, lat, lines};
}

function Workbench(){
  const [running,setRunning]=useState(true);
  const [src,setSrc]=useState('hss');
  const [rate,setRate]=useState(1000);
  const [follow,setFollow]=useState(true);
  const {rpm, lat, lines}=useLive(running);
  const [stats,setStats]=useState({max:0, avg:0});
  return <div className="ov-bench">
    <div className="ov-stats">
      <Stat label="Motor speed" value={rpm} sub="rpm · ch 2" delta={((rpm-4120)/4120)*100} icon={<Gauge size={15}/>}/>
      <Stat label="RTT latency" value={lat} decimals={2} sub="ms · p50" icon={<Activity size={15}/>}/>
      <Stat label="Sample rate" value={rate} sub={`Hz · ${src.toUpperCase()}`} icon={<Zap size={15}/>}/>
      <Stat label="Target" value={<Swap swapKey={running?'r':'h'}>{running?'Running':'Halted'}</Swap>} sub="STM32H743ZI" icon={<Cpu size={15}/>}/>
    </div>
    <div className="ov-grid">
      <Card>
        <CardHeader
          title="Signal"
          meta={`imu.ax · ${src.toUpperCase()} @ ${rate} Hz`}
          actions={<>
            <Segmented size="sm" value={src} onChange={setSrc} options={[{value:'hss', label:'HSS'}, {value:'rtt', label:'RTT'}]}/>
            <Button size="sm" swapKey={running?'s':'a'} icon={running?<Pause size={13}/>:<Play size={13}/>} onClick={()=>setRunning((v)=>!v)}>{running?'Stop':'Arm'}</Button>
          </>}
        />
        <div className="ov-chart"><Waveform running={running} window={4} onStats={setStats} aria-label="imu.ax live trace"/></div>
        <div className="ov-foot">
          <StatusDot status={running?'live':'idle'} label={running?'Streaming':'Paused'}/>
          <span>Peak <b><NumberFlow value={stats.max} decimals={3}/></b></span>
          <span>Avg <b><NumberFlow value={stats.avg} decimals={3}/></b></span>
        </div>
      </Card>
      <Card>
        <CardHeader title="Capture" meta="Tune the probe"/>
        <div className="ov-controls">
          <div className="ov-ctl"><span>Sample rate</span><Slider min={100} max={5000} step={100} value={rate} onChange={setRate} format={(v)=>`${v} Hz`} aria-label="Sample rate"/></div>
          <Switch checked={follow} onChange={setFollow} label="Follow output" description="Auto-scroll the RTT terminal"/>
          <div className="ov-chips">
            {['imu.ax', 'motor.rpm', 'pid.err', 'bat.v'].map((c, i)=><ChipToggle key={c} label={c} initial={i<2}/>)}
          </div>
          <Button variant="primary" block icon={<Plug size={14}/>} onClick={()=>toast.promise(new Promise((r)=>setTimeout(r, 1400)), {loading:'Connecting J-Link…', success:'Connected · SWD @ 4 MHz', error:'Probe not found'})}>Connect device</Button>
        </div>
      </Card>
    </div>
    <Card>
      <CardHeader title="RTT Terminal" meta="Channel 0 · live" actions={<Kbd>⌘ ↵</Kbd>}/>
      <LogView lines={lines} follow={follow} cursor={running} height={188}/>
    </Card>
  </div>;
}

function ChipToggle({label, initial}){
  const [on,setOn]=useState(initial);
  return <Chip selected={on} onToggle={setOn}>{label}</Chip>;
}

export function Overview({go, openCommand}){
  const [p,setP]=useState(18);
  useEffect(()=>{ const t=setInterval(()=>setP((v)=>(v>=100?8:v+Math.random()*18)), 1200); return ()=>clearInterval(t); },[]);
  return <div className="ov">
    <section className="ov-hero">
      <div className="ov-hero-grid" aria-hidden="true"/>
      <div className="ov-hero-glow" aria-hidden="true"/>
      <div className="ov-kicker"><span className="ov-kicker-dot"/>NOIR UI · 0.1</div>
      <h1 className="ov-title">
        <BlurText text="Monochrome." as="span" className="l1"/>
        <BlurText text="Minimal. Fluid." as="span" className="l2" delay={260}/>
      </h1>
      <BlurText as="p" className="ov-sub" delay={520} stagger={18} text="A React component library where every interaction answers with motion blur — distilled from the LeapTracker workbench and extended into a complete system."/>
      <div className="ov-cta">
        <Button variant="primary" size="lg" magnetic iconRight={<ArrowRight size={15}/>} onClick={()=>go('foundations')}>Explore foundations</Button>
        <Button size="lg" magnetic onClick={openCommand}>Search <Kbd>⌘K</Kbd></Button>
      </div>
      <div className="ov-progress"><Progress value={p} size="sm"/></div>
    </section>
    <section className="ov-section">
      <div className="ov-section-head">
        <h2>Live workbench</h2>
        <p>Every surface below is a NOIR component. Values roll, lines smear in, thumbs stretch along their path.</p>
      </div>
      <Workbench/>
    </section>
    <section className="ov-principles">
      {[
        ['01', 'Monochrome', 'Two inks — #000 and #fff — and a ladder of alpha. Hierarchy comes from weight, not hue.'],
        ['02', 'Velocity', 'Moving things blur and stretch along their direction, then settle sharp. Distance sets intensity.'],
        ['03', 'Continuity', 'Nothing pops. Content cross-smears, regions fold, surfaces resolve from blur toward their anchor.'],
      ].map(([n, t, d])=><Card key={n} className="ov-principle"><span>{n}</span><h3>{t}</h3><p>{d}</p></Card>)}
    </section>
  </div>;
}
