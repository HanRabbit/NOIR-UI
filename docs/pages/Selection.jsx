import React, {useState} from 'react';
import {AlignLeft, AlignCenter, AlignRight, Rows3, Columns3, Grid2x2} from 'lucide-react';
import {Segmented, Tabs, Switch, Checkbox, RadioGroup, Slider, NavList, Card} from '../../src/index.js';
import {Demo, PageHead, Row, Col, Label} from '../kit.jsx';

export function Selection(){
  const [layout,setLayout]=useState('overlay');
  const [all,setAll]=useState({rtt:true, hss:true, log:false});
  const n=Object.values(all).filter(Boolean).length;
  const [vol,setVol]=useState(64);
  const [range,setRange]=useState(4000);
  const [nav,setNav]=useState('scope');
  return <div className="doc-page">
    <PageHead eyebrow="Components" title="Selection">Every selected state is a single object that travels — it never teleports. The farther it goes, the harder it smears.</PageHead>

    <Demo title="Segmented" desc="From LeapTracker's SegSwitch. Click the far ends to feel the stretch scale with distance." code={`<Segmented value={v} onChange={setV}
  options={[{value:'usb', label:'USB'}, {value:'ip', label:'IP'}]}/>`}>
      <Col>
        <Row gap={14}>
          <Segmented defaultValue="usb" options={[{value:'usb', label:'USB'}, {value:'ip', label:'IP'}]} aria-label="Transport"/>
          <Segmented defaultValue="swd" options={['SWD', 'JTAG'].map((v)=>({value:v.toLowerCase(), label:v}))} aria-label="Interface"/>
          <Segmented size="sm" defaultValue="c" options={[{value:'l', icon:<AlignLeft size={14}/>}, {value:'c', icon:<AlignCenter size={14}/>}, {value:'r', icon:<AlignRight size={14}/>}]} aria-label="Align"/>
        </Row>
        <Segmented block value={layout} onChange={setLayout} options={[{value:'overlay', label:'Overlay', icon:<Grid2x2 size={13}/>}, {value:'stack', label:'Stacked', icon:<Rows3 size={13}/>}, {value:'split', label:'Split', icon:<Columns3 size={13}/>}, {value:'xy', label:'X / Y'}, {value:'fft', label:'FFT'}]} aria-label="Layout"/>
      </Col>
    </Demo>

    <Demo title="Tabs" desc="Line variant stretches its underline; pill variant inverts. Panels smear in the direction of travel." code={`<Tabs variant="line" items={[
  {value:'a', label:'Overview', content:<A/>},
  {value:'b', label:'Channels', badge:4, content:<B/>},
]}/>`}>
      <Col gap={24}>
        <Tabs variant="line" items={[
          {value:'ov', label:'Overview', content:<p className="doc-p">Connected to STM32H743ZI via SWD @ 4 MHz. Target halted at <code>0x0800_1A3C</code>.</p>},
          {value:'ch', label:'Channels', badge:4, content:<p className="doc-p">imu.ax · imu.ay · motor.rpm · pid.err — sampling at 1 kHz over HSS.</p>},
          {value:'tr', label:'Trigger', content:<p className="doc-p">Normal mode, rising edge on <code>motor.rpm</code> at 4 000.</p>},
          {value:'ex', label:'Export', content:<p className="doc-p">CSV · JSON · raw RTT. Last export 2 minutes ago.</p>},
        ]}/>
        <Tabs variant="pill" items={[{value:'d', label:'Day'}, {value:'w', label:'Week'}, {value:'m', label:'Month'}, {value:'y', label:'Year'}]}/>
      </Col>
    </Demo>

    <Demo title="NavList" desc="Sidebar navigation from LeapTracker's SegTrack — the active row glides vertically." code={`<NavList value={page} onChange={setPage} items={items}/>`}>
      <Card spotlight={false} className="sel-nav">
        <NavList value={nav} onChange={setNav} items={[
          {section:'Workspace'},
          {value:'dash', label:'Dashboard'},
          {value:'term', label:'RTT Terminal', badge:'12'},
          {value:'scope', label:'JScope'},
          {value:'sess', label:'Sessions'},
          {section:'System'},
          {value:'pref', label:'Preferences'},
        ]}/>
      </Card>
    </Demo>

    <Demo title="Switch & Checkbox" desc="The switch knob widens under press and smears across. Checkmarks draw themselves." code={`<Switch checked={on} onChange={setOn} label="Follow output"/>
<Checkbox checked={c} onChange={setC} label="RTT"/>`}>
      <Row gap={48} align="flex-start">
        <Col>
          <Switch defaultChecked label="Auto-reconnect" description="Retry the probe every 2 s"/>
          <Switch label="Halt on connect"/>
          <Row gap={14}><Switch size="sm" defaultChecked/><Switch size="md"/><Switch size="lg" defaultChecked/><Switch disabled/></Row>
        </Col>
        <Col>
          <Checkbox checked={n===3} indeterminate={n>0&&n<3} onChange={(v)=>setAll({rtt:v, hss:v, log:v})} label="All streams"/>
          <div className="sel-indent">
            <Col gap={10}>
              <Checkbox checked={all.rtt} onChange={(v)=>setAll((a)=>({...a, rtt:v}))} label="RTT terminal"/>
              <Checkbox checked={all.hss} onChange={(v)=>setAll((a)=>({...a, hss:v}))} label="HSS sampling"/>
              <Checkbox checked={all.log} onChange={(v)=>setAll((a)=>({...a, log:v}))} label="Session log" description="Writes to ~/.leaptracker"/>
            </Col>
          </div>
        </Col>
      </Row>
    </Demo>

    <Demo title="RadioGroup" desc="One dot, many rings: the fill travels between options instead of fading in place." code={`<RadioGroup value={v} onChange={setV} options={[...]}/>`}>
      <Row gap={48} align="flex-start">
        <RadioGroup defaultValue="swd" options={[
          {value:'swd', label:'SWD', description:'Two-wire, default'},
          {value:'jtag', label:'JTAG', description:'Boundary scan capable'},
          {value:'cjtag', label:'cJTAG', description:'Compact, two-pin'},
        ]} aria-label="Interface"/>
        <RadioGroup direction="row" defaultValue="1k" options={['100', '1k', '5k', '10k'].map((v)=>({value:v, label:`${v} Hz`}))} aria-label="Rate"/>
      </Row>
    </Demo>

    <Demo title="Slider" desc="Drag fast: the knob stretches with velocity and springs back. Arrow keys nudge with the same feel." code={`<Slider value={v} onChange={setV} format={(v)=>\`\${v}%\`}/>`}>
      <Col gap={26} style={{maxWidth:420}}>
        <div className="sel-slider"><Label>Gain</Label><Slider value={vol} onChange={setVol} format={(v)=>`${v}%`} aria-label="Gain"/><code>{vol}%</code></div>
        <div className="sel-slider"><Label>Speed</Label><Slider min={100} max={50000} step={100} value={range} onChange={setRange} format={(v)=>`${(v/1000).toFixed(1)} MHz`} aria-label="Speed"/><code>{range} kHz</code></div>
        <div className="sel-slider"><Label>Disabled</Label><Slider defaultValue={30} disabled aria-label="Disabled"/><code>—</code></div>
      </Col>
    </Demo>
  </div>;
}
