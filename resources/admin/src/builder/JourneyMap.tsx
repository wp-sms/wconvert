import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, useReactFlow, useStore, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { walkNodes } from './structure/journey';
import { conditionText } from './structure/conditionText';
import { graphDisplayOrder } from './structure/graph';
import '@xyflow/react/dist/style.css';

interface CardData { tree: TemplateTree; index: number; ordinal: number; rtl: boolean; muted: boolean; preview: boolean; destinationSummary?: string; select(index: number): void; selectPath(index: number, priority: number): void; goToDestinations?(): void }

export function routesFor(tree: TemplateTree, index: number) {
  const screen = tree.steps[index];
  if (tree.graph) {
    const outgoing = tree.graph.edges.filter(edge => edge.from === screen.id);
    return [...outgoing.filter(edge => edge.kind === 'answer'), ...outgoing.filter(edge => edge.kind === 'default')];
  }
  return screen.paths ?? (tree.steps[index + 1] ? [{ to: tree.steps[index + 1].id }] : []);
}

export function hiddenFor(tree: TemplateTree, index: number): string | undefined {
  if (tree.graph) return tree.graph.edges.find(edge => edge.from === tree.steps[index].id && edge.kind === 'hidden')?.to;
  return tree.steps[index].when ? tree.steps[index + 1]?.id : undefined;
}

const ScreenCard = memo(function ScreenCard({ data, selected }: NodeProps) {
  const { tree, index, ordinal, rtl, muted, preview, destinationSummary, select, selectPath, goToDestinations } = data as unknown as CardData;
  const screen = tree.steps[index];
  const content = walkNodes(screen.content);
  const question = content.find(node => node.type === 'question');
  const savesDetails = content.some(node => node.type === 'button' && 'action' in node && node.action === 'submit');
  const heading = content.find(node => node.type === 'heading');
  const incoming = tree.graph ? new Set(tree.graph.edges.filter(edge => edge.to === screen.id).map(edge => edge.from)).size
    : tree.steps.slice(0, index).filter((item, at) => (item.paths ?? (tree.steps[at + 1] ? [{ to: tree.steps[at + 1].id }] : []))
      .some(path => path.to === screen.id)).length;
  const paths = routesFor(tree, index);
  const hiddenId = hiddenFor(tree, index);
  const hiddenTarget = hiddenId && !paths.some(path => path.to === hiddenId) ? tree.steps.find(item => item.id === hiddenId) : undefined;
  const kind = screen.kind === 'acknowledgement' ? __('Ending', 'wconvert') : screen.kind === 'result' ? __('Result', 'wconvert')
    : question ? __('Question', 'wconvert') : screen.kind === 'input' ? __('Collect details', 'wconvert') : __('Screen', 'wconvert');
  return <div className={`wconvert-flow-node${selected ? ' is-selected' : ''}${muted ? ' is-muted' : ''}`}>
    <Handle id="in" type="target" position={rtl ? Position.Right : Position.Left} />
    <button type="button" className="wconvert-flow-node__main" onClick={() => select(index)}>
      <small>{ordinal} · {kind}{screen.id === (tree.graph?.entry ?? tree.steps[0].id) ? ` · ${__('First screen', 'wconvert')}` : incoming > 1 ? ` · ${__('Paths rejoin', 'wconvert')}` : ''}</small><strong>{screen.name}</strong>
      {question && 'label' in question && <span>{String(question.label)}</span>}
      {screen.when && <em>{sprintf(__('Show if %s', 'wconvert'), conditionText(tree, screen.when))}</em>}
      {screen.kind === 'result' && <span>{sprintf(__('%d possible results · first match wins', 'wconvert'), screen.results?.length ?? 0)}</span>}
    </button>
    {preview && <div className="wconvert-flow-node__preview" aria-hidden="true"><small>{__('Screen preview', 'wconvert')}</small><strong>{heading && 'text' in heading ? String(heading.text) : screen.name}</strong>
      {question && 'options' in question && <span>{question.options?.slice(0, 2).map(option => option.label).join(' · ')}</span>}
    </div>}
    {savesDetails && <div className="wconvert-flow-node__save">
      <strong>{__('Details saved here', 'wconvert')}</strong>
      {destinationSummary && <span>{destinationSummary}</span>}
      {goToDestinations && <button type="button" className="nodrag" onClick={goToDestinations}>{__('Edit destinations', 'wconvert')}</button>}
    </div>}
    {paths.length > 1 && <div className="wconvert-flow-node__paths">
      <small>{__('First matching path wins', 'wconvert')}</small>
      {paths.map((path, priority) => <div key={'id' in path && typeof path.id === 'string' ? path.id : `${path.to}-${priority}`} className="wconvert-flow-node__path">
        <button type="button" className="nodrag" onClick={() => selectPath(index, priority)}>
          {priority === paths.length - 1 ? __('Everyone else', 'wconvert') : `${priority + 1}. ${path.when ? conditionText(tree, path.when) : ''}`}
          <span> → {tree.steps.find(item => item.id === path.to)?.name}</span>
        </button>
        <Handle id={`route-${priority}`} type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />
      </div>)}
    </div>}
    {paths.length === 1 && <div className="wconvert-flow-node__continue">
      <button type="button" className="nodrag" onClick={() => selectPath(index, 0)}>
        {sprintf(tree.steps.find(item => item.id === paths[0].to)?.when ? __('Check next: %s', 'wconvert') : __('Then: %s', 'wconvert'), tree.steps.find(item => item.id === paths[0].to)?.name ?? __('Next screen', 'wconvert'))}
      </button>
      <Handle id="route-0" type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />
    </div>}
    {screen.when && hiddenId && <div className="wconvert-flow-node__hidden">
      {sprintf(__('When hidden → %s', 'wconvert'), tree.steps.find(item => item.id === hiddenId)?.name ?? hiddenId)}
      {hiddenTarget &&
      <Handle id="hidden" type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />
      }
    </div>}
    {!tree.graph && paths.length > 0 && <>
      <div className="wconvert-flow-node__add">+ {__('Drag to add a path', 'wconvert')}</div>
      <Handle id="new" type="source" position={rtl ? Position.Left : Position.Right} style={{ top: 'calc(100% - 15px)' }} />
    </>}
  </div>;
});
const nodeTypes = { screen: ScreenCard };

function FocusCamera({ selectedId, nextId, firstId, initialOverview, revision, onTidy, preview, onPreview }: {
  selectedId: string; nextId?: string; firstId: string; initialOverview: boolean; revision: number; onTidy(): void; preview: boolean; onPreview(): void;
}) {
  const { fitView, viewportInitialized } = useReactFlow();
  const width = useStore(state => state.width);
  const overviewShown = useRef(false);
  useEffect(() => {
    if (!viewportInitialized || revision === 0) return;
    const overview = !overviewShown.current && width >= 600 && initialOverview;
    overviewShown.current = true;
    const frame = requestAnimationFrame(() => void fitView({
      ...(overview ? {} : { nodes: [{ id: selectedId }, ...(width >= 600 && nextId ? [{ id: nextId }] : [])] }),
      padding: 0.2, maxZoom: 1, duration: 180 }));
    return () => cancelAnimationFrame(frame);
  }, [fitView, nextId, initialOverview, revision, selectedId, viewportInitialized, width]);
  return <div className="wconvert-journey-map__tools">
    <button type="button" onClick={() => void fitView({ nodes: [{ id: firstId }], padding: .4, maxZoom: 1, duration: 180 })}>{__('Start', 'wconvert')}</button>
    <button type="button" aria-pressed={preview} onClick={onPreview}>{preview ? __('Hide previews', 'wconvert') : __('Screen previews', 'wconvert')}</button>
    <button type="button" onClick={onTidy}>{__('Tidy up', 'wconvert')}</button>
    <button type="button" onClick={() => void fitView({ padding: .2, maxZoom: 1, duration: 180 })}>{__('Fit journey', 'wconvert')}</button>
  </div>;
}

/** The canvas is an overview; the same routes are editable through selects in the inspector. */
export function JourneyMap({ tree, selected, focusedPath = null, onSelect, onSelectPath, onConnect, samplePath = null, destinationSummary, onGoToDestinations }: {
  tree: TemplateTree; selected: number | null; onSelect(index: number): void; onSelectPath(index: number, priority: number): void;
  onConnect(source: string, target: string): void; samplePath?: readonly number[] | null; focusedPath?: number | null;
  destinationSummary?: string; onGoToDestinations?(): void;
}) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({});
  const [revision, setRevision] = useState(0);
  const [tidyRevision, setTidyRevision] = useState(0);
  const [preview, setPreview] = useState(false);
  const rtl = document.documentElement.dir === 'rtl';
  const cameraIndex = selected ?? (tree.graph ? Math.max(0, tree.steps.findIndex(screen => screen.id === tree.graph?.entry)) : 0);
  const layoutKey = tree.graph ? `${tree.graph.entry}|${tree.steps.map(screen => `${screen.id}:${!!screen.when}`).join('|')}|${tree.graph.edges.map(edge => `${edge.id}:${edge.from}:${edge.to}:${edge.kind}`).join('|')}`
    : tree.steps.map(step => `${step.id}:${step.when ? 'conditional' : 'always'}:${step.paths?.map(path => path.to).join(',') ?? ''}`).join('|');
  useEffect(() => {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: rtl ? 'RL' : 'LR', ranksep: 92, nodesep: 46 });
    graph.setDefaultEdgeLabel(() => ({}));
    tree.steps.forEach((step, index) => graph.setNode(step.id, { width: 252,
      height: 166 + (preview ? 75 : 0) + (walkNodes(step.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit') ? 74 : 0)
        + (step.when ? 32 : 0) + Math.max(0, routesFor(tree, index).length - 1) * 45
        + (hiddenFor(tree, index) && !routesFor(tree, index).some(path => path.to === hiddenFor(tree, index)) ? 30 : 0)
        - (routesFor(tree, index).length === 0 ? 28 : 0) }));
    tree.steps.forEach((step, index) => {
      routesFor(tree, index)
        .forEach(path => graph.setEdge(step.id, path.to));
      const hidden = hiddenFor(tree, index);
      if (hidden) graph.setEdge(step.id, hidden);
    });
    dagre.layout(graph);
    setPositions(Object.fromEntries(tree.steps.map(step => {
      const node = graph.node(step.id);
      return [step.id, { x: node.x - node.width / 2, y: node.y - node.height / 2 }];
    })));
    setRevision(value => value + 1);
  // The layout depends on graph structure, not card text edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, rtl, tidyRevision, preview]);
  const focusTarget = focusedPath === null || selected === null ? null
    : tree.steps.findIndex(item => item.id === routesFor(tree, selected)[focusedPath]?.to);
  const ordinals = useMemo(() => graphDisplayOrder(tree), [tree]);
  const nodes = useMemo<Node[]>(() => tree.steps.map((step, index) => ({ id: step.id, type: 'screen',
    position: positions[step.id] ?? { x: (rtl ? tree.steps.length - 1 - index : index) * 340, y: 60 }, measured: measurements[step.id],
    selected: index === selected && samplePath === null, data: { tree, index, ordinal: ordinals.indexOf(index) + 1, rtl,
      muted: samplePath !== null ? !samplePath.includes(index) : focusTarget !== null && index !== selected && index !== focusTarget,
      preview, destinationSummary, goToDestinations: onGoToDestinations, select: onSelect, selectPath: onSelectPath } })), [tree, ordinals, selected, positions, measurements, onSelect, onSelectPath, rtl, samplePath, focusTarget, preview, destinationSummary, onGoToDestinations]);
  const edges = useMemo<Edge[]>(() => tree.steps.flatMap((step, index) => {
    const paths = routesFor(tree, index);
    const routes: Edge[] = paths
      .map((path, priority) => ({ id: 'id' in path && typeof path.id === 'string' ? path.id : `${step.id}-${priority}`, source: step.id, target: path.to, data: { sourceIndex: index, priority },
        sourceHandle: `route-${priority}`, targetHandle: 'in', type: 'smoothstep',
        label: paths.length > 1 ? priority === paths.length - 1 ? __('Else', 'wconvert') : String(priority + 1) : undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#719987', width: 15, height: 15 },
        style: { stroke: '#719987', strokeWidth: 2, opacity: samplePath !== null ? 1 : focusedPath !== null && (index !== selected || priority !== focusedPath) ? .2 : 1 } }));
    const hidden = hiddenFor(tree, index);
    if (hidden && !paths.some(path => path.to === hidden)) routes.push({
      id: tree.graph?.edges.find(edge => edge.from === step.id && edge.kind === 'hidden')?.id ?? `${step.id}-hidden`,
      source: step.id, target: hidden, sourceHandle: 'hidden', targetHandle: 'in', type: 'smoothstep',
      label: __('Hidden', 'wconvert'), markerEnd: { type: MarkerType.ArrowClosed, color: '#9aa8a0', width: 15, height: 15 },
      style: { stroke: '#9aa8a0', strokeWidth: 1.5, strokeDasharray: '5 4', opacity: samplePath !== null ? 1 : focusedPath !== null ? .2 : 1 },
    });
    return routes;
  }), [tree, focusedPath, samplePath, selected]);
  const valid = (connection: Connection | Edge) => {
    const from = tree.steps.findIndex(step => step.id === connection.source);
    const to = tree.steps.findIndex(step => step.id === connection.target);
    if (tree.graph) return false;
    if (from < 0 || to <= from || tree.steps[from].paths?.some(path => path.to === connection.target)) return false;
    const boundary = tree.steps.findIndex((step, index) => index > from && (['result', 'acknowledgement'].includes(step.kind)
      || walkNodes(step.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit')));
    return boundary < 0 || to <= boundary;
  };
  return <div className="wconvert-journey-map" aria-label={__('Journey map', 'wconvert')}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      minZoom={0.25} maxZoom={1.5} deleteKeyCode={null} panOnScroll zoomOnScroll={false} zoomOnPinch
      onNodeClick={(_, node) => onSelect(tree.steps.findIndex(step => step.id === node.id))}
      onEdgeClick={(_, edge) => { const data = edge.data as { sourceIndex?: number; priority?: number } | undefined; if (data?.sourceIndex !== undefined) onSelectPath(data.sourceIndex, data.priority ?? 0); }}
      isValidConnection={valid} onConnect={connection => { if (connection.source && connection.target && valid(connection)) onConnect(connection.source, connection.target); }}
      onNodesChange={changes => {
        // Retaining measured dimensions prevents every edge from disappearing
        // briefly when a controlled node moves.
        const sizes = changes.filter((change): change is Extract<typeof change, { type: 'dimensions' }> => change.type === 'dimensions' && !!change.dimensions);
        if (sizes.length) setMeasurements(old => {
          const changed = sizes.filter(change => old[change.id]?.width !== change.dimensions!.width || old[change.id]?.height !== change.dimensions!.height);
          return changed.length ? { ...old, ...Object.fromEntries(changed.map(change => [change.id, change.dimensions!])) } : old;
        });
        const moved = changes.filter((change): change is Extract<typeof change, { type: 'position' }> => change.type === 'position' && !!change.position);
        if (moved.length) setPositions(old => ({ ...old, ...Object.fromEntries(moved.map(change => [change.id, change.position!])) }));
      }}>
      <Background gap={24} size={1} color="#dce5dd" /><Controls showInteractive={false} />
      <FocusCamera selectedId={tree.steps[cameraIndex]?.id ?? tree.steps[0].id} nextId={routesFor(tree, cameraIndex)[0]?.to}
        firstId={tree.graph?.entry ?? tree.steps[0].id}
        initialOverview={selected === null && tree.steps.length <= 3}
        revision={revision} preview={preview} onPreview={() => setPreview(value => !value)} onTidy={() => setTidyRevision(value => value + 1)} />
    </ReactFlow>
    <p className="wconvert-journey-map__hint">{tree.graph
      ? __('Follow the connected screens from the first screen. Moving a box changes only the map layout.', 'wconvert')
      : rtl ? __('Follow arrows from right to left. Scroll to move through the map; select a screen to edit or draw a forward path.', 'wconvert')
        : __('Follow arrows from left to right. Scroll to move through the map; select a screen to edit or draw a forward path.', 'wconvert')}</p>
  </div>;
}
