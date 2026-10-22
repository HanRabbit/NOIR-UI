import React, {useState} from 'react';
import {MoreHorizontal, Pencil, Copy, Trash2, Share2, Download, Settings2, Filter} from 'lucide-react';
import {Button, IconButton, Dialog, Drawer, Menu, Popover, Tooltip, Switch, Slider, Field, Input, Select, toast, Kbd} from '../../src/index.js';
import {Demo, PageHead, Row, Col, Label} from '../kit.jsx';

export function Overlays({openCommand}){
  const [dlg,setDlg]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [drawer,setDrawer]=useState(false);
  const [sheet,setSheet]=useState(false);
  const [thr,setThr]=useState(40);
  return <div className="doc-page">
    <PageHead eyebrow="Components" title="Overlays">Surfaces resolve out of blur toward their anchor. Modals push the page back — it softens and recedes — so focus is physical, not just a scrim.</PageHead>

    <Demo title="Dialog" desc="Rises out of blur and leaves upward. The page behind scales down and blurs (opt-in via data-nr-depth)." code={`<Dialog open={open} onClose={close} title="Disconnect target?"
  footer={<><Button variant="ghost">Cancel</Button><Button variant="primary">Disconnect</Button></>}>
  …
</Dialog>`}>
      <Row>
        <Button variant="primary" onClick={()=>setDlg(true)}>Open dialog</Button>
        <Button onClick={()=>setConfirm(true)}>Confirm action</Button>
      </Row>
      <Dialog open={dlg} onClose={()=>setDlg(false)} title="Connection settings" description="These values are sent to the J-Link SDK on connect." size="md"
        footer={<><Button variant="ghost" onClick={()=>setDlg(false)}>Cancel</Button><Button variant="primary" onClick={()=>{ setDlg(false); toast.success('Settings saved'); }}>Save</Button></>}>
        <Col>
          <Field label="Device"><Input data-autofocus defaultValue="STM32H743ZI"/></Field>
          <Field label="Speed"><Select block defaultValue="4000" options={[{value:'1000', label:'1 MHz'}, {value:'4000', label:'4 MHz'}, {value:'12000', label:'12 MHz'}]}/></Field>
          <Switch defaultChecked label="Reset after connect"/>
        </Col>
      </Dialog>
      <Dialog open={confirm} onClose={()=>setConfirm(false)} size="sm" title="Disconnect target?" description="RTT and HSS capture will stop. Unsaved samples are discarded."
        footer={<><Button variant="ghost" onClick={()=>setConfirm(false)}>Cancel</Button><Button variant="primary" data-autofocus onClick={()=>{ setConfirm(false); toast('Disconnected', {description:'J-Link · SWD'}); }}>Disconnect</Button></>}/>
    </Demo>

    <Demo title="Drawer" desc="Slides with a strong horizontal blur trail, like a fast pan. Right, left or bottom." code={`<Drawer open={open} onClose={close} side="right" title="Channel">…</Drawer>`}>
      <Row>
        <Button onClick={()=>setDrawer(true)} icon={<Settings2 size={14}/>}>Right drawer</Button>
        <Button onClick={()=>setSheet(true)}>Bottom sheet</Button>
      </Row>
      <Drawer open={drawer} onClose={()=>setDrawer(false)} title="Channel · imu.ax" footer={<><Button variant="ghost" onClick={()=>setDrawer(false)}>Close</Button><Button variant="primary" onClick={()=>setDrawer(false)}>Apply</Button></>}>
        <Col gap={18}>
          <Field label="Symbol"><Input mono defaultValue="g_imu.accel[0]"/></Field>
          <Field label="Type"><Select block defaultValue="f32" options={['f32', 'i32', 'u32', 'i16', 'u16']}/></Field>
          <div><Label>Scale</Label><Slider defaultValue={50} aria-label="Scale"/></div>
          <Switch defaultChecked label="Visible"/>
          <Switch label="Solo"/>
        </Col>
      </Drawer>
      <Drawer open={sheet} onClose={()=>setSheet(false)} side="bottom" size={260} title="Export capture">
        <Row gap={10}>
          {['CSV', 'JSON', 'RTT raw', 'Parquet'].map((f)=><Button key={f} icon={<Download size={14}/>} onClick={()=>{ setSheet(false); toast.success(`Exported as ${f}`); }}>{f}</Button>)}
        </Row>
      </Drawer>
    </Demo>

    <Demo title="Menu" desc="Action menus from LeapTracker's ActionMenu. The highlight glides; danger rows invert. Typeahead works." code={`<Menu trigger={<IconButton label="More"><MoreHorizontal/></IconButton>}
  items={[{value:'rename', label:'Rename', icon:<Pencil/>, shortcut:'R', onSelect}]}/>`}>
      <Row>
        <Menu trigger={<IconButton label="Project menu" variant="outline"><MoreHorizontal size={16}/></IconButton>} items={[
          {value:'rename', label:'Rename', icon:<Pencil size={14}/>, shortcut:'R', onSelect:()=>toast('Rename')},
          {value:'dup', label:'Duplicate', icon:<Copy size={14}/>, shortcut:'⌘D', onSelect:()=>toast('Duplicated')},
          {value:'share', label:'Share', icon:<Share2 size={14}/>, onSelect:()=>toast('Link copied')},
          {separator:true},
          {value:'del', label:'Delete project', icon:<Trash2 size={14}/>, danger:true, onSelect:()=>toast.error('Project deleted', {action:{label:'Undo', onClick:()=>toast.success('Restored')}})},
        ]}/>
        <Menu align="end" trigger={<Button icon={<Download size={14}/>}>Export</Button>} items={[
          {value:'csv', label:'CSV', hint:'.csv', onSelect:()=>toast.success('capture.csv')},
          {value:'json', label:'JSON', hint:'.json', onSelect:()=>toast.success('capture.json')},
          {value:'rtt', label:'Raw RTT', hint:'.rtt', disabled:true},
        ]}/>
      </Row>
    </Demo>

    <Demo title="Popover" desc="Arbitrary content anchored to a trigger; flips when there's no room." code={`<Popover trigger={<Button>Filter</Button>}>{({close})=>…}</Popover>`}>
      <Popover width={260} trigger={<Button icon={<Filter size={14}/>}>Trigger level</Button>}>
        {({close})=><Col gap={14}>
          <div><Label>Threshold · {thr}%</Label><Slider value={thr} onChange={setThr} aria-label="Threshold"/></div>
          <Switch defaultChecked label="Rising edge"/>
          <Row gap={8}><Button size="sm" variant="ghost" onClick={close}>Cancel</Button><Button size="sm" variant="primary" onClick={()=>{ close(); toast(`Trigger set at ${thr}%`); }}>Apply</Button></Row>
        </Col>}
      </Popover>
    </Demo>

    <Demo title="Tooltip" desc="Inverted ink, tight and quick. Once one has shown, neighbours open instantly — sweep across the row." code={`<Tooltip content="Halt target"><IconButton …/></Tooltip>`}>
      <Row gap={6}>
        {['Halt', 'Go', 'Step', 'Reset', 'Flash', 'Erase'].map((t)=><Tooltip key={t} content={`${t} target`}><Button variant="ghost" size="sm">{t}</Button></Tooltip>)}
        <Tooltip content="Below" placement="bottom"><Button size="sm" variant="outline">Bottom</Button></Tooltip>
        <Tooltip content="To the right" placement="right"><Button size="sm" variant="outline">Right</Button></Tooltip>
      </Row>
    </Demo>

    <Demo title="Command" desc="Fuzzy search with a gliding highlight; the list height tweens as results change." code={`useHotkey('mod+k', ()=>setOpen(true));
<Command open={open} onClose={close} items={items}/>`}>
      <Row><Button onClick={openCommand}>Open command menu <Kbd>⌘K</Kbd></Button></Row>
    </Demo>
  </div>;
}
