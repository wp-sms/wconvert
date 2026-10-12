import { Plus } from 'lucide-react';
import { __, sprintf } from '@wordpress/i18n';
import type { FlowLine } from '../structure/flowModel';
import type { FlowLayout, Rect } from '../structure/flowLayout';

/** On a trace or around the selection: drawn strongly (`on`) or quietly (`off`); `undefined` when nothing is emphasised. */
export type TraceState = 'on' | 'off' | undefined;

/** Arrowheads, one per colour a line can take: SVG markers cannot inherit a stroke everywhere yet. */
const markers = ['neutral', 'on', 'off', ...[1, 2, 3, 4, 5, 6].map(slot => `answer-${slot}`)];
// A coloured line keeps its answer's colour when it is drawn strongly; only a grey one turns teal.
const marker = (line: FlowLine, state: TraceState) => state === 'off' ? 'off' : line.colour ? `answer-${line.colour}` : state === 'on' ? 'on' : 'neutral';

/** Every line, drawn once and hidden from assistive tech: the cards and pills say it all in words. */
export function FlowLines({ id, layout, lines, states, focused }: {
  id: string; layout: FlowLayout; lines: readonly FlowLine[]; states: ReadonlyMap<string, TraceState>; focused?: string;
}) {
  return <svg className="wconvert-flow-lines" width={layout.width} height={layout.height} aria-hidden="true" focusable="false">
    <defs>{markers.map(name => <marker key={name} id={`${id}-${name}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" className="wconvert-flow-arrow" data-marker={name} />
    </marker>)}</defs>
    {lines.map(line => {
      const placed = layout.lines.get(line.id);
      if (!placed) return null;
      const state = states.get(line.id);
      return <path key={line.id} d={placed.path} className="wconvert-flow-line" data-style={line.style} data-colour={line.colour}
        data-state={state} data-selected={focused === line.id || undefined} data-problem={line.problem || undefined}
        markerEnd={`url(#${id}-${marker(line, state)})`} />;
    })}
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
