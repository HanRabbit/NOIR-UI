import React, {useState} from 'react';
import {Mail, Lock, Search, Cpu} from 'lucide-react';
import {Input, Textarea, Field, Select, Button, toast, LayoutGroup} from '../../src/index.js';
import {Demo, PageHead, Row, Col} from '../kit.jsx';

const CHIPS=['STM32H743ZI', 'STM32F407VG', 'nRF52840_xxAA', 'RP2040_M0_0', 'ATSAME70Q21', 'GD32F303CC', 'ESP32-S3', 'MIMXRT1062xxx6A'];

export function Inputs(){
  const [q,setQ]=useState('imu.ax');
  const [email,setEmail]=useState('');
  const [tried,setTried]=useState(false);
  const [addr,setAddr]=useState('0x2000_0410');
  const [device,setDevice]=useState('STM32H743ZI');
  const [speed,setSpeed]=useState('4000');
  const bad=tried && !/^\S+@\S+\.\S+$/.test(email);
  return <LayoutGroup className="doc-page" scale={false}>
    <PageHead eyebrow="Components" title="Inputs">Focus is drawn, not switched on: a hairline sweeps outward from exactly where you clicked. Errors shake once, then hold.</PageHead>

    <Demo title="Input" desc="Click near the left or right edge — the focus line grows from that point." code={`<Input prefix={<Search/>} clearable value={q}
  onChange={(e)=>setQ(e.target.value)} onClear={()=>setQ('')}/>`}>
      <Col style={{maxWidth:420}}>
        <Input prefix={<Search size={14}/>} placeholder="Filter symbols" clearable value={q} onChange={(e)=>setQ(e.target.value)} onClear={()=>setQ('')}/>
        <Input prefix="0x" mono value={addr} onChange={(e)=>setAddr(e.target.value)} suffix="RTT CB"/>
        <Row gap={8} wrap={false}>
          <Input size="sm" placeholder="Small"/>
          <Input size="md" placeholder="Medium"/>
          <Input size="lg" placeholder="Large"/>
        </Row>
        <Input placeholder="Disabled" disabled/>
      </Col>
    </Demo>

    <Demo title="Field & validation" desc="Field wires label, hint and error. Messages cross-smear when they change." code={`<Field label="Email" hint="We'll never share it" error={bad && 'Enter a valid address'}>
  <Input value={email} onChange={...}/>
</Field>`}>
      <form className="in-form" onSubmit={(e)=>{ e.preventDefault(); setTried(true); if(/^\S+@\S+\.\S+$/.test(email)) toast.success('Invite sent', {description:email}); }}>
        <Field label="Email" required hint="Used for session sharing" error={bad?'Enter a valid email address':null}>
          <Input prefix={<Mail size={14}/>} placeholder="name@company.com" value={email} onChange={(e)=>setEmail(e.target.value)}/>
        </Field>
        <Field label="Access key" hint="Stored in the OS keychain">
          <Input prefix={<Lock size={14}/>} type="password" placeholder="••••••••"/>
        </Field>
        <Field label="Notes">
          <Textarea placeholder="Grows as you type…" rows={2}/>
        </Field>
        <Row><Button type="submit" variant="primary">Send invite</Button><Button variant="ghost" onClick={()=>{ setEmail(''); setTried(false); }}>Reset</Button></Row>
      </form>
    </Demo>

    <Demo title="Select" desc="From LeapTracker's DropSelect. The highlight glides between rows; the value cross-smears; rows trail in." code={`<Select value={v} onChange={setV} options={[...]}/>`}>
      <Row gap={14} align="flex-end">
        <Field label="Target device"><Select value={device} onChange={setDevice} options={CHIPS.map((c)=>({value:c, label:c, icon:<Cpu size={13}/>}))}/></Field>
        <Field label="Speed"><Select value={speed} onChange={setSpeed} options={[100, 400, 1000, 4000, 12000, 50000].map((v)=>({value:String(v), label:v>=1000?`${v/1000} MHz`:`${v} kHz`, hint:`${v}`}))}/></Field>
        <Field label="Small"><Select size="sm" defaultValue="f32" options={['f32', 'i32', 'u32', 'i16', 'u16', 'u8']}/></Field>
        <Field label="Disabled"><Select disabled defaultValue="a" options={[{value:'a', label:'Locked'}]}/></Field>
      </Row>
    </Demo>
  </LayoutGroup>;
}
