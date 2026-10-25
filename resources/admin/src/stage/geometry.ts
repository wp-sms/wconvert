import type { Device } from './renderWidth';

export interface Framing {
  readonly format: string;
  readonly device: Device;
  /** `fit` scales the design into its slot; `actual` draws it at scale 1 on a page grown to hold it. */
  readonly zoom: 'fit' | 'actual';
  /** The most a design is ever enlarged: 1.25 on a card, 1 on the canvas. */
  readonly cap: number;
  readonly rtl: boolean;
  /** A bar's or a slide-in's saved placement; a card has none and takes the default. */
  readonly placement?: string | null;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Box extends Size {
  readonly x: number;
  readonly y: number;
}

export interface Placed {
  /** The design's top-left corner on the page, in page pixels, and its scale. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /** The page: its size, and how it is itself scaled and offset onto the stage (a phone is). */
  readonly page: Size & { readonly scale: number; readonly x: number; readonly y: number };
  /** The band of page an inline design sits on, hiding the lines behind it, in page pixels. */
  readonly plate?: Box;
  /** How much of the page a top bar covers, so the ghost page starts beneath it. */
  readonly barHeight?: number;
  /** A fullscreen is as tall as the page: the design-space height it is given. */
  readonly fill?: number;
}

const PHONE = { width: 360, height: 720 } as const;

/**
 * Where a design stands on the faint page behind it (ADR 0170).
 *
 * Each format has a slot — a popup the middle 72% × 88%, a slide-in half the
 * page in a corner, an inline design a band 88% wide — and the design is
 * scaled to fill it, never past `cap`. On a phone the page is 360 × 720 and the
 * design is drawn at its own size; the whole phone is scaled into the stage.
 */
export function place(framing: Framing, stage: Size, design: Size): Placed {
  const { format, placement } = framing;
  const { width: w, height: h } = design;
  const top = typeof placement === 'string' && placement.startsWith('block_start');
  const start = typeof placement === 'string' && placement.endsWith('inline_start');
  // A physical left edge: the end corner is on the right in LTR and the left in RTL.
  const onLeft = start !== framing.rtl;

  if (framing.device === 'mobile') {
    // The whole phone is fitted, never past the cap; at actual size it is its own size and scrolls.
    const k = framing.zoom === 'actual' ? 1 : Math.min(stage.width / PHONE.width, stage.height / PHONE.height, framing.cap);
    const page = { ...PHONE, scale: k, x: Math.max(0, (stage.width - PHONE.width * k) / 2), y: Math.max(0, (stage.height - PHONE.height * k) / 2) };
    const at = (x: number, y: number, more: Partial<Placed> = {}): Placed => ({ x, y, scale: 1, page, ...more });

    switch (format) {
      case 'floating_bar':
        return placement === 'block_end' ? at(0, PHONE.height - h) : at(0, 0, { barHeight: h });
      case 'fullscreen':
        return at(0, 0, { fill: PHONE.height });
      case 'slide_in':
        return at((PHONE.width - w) / 2, top ? 16 : PHONE.height - 16 - h);
      case 'inline': {
        const y = Math.max(64, Math.min(150, PHONE.height - 16 - h));

        return at(16, y, { plate: plate(y, h, PHONE.width) });
      }
      default:
        return at((PHONE.width - w) / 2, Math.max(16, (PHONE.height - h) / 2));
    }
  }

  const actual = framing.zoom === 'actual';
  // At actual size the page grows until the slot holds the design at scale 1.
  const grown = (sw: number, sh: number) => actual
    ? { width: Math.max(stage.width, w / sw), height: Math.max(stage.height, h / sh) }
    : stage;
  const { width: W, height: H } = format === 'floating_bar'
    ? (actual ? { width: Math.max(stage.width, w), height: stage.height } : stage)
    : format === 'fullscreen'
      ? (actual ? { width: Math.max(stage.width, w), height: Math.max(stage.height, 640) } : stage)
      : format === 'slide_in' ? grown(0.5, 0.86) : format === 'inline' ? grown(0.84, 0.6) : grown(0.72, 0.88);
  const page = { width: W, height: H, scale: 1, x: 0, y: 0 };
  const slot = (sw: number, sh: number) => actual ? 1 : Math.min(sw / w, sh / h, framing.cap);

  switch (format) {
    case 'floating_bar': {
      const scale = actual ? 1 : W / w;

      return placement === 'block_end'
        ? { x: 0, y: H - h * scale, scale, page }
        : { x: 0, y: 0, scale, page, barHeight: h * scale };
    }
    case 'fullscreen': {
      const scale = actual ? 1 : W / w;

      return { x: 0, y: 0, scale, page, fill: H / scale };
    }
    case 'slide_in': {
      const scale = slot(W * 0.5, H * 0.86);
      const margin = W * 0.04;
      const x = onLeft ? margin : W - margin - w * scale;

      return { x, y: top ? H * 0.07 : H - H * 0.07 - h * scale, scale, page };
    }
    case 'inline': {
      const scale = slot(W * 0.88, H * 0.6);
      const x = (W - w * scale) / 2;
      const y = H * 0.22 + (H * 0.6 - h * scale) / 2;

      return { x, y, scale, page, plate: plate(y, h * scale, W) };
    }
    default: {
      const scale = slot(W * 0.72, H * 0.88);

      return { x: (W - w * scale) / 2, y: (H - h * scale) / 2, scale, page };
    }
  }
}

/*
 * The plate runs the page's width and stands 2% proud of the design above and
 * below: the page's lines stop at the design's edges rather than peeking past a
 * design the cap keeps narrower than its band.
 */
function plate(y: number, height: number, pageWidth: number): Box {
  const pad = Math.max(4, pageWidth * 0.02);

  return { x: 0, y: y - pad, width: pageWidth, height: height + pad * 2 };
}
