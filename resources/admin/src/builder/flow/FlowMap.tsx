import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { __ } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { issuesByScreen, type CampaignIssue } from '../readiness/campaignIssues';
import { flowModel, lineIsOn, type FlowLine, type Priority } from '../structure/flowModel';
import { flowLayout, layoutInput } from '../structure/flowLayout';
import { clampZoom, fitZoom, revealScroll, stepZoom, zoomAt } from '../structure/flowViewport';
import { questionsIn, walkNodes } from '../structure/journey';
import { useDirection } from '../../hooks/useDirection';
import { FlowCard, FlowGroup } from './FlowCard';
import { FlowLines, LinePill, type TraceState } from './FlowLines';
import { FlowLegend, FlowOverview, FlowViewport } from './FlowViewport';
import { FlowVisitor, visitorTrace } from './FlowVisitor';
import type { Answers } from '../../../../loader/src/journey-rules';

const noIssues: readonly CampaignIssue[] = [];
const PAD = 16;
/** Kept clear below the map at Fit, so the zoom bar never covers the last card (GUIDELINES §22). */
const TOOLBAR = 64;

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update(); list.addEventListener?.('change', update);
    return () => list.removeEventListener?.('change', update);
  }, [query]);
  return matches;
}

export interface FlowMapProps {
  tree: TemplateTree;
  selected: number | null;
  /** The selected screen's line being edited, marked on the map. */
  focusedPath?: Priority | null;
  onSelect(index: number): void;
  /** Opens the control that sets one of a screen's lines: its Then, an answer line, its If skipped. */
  onSelectPath(index: number, priority: Priority): void;
  /** A visitor's path to mark: the screens shown and the edges taken (`journeyTraceEdges`). */
  samplePath?: readonly number[] | null;
  sampleEdges?: readonly string[] | null;
  onClearTrace?(): void;
  issues?: readonly CampaignIssue[];
  onIssue?(issue: CampaignIssue): void;
  destinationSummary?: string;
  /** "+" on a line: insert a screen on that graph edge. Absent where screens cannot be inserted. */
  onAdd?(index: number, edgeId: string): void;
  /** A straight campaign's first answer line. */
  onBranch?(): void;
}

/**
 * The Flow map (ADR 0142): one readable picture of where every visitor goes.
 * `flowModel` says what to draw, `flowLayout` where, and this draws it — the
 * cards and the pills as buttons in reading order, the lines in one SVG —
 * with a roving tab stop like the Edit tree's.
 */
export function FlowMap({ tree, selected, focusedPath = null, onSelect, onSelectPath, samplePath = null, sampleEdges = null, onClearTrace, issues = noIssues, onIssue, destinationSummary, onAdd, onBranch }: FlowMapProps) {
  const id = useId();
  const rtl = useDirection() === 'rtl';
  const coarse = useMedia('(pointer: coarse)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const screen = selected === null ? undefined : tree.steps[selected];
  const selectedQuestion = screen ? questionsIn(screen.content)[0]?.id
    ?? screen.when?.clauses[0]?.question : undefined;
  const model = useMemo(() => flowModel(tree, { selectedQuestion }), [tree, selectedQuestion]);
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const layout = useMemo(() => flowLayout(layoutInput(model, node => measured[node], coarse), { rtl }), [model, measured, coarse, rtl]);

  // One ResizeObserver: the viewport's size, and every card's height as it wraps.
  const viewport = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [view, setView] = useState({ width: 0, height: 0 });
  const [tick, setTick] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(() => setTick(value => value + 1));
    if (viewport.current) observer.current.observe(viewport.current);
    nodes.current.forEach(element => observer.current!.observe(element));
    return () => observer.current?.disconnect();
  }, []);
  const measureRef = useCallback((node: string) => (element: HTMLDivElement | null) => {
    const known = nodes.current.get(node);
    if (known && known !== element) observer.current?.unobserve(known);
    if (element) { nodes.current.set(node, element); observer.current?.observe(element); } else nodes.current.delete(node);
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (element && (Math.abs(element.clientWidth - view.width) > 1 || Math.abs(element.clientHeight - view.height) > 1)) setView({ width: element.clientWidth, height: element.clientHeight });
    const changed: Record<string, number> = {};
    nodes.current.forEach((node, key) => { const height = node.offsetHeight; if (height > 0 && Math.abs(height - (measured[key] ?? 0)) > 1) changed[key] = height; });
    if (Object.keys(changed).length) setMeasured(current => ({ ...current, ...changed }));
  }, [layout, tick]); // eslint-disable-line react-hooks/exhaustive-deps -- re-measured after every layout and resize

  // Fit until the merchant zooms; Fit again on request.
  const [zoom, setZoom] = useState(1);
  const [fitted, setFitted] = useState(true);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pending = useRef<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!fitted || !view.width) return;
    const next = fitZoom({ width: view.width - PAD, height: view.height - PAD - TOOLBAR }, layout);
    if (next !== zoomRef.current) setZoom(next);
  }, [fitted, view, layout]);
  // Fit has not reached its zoom yet: the first render is at 100%, before the map is measured.
  const settling = fitted && (!view.width || fitZoom({ width: view.width - PAD, height: view.height - PAD - TOOLBAR }, layout) !== zoom);
  const zoomTo = useCallback((next: number, anchor?: { x: number; y: number }) => {
    const element = viewport.current;
    const target = clampZoom(next);
    if (target === zoomRef.current) return;
    if (element) pending.current = zoomAt({ left: element.scrollLeft, top: element.scrollTop }, anchor ?? { x: element.clientWidth / 2, y: element.clientHeight / 2 }, zoomRef.current, target);
    setFitted(false); setZoom(target);
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (element && pending.current) { element.scrollLeft = pending.current.left; element.scrollTop = pending.current.top; pending.current = null; }
  }, [zoom]);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const frame = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { const element = viewport.current; if (element) setScroll({ left: element.scrollLeft, top: element.scrollTop }); });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The selected card, and the screen after it when both fit, stay in view.
  const selectedNode = screen ? model.nodeOf(screen.id) : undefined;
  const reveal = useCallback((node: string | undefined, withNext: boolean) => {
    const element = viewport.current;
    const box = node ? layout.boxes.get(node) : undefined;
    if (!element || !box || settling) return;
    // "The screen after it" is the first one in reading order, whatever order its lines are stored in.
    const after = withNext ? model.lines.filter(line => line.from === node && line.style !== 'around' && line.style !== 'skipped').map(line => line.to) : [];
    const nextNode = after.sort((a, b) => layout.order.indexOf(a) - layout.order.indexOf(b))[0];
    const offset = { x: Math.max(0, (element.clientWidth - layout.width * zoomRef.current) / 2), y: 0 };
    const target = revealScroll({ left: element.scrollLeft - offset.x, top: element.scrollTop, width: element.clientWidth, height: element.clientHeight }, zoomRef.current,
      [box, ...(nextNode && layout.boxes.get(nextNode) ? [layout.boxes.get(nextNode)!] : [])]);
    if (target) element.scrollTo?.({ left: target.left + offset.x, top: target.top, behavior: reduced ? 'auto' : 'smooth' });
  }, [layout, model.lines, reduced, settling]);
  // A scroll worked out at 100% and started before Fit shrank the map opened wide maps past their first branch.
  useEffect(() => { reveal(selectedNode, true); }, [selectedNode, zoom, settling]); // eslint-disable-line react-hooks/exhaustive-deps -- follows the selection, not every re-layout

  // One tab stop: the active card, then its buttons and its lines' pills.
  const [active, setActive] = useState<string | undefined>(selectedNode);
  useEffect(() => { if (selectedNode) setActive(selectedNode); }, [selectedNode]);
  const current = active && layout.boxes.has(active) ? active : selectedNode && layout.boxes.has(selectedNode) ? selectedNode : layout.order[0];
  const keys = useRef(new Map<string, HTMLButtonElement>());
  const focusRef = useCallback((node: string) => (element: HTMLButtonElement | null) => { if (element) keys.current.set(node, element); else keys.current.delete(node); }, []);
  const go = (node: string | undefined) => { if (!node) return; setActive(node); keys.current.get(node)?.focus(); };
  const onKeyDown = (event: KeyboardEvent) => {
    const from = (event.target as HTMLElement).closest<HTMLElement>('[data-flow-key]')?.dataset.flowKey;
    if (event.key === 'Escape' && (visitor || samplePath)) { event.preventDefault(); clearTrace(); return; }
    if (!from || (event.target as HTMLElement).dataset.flowKey !== from) return;
    const at = layout.order.indexOf(from);
    const row = layout.order.filter(node => layout.row.get(node) === layout.row.get(from));
    const x = (node: string) => layout.boxes.get(node)!.x;
    const beside = (direction: 1 | -1) => row.filter(node => direction * (x(node) - x(from)) > 0).sort((a, b) => direction * (x(a) - x(b)))[0];
    const moves: Record<string, () => string | undefined> = {
      ArrowDown: () => layout.order[at + 1], ArrowUp: () => layout.order[at - 1],
      ArrowRight: () => beside(1), ArrowLeft: () => beside(-1),
      Home: () => layout.order[0], End: () => layout.order[layout.order.length - 1],
    };
    if (moves[event.key]) { event.preventDefault(); go(moves[event.key]()); return; }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomTo(stepZoom(zoomRef.current, 1)); }
    else if (event.key === '-') { event.preventDefault(); zoomTo(stepZoom(zoomRef.current, -1)); }
    else if (event.key === '0') { event.preventDefault(); setFitted(true); }
  };

  // Keys are read on the region, a landmark rather than a widget: the cards and pills are the controls.
  const region = useRef<HTMLElement>(null);
  const keyHandler = useRef(onKeyDown);
  keyHandler.current = onKeyDown;
  useEffect(() => {
    const element = region.current;
    const listener = (event: KeyboardEvent) => keyHandler.current(event);
    element?.addEventListener('keydown', listener);
    return () => element?.removeEventListener('keydown', listener);
  }, []);

  // Try a visitor: answers in, the loader's own trace out. Any edit starts again.
  const [visitor, setVisitor] = useState<Answers | null>(null);
  useEffect(() => { setVisitor(null); }, [tree]);
  const visitorRoute = useMemo(() => visitor ? visitorTrace(tree, visitor) : null, [tree, visitor]);
  const path = visitorRoute?.screens ?? samplePath;
  const pathEdges = visitorRoute?.edges ?? sampleEdges;
  const clearTrace = () => { if (visitor) setVisitor(null); else onClearTrace?.(); };
  // A trace marks the screens shown and the lines taken; everything else is drawn quietly.
  const trace = useMemo(() => path ? { screens: new Set(path.map(index => tree.steps[index]?.id).filter((item): item is string => !!item)), edges: new Set(pathEdges ?? []) } : null, [path, pathEdges, tree.steps]);
  // Without a trace, the selected card's own lines and neighbours are drawn strongly and the rest quietly,
  // as in the prototype; no text fades either way (GUIDELINES §22).
  const near = useMemo(() => {
    if (trace || !selectedNode) return null;
    const lines = new Set(model.lines.filter(line => line.from === selectedNode || line.to === selectedNode).map(line => line.id));
    return { lines, nodes: new Set(model.lines.filter(line => lines.has(line.id)).flatMap(line => [line.from, line.to])) };
  }, [trace, selectedNode, model.lines]);
  const lineStates = useMemo(() => new Map(model.lines.map(line => [line.id, trace ? lineIsOn(line, trace) ? 'on' as const : 'off' as const
    : near ? near.lines.has(line.id) ? 'on' as const : 'off' as const : undefined])), [model.lines, trace, near]);
  const nodeState = (node: string, screens: readonly string[]): TraceState => trace ? screens.some(item => trace.screens.has(item)) ? 'on' : 'off'
    : near ? node === selectedNode ? undefined : near.nodes.has(node) ? 'on' : 'off' : undefined;
  const focusedLine = focusedPath !== null && selected !== null ? model.lines.find(line => line.select?.index === selected && line.select.priority === focusedPath)?.id : undefined;
  const byScreen = useMemo(() => issuesByScreen(issues), [issues]);
  const label = model.nameOf;
  const edgeSource = (edge: string) => {
    const graphEdge = tree.graph?.edges.find(item => item.id === edge);
    return graphEdge ? tree.steps.findIndex(item => item.id === graphEdge.from) : -1;
  };
  const pills = (node: string) => model.lines.filter(line => line.from === node && layout.lines.get(line.id)?.label)
    .sort((a, b) => (layout.lines.get(a.id)!.label!.x - layout.lines.get(b.id)!.label!.x) * (rtl ? -1 : 1));
  const pill = (line: FlowLine) => <LinePill key={line.id} line={line} rtl={rtl} rect={layout.lines.get(line.id)!.label!} fromName={label(line.from)} toName={label(line.to)}
    state={lineStates.get(line.id)} selected={focusedLine === line.id} tabbable={line.from === current}
    onLabel={line.select ? () => onSelectPath(line.select!.index, line.select!.priority) : undefined}
    onAdd={onAdd && line.insertEdgeId && edgeSource(line.insertEdgeId) >= 0 ? () => onAdd(edgeSource(line.insertEdgeId!), line.insertEdgeId!) : undefined} />;

  const overflows = layout.width * zoom > view.width + 4 || layout.height * zoom > view.height + 4;
  const hasChoiceQuestion = tree.steps.some(item => walkNodes(item.content).some(node => node.type === 'question' && 'answer_type' in node && node.answer_type !== 'text'));
  return <div className="wconvert-journey-map wconvert-flow" data-trace={trace ? 'on' : undefined}>
    <section className="wconvert-flow-region" aria-label={__('Flow map', 'wconvert')} aria-describedby={`${id}-keys`} ref={region}>
      {model.straight && <div className="wconvert-flow-nudge">
        <span>{__('Every visitor sees these screens in order.', 'wconvert')}</span>
        {onBranch && hasChoiceQuestion ? <button type="button" className="wconvert-panel-link" onClick={onBranch}>{__('Send some answers to a different screen', 'wconvert')}</button>
            : onBranch ? <span>{__('Add a question to send answers to different screens.', 'wconvert')}</span> : null}
      </div>}
      {visitorRoute && visitor ? <FlowVisitor tree={tree} answers={visitor} trace={visitorRoute} onAnswers={setVisitor} onStop={() => setVisitor(null)} />
        : trace ? <div className="wconvert-flow-nudge" role="status">
          <span>{__('Showing where one visitor goes. Lines they don’t take are faint.', 'wconvert')}</span>
          {onClearTrace && <button type="button" className="wconvert-panel-link" onClick={onClearTrace}>{__('Stop showing it', 'wconvert')}</button>}
        </div>
        : <button type="button" className="wconvert-flow-try" onClick={() => setVisitor({})}>{__('Try a visitor', 'wconvert')}</button>}
      <p id={`${id}-keys`} className="sr-only">{__('Arrow keys move between screens in reading order. Tab reaches a screen’s buttons and its lines. Plus and minus zoom; 0 fits.', 'wconvert')}</p>
      <FlowViewport viewport={viewport} surface={region} width={layout.width} height={layout.height} zoom={zoom} onZoom={zoomTo} onScroll={onScroll}>
        <FlowLines id={id} layout={layout} lines={model.lines} states={lineStates} focused={focusedLine} quiet={!!trace} />
        {layout.order.map(node => {
          const box = layout.boxes.get(node)!;
          const card = model.cards.find(item => item.id === node);
          const group = card ? undefined : model.groups.find(item => item.id === node);
          const common = { box, rtl, active: node === current, onIssue, onSelect, onSelectPath, onFocusNode: () => { setActive(node); reveal(node, false); },
            focusRef: focusRef(node), measureRef: measureRef(node) };
          return <Fragment key={node}>
            {card && <FlowCard {...common} card={card} selected={card.index === selected} state={nodeState(card.id, [card.id])} issues={byScreen.get(card.id) ?? noIssues} destinationSummary={destinationSummary}
              shownResult={visitorRoute?.result?.screen === card.id ? visitorRoute.result.id : undefined} />}
            {group && <FlowGroup {...common} group={group} selected={selected} state={nodeState(group.id, group.members.map(member => member.id))} visited={trace?.screens}
              issues={group.members.flatMap(member => byScreen.get(member.id) ?? [])}
              nextPriority={model.lines.find(line => line.from === group.id)?.select?.priority as number | undefined} />}
            {pills(node).map(pill)}
          </Fragment>;
        })}
      </FlowViewport>
      <div className="wconvert-flow-zoom" role="group" aria-label={__('Zoom', 'wconvert')}>
        <button type="button" aria-label={__('Zoom out', 'wconvert')} title={__('Zoom out', 'wconvert')} onClick={() => zoomTo(stepZoom(zoom, -1))}><Minus aria-hidden="true" /></button>
        <output aria-label={__('Zoom level', 'wconvert')}>{Math.round(zoom * 100)}%</output>
        <button type="button" aria-label={__('Zoom in', 'wconvert')} title={__('Zoom in', 'wconvert')} onClick={() => zoomTo(stepZoom(zoom, 1))}><Plus aria-hidden="true" /></button>
        <button type="button" onClick={() => setFitted(true)}>{__('Fit', 'wconvert')}</button>
      </div>
      {overflows ? <FlowOverview width={layout.width} height={layout.height}
        boxes={layout.order.map(node => ({ id: node, ...layout.boxes.get(node)!, color: model.cards.find(card => card.id === node)?.color }))}
        view={{ x: scroll.left / zoom, y: scroll.top / zoom, width: view.width / zoom, height: view.height / zoom }}
        onJump={(x, y) => viewport.current?.scrollTo?.({ left: x * zoom - view.width / 2, top: y * zoom - view.height / 2, behavior: reduced ? 'auto' : 'smooth' })} />
        : <FlowLegend />}
    </section>
  </div>;
}
