import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { GripVertical } from 'lucide-react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine';
import type { Template } from '@renderer/types';
import { Preview } from './Preview';

/** Pointer dragging supplements the same move operation used by the arrow buttons. */
export function JourneyScreenCard({ template, index, selected, scope, label, condition, onSelect, onMove }: {
  template: Template; index: number; selected: boolean; scope: string; label: string; condition?: string;
  onSelect(): void; onMove(from: string, to: string): void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const drawing = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(.25);
  useEffect(() => {
    const viewport = frame.current;
    const content = drawing.current;
    if (!viewport || !content) return;
    const fit = () => {
      if (content.offsetWidth && content.offsetHeight) setScale(Math.min(viewport.clientWidth / content.offsetWidth, viewport.clientHeight / content.offsetHeight, 1));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(viewport); observer.observe(content); fit();
    return () => observer.disconnect();
  }, []);
  const card = useRef<HTMLLIElement>(null);
  const grip = useRef<HTMLSpanElement>(null);
  const latestMove = useRef(onMove);
  latestMove.current = onMove;
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const screen = template.tree.steps[index];
  const terminal = screen.kind === 'acknowledgement';
  useEffect(() => {
    if (!card.current || !grip.current) return;
    return combine(
      draggable({ element: card.current, dragHandle: grip.current, canDrag: () => !terminal,
        getInitialData: () => ({ journey: scope, screen: screen.id }),
        onDragStart: () => setDragging(true), onDrop: () => setDragging(false) }),
      dropTargetForElements({ element: card.current,
        canDrop: ({ source }) => source.data.journey === scope && source.data.screen !== screen.id,
        onDragEnter: () => setOver(true), onDragLeave: () => setOver(false),
        onDrop: ({ source }) => { setOver(false); latestMove.current(String(source.data.screen), screen.id); },
      }),
    );
  }, [scope, screen.id, terminal]);
  return <li ref={card} className="wconvert-journey-card" data-selected={selected} data-dragging={dragging} data-drop-target={over}>
    <div className="wconvert-journey-card__head">
      <span>{sprintf(__('Screen %d', 'wconvert'), index + 1)}</span>
      <span ref={grip} className="wconvert-journey-card__grip" aria-hidden="true">{terminal ? __('Last', 'wconvert') : <GripVertical size={16} />}</span>
    </div>
    <div ref={frame} className="wconvert-journey-card__preview" inert aria-hidden="true"><div ref={drawing} className="wconvert-journey-card__drawing" style={{ transform: `translateY(-50%) scale(${scale})` }}><Preview template={template} step={index} /></div></div>
    <button type="button" className="wconvert-journey-card__select" aria-pressed={selected} onClick={onSelect}>
      <strong>{screen.name}</strong><span>{label}</span>
      {condition && <small className="wconvert-journey-card__condition">{condition}</small>}
    </button>
  </li>;
}
