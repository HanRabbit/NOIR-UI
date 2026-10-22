import React, {useState} from 'react';
import {Plug, Download, Trash2, Play, Pause, Settings2, Bold, Italic, Underline, Share2, Star, Heart} from 'lucide-react';
import {Button, IconButton, Chip, Tooltip, Swap, toast} from '../../src/index.js';
import {Demo, PageHead, Row, Col, Label} from '../kit.jsx';

function ConnectButton(){
  const [state,setState]=useState('idle');
  const click=()=>{
    if(state==='on'){ setState('idle'); return; }
    setState('busy');
    setTimeout(()=>setState('on'), 1300);
  };
  return <Button variant="primary" loading={state==='busy'} swapKey={state} icon={<Plug size={14}/>} onClick={click}>
    {state==='busy'?'Connecting…':state==='on'?'Disconnect':'Connect device'}
  </Button>;
}

function Liker(){
  const [on,setOn]=useState(false);
  return <IconButton label={on?'Unlike':'Like'} variant="outline" swapKey={on?'y':'n'} onClick={()=>setOn((v)=>!v)}>
    {on?<Heart size={16} fill="currentColor"/>:<Heart size={16}/>}
  </IconButton>;
}

export function Actions(){
  const [run,setRun]=useState(false);
  const [fmt,setFmt]=useState({b:true, i:false, u:false});
  const [tags,setTags]=useState(['hss', 'imu']);
  const toggleTag=(t)=>setTags((l)=>l.includes(t)?l.filter((x)=>x!==t):[...l, t]);
  return <div className="doc-page">
    <PageHead eyebrow="Components" title="Actions">Buttons answer the pointer in three layers: a sheen that follows the cursor, a blurred ink ripple on press, and a spring on release.</PageHead>

    <Demo title="Button" desc="Hover to see the sheen track the pointer. Press and hold for the spring." code={`<Button variant="primary" icon={<Plug/>}>Connect</Button>
<Button>Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="outline">Outline</Button>`}>
      <Col>
        <Row>
          <Button variant="primary" icon={<Plug size={14}/>}>Connect device</Button>
          <Button icon={<Settings2 size={14}/>}>Connection</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline" icon={<Download size={14}/>}>Export</Button>
          <Button disabled>Disabled</Button>
        </Row>
        <Row>
          <Button size="sm" variant="primary">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg" variant="primary">Large</Button>
        </Row>
      </Col>
    </Demo>

    <Demo title="Label morph" desc="Pass swapKey and the label cross-smears; the button width glides to fit. Loading swaps in a spinner." code={`<Button variant="primary" loading={busy} swapKey={state}>
  {busy ? 'Connecting…' : on ? 'Disconnect' : 'Connect device'}
</Button>`}>
      <Row>
        <ConnectButton/>
        <Button swapKey={run?'s':'r'} icon={run?<Pause size={14}/>:<Play size={14}/>} onClick={()=>setRun((v)=>!v)}>{run?'Pause capture':'Start stream'}</Button>
        <Button variant="ghost" onClick={()=>toast.promise(new Promise((r, j)=>setTimeout(Math.random()>.3?r:j, 1200)), {loading:'Exporting CSV…', success:'Saved capture.csv', error:'Disk is full'})}>Promise toast</Button>
      </Row>
    </Demo>

    <Demo title="Magnetic" desc="For hero-level calls to action: the button leans a few pixels toward the cursor." code={`<Button variant="primary" size="lg" magnetic>Get started</Button>`}>
      <Row gap={18}>
        <Button variant="primary" size="lg" magnetic>Get started</Button>
        <Button size="lg" magnetic icon={<Share2 size={15}/>}>Share</Button>
      </Row>
    </Demo>

    <Demo title="IconButton" desc="Square, quiet until hovered. swapKey morphs the glyph." code={`<IconButton label="Delete"><Trash2/></IconButton>`}>
      <Row>
        <Tooltip content="Delete"><IconButton label="Delete"><Trash2 size={16}/></IconButton></Tooltip>
        <Tooltip content="Favourite"><IconButton label="Favourite" variant="outline"><Star size={16}/></IconButton></Tooltip>
        <Tooltip content="Like"><Liker/></Tooltip>
        <Tooltip content="Run"><IconButton label="Run" variant="solid"><Play size={15}/></IconButton></Tooltip>
        <span className="doc-sep"/>
        {[['b', Bold], ['i', Italic], ['u', Underline]].map(([k, I])=><IconButton key={k} label={k} size="sm" variant={fmt[k]?'solid':'ghost'} onClick={()=>setFmt((f)=>({...f, [k]:!f[k]}))}><I size={14}/></IconButton>)}
      </Row>
    </Demo>

    <Demo title="Chip" desc="Toggle pills. Selecting inverts the ink and folds a check in from zero width." code={`<Chip selected={on} onToggle={setOn}>imu.ax</Chip>`}>
      <Col gap={10}>
        <Label>Channels</Label>
        <Row gap={8}>
          {['hss', 'rtt', 'imu', 'motor', 'pid', 'battery'].map((t)=><Chip key={t} selected={tags.includes(t)} onToggle={()=>toggleTag(t)}>{t}</Chip>)}
        </Row>
        <div className="doc-mono-note">selected: <Swap swapKey={tags.join(',')}>{tags.length?tags.join(', '):'—'}</Swap></div>
      </Col>
    </Demo>
  </div>;
}
