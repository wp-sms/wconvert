import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, useReactFlow, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { walkNodes } from './structure/journey';
import { conditionText } from './structure/conditionText';
import '@xyflow/react/dist/style.css';

interface CardData { tree: TemplateTree; index: number; rtl: boolean; select(index: number): void }

const ScreenCard = memo(function ScreenCard({ data, selected }: NodeProps) {
  const { tree, index, rtl, select } = data as unknown as CardData;
  const screen = tree.steps[index];
  const question = walkNodes(screen.content).find(node => node.type === 'question');
  const paths = screen.paths ?? (index + 1 < tree.steps.length ? [{ to: tree.steps[index + 1].id }] : []);
  const hiddenTarget = screen.when && screen.paths && tree.steps[index + 1]
    && !screen.paths.some(path => path.to === tree.steps[index + 1].id) ? tree.steps[index + 1] : undefined;
  const kind = screen.kind === 'acknowledgement' ? __('Ending', 'wconvert') : screen.kind === 'result' ? __('Result', 'wconvert')
    : question ? __('Question', 'wconvert') : screen.kind === 'input' ? __('Collect details', 'wconvert') : __('Screen', 'wconvert');
  return <div className={`wconvert-flow-node${selected ? ' is-selected' : ''}`}>
    <Handle id="in" type="target" position={rtl ? Position.Right : Position.Left} />
    <button type="button" className="wconvert-flow-node__main" onClick={() => select(index)}>
      <small>{index + 1} · {kind}</small><strong>{screen.name}</strong>
      {question && 'label' in question && <span>{String(question.label)}</span>}
      {screen.when && <em>{sprintf(__('Show if %s', 'wconvert'), conditionText(tree, screen.when))}</em>}
      {screen.kind === 'result' && <span>{sprintf(__('%d possible results · first match wins', 'wconvert'), screen.results?.length ?? 0)}</span>}
    </button>
    {paths.length > 1 && <div className="wconvert-flow-node__paths">
      <small>{__('First matching path wins', 'wconvert')}</small>
      {paths.map((path, priority) => <div key={`${path.to}-${priority}`} className="wconvert-flow-node__path">
        <button type="button" className="nodrag" onClick={() => select(index)}>
          {priority === paths.length - 1 ? __('Everyone else', 'wconvert') : `${priority + 1}. ${path.when ? conditionText(tree, path.when) : ''}`}
          <span> → {tree.steps.find(item => item.id === path.to)?.name}</span>
        </button>
        <Handle id={`route-${priority}`} type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />
      </div>)}
    </div>}
    {hiddenTarget && <div className="wconvert-flow-node__hidden">
      {sprintf(__('When hidden → %s', 'wconvert'), hiddenTarget.name)}
      <Handle id="hidden" type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />
    </div>}
    {index < tree.steps.length - 1 && <>
      {paths.length === 1 && <Handle id="route-0" type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />}
      <div className="wconvert-flow-node__add">+ {__('Drag to add a path', 'wconvert')}</div>
      <Handle id="new" type="source" position={rtl ? Position.Left : Position.Right} style={{ top: 'calc(100% - 15px)' }} />
    </>}
  </div>;
});
const nodeTypes = { screen: ScreenCard };

function FocusCamera({ selectedId, nextId, revision }: { selectedId: string; nextId?: string; revision: number }) {
  const { fitView, viewportInitialized } = useReactFlow();
  const overviewShown = useRef(false);
  useEffect(() => {
    if (!viewportInitialized || revision === 0) return;
    const overview = !overviewShown.current;
    overviewShown.current = true;
    const frame = requestAnimationFrame(() => void fitView({
      ...(overview ? {} : { nodes: [{ id: selectedId }, ...(nextId ? [{ id: nextId }] : [])] }),
      padding: 0.2, maxZoom: 1, duration: 180 }));
    return () => cancelAnimationFrame(frame);
  }, [fitView, nextId, revision, selectedId, viewportInitialized]);
  return null;
}

/** The canvas is an overview; the same routes are editable through selects in the inspector. */
export function JourneyMap({ tree, selected, onSelect, onConnect }: {
  tree: TemplateTree; selected: number; onSelect(index: number): void; onConnect(source: string, target: string): void;
}) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({});
  const [revision, setRevision] = useState(0);
  const rtl = document.documentElement.dir === 'rtl';
  const layoutKey = tree.steps.map(step => `${step.id}:${step.when ? 'conditional' : 'always'}:${step.paths?.map(path => path.to).join(',') ?? ''}`).join('|');
  useEffect(() => {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: rtl ? 'RL' : 'LR', ranksep: 92, nodesep: 46 });
    graph.setDefaultEdgeLabel(() => ({}));
    tree.steps.forEach((step, index) => graph.setNode(step.id, { width: 252,
      height: 166 + (step.when ? 32 : 0) + Math.max(0, (step.paths?.length ?? 1) - 1) * 45
        + (step.when && step.paths && tree.steps[index + 1] && !step.paths.some(path => path.to === tree.steps[index + 1].id) ? 30 : 0)
        - (index === tree.steps.length - 1 ? 28 : 0) }));
    tree.steps.forEach((step, index) => {
      (step.paths ?? (tree.steps[index + 1] ? [{ to: tree.steps[index + 1].id }] : []))
        .forEach(path => graph.setEdge(step.id, path.to));
      if (step.when && step.paths && tree.steps[index + 1]) graph.setEdge(step.id, tree.steps[index + 1].id);
    });
    dagre.layout(graph);
    setPositions(Object.fromEntries(tree.steps.map(step => {
      const node = graph.node(step.id);
      return [step.id, { x: node.x - node.width / 2, y: node.y - node.height / 2 }];
    })));
    setRevision(value => value + 1);
  // The layout depends on graph structure, not card text edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, rtl]);
  const nodes = useMemo<Node[]>(() => tree.steps.map((step, index) => ({ id: step.id, type: 'screen',
    position: positions[step.id] ?? { x: (rtl ? tree.steps.length - 1 - index : index) * 340, y: 60 }, measured: measurements[step.id],
    selected: index === selected, data: { tree, index, rtl, select: onSelect } })), [tree, selected, positions, measurements, onSelect, rtl]);
  const edges = useMemo<Edge[]>(() => tree.steps.flatMap((step, index) => {
    const routes: Edge[] = (step.paths ?? (tree.steps[index + 1] ? [{ to: tree.steps[index + 1].id }] : []))
      .map((path, priority) => ({ id: `${step.id}-${priority}`, source: step.id, target: path.to,
        sourceHandle: `route-${priority}`, targetHandle: 'in', type: 'smoothstep',
        label: step.paths && step.paths.length > 1 ? priority === step.paths.length - 1 ? __('Else', 'wconvert') : String(priority + 1) : undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#719987', width: 15, height: 15 },
        style: { stroke: '#719987', strokeWidth: 2 } }));
    const next = tree.steps[index + 1];
    if (step.when && step.paths && next && !step.paths.some(path => path.to === next.id)) routes.push({
      id: `${step.id}-hidden`, source: step.id, target: next.id, sourceHandle: 'hidden', targetHandle: 'in', type: 'smoothstep',
      label: __('Hidden', 'wconvert'), markerEnd: { type: MarkerType.ArrowClosed, color: '#9aa8a0', width: 15, height: 15 },
      style: { stroke: '#9aa8a0', strokeWidth: 1.5, strokeDasharray: '5 4' },
    });
    return routes;
  }), [tree]);
  const valid = (connection: Connection | Edge) => {
    const from = tree.steps.findIndex(step => step.id === connection.source);
    const to = tree.steps.findIndex(step => step.id === connection.target);
    if (from < 0 || to <= from || tree.steps[from].paths?.some(path => path.to === connection.target)) return false;
    const boundary = tree.steps.findIndex((step, index) => index > from && (['result', 'acknowledgement'].includes(step.kind)
      || walkNodes(step.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit')));
    return boundary < 0 || to <= boundary;
  };
  return <div className="wconvert-journey-map" aria-label={__('Journey map', 'wconvert')}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      minZoom={0.25} maxZoom={1.5} deleteKeyCode={null} panOnScroll zoomOnScroll={false} zoomOnPinch
      onNodeClick={(_, node) => onSelect(tree.steps.findIndex(step => step.id === node.id))}
      isValidConnection={valid} onConnect={connection => { if (connection.source && connection.target && valid(connection)) onConnect(connection.source, connection.target); }}
      onNodesChange={changes => {
        // Retaining measured dimensions prevents every edge from disappearing
        // briefly when a controlled node moves.
        const sizes = changes.filter((change): change is Extract<typeof change, { type: 'dimensions' }> => change.type === 'dimensions' && !!change.dimensions);
        if (sizes.length) setMeasurements(old => ({ ...old, ...Object.fromEntries(sizes.map(change => [change.id, change.dimensions!])) }));
        const moved = changes.filter((change): change is Extract<typeof change, { type: 'position' }> => change.type === 'position' && !!change.position);
        if (moved.length) setPositions(old => ({ ...old, ...Object.fromEntries(moved.map(change => [change.id, change.position!])) }));
      }}>
      <Background gap={24} size={1} color="#dce5dd" /><Controls showInteractive={false} />
      <FocusCamera selectedId={tree.steps[selected]?.id ?? tree.steps[0].id} nextId={tree.steps[selected + 1]?.id} revision={revision} />
    </ReactFlow>
    <p className="wconvert-journey-map__hint">{rtl ? __('Follow arrows from right to left. Select a screen to edit; draw a line to add a forward path.', 'wconvert')
      : __('Follow arrows from left to right. Select a screen to edit; draw a line to add a forward path.', 'wconvert')}</p>
  </div>;
}
