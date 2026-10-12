import { Plus } from 'lucide-react';
import { __, sprintf } from '@wordpress/i18n';
import type { FlowLine } from '../structure/flowModel';
import type { FlowLayout, Rect } from '../structure/flowLayout';

/** On a trace or around the selection: drawn strongly (`on`) or quietly (`off`); `undefined` when nothing is emphasised. */
export type TraceState = 'on' | 'off' | undefined;

// A coloured line keeps its answer's colour when it is drawn strongly; only a grey one turns teal.
// Only a trace draws untaken lines quietly; around a selection they keep their colour.
const marker = (line: FlowLine, state: TraceState, quiet: boolean) => state === 'off' && quiet ? 'off' : line.colour ? `answer-${line.colour}` : state === 'on' ? 'on' : 'neutral';

/**
 * Every line, drawn once and hidden from assistive tech: the cards and pills
 * say it all in words. Lines into one box meet at the middle of its top and
 * share one arrowhead, of one size whatever the line's weight: the strongest
 * line's colour, so a trace or a selection still shows where it arrives.
 */
export function FlowLines({ id, layout, lines, states, focused, quiet }: {
  id: string; layout: FlowLayout; lines: readonly FlowLine[]; states: ReadonlyMap<string, TraceState>; focused?: string;
  /** A trace is showing: lines it did not take are drawn quietly. */
  quiet: boolean;
}) {
  const arrivals = [...new Set(lines.map(line => line.to))].flatMap(to => {
    const into = lines.filter(line => line.to === to && layout.lines.has(line.id));
    if (!into.length) return [];
    const end = layout.lines.get(into[0].id)!.points.at(-1)!;
    const strongest = into.find(line => states.get(line.id) === 'on') ?? into.find(line => states.get(line.id) !== 'off') ?? into[0];
    return [{ to, x: end[0], y: end[1], marker: marker(strongest, states.get(strongest.id), quiet) }];
  });
  return <svg className="wconvert-flow-lines" width={layout.width} height={layout.height} aria-hidden="true" focusable="false">
    {lines.map(line => {
      const placed = layout.lines.get(line.id);
      if (!placed) return null;
      return <path key={line.id} d={placed.path} className="wconvert-flow-line" data-style={line.style} data-colour={line.colour}
        data-state={states.get(line.id)} data-selected={focused === line.id || undefined} data-problem={line.problem || undefined} />;
    })}
    {arrivals.map(arrival => <path key={`${id}-${arrival.to}`} className="wconvert-flow-arrow" data-marker={arrival.marker}
      d={`M${arrival.x - 6},${arrival.y - 9} L${arrival.x + 6},${arrival.y - 9} L${arrival.x},${arrival.y} Z`} />)}
  </svg>;
}

/** A line's words and its "+", placed in the room the layout kept for them, right after the card the line leaves. */
export function LinePill({ line, rtl, rect, fromName, toName, state, selected, tabbable, onLabel, onAdd }: {
  line: FlowLine; rtl: boolean; rect: Rect; fromName: string; toName: string; state: TraceState; selected: boolean; tabbable: boolean;
  onLabel?(): void; onAdd?(): void;
}) {
  const where = line.label
    ? sprintf(/* translators: 1: a line's answer. 2, 3: screen names. */ __('%1$s: %2$s to %3$s', 'wconvert'), line.label, fromName, toName)
    : sprintf(/* translators: 1, 2: screen names. */ __('%1$s to %2$s', 'wconvert'), fromName, toName);
  return <span className="wconvert-flow-pill" data-style={line.style} data-colour={line.colour} data-state={state} data-selected={selected || undefined} data-problem={line.problem || undefined}
    dir={rtl ? 'rtl' : 'ltr'} style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
    {line.label && <button type="button" className="wconvert-flow-pill__label" tabIndex={tabbable ? 0 : -1} onClick={onLabel} disabled={!onLabel}
      aria-label={sprintf(/* translators: %s: a line, e.g. “Growing: Interests to Your guide”. */ __('%s. Edit', 'wconvert'), where)}>
      {line.colour && <span className="wconvert-flow-dot" data-colour={line.colour} aria-hidden="true" />}<bdi>{line.label}</bdi>
    </button>}
    {onAdd && <button type="button" className="wconvert-flow-pill__add" tabIndex={tabbable ? 0 : -1} onClick={onAdd} title={__('Add a screen here', 'wconvert')}
      aria-label={sprintf(/* translators: %s: a line, e.g. “Interests to Your guide”. */ __('Add a screen on the line %s', 'wconvert'), where)}>
      <Plus aria-hidden="true" />
    </button>}
  </span>;
}
