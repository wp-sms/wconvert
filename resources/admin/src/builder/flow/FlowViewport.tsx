import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { __ } from '@wordpress/i18n';

/**
 * The Flow map's scroll box (ADR 0142). Plain wheel scrolls, as everywhere
 * else in wp-admin; Ctrl/⌘-wheel and a trackpad pinch (which arrives as a
 * Ctrl-wheel in Chrome and as `gesture*` in Safari) and a two-finger pinch on
 * a touch screen zoom — and only inside the map, so the page itself never
 * zooms. The content is laid out once at 100% and scaled with CSS; the sizer
 * holds its scaled size so the scrollbars are true. Physically left-to-right:
 * the layout has already mirrored RTL, and a scroll box in RTL would count
 * its scroll backwards.
 */
export function FlowViewport({ viewport, surface, width, height, zoom, onZoom, onScroll, children }: {
  viewport: RefObject<HTMLDivElement | null>;
  /** Where a pinch is read: the whole map, so its toolbar and overview never let the page zoom instead. */
  surface: RefObject<HTMLElement | null>;
  width: number; height: number; zoom: number;
  /** A new zoom, about a point in the viewport. */
  onZoom(next: number, anchor: { x: number; y: number }): void;
  onScroll(): void;
  children: ReactNode;
}) {
  const latest = useRef({ zoom, onZoom });
  latest.current = { zoom, onZoom };
  useEffect(() => {
    const element = surface.current ?? viewport.current;
    if (!element) return;
    const point = (x: number, y: number) => { const rect = (viewport.current ?? element).getBoundingClientRect(); return { x: x - rect.left, y: y - rect.top }; };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      latest.current.onZoom(latest.current.zoom * Math.exp(-event.deltaY * 0.01), point(event.clientX, event.clientY));
    };
    // Safari's trackpad pinch.
    let gestureStart = 1;
    const gesture = (event: Event) => {
      event.preventDefault();
      const { scale = 1, clientX = 0, clientY = 0 } = event as Event & { scale?: number; clientX?: number; clientY?: number };
      if (event.type === 'gesturestart') { gestureStart = latest.current.zoom; return; }
      latest.current.onZoom(gestureStart * scale, point(clientX, clientY));
    };
    // Two fingers on a touch screen; one finger still scrolls (touch-action: pan-x pan-y).
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { distance: number; zoom: number } | null = null;
    const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) pinch = { distance: spread(), zoom: latest.current.zoom };
    };
    const move = (event: PointerEvent) => {
      if (!touches.has(event.pointerId)) return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!pinch || touches.size !== 2 || !pinch.distance) return;
      const [a, b] = [...touches.values()];
      latest.current.onZoom(pinch.zoom * spread() / pinch.distance, point((a.x + b.x) / 2, (a.y + b.y) / 2));
    };
    const up = (event: PointerEvent) => { touches.delete(event.pointerId); if (touches.size < 2) pinch = null; };
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('gesturestart', gesture);
    element.addEventListener('gesturechange', gesture);
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    return () => {
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('gesturestart', gesture);
      element.removeEventListener('gesturechange', gesture);
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };
  }, [viewport, surface]);
  return <div ref={viewport} className="wconvert-flow-viewport" dir="ltr" onScroll={onScroll}>
    <div className="wconvert-flow-sizer" style={{ width: width * zoom, height: height * zoom }}>
      <div className="wconvert-flow-canvas" style={{ width, height, transform: `scale(${zoom})` }}>{children}</div>
    </div>
  </div>;
}

/** Where the view is on a map larger than it, and a click to go elsewhere. Decorative: the cards are all in the tab order already. */
export function FlowOverview({ width, height, boxes, view, onJump }: {
  width: number; height: number; boxes: readonly { id: string; x: number; y: number; width: number; height: number; colour?: number }[];
  view: { x: number; y: number; width: number; height: number }; onJump(x: number, y: number): void;
}) {
  // At most 142 × 160: a tall map gets a narrow overview, not a tall one.
  const scale = Math.min(142 / Math.max(1, width), 160 / Math.max(1, height));
  return <div className="wconvert-flow-overview" aria-hidden="true" title={__('Overview: click to go there', 'wconvert')}
    onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); onJump((event.clientX - rect.left) / rect.width * width, (event.clientY - rect.top) / rect.height * height); }}>
    <svg width={width * scale} height={height * scale} viewBox={`0 0 ${width * scale} ${height * scale}`}>
      {boxes.map(box => <rect key={box.id} x={box.x * scale} y={box.y * scale} width={box.width * scale} height={box.height * scale} rx="1.5" data-colour={box.colour} />)}
      <rect className="wconvert-flow-overview__view" x={view.x * scale} y={view.y * scale} width={view.width * scale} height={view.height * scale} />
    </svg>
  </div>;
}

/** What a line's look means. Hidden where the overview needs the corner. */
export function FlowLegend() {
  return <div className="wconvert-flow-legend" role="note" aria-label={__('Line key', 'wconvert')}>
    <span><svg viewBox="0 0 28 8" aria-hidden="true"><path d="M0 4H28" data-style="plain" /></svg>{__('Everyone on this line', 'wconvert')}</span>
    <span><svg viewBox="0 0 28 8" aria-hidden="true"><path d="M0 4H28" data-style="answer" /></svg>{__('Only visitors with that answer', 'wconvert')}</span>
    <span><svg viewBox="0 0 28 8" aria-hidden="true"><path d="M0 4H28" data-style="around" /></svg>{__('Goes around · if skipped', 'wconvert')}</span>
  </div>;
}
