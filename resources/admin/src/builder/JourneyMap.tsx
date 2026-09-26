import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Background, Handle, MarkerType, Position, ReactFlow, useReactFlow, useStore, useNodesInitialized, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { walkNodes } from './structure/journey';
import { conditionText } from './structure/conditionText';
import { graphDisplayOrder } from './structure/graph';
import { canAddGraphConnection, canTargetGraphScreen, graphChoiceSources } from './structure/graphConnections';
import { FollowupGroupCard } from './FollowupGroupCard';
import { followupGroups, type FollowupGroup } from './structure/followupGroups';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem } from '../components/ui/dropdown-menu';
import '@xyflow/react/dist/style.css';

interface CardData { tree: TemplateTree; index: number; ordinal: number; rtl: boolean; muted: boolean; preview: boolean; compactEnding: boolean; destinationSummary?: string; select(index: number): void; selectPath(index: number, priority: number | 'hidden'): void; goToDestinations?(): void }

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
  const { tree, index, ordinal, rtl, muted, preview, compactEnding, destinationSummary, select, selectPath, goToDestinations } = data as unknown as CardData;
  const screen = tree.steps[index];
  const content = walkNodes(screen.content);
  const question = content.find(node => node.type === 'question');
  const savesDetails = content.some(node => node.type === 'button' && 'action' in node && node.action === 'submit');
  const heading = content.find(node => node.type === 'heading');
  const incoming = tree.graph ? new Set(tree.graph.edges.filter(edge => edge.to === screen.id).map(edge => edge.from)).size
    : tree.steps.slice(0, index).filter((item, at) => (item.paths ?? (tree.steps[at + 1] ? [{ to: tree.steps[at + 1].id }] : []))
      .some(path => path.to === screen.id)).length;
  const paths = routesFor(tree, index);
  const branching = paths.some(path => 'kind' in path ? path.kind === 'answer' : !!path.when);
  const missingContinuation = !!tree.graph && !paths.some(path => 'kind' in path && path.kind === 'default');
  const canDraw = tree.graph ? screen.kind !== 'acknowledgement' && (missingContinuation
    ? screen.kind !== 'result' || branching : graphChoiceSources(tree, screen.id).length > 0)
    : paths.length > 0;
  const hiddenId = hiddenFor(tree, index);
  const hiddenTarget = hiddenId && !paths.some(path => path.to === hiddenId) ? tree.steps.find(item => item.id === hiddenId) : undefined;
  const kind = screen.kind === 'acknowledgement' ? __('Ending', 'wconvert') : screen.kind === 'result' ? __('Result', 'wconvert')
    : question ? __('Question', 'wconvert') : screen.kind === 'input' ? __('Collect details', 'wconvert') : __('Screen', 'wconvert');
  return <div className={`wconvert-flow-node${selected ? ' is-selected' : ''}${muted ? ' is-muted' : ''}${compactEnding && screen.kind === 'acknowledgement' ? ' is-compact-ending' : ''}`}>
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
    {branching && <div className="wconvert-flow-node__paths">
      <small>{__('First matching path wins', 'wconvert')}</small>
      {paths.map((path, priority) => <div key={'id' in path && typeof path.id === 'string' ? path.id : `${path.to}-${priority}`} className="wconvert-flow-node__path">
        <button type="button" className="nodrag" onClick={() => selectPath(index, priority)}>
          {('kind' in path ? path.kind === 'default' : !path.when) ? __('Everyone else', 'wconvert') : `${priority + 1}. ${path.when ? conditionText(tree, path.when) : ''}`}
          <span> → {tree.steps.find(item => item.id === path.to)?.name}</span>
        </button>
        <Handle id={`route-${priority}`} type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />
      </div>)}
    </div>}
    {!branching && paths.length === 1 && <div className="wconvert-flow-node__continue">
      <button type="button" className="nodrag" onClick={() => selectPath(index, 0)}>
        {sprintf(tree.steps.find(item => item.id === paths[0].to)?.when ? __('Check next: %s', 'wconvert') : __('Then: %s', 'wconvert'), tree.steps.find(item => item.id === paths[0].to)?.name ?? __('Next screen', 'wconvert'))}
      </button>
      <Handle id="route-0" type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />
    </div>}
    {screen.when && hiddenId && <div className="wconvert-flow-node__hidden">
      {tree.graph ? <button type="button" className="nodrag" onClick={() => selectPath(index, 'hidden')}>{sprintf(__('When hidden → %s', 'wconvert'), tree.steps.find(item => item.id === hiddenId)?.name ?? hiddenId)}</button>
        : sprintf(__('When hidden → %s', 'wconvert'), tree.steps.find(item => item.id === hiddenId)?.name ?? hiddenId)}
      {hiddenTarget &&
      <Handle id="hidden" type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />
      }
    </div>}
    {canDraw && <>
      <div className="wconvert-flow-node__add">+ {missingContinuation ? __('Drag to connect the next screen', 'wconvert') : __('Drag to add an answer path', 'wconvert')}</div>
      <Handle id="new" type="source" position={rtl ? Position.Left : Position.Right} style={{ top: 'calc(100% - 15px)' }} />
    </>}
  </div>;
});
const nodeTypes = { screen: ScreenCard, followups: FollowupGroupCard };

function FocusCamera({ mapRoot, selectedId, nextId, firstId, initialOverview, overviewWidth = 600, revision, onTidy, preview, onPreview, grouping, toolbar, onNodesReady }: {
  mapRoot: RefObject<HTMLDivElement | null>; selectedId: string; nextId?: string; firstId: string; initialOverview: boolean; overviewWidth?: number; revision: number; onTidy(): void; preview: boolean; onPreview(): void; grouping?: { active: boolean; toggle(): void }; toolbar: HTMLElement | null; onNodesReady(): void;
}) {
  const { fitView, zoomIn, zoomOut, viewportInitialized, getViewport, setViewport } = useReactFlow();
  useEffect(() => {
    const root = mapRoot.current;
    if (!root) return;
    let frame = 0;
    const reveal = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.closest('.react-flow__node')) return;
      cancelAnimationFrame(frame);
      // WebKit applies :focus-visible after focusin; the group may also scroll.
      frame = requestAnimationFrame(() => {
        if (document.activeElement !== target || !target.matches(':focus-visible')) return;
        const bounds = root.querySelector('.react-flow')?.getBoundingClientRect();
        if (!bounds?.width || !bounds.height) return;
        const rect = target.getBoundingClientRect();
        const dx = rect.left < bounds.left + 12 ? bounds.left + 12 - rect.left
          : rect.right > bounds.right - 12 ? bounds.right - 12 - rect.right : 0;
        const dy = rect.top < bounds.top + 12 ? bounds.top + 12 - rect.top
          : rect.bottom > bounds.bottom - 12 ? bounds.bottom - 12 - rect.bottom : 0;
        if (dx || dy) {
          const viewport = getViewport();
          void setViewport({ ...viewport, x: viewport.x + dx, y: viewport.y + dy });
        }
      });
    };
    root.addEventListener('focusin', reveal);
    return () => { cancelAnimationFrame(frame); root.removeEventListener('focusin', reveal); };
  }, [mapRoot, getViewport, setViewport]);
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);
  const nodesReady = useNodesInitialized();
  useEffect(() => {
    if (!nodesReady) return;
    const frame = requestAnimationFrame(onNodesReady);
    return () => cancelAnimationFrame(frame);
  }, [nodesReady, onNodesReady, revision]);
  useEffect(() => {
    if (!viewportInitialized || revision === 0) return;
    const overview = width >= overviewWidth && initialOverview;
    const frame = requestAnimationFrame(() => void fitView({
      ...(overview ? {} : { nodes: [{ id: selectedId }, ...(width >= 600 && nextId ? [{ id: nextId }] : [])] }),
      padding: width < 600 ? .06 : overview ? .08 : .2, maxZoom: 1, duration: 180 }));
    return () => cancelAnimationFrame(frame);
  }, [fitView, nextId, initialOverview, revision, selectedId, viewportInitialized, width, height, overviewWidth]);
  return toolbar && createPortal(<div className="wconvert-journey-map__tools">
    <button type="button" className="wconvert-journey-map__desktop-tool" aria-label={__('Zoom in', 'wconvert')} onClick={() => void zoomIn()}>+</button>
    <button type="button" className="wconvert-journey-map__desktop-tool" aria-label={__('Zoom out', 'wconvert')} onClick={() => void zoomOut()}>−</button>
    <button type="button" className="wconvert-journey-map__desktop-tool" onClick={() => void fitView({ nodes: [{ id: firstId }], padding: .4, maxZoom: 1, duration: 180 })}>{__('Start', 'wconvert')}</button>
    <button type="button" className="wconvert-journey-map__desktop-tool" aria-pressed={preview} onClick={onPreview}>{preview ? __('Hide previews', 'wconvert') : __('Screen previews', 'wconvert')}</button>
    {grouping && <button type="button" aria-pressed={grouping.active} onClick={grouping.toggle}>{__('Group follow-ups', 'wconvert')}</button>}
    <button type="button" className="wconvert-journey-map__desktop-tool" onClick={onTidy}>{__('Tidy up', 'wconvert')}</button>
    <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="wconvert-journey-map__mobile-tool">{__('View options', 'wconvert')}</button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void zoomIn()}>{__('Zoom in', 'wconvert')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void zoomOut()}>{__('Zoom out', 'wconvert')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void fitView({ nodes: [{ id: firstId }], padding: .1, maxZoom: 1, duration: 180 })}>{__('Go to first screen', 'wconvert')}</DropdownMenuItem>
        <DropdownMenuCheckboxItem checked={preview} onCheckedChange={onPreview}>{__('Screen previews', 'wconvert')}</DropdownMenuCheckboxItem>
        <DropdownMenuItem onSelect={onTidy}>{__('Tidy up', 'wconvert')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <button type="button" onClick={() => void fitView({ padding: .2, maxZoom: 1, duration: 180 })}>{__('Fit journey', 'wconvert')}</button>
  </div>, toolbar);
}

/** The canvas is an overview; the same routes are editable through selects in the inspector. */
export function JourneyMap({ tree, selected, focusedPath = null, onSelect, onSelectPath, onConnect, onReconnect, samplePath = null, destinationSummary, onGoToDestinations }: {
  tree: TemplateTree; selected: number | null; onSelect(index: number): void; onSelectPath(index: number, priority: number | 'hidden'): void;
  onConnect(source: string, target: string): void; samplePath?: readonly number[] | null; focusedPath?: number | 'hidden' | null;
  onReconnect?(edgeId: string, target: string): void;
  destinationSummary?: string; onGoToDestinations?(): void;
}) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({});
  const [revision, setRevision] = useState(0);
  const [tidyRevision, setTidyRevision] = useState(0);
  const [preview, setPreview] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 600px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 600px)');
    const update = () => setNarrow(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<readonly string[]>([]);
  const [grouping, setGrouping] = useState(true);
  const [expandedFocus, setExpandedFocus] = useState<string | null>(null);
  const mapRoot = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const layoutState = useRef({ key: '', manuallyPositioned: false });
  const detectedGroups = useMemo(() => followupGroups(tree), [tree]);
  const groups = useMemo(() => grouping ? detectedGroups.filter(group => !expandedGroups.includes(group.id)) : [], [detectedGroups, expandedGroups, grouping]);
  const groupedScreens = useMemo(() => new Map(groups.flatMap(group => group.screens.map(index => [tree.steps[index].id, group.id] as const))), [groups, tree.steps]);
  const visibleId = useCallback((id: string) => groupedScreens.get(id) ?? id, [groupedScreens]);
  const ordinals = useMemo(() => graphDisplayOrder(tree), [tree]);
  const view = useMemo(() => ordinals.flatMap<{ id: string; index: number; group?: FollowupGroup; width: number }>(index => {
    const screen = tree.steps[index];
    const group = groups.find(item => item.screens.includes(index));
    return group ? group.screens[0] === index ? [{ id: group.id, index, group, width: 320 }] : []
      : [{ id: screen.id, index, group: undefined, width: groups.length && screen.kind === 'acknowledgement' ? 176 : 252 }];
  }), [tree.steps, groups, ordinals]);
  const groupKey = groups.map(group => `${group.id}:${group.screens.join(',')}`).join('|');
  const expand = useCallback((group: FollowupGroup) => {
    const id = tree.steps[group.screens[0]].id;
    pendingFocus.current = id; setExpandedFocus(id);
    setExpandedGroups(current => [...current, group.id]);
  }, [tree.steps]);
  const focusExpandedScreen = useCallback(() => {
    if (!pendingFocus.current) return;
    const card = mapRoot.current?.querySelector<HTMLElement>(`[data-id="${pendingFocus.current}"] .wconvert-flow-node__main`);
    if (card && getComputedStyle(card).visibility !== 'hidden') {
      card.focus({ preventScroll: true });
      if (document.activeElement === card) pendingFocus.current = null;
    }
  }, []);
  const rtl = document.documentElement.dir === 'rtl';
  const cameraIndex = selected ?? (expandedFocus && tree.steps.some(screen => screen.id === expandedFocus) ? tree.steps.findIndex(screen => screen.id === expandedFocus) : tree.graph ? Math.max(0, tree.steps.findIndex(screen => screen.id === tree.graph?.entry)) : 0);
  const layoutKey = tree.graph ? `${tree.graph.entry}|${tree.steps.map(screen => `${screen.id}:${!!screen.when}`).join('|')}|${tree.graph.edges.map(edge => `${edge.id}:${edge.from}:${edge.to}:${edge.kind}`).join('|')}`
    : tree.steps.map(step => `${step.id}:${step.when ? 'conditional' : 'always'}:${step.paths?.map(path => path.to).join(',') ?? ''}`).join('|');
  const layoutRequest = `${layoutKey}|${groupKey}|${rtl}|${tidyRevision}|${preview}`;
  useEffect(() => {
    if (layoutState.current.key !== layoutRequest) layoutState.current = { key: layoutRequest, manuallyPositioned: false };
    else if (layoutState.current.manuallyPositioned) return;
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: rtl ? 'RL' : 'LR', ranksep: groups.length ? 56 : 92, nodesep: 46 });
    graph.setDefaultEdgeLabel(() => ({}));
    view.forEach(({ id, index, group, width }) => {
      const step = tree.steps[index];
      graph.setNode(id, { width: measurements[id]?.width ?? width, height: measurements[id]?.height ?? (group ? 100 + Math.min(group.screens.length * 52, 240) :
        166 + (preview ? 75 : 0) + (walkNodes(step.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit') ? 74 : 0)
        + (step.when ? 32 : 0) + Math.max(0, routesFor(tree, index).length - 1) * 45
        + (hiddenFor(tree, index) && !routesFor(tree, index).some(path => path.to === hiddenFor(tree, index)) ? 30 : 0)
        - (routesFor(tree, index).length === 0 ? 28 : 0)) });
    });
    tree.steps.forEach((step, index) => {
      const from = visibleId(step.id);
      const targets = [...routesFor(tree, index).map(path => path.to), hiddenFor(tree, index)].filter((id): id is string => !!id);
      targets.forEach(target => { const to = visibleId(target); if (from !== to) graph.setEdge(from, to); });
    });
    dagre.layout(graph);
    setPositions(Object.fromEntries(view.map(({ id }) => {
      const node = graph.node(id);
      return [id, { x: node.x - node.width / 2, y: node.y - node.height / 2 }];
    })));
    setRevision(value => value + 1);
  // Measured text wrapping determines spacing. Once a merchant moves a card,
  // measurements must not reset that arrangement; Tidy up explicitly opts in.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutRequest, measurements]);
  const focusTarget = focusedPath === null || selected === null ? null
    : tree.steps.findIndex(item => item.id === (focusedPath === 'hidden' ? hiddenFor(tree, selected) : routesFor(tree, selected)[focusedPath]?.to));
  const cardData = useMemo(() => tree.steps.map((_, index) => ({ tree, index, ordinal: ordinals.indexOf(index) + 1, rtl,
      muted: samplePath !== null ? !samplePath.includes(index) : focusTarget !== null && index !== selected && index !== focusTarget,
      preview, compactEnding: groups.length > 0, destinationSummary, goToDestinations: onGoToDestinations, select: onSelect, selectPath: onSelectPath })),
    [tree, ordinals, selected, onSelect, onSelectPath, rtl, samplePath, focusTarget, preview, groups.length, destinationSummary, onGoToDestinations]);
  const groupData = useMemo(() => new Map(groups.map(group => [group.id, { tree, group, rtl, selected: samplePath === null ? selected : null, samplePath, select: onSelect, expand }])),
    [groups, tree, rtl, selected, samplePath, onSelect, expand]);
  const nodes = useMemo<Node[]>(() => view.map(({ id, index, group }) => ({ id, type: group ? 'followups' : 'screen',
    position: positions[id] ?? { x: index * 340, y: 60 }, measured: measurements[id],
    selected: !group && index === selected && samplePath === null, data: group ? groupData.get(id)! : cardData[index] })), [view, positions, measurements, selected, samplePath, groupData, cardData]);
  const rawEdges = useMemo<Edge[]>(() => tree.steps.flatMap((step, index) => {
    const paths = routesFor(tree, index);
    const routes: Edge[] = paths
      .map((path, priority) => ({ id: 'id' in path && typeof path.id === 'string' ? path.id : `${step.id}-${priority}`, source: step.id, target: path.to, data: { sourceIndex: index, priority },
        sourceHandle: `route-${priority}`, targetHandle: 'in', type: 'smoothstep', reconnectable: tree.graph ? 'target' : false,
        label: paths.length > 1 || path.when ? ('kind' in path ? path.kind === 'default' : !path.when) ? __('Else', 'wconvert') : String(priority + 1) : undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#719987', width: 15, height: 15 },
        style: { stroke: '#719987', strokeWidth: 2, opacity: samplePath !== null ? 1 : focusedPath !== null && (index !== selected || priority !== focusedPath && !(focusedPath === 'hidden' && path.to === hiddenFor(tree, index))) ? .2 : 1 } }));
    const hidden = hiddenFor(tree, index);
    if (hidden && !paths.some(path => path.to === hidden)) routes.push({
      id: tree.graph?.edges.find(edge => edge.from === step.id && edge.kind === 'hidden')?.id ?? `${step.id}-hidden`,
      source: step.id, target: hidden, data: { sourceIndex: index, priority: 'hidden' }, sourceHandle: 'hidden', targetHandle: 'in', type: 'smoothstep', reconnectable: 'target',
      label: __('Hidden', 'wconvert'), markerEnd: { type: MarkerType.ArrowClosed, color: '#9aa8a0', width: 15, height: 15 },
      style: { stroke: '#9aa8a0', strokeWidth: 1.5, strokeDasharray: '5 4', opacity: samplePath !== null ? 1 : focusedPath !== null && (index !== selected || focusedPath !== 'hidden') ? .2 : 1 },
    });
    return routes;
  }), [tree, focusedPath, samplePath, selected]);
  const edges = useMemo(() => rawEdges.flatMap(edge => {
    const source = visibleId(edge.source), target = visibleId(edge.target);
    if (source === target) return [];
    return [{ ...edge, source, target,
      ariaLabel: sprintf(edge.data?.priority === 'hidden' ? __('When hidden: %1$s to %2$s', 'wconvert') : __('%1$s to %2$s', 'wconvert'), tree.steps.find(step => step.id === edge.source)?.name ?? edge.source, tree.steps.find(step => step.id === edge.target)?.name ?? edge.target),
      sourceHandle: source !== edge.source ? 'out' : edge.sourceHandle,
      targetHandle: target !== edge.target ? 'in' : edge.targetHandle,
      reconnectable: source !== edge.source || target !== edge.target ? false : edge.reconnectable }];
  }), [rawEdges, visibleId, tree.steps]);
  const valid = (connection: Connection | Edge) => {
    const from = tree.steps.findIndex(step => step.id === connection.source);
    const to = tree.steps.findIndex(step => step.id === connection.target);
    if (tree.graph) return connection.sourceHandle === 'new'
      ? canAddGraphConnection(tree, connection.source, connection.target)
      : canTargetGraphScreen(tree, connection.source, connection.target);
    if (from < 0 || to <= from || tree.steps[from].paths?.some(path => path.to === connection.target)) return false;
    const boundary = tree.steps.findIndex((step, index) => index > from && (['result', 'acknowledgement'].includes(step.kind)
      || walkNodes(step.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit')));
    return boundary < 0 || to <= boundary;
  };
  return <div ref={mapRoot} className="wconvert-journey-map" aria-label={__('Journey map', 'wconvert')}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      nodesFocusable={false} edgesFocusable={false}
      ariaLabelConfig={{ 'node.a11yDescription.default': __('Use Tab to reach screen and path buttons. Press Enter to edit. Connections can also be edited in Next screen settings.', 'wconvert') }}
      minZoom={0.25} maxZoom={1.5} deleteKeyCode={null} panOnScroll={!narrow} preventScrolling={!narrow} zoomOnScroll={false} zoomOnPinch
      onNodeClick={(event, node) => { if (node.type === 'screen' && !(event.target instanceof Element && event.target.closest('button'))) onSelect(tree.steps.findIndex(step => step.id === node.id)); }}
      onEdgeClick={(_, edge) => { const data = edge.data as { sourceIndex?: number; priority?: number | 'hidden' } | undefined; if (data?.sourceIndex !== undefined) onSelectPath(data.sourceIndex, data.priority ?? 0); }}
      isValidConnection={valid} onConnect={connection => { if (connection.source && connection.target && valid(connection)) onConnect(connection.source, connection.target); }}
      onReconnect={(edge, connection) => {
        if (tree.graph && connection.source === edge.source && valid(connection)) onReconnect?.(edge.id, connection.target);
      }}
      onNodesChange={changes => {
        // Retaining measured dimensions prevents every edge from disappearing
        // briefly when a controlled node moves.
        const sizes = changes.filter((change): change is Extract<typeof change, { type: 'dimensions' }> => change.type === 'dimensions' && !!change.dimensions);
        if (sizes.length) setMeasurements(old => {
          const changed = sizes.filter(change => old[change.id]?.width !== change.dimensions!.width || old[change.id]?.height !== change.dimensions!.height);
          return changed.length ? { ...old, ...Object.fromEntries(changed.map(change => [change.id, change.dimensions!])) } : old;
        });
        const moved = changes.filter((change): change is Extract<typeof change, { type: 'position' }> => change.type === 'position' && !!change.position);
        if (moved.length) {
          layoutState.current.manuallyPositioned = true;
          setPositions(old => ({ ...old, ...Object.fromEntries(moved.map(change => [change.id, change.position!])) }));
        }
      }}>
      <Background gap={24} size={1} color="#dce5dd" />
      <FocusCamera mapRoot={mapRoot} selectedId={visibleId(tree.steps[cameraIndex]?.id ?? tree.steps[0].id)} nextId={routesFor(tree, cameraIndex)[0]?.to ? visibleId(routesFor(tree, cameraIndex)[0].to) : undefined}
        firstId={visibleId(tree.graph?.entry ?? tree.steps[0].id)}
        initialOverview={selected === null && view.length <= (groups.length ? 4 : 3)} overviewWidth={groups.length && view.length > 3 ? 900 : 600}
        grouping={detectedGroups.length ? { active: groups.length > 0, toggle: () => { setGrouping(groups.length === 0); setExpandedGroups([]); } } : undefined}
        revision={revision} toolbar={toolbar} onNodesReady={focusExpandedScreen} preview={preview} onPreview={() => setPreview(value => !value)} onTidy={() => setTidyRevision(value => value + 1)} />
    </ReactFlow>
    <p className="wconvert-journey-map__hint">{groups.length ? __('Every matching follow-up is shown. Expand screens to edit their connections.', 'wconvert') : tree.graph
      ? __('Drag from “+” to add an answer path, or move a line’s arrow to change its destination. Next screen settings offer the same controls. Moving a box changes only the layout.', 'wconvert')
      : rtl ? __('Follow arrows from right to left. Scroll to move through the map; select a screen to edit or draw a forward path.', 'wconvert')
        : __('Follow arrows from left to right. Scroll to move through the map; select a screen to edit or draw a forward path.', 'wconvert')}</p>
    <div ref={setToolbar} className="wconvert-journey-map__toolbar" />
  </div>;
}
