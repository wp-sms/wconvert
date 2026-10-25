import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Skeleton } from '../components/ui/skeleton';
import { Preview } from '../builder/Preview';
import type { SlotKey } from '../builder/slots';
import type { ResultVariant, Template } from '@renderer/types';
import { useDirection } from '../hooks/useDirection';
import { GhostPage } from './GhostPage';
import { renderWidth, type Device } from './renderWidth';
import { useFitScale } from './useFitScale';
import './stage.css';

/**
 * What a stage draws: a design on this site, drawn live by the renderer, or an
 * online one, drawn from the catalogue's picture of it (ADR 0170).
 */
export type StageSource =
  | { readonly live: { readonly template: Template } }
  | { readonly image: { readonly '1x': string; readonly '2x'?: string } };

export type StageSize = 'card' | 'thumb' | 'inspect' | 'canvas';

/** How far outside the viewport a card still counts as near: a screen's worth. */
const NEARBY = '600px';

/** The catalogue's 1x picture is 600 wide; a picture is laid out at that width and scaled like a render. */
const PICTURE_WIDTH = 600;

export interface DesignStageProps {
  readonly displayType: string;
  readonly size: StageSize;
  readonly device?: Device;
  readonly zoom?: 'fit' | 'actual';
  readonly step?: number;
  readonly result?: ResultVariant;
  /** A bar's or a slide-in's resolved placement. A card has none: a bar is drawn at the top. */
  readonly placement?: string | null;
  /** Nothing yet while a tree is arriving: the page is drawn and the slot waits. */
  readonly source?: StageSource;
  /** Draw the design only near the viewport. On by default for a card and a thumb. */
  readonly lazy?: boolean;
  /** The stage came near the viewport: its design is worth fetching. */
  readonly onNear?: () => void;
  readonly selected?: SlotKey | null;
  readonly onSelect?: (key: SlotKey) => void;
  readonly interactive?: boolean;
  readonly onAdvance?: () => void;
  /** Drawn over the design and scaled with it: the canvas's close button. */
  readonly chrome?: ReactNode;
  /** The canvas's own screen, drawn on the page in place of the design. */
  readonly children?: ReactNode;
  /** That screen is a page of its own, so the ghost page is not drawn under it. */
  readonly inFlow?: boolean;
  /** The scale the design is seen at, the phone's included. */
  readonly onScale?: (scale: number) => void;
  /** A press on the page around the design. */
  readonly onStage?: () => void;
  /**
   * At actual size a page bigger than the stage scrolls inside it, and the
   * stage then becomes a named, focusable region so a keyboard can scroll it.
   */
  readonly region?: { readonly label: string; readonly describedBy?: string };
  readonly onOverflow?: (overflows: boolean) => void;
}

export function DesignStage({
  displayType,
  size,
  device = 'desktop',
  zoom = 'fit',
  step = 0,
  result,
  placement = null,
  source,
  lazy = size === 'card' || size === 'thumb',
  onNear,
  selected,
  onSelect,
  interactive = false,
  onAdvance,
  chrome,
  children,
  inFlow = false,
  onScale,
  onStage,
  region,
  onOverflow,
}: DesignStageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const design = useRef<HTMLDivElement>(null);
  // Where nothing can observe (jsdom, an old browser) the honest answer is to draw.
  const [near, setNear] = useState(!lazy || typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const node = stage.current;

    if (!lazy || node === null || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => setNear(entry?.isIntersecting === true), { rootMargin: NEARBY });

    observer.observe(node);

    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (near) onNear?.();
  }, [near, onNear]);

  const live = source !== undefined && 'live' in source ? source.live.template : undefined;
  const image = source !== undefined && 'image' in source ? source.image : undefined;
  const width = live !== undefined ? renderWidth(live.tokens, displayType, device) : PICTURE_WIDTH;
  /*
   * The width is the anchor's, so the design fills it: the render is handed
   * `100%` the way `mountModal` hands a dialog's root one. A fullscreen keeps
   * its own token, which is the measure of its content inside the page.
   */
  const drawn = useMemo(
    (): Template | undefined => live === undefined || displayType === 'fullscreen'
      ? live
      : { ...live, tokens: { ...live.tokens, width: '100%' } },
    [live, displayType],
  );
  const rtl = useDirection() === 'rtl';
  const showing = near && children === undefined && (drawn !== undefined || image !== undefined);
  const placed = useFitScale(stage, design, { format: displayType, device, zoom, cap: size === 'canvas' ? 1 : 1.25, placement, rtl },
    showing || children !== undefined, children !== undefined ? 'screen' : drawn ?? image);
  const seen = placed === null ? null : placed.scale * placed.page.scale;

  useEffect(() => {
    if (seen !== null) onScale?.(seen);
  }, [seen, onScale]);

  const overflows = placed !== null && zoom === 'actual'
    && (placed.page.width * placed.page.scale > placed.stage.width + 1 || placed.page.height * placed.page.scale > placed.stage.height + 1);

  useEffect(() => {
    onOverflow?.(overflows);
  }, [overflows, onOverflow]);

  // A new view starts from the top of the page.
  useEffect(() => {
    stage.current?.scrollTo?.({ top: 0, left: 0 });
  }, [step, device, zoom, result]);

  const inert = !interactive && onSelect === undefined;
  const fill = image === undefined ? placed?.fill : undefined;

  return (
    /*
      Coordinates of a laid-out picture (GUIDELINES §15): `place()` has already
      mirrored them for RTL, so the scroll box is `ltr` — an RTL scroll origin
      would hide an actual-size page's overflow on the side it cannot scroll
      to — and the page inside takes the admin's direction back.
    */
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- a pointer shortcut; the Look row in the tree is the keyboard way. */
    <div
      ref={stage}
      dir="ltr"
      className="wconvert-stage"
      data-display-type={displayType}
      data-placement={placement ?? undefined}
      data-size={size}
      data-device={device}
      data-zoom={zoom}
      data-scale={seen === null ? undefined : seen.toFixed(2)}
      role={overflows && region ? 'region' : undefined}
      tabIndex={overflows && region ? 0 : undefined}
      aria-label={overflows ? region?.label : undefined}
      aria-describedby={overflows ? region?.describedBy : undefined}
      onClick={onStage === undefined ? undefined : event => {
        if (!(event.target as Element).closest('.wconvert-stage__design, .wconvert-stage__screen')) onStage();
      }}
    >
      <div
        className="wconvert-stage__page"
        dir={rtl ? 'rtl' : 'ltr'}
        style={{
          left: placed?.page.x ?? 0,
          top: placed?.page.y ?? 0,
          ...(device === 'mobile' ? { inlineSize: 360, blockSize: 720, transform: `scale(${placed?.page.scale ?? 0})` } : {}),
          ...(device === 'desktop' && zoom === 'actual' && placed !== null ? { inlineSize: placed.page.width, blockSize: placed.page.height } : {}),
          ...(placed?.barHeight !== undefined ? { '--wconvert-stage-bar': `${placed.barHeight}px` } : {}),
        }}
      >
        {!inFlow && <GhostPage displayType={displayType} thumb={size === 'thumb'} />}
        {children === undefined && displayType === 'popup' && <div className="wconvert-stage__dim" />}
        {children === undefined && placed?.plate !== undefined && (
          <div className="wconvert-stage__plate" style={{ left: placed.plate.x, top: placed.plate.y, inlineSize: placed.plate.width, blockSize: placed.plate.height }} />
        )}
        {children !== undefined ? (
          <div className="wconvert-stage__screen" data-in-flow={inFlow || undefined}>{children}</div>
        ) : showing ? (
          <div
            ref={design}
            className="wconvert-stage__design"
            data-waiting={placed === null || undefined}
            data-fill={fill !== undefined || undefined}
            inert={inert || undefined}
            aria-hidden={inert || undefined}
            style={{
              inlineSize: width,
              blockSize: fill,
              left: placed?.x ?? 0,
              top: placed?.y ?? 0,
              transform: `scale(${placed?.scale ?? 1})`,
            }}
          >
            {drawn !== undefined ? (
              <Preview template={drawn} displayType={displayType} width={width} step={step} result={result}
                selected={selected} onSelect={onSelect} interactive={interactive} onAdvance={onAdvance} />
            ) : image !== undefined && (
              <img
                src={image['1x']}
                srcSet={image['2x'] ? `${image['1x']} 600w, ${image['2x']} 1200w` : undefined}
                sizes={`${Math.max(1, Math.round(PICTURE_WIDTH * (seen ?? 1)))}px`}
                alt=""
                decoding="async"
                referrerPolicy="no-referrer"
              />
            )}
            {chrome}
          </div>
        ) : (
          <Skeleton aria-hidden="true" className="wconvert-stage__waiting" />
        )}
      </div>
    </div>
  );
}
