// Prototype-only custom React Flow nodes with named ports and ELK layout.
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, BaseEdge, EdgeLabelRenderer, getSmoothStepPath, MarkerType, useReactFlow, NodeToolbar, useStore } from '@xyflow/react';
import { ArrowRight, Check, CircleHelp, GitBranch, Globe, LayoutTemplate, Plus, Send, Flag, Maximize2, Focus, Eye, EyeOff, X } from 'lucide-react';
import { followupGroups } from './MapExperience';
import { conditionLabel } from '../journey-prototype/model';
import { edgeLabel, validConnection, destinations, questionFor } from './model';

let layoutEngine;
function getLayoutEngine() { return layoutEngine ??= import('elkjs/lib/elk.bundled.js').then(({ default: ELK }) => new ELK()); }
const nodeWidth = 260;
const kinds = { question: ['Question', CircleHelp], capture: ['Collect details', Send], content: ['Message', LayoutTemplate], result: ['Show result', Flag], acknowledgement: ['Ending', Check] };
function ordered(d, source) { const all = d.edges.filter(e => e.source === source); return [...all.filter(e => e.value !== null && !e.skip), ...all.filter(e => e.value === null && !e.skip), ...all.filter(e => e.skip)]; }
function Preview({ screen }) {
  return <div className="gx-preview"><span>fern & form</span><strong>{screen.question?.label ?? screen.heading ?? screen.name}</strong><small>{screen.question?.options?.map(o => `○ ${o.label}`).join('   ') ?? screen.body}</small></div>;
}
const ScreenNode = memo(function ScreenNode({ id, data, selected }) {
  const { screen: s, paths, previews, select, add, preview, handoffs } = data;
  const overview = useStore(state=>state.transform[2]<.72);
  const incoming=data.d.edges.filter(e=>e.target===id).length;
  const [label, Icon] = kinds[s.kind] ?? kinds.content;
  const branching = paths.filter(e => !e.skip).length > 1;
  return <div className={`gx-node gx-${s.kind} ${selected ? 'is-selected' : ''} ${data.visited ? 'is-traced' : ''} ${data.dim ? 'is-dim' : ''} ${branching ? 'has-branches' : 'is-compact'} ${overview ? 'mx-zoomed-out' : ''}`} >
    <NodeToolbar isVisible={selected} position={Position.Top}><div className="mx-node-toolbar"><button onClick={()=>select('screen',id)}>Edit screen</button><button onClick={()=>preview(id)}>Preview screen</button>{s.kind!=='acknowledgement' && <button onClick={()=>add({source:id,mode:branching?'branch':'insert'})}>Add {branching?'path':'screen'}</button>}</div></NodeToolbar>
    {overview && <div className="mx-zoom-summary"><small>{label}{incoming>1?' · Paths rejoin':''}</small><strong>{s.name}</strong>{s.showWhen && <span>Show if {conditionLabel(s.showWhen,data.original)}</span>}{branching && <div><b>Take the first matching path</b>{paths.map((e,i)=><span key={e.id}>{e.skip?'Skip':e.value===null?'':`${i+1}.`} {edgeLabel(data.original,e)}</span>)}</div>}{s.kind==='capture' && <span>Save submitted details</span>}{s.kind==='acknowledgement' && <span>Journey ends</span>}</div>}
    <Handle type="target" position={Position.Left} id={`${id}:in`} style={{ top: 42 }} aria-label={`Connect into ${s.name}`}/>
    <div className="gx-node-header"><span className="gx-type-icon"><Icon size={17}/></span><div><small>{label}{data.start ? ' · First screen' : incoming>1?' · Paths rejoin':''}</small><strong title={s.name}>{s.name}</strong></div><button className="nodrag gx-preview-button" aria-label={`Preview ${s.name}`} onClick={e => { e.stopPropagation(); preview(s.id); }}><Eye size={15}/></button></div>
    <p className="gx-node-description">{s.question?.label ?? s.heading ?? (s.kind === 'acknowledgement' ? 'The visitor’s journey ends here.' : s.name)}</p>
    {s.showWhen && <button className="wb-node-condition nodrag" title={conditionLabel(s.showWhen, data.original)} onClick={e => { e.stopPropagation(); select('screen', id, 'visibility'); }}>{s.showWhen.clauses.length && s.showWhen.clauses.every(c => c.values.length) ? `Show if ${conditionLabel(s.showWhen, data.original)}` : 'Set show condition'}</button>}{previews && <Preview screen={s}/>}
    {s.kind === 'capture' && <button className="gx-handoff nodrag" onClick={e => { e.stopPropagation(); select('destinations', 'destinations'); }}><Send size={12}/><span>On save: {handoffs.length ? handoffs.join(' + ') : 'WConvert only'}</span><ArrowRight size={12}/></button>}
    {s.kind === 'result' && <div className="gx-result-note"><Flag size={12}/>{s.results?.length ?? 1} possible results · first match</div>}
    {paths.length > 0 && <div className={`gx-paths ${branching ? 'is-branching' : ''}`}><div className="gx-paths-label">{branching ? <><GitBranch size={12}/>Take the first matching path</> : 'CONTINUE IN ORDER'}</div>{paths.map((edge, i) => <div className={`gx-path ${edge.value === null ? 'is-fallback' : ''} ${data.activeEdge === edge.id ? 'is-selected' : ''}`} key={edge.id}><button className="nodrag" onClick={event => { event.stopPropagation(); select('edge', edge.id); }} aria-label={`Edit path: ${edgeLabel(data.original, edge)} from ${s.name}`}><span className="gx-path-order">{edge.skip ? '↳' : edge.value !== null ? i + 1 : branching ? '↳' : <ArrowRight size={12}/>}</span><span className="gx-path-copy"><strong title={edgeLabel(data.original, edge)}>{!branching && !edge.skip ? `${data.d.screens.find(s=>s.id===edge.target)?.showWhen?'Check':'Then'}: ${data.d.screens.find(s => s.id === edge.target)?.name}` : edge.value !== null && !edge.skip ? `If ${edgeLabel(data.original, edge)}` : edgeLabel(data.original, edge)}</strong>{(branching || edge.skip) && <small>→ {data.d.screens.find(s => s.id === edge.target)?.name}</small>}</span>{edge.value === '__choose__' && <b className="gx-needs">Set condition</b>}</button><Handle type="source" position={Position.Right} id={edge.id} aria-label={`Route ${edgeLabel(data.original, edge)} from ${s.name}`}/></div>)}</div>}
    {s.kind !== 'acknowledgement' ? <div className="gx-node-add"><button className="nodrag" onClick={e => { e.stopPropagation(); add({ source: id, mode: paths.filter(e => !e.skip).length > 1 ? 'branch' : 'insert' }); }}><Plus size={13}/>{branching ? 'Add answer path' : 'Add next screen'}</button><Handle type="source" position={Position.Right} id={`${id}:new`} aria-label={`Draw a new path from ${s.name}`}/></div> : <div className="gx-ending"><Check size={12}/>Journey complete</div>}
  </div>;
});
function FollowupsNode({id,data}) {
  const {screen:s,paths,select}=data;
  const overview=useStore(state=>state.transform[2]<.72);
  return <div className={`mx-followups ${data.visited?'is-traced':''} ${data.dim?'is-dim':''} ${overview?'mx-group-overview':''}`} >
    <Handle type="target" position={Position.Left} id={`${id}:in`} style={{top:42}} isConnectable={false}/>
    <div className="mx-group-heading"><small>CONDITIONAL FOLLOW-UPS · {s.members.length}</small><strong>Ask every relevant question</strong><p>Check each in order. Skip those that don’t match.</p></div>
    <div className="mx-group-members">{s.members.slice(0,3).map((member,i)=><button className={`nodrag ${data.tracedMembers.includes(member.id)?'is-traced':''}`} key={member.id} onClick={e=>{e.stopPropagation();select('screen',member.id);}}><b>{i+1}. {member.name}</b><span>{conditionLabel(member.showWhen,data.original)}</span>{data.sampleActive && <em>{data.tracedMembers.includes(member.id)?'On this path':'Not reached'}</em>}</button>)}</div>
    <button className="mx-expand nodrag" onClick={e=>{e.stopPropagation();data.expand(id);}}>{s.members.length>3?`Show all ${s.members.length} screens`:'Show individual screens'} <ArrowRight size={13}/></button>
    {paths.map(e=><Handle key={e.id} type="source" position={Position.Right} id={e.id} style={{top:42}} isConnectable={false}/>)}
  </div>;
}
function EntryNode({ data, selected }) { return <button className={`gx-entry ${selected ? 'is-selected' : ''}`} onClick={() => data.select('display', 'display')}><span><Globe size={15}/>CAMPAIGN STARTS</span><strong>{data.rules.audience}</strong><small>{data.rules.pages}</small><div>{data.rules.type === 'inline' ? 'Inline placement' : data.rules.trigger === 'exit' ? 'Exit intent' : data.rules.trigger === 'click' ? 'On launcher click' : `After ${data.rules.delay} seconds`} <ArrowRight size={13}/></div><Handle type="source" position={data.vertical ? Position.Bottom : Position.Right} id="entry:out" style={data.vertical ? { bottom: -5, top: 'auto', left: 113 } : undefined} isConnectable={false}/></button>; }
function PathEdge(props) {
  let [path, x, y] = getSmoothStepPath({ ...props, borderRadius: 12, offset: 24 });
  const bends = props.data?.route?.bendPoints;
  if (bends?.length) {
    const points = [{ x: props.sourceX, y: props.sourceY }, ...bends.map(p => ({ ...p })), { x: props.targetX, y: props.targetY }];
    points[1].y = props.sourceY;
    if (props.targetPosition === Position.Top) points[points.length - 2].x = props.targetX;
    else points[points.length - 2].y = props.targetY;
    path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x},${p.y}`).join(' ');
    let longest = 0;
    for (let i = 1; i < points.length; i++) { const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y); if (length > longest) { longest = length; x = (a.x + b.x) / 2; y = (a.y + b.y) / 2; } }
  }
  return <><BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} interactionWidth={22}/>{props.data?.insert && <EdgeLabelRenderer><button className={`gx-edge-add nodrag nopan ${props.selected ? 'is-selected' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }} aria-label={`Insert screen before ${props.data.targetName}`} title={`Insert a screen on this path`} onClick={e => { e.stopPropagation(); props.data.insert({ edge: props.id }); }}><Plus size={12}/></button></EdgeLabelRenderer>}</>;
}
const nodeTypes = { screen: ScreenNode, entry: EntryNode, followups: FollowupsNode };
const edgeTypes = { path: PathEdge };

function Camera({ revision, focus, selected, d, visited, api, width, height }) {
  const { fitView, getNode, getNodes, setViewport, getViewport, viewportInitialized } = useReactFlow();
  const last = useRef('');
  const focusNodes = (ids, overview = false) => {
    const nodes = ids.map(getNode).filter(Boolean);
    if (!nodes.length || !width || !height) return;
    const left = Math.min(...nodes.map(n => n.position.x));
    const right = Math.max(...nodes.map(n => n.position.x + (n.measured?.width ?? 280)));
    const top = Math.min(...nodes.map(n => n.position.y));
    const bottom = Math.max(...nodes.map(n => n.position.y + (n.measured?.height ?? 250)));
    const zoom = Math.min(1, Math.max(overview ? .25 : .85, Math.min((width - 80) / (right - left), (height - 150) / (bottom - top))));
    const anchor = nodes[0];
    const overflow = (right - left) * zoom > width - 64;
    const x = overflow ? 32 - anchor.position.x * zoom : (width - (right - left) * zoom) / 2 - left * zoom;
    const y = Math.min(100, Math.max(height < 300 ? 40 : 68, (height - (bottom - top) * zoom) / 2)) - top * zoom;
    setViewport({ x, y, zoom }, { duration: 180 });
  };
  const selectionIds = () => {
    if (selected.kind === 'edge') { const edge = d.edges.find(e => e.id === selected.id); return edge ? [edge.source, edge.target] : []; }
    if (selected.kind === 'screen') return [selected.id, ...d.edges.filter(e => e.source === selected.id).map(e => e.target)];
    return width >= 1000 ? getNodes().map(n => n.id) : [d.entry, ...d.edges.filter(e => e.source === d.entry).map(e => e.target)];
  };
  useEffect(() => {
    if (!viewportInitialized || !width || !height) return;
    const signature = `${revision}:${selected.kind}:${selected.id}:${width}:${height}:${focus?.at}:${visited.join()}`;
    if (signature === last.current) return;
    last.current = signature;
    const frame = requestAnimationFrame(() => visited.length && (selected.kind === 'overview' || selected.kind === 'sample') ? focusNodes(width < 700 ? visited.slice(0,2) : visited, width >= 700) : focusNodes(focus?.id && selected.kind === 'screen' && selected.id === focus.id ? [focus.id] : selectionIds()));
    return () => cancelAnimationFrame(frame);
  }, [revision, selected.kind, selected.id, width, height, focus, visited.join(), viewportInitialized]);
  api.current = {
    fit: () => fitView({ padding: .15, maxZoom: 1, duration: 200 }),
    selection: () => focusNodes(selectionIds()),
    start: () => focusNodes([d.entry]),
    pan: direction => { const v = getViewport(); setViewport({ ...v, x: v.x + direction * width * .65 }, { duration: 180 }); },
  };
  return null;
}

export function JourneyGraph({ d: campaign, selected, select, connect, add, preview, previews, setPreviews, positions, setPositions, visited, visitedEdges, clearTrace, focus, variant, sampleActive }) {
  const groups=useMemo(()=>variant==='B'?followupGroups(campaign):[],[campaign,variant]);
  const [expandedGroups,setExpandedGroups]=useState([]);
  const selectedPath=campaign.edges.find(e=>selected.kind==='edge'&&e.id===selected.id);
  const collapsed=groups.filter(g=>!expandedGroups.includes(g.id)&&!g.members.some(s=>(selected.kind==='screen'&&selected.id===s.id)||selectedPath?.source===s.id||selectedPath?.target===s.id));
  const memberGroup=new Map(collapsed.flatMap(g=>g.members.map(s=>[s.id,g.id])));
  const d={...campaign,screens:campaign.screens.filter(s=>!memberGroup.has(s.id)).concat(collapsed.map(g=>({id:g.id,kind:'followups',name:'Relevant follow-ups',members:g.members}))),edges:campaign.edges.filter(e=>!memberGroup.has(e.source)||memberGroup.get(e.source)!==memberGroup.get(e.target)).map(e=>({...e,source:memberGroup.get(e.source)??e.source,target:memberGroup.get(e.target)??e.target})),entry:memberGroup.get(campaign.entry)??campaign.entry};
  const shownVisited=[...new Set(visited.map(id=>memberGroup.get(id)??id))];
  const [auto, setAuto] = useState({});
  const [measurements, setMeasurements] = useState({});
  const [routes, setRoutes] = useState({});
  const [revision, setRevision] = useState(0);
  const [layoutError, setLayoutError] = useState(false);
  const camera = useRef(null);
  const canvas = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [focusConnections, setFocusConnections] = useState(true);
  useEffect(() => { const observer = new ResizeObserver(() => { const box = canvas.current?.getBoundingClientRect(); if (box) setSize({ width: box.width, height: box.height }); }); if (canvas.current) observer.observe(canvas.current); return () => observer.disconnect(); }, []);
  const layoutSpec = useMemo(() => {
    const screens = d.screens.map(s => {
      const paths = ordered(d, s.id);
      if(s.kind==='followups') return {id:s.id,width:300,height:138+Math.min(s.members.length,3)*72,layoutOptions:{'elk.portConstraints':'FIXED_POS'},ports:[{id:`${s.id}:in`,x:0,y:42,width:0,height:0,properties:{side:'WEST'}},...paths.map(e=>({id:e.id,x:300,y:42,width:0,height:0,properties:{side:'EAST'}}))]};
      const branching = paths.filter(e => !e.skip).length > 1;
      const extra = (s.kind === 'capture' || s.kind === 'result' ? 28 : 0) + (s.showWhen ? 32 : 0);
      const rowHeight = branching ? 48 : 36;
      const height = 92 + (previews ? 104 : 0) + extra + (paths.length ? (branching ? 25 : 0) + paths.length * rowHeight : 0) + 32;
      const pathTop = 92 + (previews ? 104 : 0) + extra + (branching ? 25 : 0);
      return { id: s.id, width: nodeWidth, height, layoutOptions: { 'elk.portConstraints': 'FIXED_POS' }, ports: [
        { id: `${s.id}:in`, x: 0, y: 42, width: 0, height: 0, properties: { side: 'WEST' } },
        ...paths.map((e, i) => ({ id: e.id, x: nodeWidth, y: pathTop + i * rowHeight + rowHeight / 2, width: 0, height: 0, properties: { side: 'EAST' } })),
      ] };
    });
    return { children: [...(variant === 'A' ? [{ id: '__entry', width: 226, height: 140, ports: [{ id: 'entry:out', x: 226, y: 70, width: 0, height: 0, properties: { side: 'EAST' } }], layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } }] : []), ...screens], edges: [...(variant === 'A' ? [{ id: 'entry-link', sources: ['entry:out'], targets: [`${d.entry}:in`] }] : []), ...d.edges.map(e => ({ id: `link:${e.id}`, sources: [e.id], targets: [`${e.target}:in`] }))] };
  }, [d.entry, d.screens.map(s => `${s.id}:${s.kind}:${!!s.showWhen}:${s.members?.length}`).join('|'), d.edges.map(e => `${e.id}:${e.source}:${e.target}:${e.value === null}:${e.skip}`).join('|'), previews, variant]);
  useEffect(() => {
    let cancelled = false;
    getLayoutEngine().then(elk => elk.layout({ id: 'root', layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.spacing.nodeNode': '40', 'elk.layered.spacing.nodeNodeBetweenLayers': '66', 'elk.layered.spacing.edgeNodeBetweenLayers': '30', 'elk.layered.crossingMinimization.forceNodeModelOrder': 'true', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', 'elk.padding': '[top=30,left=30,bottom=30,right=30]' }, ...layoutSpec }))
      .then(result => { if (!cancelled) { const simple = d.screens.every(s => d.edges.filter(e => e.source === s.id && !e.skip).length <= 1); setAuto(Object.fromEntries(result.children.map(n => [n.id, { x: n.x, y: simple && n.id !== '__entry' ? 60 : n.y }]))); setRoutes(simple ? {} : Object.fromEntries(result.edges.map(e => [e.id.replace(/^link:/, ''), e.sections?.[0]]))); setPositions({}); setRevision(r => r + 1); setLayoutError(false); } })
      .catch(() => { if (!cancelled) setLayoutError(true); });
    return () => { cancelled = true; };
  }, [layoutSpec]);
  // Only a moved endpoint invalidates an edge's ELK route. Moving one box must
  // not reroute every other line through the simpler live-drag path generator.
  const routeFor = (id, source, target) => positions[source] || positions[target] ? null : routes[id];
  const selectedEdge = d.edges.find(e => selected.kind === 'edge' && e.id === selected.id);
  const relevant = new Set();
  const highlightedEdges = new Set();
  if (selectedEdge) {
    relevant.add(selectedEdge.source); highlightedEdges.add(selectedEdge.id);
    const walk = id => { if (relevant.has(id)) return; relevant.add(id); d.edges.filter(e => e.source === id).forEach(e => { highlightedEdges.add(e.id); walk(e.target); }); };
    walk(selectedEdge.target);
  } else if (selected.kind === 'screen') {
    relevant.add(selected.id);
    d.edges.filter(e => e.source === selected.id || e.target === selected.id).forEach(e => { relevant.add(e.source); relevant.add(e.target); highlightedEdges.add(e.id); });
  }
  const focusing = focusConnections && relevant.size > 0;
  const nodes = [...(variant === 'A' ? [{ id: '__entry', type: 'entry', position: auto.__entry ?? { x: -320, y: 0 }, selected: selected.kind === 'display', draggable: false, connectable: false, data: { rules: d.rules, select } }] : []), ...d.screens.map((s, index) => ({ id: s.id, type: s.kind==='followups'?'followups':'screen', position: positions[s.id] ?? auto[s.id] ?? { x: index * 390, y: 0 }, selected: selected.kind === 'screen' && selected.id === s.id, data: { screen: s, d, original:campaign, sampleActive, tracedMembers:visited, expand:id=>setExpandedGroups(old=>[...old,id]), paths: ordered(d, s.id), previews, select, add, preview, start: s.id === d.entry, activeEdge: selected.kind === 'edge' ? selected.id : null, visited: shownVisited.includes(s.id), dim: visited.length > 0 ? !shownVisited.includes(s.id) : focusing && !relevant.has(s.id), handoffs: d.destinations.filter(id => destinations[id].channel === s.channel).map(id => destinations[id].name) } }))];
  const edges = [...(variant === 'A' ? [{ id: 'entry-link', source: '__entry', target: d.entry, sourceHandle: 'entry:out', targetHandle: `${d.entry}:in`, type: 'path', data: { route: routeFor('entry-link', '__entry', d.entry) }, style: { stroke: '#a9bdb2', strokeDasharray: '4 4' }, selectable: false }] : []), ...d.edges.map(e => ({ ...e, sourceHandle: e.id, targetHandle: `${e.target}:in`, type: 'path', selected: selected.kind === 'edge' && selected.id === e.id, data: { route: routeFor(e.id, e.source, e.target), insert: add, targetName: d.screens.find(s => s.id === e.target)?.name }, markerEnd: { type: MarkerType.ArrowClosed, color: selected.id === e.id ? '#bd7b34' : '#8daba1', width: 14, height: 14 }, style: { opacity: visited.length ? (visitedEdges.includes(e.id) ? 1 : .16) : focusing && !highlightedEdges.has(e.id) ? .16 : 1, stroke: visited.length && visitedEdges.includes(e.id) ? '#397c58' : selected.id === e.id ? '#b57a29' : focusing && highlightedEdges.has(e.id) ? '#457c6e' : '#91aaa2', strokeWidth: selected.id === e.id ? 2.5 : 1.6, strokeDasharray: e.skip ? '5 4' : undefined } }))];
  return <div className="gx-canvas" ref={canvas}><ReactFlow key={variant} nodes={nodes.map(node => ({ ...node, measured: measurements[node.id], initialWidth: layoutSpec.children.find(s => s.id === node.id)?.width, initialHeight: layoutSpec.children.find(s => s.id === node.id)?.height }))} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={.25} maxZoom={1.4} deleteKeyCode={null} onNodeClick={(_, n) => {if(n.type==='followups')setExpandedGroups(old=>[...old,n.id]);else select(n.id === '__entry' ? 'display' : 'screen', n.id);}} onEdgeClick={(_, e) => { if (e.id !== 'entry-link') select('edge', e.id); }} onConnect={connect} isValidConnection={c => validConnection(campaign, c.source, c.target)} onNodesChange={changes => {
      // Controlled nodes must retain React Flow's measured dimensions. Without
      // them, every drag update resets handle bounds and temporarily removes all edges.
      const resized = changes.filter(c => c.type === 'dimensions' && c.dimensions);
      if (resized.length) setMeasurements(old => {
        const changed = resized.filter(c => old[c.id]?.width !== c.dimensions.width || old[c.id]?.height !== c.dimensions.height);
        return changed.length ? { ...old, ...Object.fromEntries(changed.map(c => [c.id, c.dimensions])) } : old;
      });
      const moved = changes.filter(c => c.type === 'position' && c.position); if (moved.length) setPositions(old => ({ ...old, ...Object.fromEntries(moved.map(c => [c.id, c.position])) })); }} onPaneClick={() => select('overview', null)} panOnScroll zoomOnScroll={false} zoomOnPinch><Background gap={24} size={1} color="#dce3dd"/><Controls showInteractive={false} showFitView={false}/><Camera revision={`${variant}-${revision}`} focus={focus} selected={selected} d={d} visited={shownVisited} api={camera} width={size.width} height={size.height}/></ReactFlow>
    <div className="gx-view-tools">{groups.length>0 && <button onClick={()=>{if(collapsed.length){setExpandedGroups(groups.map(g=>g.id));}else{setExpandedGroups([]);select('overview',null);}}}>{collapsed.length?'Expand follow-ups':'Group follow-ups'}</button>}<button onClick={() => camera.current?.start()}><ArrowRight size={14}/>Start</button><button aria-pressed={previews} onClick={() => setPreviews(!previews)}>{previews ? <EyeOff size={14}/> : <Eye size={14}/>}Screen previews</button><button onClick={() => { setPositions({}); setRevision(r => r + 1); }}><Maximize2 size={14}/>Tidy up</button><button onClick={() => camera.current?.fit()}><Focus size={14}/>Fit journey</button></div>
    {visited.length > 0 && <div className="gx-trace-note"><Check size={15}/>{sampleActive ? 'Sample path · change answers in the panel' : 'Sample visitor path highlighted'}<button onClick={clearTrace}><X size={14}/>Clear</button></div>}
    {layoutError && <div className="gx-trace-note">Automatic layout unavailable. You can still move screens.</div>}
    <div className="gx-canvas-hint"><ArrowRight size={14}/><span>{sampleActive ? 'Highlighted screens are the ones this visitor reaches' : 'Follow arrows from the first screen · Select a screen to edit'}</span></div>
    {relevant.size > 0 && !visited.length && <div className="gx-focus-tools"><button aria-pressed={focusConnections} onClick={() => setFocusConnections(!focusConnections)}><Focus size={14}/>{focusConnections ? 'Related paths highlighted' : 'Highlight related paths'}</button><button onClick={() => camera.current?.selection()}>Focus selection</button></div>}
    <div className="gx-pan"><button aria-label="Pan to earlier screens" onClick={() => camera.current?.pan(1)}>←</button><span>Scroll to pan</span><button aria-label="Pan to later screens" onClick={() => camera.current?.pan(-1)}>→</button></div>
  </div>;
}
