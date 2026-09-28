import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Background, Handle, MarkerType, Panel, Position, ReactFlow, useReactFlow, useStore, useNodesInitialized, useUpdateNodeInternals, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { branchRegions, layoutMap } from './structure/mapLayout';
import { ArrowRight, Check, CircleHelp, FileText, Flag, Send, Eye, Focus, Layers, Maximize2, Minus, Plus, Settings2 } from 'lucide-react';
import { SmartEdgeProvider } from '@tisoap/react-flow-smart-edge';
import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { unreachableScreenIds, walkNodes } from './structure/journey';
import { conditionText } from './structure/conditionText';
import { graphDisplayOrder } from './structure/graph';
import { canAddGraphConnection, canTargetGraphScreen, graphChoiceSources } from './structure/graphConnections';
import { FollowupGroupCard } from './FollowupGroupCard';
import { followupGroups, type FollowupGroup } from './structure/followupGroups';
import { JourneyMapEdge } from './JourneyMapEdge';
import { mapRoutingOptions } from './structure/mapRouting';
import { cameraTargets, mapMinZoom } from './structure/mapCamera';
import { relatedMapElements } from './structure/mapSelection';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem } from '../components/ui/dropdown-menu';
import '@xyflow/react/dist/style.css';

interface CardData { incomingPorts: string[]; detourTarget?: string; detourEntry: boolean; editingConnections: boolean; groupedTargets: ReadonlyMap<string, string>; tree: TemplateTree; index: number; rtl: boolean; unreachable: boolean; muted: boolean; preview: boolean; compactEnding: boolean; destinationSummary?: string; select(index: number): void; selectPath(index: number, priority: number | 'hidden'): void; goToDestinations?(): void; previewScreen?(index: number): void; add?(index: number, edgeId?: string): void }

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

const ScreenCard = memo(function ScreenCard({ id, data, selected }: NodeProps) {
  const { incomingPorts, detourTarget, detourEntry, editingConnections, tree, index, rtl, groupedTargets, unreachable, muted, preview, compactEnding, destinationSummary, select, selectPath, goToDestinations, previewScreen } = data as unknown as CardData;
  const overview = useStore(state => state.transform[2] < .65);
  const screen = tree.steps[index];
  const content = walkNodes(screen.content);
  const question = content.find(node => node.type === 'question');
  const savesDetails = content.some(node => node.type === 'button' && 'action' in node && node.action === 'submit');
  const submit = content.find(node => node.type === 'button' && 'action' in node && node.action === 'submit');
  const capture = submit && 'submission' in submit ? tree.submissions.find(item => item.id === submit.submission) : undefined;
  const heading = content.find(node => node.type === 'heading');
  const incoming = tree.graph ? new Set(tree.graph.edges.filter(edge => edge.to === screen.id).map(edge => edge.from)).size
    : tree.steps.slice(0, index).filter((item, at) => (item.paths ?? (tree.steps[at + 1] ? [{ to: tree.steps[at + 1].id }] : []))
      .some(path => path.to === screen.id)).length;
  const paths = routesFor(tree, index);
  const updateInternals = useUpdateNodeInternals();
  const handles = `${detourTarget ?? ''}:${detourEntry}:${editingConnections}:${incomingPorts.join(',')}:${paths.map(path => path.to).join(',')}`;
  useEffect(() => { updateInternals(id); }, [id, handles, updateInternals]);
  const targetName = (target: string) => groupedTargets.has(target) ? __('Relevant follow-ups', 'wconvert') : tree.steps.find(item => item.id === target)?.name ?? __('Next screen', 'wconvert');
  const branching = paths.some(path => 'kind' in path ? path.kind === 'answer' : !!path.when);
  const missingContinuation = !!tree.graph && !paths.some(path => 'kind' in path && path.kind === 'default');
  const canDraw = tree.graph ? screen.kind !== 'acknowledgement' && (missingContinuation
    ? screen.kind !== 'result' || branching : graphChoiceSources(tree, screen.id).length > 0)
    : paths.length > 0;
  const hiddenId = hiddenFor(tree, index);
  const hiddenTarget = hiddenId && !paths.some(path => path.to === hiddenId) ? tree.steps.find(item => item.id === hiddenId) : undefined;
  const kind = screen.kind === 'acknowledgement' ? __('Ending', 'wconvert') : screen.kind === 'result' ? __('Result', 'wconvert')
    : question ? __('Question', 'wconvert') : savesDetails ? __('Collect details', 'wconvert') : __('Message', 'wconvert');
  const KindIcon = screen.kind === 'acknowledgement' ? Check : screen.kind === 'result' ? Flag : question ? CircleHelp : savesDetails ? Send : FileText;
  return <div dir={rtl ? 'rtl' : 'ltr'} className={`wconvert-flow-node${selected ? ' is-selected' : ''}${unreachable ? ' is-unreachable' : ''}${muted ? ' is-muted' : ''}${compactEnding && screen.kind === 'acknowledgement' ? ' is-compact-ending' : ''}${overview && !selected ? ' is-overview' : ''}`}>
    {overview && !selected && <button type="button" className="wconvert-flow-node__overview" aria-label={sprintf(__('Open %s', 'wconvert'), screen.name)} onClick={() => select(index)}>
      <small>{kind}{screen.id === (tree.graph?.entry ?? tree.steps[0].id) ? ` · ${__('First screen', 'wconvert')}` : ''}{incoming > 1 ? ` · ${__('Paths rejoin', 'wconvert')}` : ''}</small><strong><bdi>{screen.name}</bdi></strong>
      {screen.when && <span>{sprintf(__('Show if %s', 'wconvert'), conditionText(tree, screen.when))}</span>}
      {branching && <span>{sprintf(__('%d answer paths · first match wins', 'wconvert'), paths.length - 1)}</span>}
      {savesDetails && <span>{__('Details saved here', 'wconvert')}</span>}
      {screen.kind === 'result' && <span>{sprintf(__('%d possible results', 'wconvert'), screen.results?.length ?? 0)}</span>}
      {screen.kind === 'acknowledgement' && <span>{__('Journey complete', 'wconvert')}</span>}
    </button>}
    {previewScreen && <button type="button" className="wconvert-flow-node__preview-button nodrag" aria-label={sprintf(__('Preview %s', 'wconvert'), screen.name)} onClick={() => previewScreen(index)}><Eye aria-hidden="true" /></button>}
    {(incomingPorts.length < 2 || editingConnections) && <Handle id="in" type="target" position={rtl ? Position.Right : Position.Left} />}
    {incomingPorts.length > 1 && incomingPorts.map((edge, at) => <Handle key={edge} id={`in:${edge}`} type="target" position={rtl ? Position.Right : Position.Left} isConnectable={false}
      style={{ top: `calc(50% + ${(at - (incomingPorts.length - 1) / 2) * Math.min(18, 80 / incomingPorts.length)}px)` }} />)}
    {detourEntry && <Handle id="detour-in" type="target" position={Position.Top} isConnectable={false} />}
    {detourTarget && <Handle id="detour-out" type="source" position={Position.Bottom} isConnectable={false} />}
    <button type="button" className="wconvert-flow-node__main" onClick={() => select(index)}>
      <div className="wconvert-flow-node__heading"><span className="wconvert-flow-node__type-icon" aria-hidden="true"><KindIcon /></span><div><small>{kind}{screen.id === (tree.graph?.entry ?? tree.steps[0].id) ? ` · ${__('First screen', 'wconvert')}` : incoming > 1 ? ` · ${__('Paths rejoin', 'wconvert')}` : ''}</small><strong><bdi>{screen.name}</bdi></strong></div></div>
      {question && 'label' in question ? <span><bdi>{String(question.label)}</bdi></span> : heading && 'text' in heading && heading.text !== screen.name ? <span><bdi>{String(heading.text)}</bdi></span> : null}
      {screen.when && <em>{sprintf(__('Show if %s', 'wconvert'), conditionText(tree, screen.when))}</em>}
      {unreachable && <em>{__('Unreachable — connect an incoming path', 'wconvert')}</em>}
      {screen.kind === 'result' && <span>{sprintf(__('%d possible results · first match wins', 'wconvert'), screen.results?.length ?? 0)}</span>}
    </button>
    {screen.kind === 'result' && <details className="wconvert-flow-node__results nodrag"><summary>{__('Possible results', 'wconvert')}</summary><ol>{screen.results?.map((result, at) => <li key={result.id}><strong>{result.heading}</strong><small>{result.when ? sprintf(__('Priority %d', 'wconvert'), at + 1) : __('Everyone else', 'wconvert')}</small></li>)}</ol></details>}
    {preview && <div className="wconvert-flow-node__preview" aria-hidden="true"><small>{__('Screen preview', 'wconvert')}</small><strong><bdi>{heading && 'text' in heading ? String(heading.text) : screen.name}</bdi></strong>
      {question && 'options' in question && <span>{question.options?.slice(0, 2).map(option => option.label).join(' · ')}</span>}
    </div>}
    {savesDetails && <div className="wconvert-flow-node__save">
      <strong>{capture?.required === false ? __('Optional signup', 'wconvert') : __('Details saved here', 'wconvert')}</strong>
      {capture?.required === false && <span>{__('Submit to save these details, or skip and continue.', 'wconvert')}</span>}
      {destinationSummary && <span>{destinationSummary}</span>}
      {goToDestinations && <button type="button" className="nodrag" onClick={goToDestinations}>{__('Edit destinations', 'wconvert')}</button>}
    </div>}
    {branching && <div className="wconvert-flow-node__paths">
      <small>{paths.length > 2 ? __('First matching path wins', 'wconvert') : detourTarget ? __('Conditional follow-up', 'wconvert') : __('Choose one path', 'wconvert')}</small>
      {paths.map((path, priority) => <div key={'id' in path && typeof path.id === 'string' ? path.id : `${path.to}-${priority}`} className="wconvert-flow-node__path">
        <button type="button" className="nodrag" onClick={() => selectPath(index, priority)}>
          {('kind' in path ? path.kind === 'default' : !path.when) ? __('Everyone else', 'wconvert') : `${paths.length > 2 ? `${priority + 1}. ` : ''}${path.when ? conditionText(tree, path.when) : ''}`}
          <span> {rtl ? '←' : '→'} <bdi>{targetName(path.to)}</bdi></span>
        </button>
        {(groupedTargets.get(path.to) ?? path.to) !== detourTarget && <Handle id={`route-${priority}`} type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />}
      </div>)}
    </div>}
    {!branching && paths.length === 1 && <div className="wconvert-flow-node__continue">
      <button type="button" className="nodrag" onClick={() => selectPath(index, 0)}>
        {sprintf(!groupedTargets.has(paths[0].to) && tree.steps.find(item => item.id === paths[0].to)?.when ? __('Check next: %s', 'wconvert') : __('Then: %s', 'wconvert'), targetName(paths[0].to))}
      </button>
      {(groupedTargets.get(paths[0].to) ?? paths[0].to) !== detourTarget && <Handle id="route-0" type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />}
    </div>}
    {screen.when && hiddenId && <div className="wconvert-flow-node__hidden">
      {tree.graph ? <button type="button" className="nodrag" onClick={() => selectPath(index, 'hidden')}>{sprintf(__('When hidden %1$s %2$s', 'wconvert'), rtl ? '←' : '→', tree.steps.find(item => item.id === hiddenId)?.name ?? hiddenId)}</button>
        : sprintf(__('When hidden %1$s %2$s', 'wconvert'), rtl ? '←' : '→', tree.steps.find(item => item.id === hiddenId)?.name ?? hiddenId)}
      {hiddenTarget &&
      <Handle id="hidden" type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />
      }
    </div>}
    {screen.kind === 'acknowledgement' && <div className="wconvert-flow-node__ending"><Check aria-hidden="true" />{__('Journey complete', 'wconvert')}</div>}
    {canDraw && editingConnections && <Handle id="new" type="source" position={Position.Bottom} className="wconvert-flow-node__new-connection"
      title={missingContinuation ? __('Drag to connect the next screen', 'wconvert') : __('Drag to add an answer path', 'wconvert')}
      style={detourTarget ? { left: '25%' } : undefined} isConnectable={selected}><span aria-hidden="true">+</span></Handle>}

  </div>;
});
const nodeTypes = { screen: ScreenCard, followups: FollowupGroupCard };
const edgeTypes = { journey: JourneyMapEdge };

export function FocusCamera({ mapRoot, selectedId, nextId, contextIds, firstId, initialOverview, overviewWidth = 600, revision, onTidy, preview, onPreview, grouping, selection, onNodesReady, editingConnections, onEditConnections }: {
  editingConnections?: boolean; onEditConnections?(): void; mapRoot: RefObject<HTMLDivElement | null>; selectedId: string; nextId?: string; contextIds?: readonly string[]; firstId: string; initialOverview: boolean; overviewWidth?: number; revision: number; onTidy(): void; preview: boolean; onPreview(): void; grouping?: { active: boolean; toggle(): void }; selection?: { highlighted: boolean; toggle(): void }; onNodesReady(): void;
}) {
  const { fitView, zoomIn, zoomOut, viewportInitialized, getViewport, setViewport, getNodes } = useReactFlow();
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
        const tools = root.querySelector('.wconvert-journey-map__controls')?.getBoundingClientRect();
        const bottom = tools?.height ? Math.min(bounds.bottom - 12, tools.top - 12) : bounds.bottom - 12;
        const dx = rect.left < bounds.left + 12 ? bounds.left + 12 - rect.left
          : rect.right > bounds.right - 12 ? bounds.right - 12 - rect.right : 0;
        const dy = rect.top < bounds.top + 12 ? bounds.top + 12 - rect.top
          : rect.bottom > bottom ? bottom - rect.bottom : 0;
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
  const viewPadding = useCallback(() => {
    const tools = mapRoot.current?.querySelector('.wconvert-journey-map__controls')?.getBoundingClientRect();
    const canvas = mapRoot.current?.querySelector('.react-flow')?.getBoundingClientRect();
    return { top: '24px' as const, left: '24px' as const, right: '56px' as const, bottom: `${Math.ceil(tools && canvas ? canvas.bottom - tools.top + 12 : 84)}px` as const };
  }, [mapRoot]);
  useEffect(() => {
    if (!nodesReady) return;
    const frame = requestAnimationFrame(onNodesReady);
    return () => cancelAnimationFrame(frame);
  }, [nodesReady, onNodesReady, revision]);
  useEffect(() => {
    if (!viewportInitialized || revision === 0) return;
    const overview = width >= overviewWidth && initialOverview;
    const frame = requestAnimationFrame(() => void fitView({
      ...(overview ? {} : { nodes: cameraTargets(getNodes(), selectedId, nextId, width, height, contextIds) }),
      padding: viewPadding(), maxZoom: 1, duration: 180 }));
    return () => cancelAnimationFrame(frame);
  }, [fitView, getNodes, nextId, contextIds, initialOverview, revision, selectedId, viewportInitialized, width, height, overviewWidth, viewPadding]);
  const focusSelection = () => void fitView({ nodes: [{ id: selectedId }], padding: viewPadding(), maxZoom: 1, duration: 180 });
  const goToStart = () => void fitView({ nodes: [{ id: firstId }], padding: viewPadding(), maxZoom: 1, duration: 180 });
  const fitJourney = () => void fitView({ padding: viewPadding(), maxZoom: 1, duration: 180 });
  const pan = (direction: number) => {
    const viewport = getViewport();
    const rtl = document.documentElement.dir === 'rtl';
    void setViewport({ ...viewport, x: viewport.x + direction * (rtl ? -1 : 1) * width * .65 }, { duration: 180 });
  };
  return <>
    <Panel position="top-right" className="wconvert-journey-map__zoom wconvert-journey-map__control-group">
      <button type="button" aria-label={__('Zoom in', 'wconvert')} title={__('Zoom in', 'wconvert')} onClick={() => void zoomIn()}><Plus aria-hidden="true" /></button>
      <button type="button" aria-label={__('Zoom out', 'wconvert')} title={__('Zoom out', 'wconvert')} onClick={() => void zoomOut()}><Minus aria-hidden="true" /></button>
      <button type="button" disabled={!selection} aria-label={__('Show selected screen', 'wconvert')} title={__('Show selected screen', 'wconvert')} onClick={focusSelection}><Focus aria-hidden="true" /></button>
    </Panel>
    <Panel position="bottom-left" className="wconvert-journey-map__controls">
      <div className="wconvert-journey-map__tools wconvert-journey-map__control-group" role="group" aria-label={__('Map view', 'wconvert')}>
        {onEditConnections && <button type="button" aria-pressed={editingConnections} onClick={onEditConnections}>{editingConnections ? __('Done connecting', 'wconvert') : __('Edit connections', 'wconvert')}</button>}
        {grouping && <button type="button" className="wconvert-journey-map__desktop-tool" onClick={grouping.toggle}><Layers aria-hidden="true" />{grouping.active ? __('Expand follow-ups', 'wconvert') : __('Group follow-ups', 'wconvert')}</button>}
        <button type="button" className="wconvert-journey-map__desktop-tool" onClick={goToStart}><ArrowRight className="wconvert-journey-map__direction" aria-hidden="true" />{__('Start', 'wconvert')}</button>

        <button type="button" className="wconvert-journey-map__desktop-tool" onClick={onTidy}><Maximize2 aria-hidden="true" />{__('Tidy up', 'wconvert')}</button>
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="wconvert-journey-map__view-options"><Settings2 aria-hidden="true" />{__('View options', 'wconvert')}</button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={goToStart}>{__('Go to first screen', 'wconvert')}</DropdownMenuItem>
            {selection && <DropdownMenuCheckboxItem checked={selection.highlighted} onCheckedChange={selection.toggle}>{__('Highlight related paths', 'wconvert')}</DropdownMenuCheckboxItem>}
            <DropdownMenuCheckboxItem checked={preview} onCheckedChange={onPreview}>{__('Screen previews', 'wconvert')}</DropdownMenuCheckboxItem>
            {grouping && <DropdownMenuItem onSelect={grouping.toggle}>{grouping.active ? __('Expand follow-ups', 'wconvert') : __('Group follow-ups', 'wconvert')}</DropdownMenuItem>}
            <DropdownMenuItem onSelect={onTidy}>{__('Tidy up', 'wconvert')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => pan(1)}>{__('Pan to earlier screens', 'wconvert')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => pan(-1)}>{__('Pan to later screens', 'wconvert')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" onClick={fitJourney}><Focus aria-hidden="true" />{__('Fit journey', 'wconvert')}</button>
      </div>
    </Panel>

  </>;

}

/** The canvas is an overview; the same routes are editable through selects in the inspector. */
export function JourneyMap({ tree, selected, focusedPath = null, onSelect, onSelectPath, onConnect, onReconnect, samplePath = null, sampleEdges = null, destinationSummary, onGoToDestinations, onPreview, onAdd }: {
  tree: TemplateTree; selected: number | null; onSelect(index: number): void; onSelectPath(index: number, priority: number | 'hidden'): void;
  onConnect(source: string, target: string): void; samplePath?: readonly number[] | null; sampleEdges?: readonly string[] | null; focusedPath?: number | 'hidden' | null;
  onReconnect?(edgeId: string, target: string): void;
  destinationSummary?: string; onGoToDestinations?(): void; onPreview?(index: number): void; onAdd?(index: number, edgeId?: string): void;
}) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({});
  const [revision, setRevision] = useState(0);
  const [tidyRevision, setTidyRevision] = useState(0);
  const [preview, setPreview] = useState(false);
  const [editingConnections, setEditingConnections] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 600px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 600px)');
    const update = () => setNarrow(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const [highlightRelated, setHighlightRelated] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<readonly string[]>([]);
  const [grouping, setGrouping] = useState(true);
  const [cameraFocus, setCameraFocus] = useState<string | null>(null);
  useEffect(() => {
    if (selected !== null && tree.steps[selected]) setCameraFocus(tree.steps[selected].id);
  }, [selected, tree.steps]);
  const mapRoot = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const layoutState = useRef({ key: '', manuallyPositioned: false });
  const disconnected = useMemo(() => new Set(unreachableScreenIds(tree)), [tree]);
  const detectedGroups = useMemo(() => followupGroups(tree), [tree]);
  useEffect(() => {
    if (selected === null || focusedPath === null) return;
    const group = detectedGroups.find(item => item.screens.includes(selected));
    if (group) setExpandedGroups(current => current.includes(group.id) ? current : [...current, group.id]);
  }, [selected, focusedPath, detectedGroups]);
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
  const topology = useMemo(() => tree.steps.flatMap((step, index) =>
    [...routesFor(tree, index).map(path => path.to), hiddenFor(tree, index)].filter((id): id is string => !!id)
      .map(target => ({ source: visibleId(step.id), target: visibleId(target) }))).filter(edge => edge.source !== edge.target), [tree, visibleId]);
  const regions = useMemo(() => branchRegions(view.map(item => item.id), topology,
    new Set(tree.steps.filter((_, index) => routesFor(tree, index).some(path => !!path.when)).map(step => visibleId(step.id)))), [view, topology, tree, visibleId]);
  const detours = useMemo(() => new Map(regions.filter(region => region.detour).flatMap(region => {
    const chain = [region.source, ...region.arms.flat()];
    return chain.slice(0, -1).map((id, index) => [id, chain[index + 1]] as const);
  })), [regions]);
  const groupKey = groups.map(group => `${group.id}:${group.screens.join(',')}`).join('|');
  const expand = useCallback((group: FollowupGroup) => {
    const id = tree.steps[group.screens[0]].id;
    pendingFocus.current = id; setCameraFocus(id);
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
  const cameraIndex = selected ?? (cameraFocus && tree.steps.some(screen => screen.id === cameraFocus) ? tree.steps.findIndex(screen => screen.id === cameraFocus) : tree.graph ? Math.max(0, tree.steps.findIndex(screen => screen.id === tree.graph?.entry)) : 0);
  const cameraContext = useMemo(() => {
    const id = visibleId(tree.steps[cameraIndex]?.id);
    const region = regions.find(item => item.detour && (item.source === id || item.arms.flat().includes(id)));
    return region ? [region.source, ...region.arms.flat(), region.join] : [];
  }, [cameraIndex, regions, tree.steps, visibleId]);
  const layoutKey = tree.graph ? `${tree.graph.entry}|${tree.steps.map(screen => `${screen.id}:${!!screen.when}`).join('|')}|${tree.graph.edges.map(edge => `${edge.id}:${edge.from}:${edge.to}:${edge.kind}`).join('|')}`
    : tree.steps.map(step => `${step.id}:${step.when ? 'conditional' : 'always'}:${step.paths?.map(path => path.to).join(',') ?? ''}`).join('|');
  const layoutRequest = `${layoutKey}|${groupKey}|${rtl}|${tidyRevision}|${preview}`;
  useEffect(() => {
    if (layoutState.current.key !== layoutRequest) layoutState.current = { key: layoutRequest, manuallyPositioned: false };
    else if (layoutState.current.manuallyPositioned) return;
    const boxes = view.map(({ id, index, group, width }) => {
      const step = tree.steps[index];
      return { id, width: measurements[id]?.width ?? width, height: measurements[id]?.height ?? (group ? 100 + Math.min(group.screens.length * 52, 240) :
        166 + (preview ? 75 : 0) + (walkNodes(step.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit') ? 74 : 0)
        + (step.when ? 32 : 0) + Math.max(0, routesFor(tree, index).length - 1) * 45
        + (hiddenFor(tree, index) && !routesFor(tree, index).some(path => path.to === hiddenFor(tree, index)) ? 30 : 0)
        - (routesFor(tree, index).length === 0 ? 28 : 0)) };
    });
    setPositions(layoutMap(boxes, topology, regions, rtl));
    setRevision(value => value + 1);
  // Measured text wrapping determines spacing. Once a merchant moves a card,
  // measurements must not reset that arrangement; Tidy up explicitly opts in.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutRequest, measurements]);
  const rawEdges = useMemo<Edge[]>(() => tree.steps.flatMap((step, index) => {
    const paths = routesFor(tree, index);
    const routes: Edge[] = paths
      .map((path, priority) => ({ id: 'id' in path && typeof path.id === 'string' ? path.id : `${step.id}-${priority}`, source: step.id, target: path.to, data: { sourceIndex: index, priority },
        sourceHandle: `route-${priority}`, targetHandle: 'in', type: 'journey', reconnectable: tree.graph ? 'target' : false,
        label: paths.length > 1 || path.when ? ('kind' in path ? path.kind === 'default' : !path.when) ? __('Everyone else', 'wconvert') : `${paths.length > 2 ? `${priority + 1}. ` : ''}${path.when ? conditionText(tree, path.when) : ''}` : undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#719987', width: 15, height: 15 },
        style: { stroke: '#719987', strokeWidth: 2 } }));
    const hidden = hiddenFor(tree, index);
    if (hidden && !paths.some(path => path.to === hidden)) routes.push({
      id: tree.graph?.edges.find(edge => edge.from === step.id && edge.kind === 'hidden')?.id ?? `${step.id}-hidden`,
      source: step.id, target: hidden, data: { sourceIndex: index, priority: 'hidden' }, sourceHandle: 'hidden', targetHandle: 'in', type: 'journey', reconnectable: 'target',
      label: __('Hidden', 'wconvert'), markerEnd: { type: MarkerType.ArrowClosed, color: '#9aa8a0', width: 15, height: 15 },
      style: { stroke: '#9aa8a0', strokeWidth: 1.5, strokeDasharray: '5 4' },
    });
    return routes;
  }), [tree]);
  const incomingPorts = useMemo(() => {
    const ports = new Map<string, string[]>();
    const order = new Map(view.map((node, index) => [node.id, index]));
    [...rawEdges].sort((a,b) => (order.get(visibleId(a.source)) ?? 0) - (order.get(visibleId(b.source)) ?? 0)).forEach(edge => {
      const source = visibleId(edge.source), target = visibleId(edge.target);
      if (source !== target) ports.set(target, [...(ports.get(target) ?? []), edge.id]);
    });
    return ports;
  }, [rawEdges, view, visibleId]);
  const selectedId = selected === null ? undefined : tree.steps[selected]?.id;
  const selectedEdge = focusedPath === null ? undefined : rawEdges.find(edge => edge.source === selectedId &&
    (edge.data?.priority === focusedPath || focusedPath === 'hidden' && edge.target === hiddenFor(tree, selected!)));
  const related = useMemo(() => relatedMapElements(rawEdges, selectedId, selectedEdge?.id), [rawEdges, selectedId, selectedEdge?.id]);
  const highlighting = highlightRelated && selected !== null && samplePath === null;
  const cardData = useMemo(() => tree.steps.map((_, index) => ({ incomingPorts: incomingPorts.get(tree.steps[index].id) ?? [], detourTarget: detours.get(tree.steps[index].id), detourEntry: [...detours.values()].includes(tree.steps[index].id), editingConnections, tree, index, rtl, unreachable: disconnected.has(tree.steps[index].id),
      muted: samplePath !== null ? !samplePath.includes(index) : highlighting && !related.screens.has(tree.steps[index].id),
      groupedTargets: groupedScreens, previewScreen: onPreview, add: onAdd, preview, compactEnding: groups.length > 0, destinationSummary, goToDestinations: onGoToDestinations, select: onSelect, selectPath: onSelectPath })),
    [incomingPorts, detours, editingConnections, tree, disconnected, onSelect, onSelectPath, rtl, samplePath, highlighting, related, preview, groups.length, groupedScreens, destinationSummary, onGoToDestinations, onPreview, onAdd]);
  const groupData = useMemo(() => new Map(groups.map(group => [group.id, { incomingPorts: incomingPorts.get(group.id) ?? [], detourEntry: [...detours.values()].includes(group.id), detourTarget: detours.get(group.id), tree, group, rtl, unreachable: disconnected.has(tree.steps[group.screens[0]].id), selected: samplePath === null ? selected : null, muted: highlighting && !group.screens.some(index => related.screens.has(tree.steps[index].id)), samplePath, select: onSelect, expand }])),
    [incomingPorts, detours, groups, tree, disconnected, rtl, selected, samplePath, highlighting, related, onSelect, expand]);
  const nodes = useMemo<Node[]>(() => view.map(({ id, index, group }) => ({ id, type: group ? 'followups' : 'screen',
    position: positions[id] ?? { x: index * 340, y: 60 }, measured: measurements[id],
    selected: !group && index === selected && samplePath === null, data: group ? groupData.get(id)! : cardData[index] })), [view, positions, measurements, selected, samplePath, groupData, cardData]);
  const routingBoxes = useMemo(() => nodes.map(node => ({ id: node.id, ...node.position,
    width: node.measured?.width ?? (node.type === 'followups' ? 320 : 252), height: node.measured?.height ?? 240 })), [nodes]);
  const edges = useMemo(() => rawEdges.flatMap(edge => {
    const source = visibleId(edge.source), target = visibleId(edge.target);
    if (source === target) return [];
    const ports = incomingPorts.get(target) ?? [];
    return [{ ...edge, source, target, selected: edge.id === selectedEdge?.id,
      data: { ...edge.data, corridorOffset: (ports.indexOf(edge.id) - (ports.length - 1) / 2) * 24, boxes: routingBoxes, sourceName: tree.steps.find(step => step.id === edge.source)?.name, edit: () => onSelectPath(Number(edge.data?.sourceIndex), edge.data?.priority as number | 'hidden'), targetName: tree.steps.find(step => step.id === edge.target)?.name,
        insert: onAdd && tree.graph ? (edgeId: string) => onAdd(Number(edge.data?.sourceIndex), edgeId) : undefined },
      style: { ...edge.style, opacity: samplePath !== null && sampleEdges !== null ? sampleEdges.includes(edge.id) || tree.graph?.edges.some(hidden => hidden.kind === 'hidden' && hidden.from === edge.source && hidden.to === edge.target && sampleEdges.includes(hidden.id)) ? 1 : .15 : highlighting && !related.paths.has(edge.id) ? .2 : 1 },
      ariaLabel: sprintf(edge.data?.priority === 'hidden' ? __('When hidden: %1$s to %2$s', 'wconvert') : __('%1$s to %2$s', 'wconvert'), tree.steps.find(step => step.id === edge.source)?.name ?? edge.source, tree.steps.find(step => step.id === edge.target)?.name ?? edge.target),
      sourceHandle: detours.get(source) === target ? 'detour-out' : source !== edge.source ? 'out' : edge.sourceHandle,
      targetHandle: detours.get(source) === target ? 'detour-in' : ports.length > 1 ? `in:${edge.id}` : 'in',
      reconnectable: !editingConnections || source !== edge.source || target !== edge.target ? false : edge.reconnectable }];
  }), [incomingPorts, routingBoxes, detours, editingConnections, rawEdges, visibleId, tree.steps, tree.graph, highlighting, related, selectedEdge?.id, onAdd, onSelectPath, sampleEdges, samplePath]);
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
    <div className="wconvert-journey-node-tools" aria-label={__('Selected screen actions', 'wconvert')}>
      {selected !== null && samplePath === null ? <>
        <strong>{selectedEdge ? `${tree.steps[selected].name} → ${tree.steps.find(screen => screen.id === selectedEdge.target)?.name}` : tree.steps[selected].name}</strong>
        <button type="button" onClick={() => onSelect(selected)}>{__('Edit screen', 'wconvert')}</button>
        {onPreview && <button type="button" onClick={() => onPreview(selected)}>{__('Preview screen', 'wconvert')}</button>}
        {onAdd && tree.steps[selected].kind !== 'acknowledgement' && <button type="button" onClick={() => onAdd(selected, selectedEdge?.id)}>{selectedEdge ? __('Add screen on this path', 'wconvert') : __('Add screen', 'wconvert')}</button>}
      </> : <span>{__('Select a screen to edit or preview it.', 'wconvert')}</span>}
    </div>
    <SmartEdgeProvider nodes={nodes} options={mapRoutingOptions}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      nodesFocusable={false} edgesFocusable={false} nodesConnectable={editingConnections} edgesReconnectable={editingConnections}
      ariaLabelConfig={{ 'node.a11yDescription.default': __('Use Tab to reach screen and path buttons. Press Enter to edit. Connections can also be edited in Next screen settings.', 'wconvert') }}
      minZoom={mapMinZoom} maxZoom={1.5} deleteKeyCode={null} panOnScroll={!narrow} preventScrolling={!narrow} zoomOnScroll={false} zoomOnPinch
      onNodeClick={(event, node) => { if (node.type === 'screen' && !(event.target instanceof Element && event.target.closest('button'))) onSelect(tree.steps.findIndex(step => step.id === node.id)); }}
      onEdgeClick={(_, edge) => { const data = edge.data as { sourceIndex?: number; priority?: number | 'hidden' } | undefined; if (data?.sourceIndex !== undefined) onSelectPath(data.sourceIndex, data.priority ?? 0); }}
      isValidConnection={valid} onConnect={connection => { if (editingConnections && connection.source && connection.target && valid(connection)) onConnect(connection.source, connection.target); }}
      onReconnect={(edge, connection) => {
        if (editingConnections && tree.graph && connection.source === edge.source && valid(connection)) onReconnect?.(edge.id, connection.target);
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
      <FocusCamera editingConnections={editingConnections} onEditConnections={() => setEditingConnections(value => !value)} mapRoot={mapRoot} selectedId={visibleId(tree.steps[cameraIndex]?.id ?? tree.steps[0].id)} nextId={routesFor(tree, cameraIndex)[0]?.to ? visibleId(routesFor(tree, cameraIndex)[0].to) : undefined}
        contextIds={cameraContext} firstId={visibleId(tree.graph?.entry ?? tree.steps[0].id)}
        initialOverview={selected === null && cameraFocus === null && view.length <= (groups.length ? 4 : 3)} overviewWidth={groups.length && view.length > 3 ? 900 : 600}
        grouping={detectedGroups.length ? { active: groups.length > 0, toggle: () => { setGrouping(groups.length === 0); setExpandedGroups([]); } } : undefined}
        revision={revision} selection={selected !== null && samplePath === null ? { highlighted: highlightRelated, toggle: () => setHighlightRelated(value => !value) } : undefined} onNodesReady={focusExpandedScreen} preview={preview} onPreview={() => setPreview(value => !value)} onTidy={() => setTidyRevision(value => value + 1)} />
    </ReactFlow>
    </SmartEdgeProvider>
    <p className="wconvert-journey-map__hint">{editingConnections ? __('Drag from + to add a path, or drag a line’s arrow to change its destination. Choose Done connecting when finished.', 'wconvert') : disconnected.size ? __('Unreachable screens stay in your draft. Connect their incoming paths or remove screens you no longer need.', 'wconvert') : groups.length ? __('Every matching follow-up is shown. Expand screens to edit their connections.', 'wconvert') : tree.graph
      ? __('Select a screen to edit. Moving a box changes only the layout. Use Edit connections for custom routing.', 'wconvert')
      : rtl ? __('Follow arrows from right to left. Scroll to move through the map; select a screen to edit it.', 'wconvert')
        : __('Follow arrows from left to right. Scroll to move through the map; select a screen to edit it.', 'wconvert')}</p>
  </div>;
}
