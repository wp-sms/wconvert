import { useEffect, type CSSProperties, type Ref } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { BrandMark } from './Brand';

/**
 * The builder in the shape of the builder, and the way out of it.
 *
 * ============================================================================
 * IT IS HERE BECAUSE IT HAS TO LOAD BEFORE THE BUILDER DOES (#73).
 * ============================================================================
 * The builder is behind a lazy boundary, so opening it is a network fetch
 * before a single component of it exists. Whatever stands in that gap cannot
 * live inside the chunk it is waiting for — a fallback shipped with the thing
 * it is a fallback for is a blank frame — so it lives out here with the
 * reading screens and costs them these few lines.
 *
 * **And it is the same skeleton the builder's own first fetch draws.** The gap
 * is two waits end to end: the chunk arrives, then `getOptin` does. Two
 * different placeholders across those two moments is a screen that redraws
 * itself for no reason a merchant can see, so {@see OptinBuilder} renders this
 * one too and the wait reads as one wait.
 *
 * **The frame is the editor's own, not a copy of it.** The workspace box and
 * its header band are `.wconvert-workspace` and `.wconvert-workspace__header`,
 * whose rules are eager in `index.css` for exactly this, and the panes are
 * laid out from the same `--editor-tree` and `--editor-panel` the Edit tab
 * reads. So the header is the real one — the icon Back with its label, the
 * mark, the name and status, the three tabs in line, the actions — and the
 * Canvas/Flow row, screen tree, canvas and inspector sit where they will.
 * Nothing but the status line is announced: a grid of announced boxes is a
 * spinner read aloud.
 */
export function BuilderSkeleton({ onClose, backLabel }: { onClose: () => void; backLabel?: string }) {
  useEditingFrame();
  const bar = (className: string, style?: CSSProperties) => <Skeleton className={className} style={style} />;
  const back = backLabel ?? __('Back to campaigns', 'wconvert');
  return (
    <div className="wconvert-workspace wconvert-builder-skeleton">
      <p role="status" className="sr-only">{__('Loading campaign builder…', 'wconvert')}</p>
      <header className="wconvert-workspace__header">
        <Button type="button" variant="ghost" size="icon-sm" aria-label={back} title={back} onClick={onClose}>
          <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
        </Button>
        <BrandMark className="wconvert-workspace__brand-mark" />
        <div className="wconvert-workspace__identity" aria-hidden="true">{bar('h-8 w-36')}{bar('h-5 w-10')}</div>
        <div className="wconvert-workspace__navigation wconvert-builder-skeleton__tabs" aria-hidden="true">
          {bar('w-11', { blockSize: 31 })}{bar('w-[103px]', { blockSize: 31 })}{bar('w-[101px]', { blockSize: 31 })}
        </div>
        <div className="wconvert-workspace__actions" aria-hidden="true">
          {bar('wconvert-builder-skeleton__history h-8 w-[66px]')}
          {bar('w-[102px]', { blockSize: 'var(--control-height)' })}{bar('w-[102px]', { blockSize: 'var(--control-height)' })}
          {bar('w-[173px]', { blockSize: 'var(--control-height)' })}{bar('size-8')}
        </div>
      </header>
      <div className="wconvert-builder-skeleton__view" aria-hidden="true">{bar('h-8 w-[66px]')}{bar('h-8 w-[50px]')}</div>
      <div className="wconvert-builder-skeleton__body" aria-hidden="true">
        <div className="wconvert-builder-skeleton__tree">
          {bar('h-10 w-full')}
          {bar('mt-2 h-[83px] w-full')}
          {[0, 1, 2, 3].map((row) => <Skeleton key={row} className={row === 0 ? 'mt-2 h-11 w-full' : 'h-8 w-full'} />)}
        </div>
        <div className="wconvert-builder-skeleton__canvas">
          <div className="wconvert-builder-skeleton__bar">{bar('h-8 w-[74px]')}{bar('h-8 w-[62px]')}</div>
          <div className="wconvert-builder-skeleton__stage">{bar('wconvert-builder-skeleton__design')}</div>
        </div>
        <div className="wconvert-builder-skeleton__panel">
          <div className="wconvert-builder-skeleton__panel-head">{bar('size-8 shrink-0')}<span className="grid flex-1 gap-1.5">{bar('h-4 w-24')}{bar('h-3 w-14')}</span></div>
          {[0, 1, 2, 3].map((field) => <div key={field} className="grid gap-2">{bar('h-3 w-24')}{bar('w-full', { blockSize: 'var(--control-height)' })}</div>)}
        </div>
      </div>
    </div>
  );
}

/**
 * The editing frame on `<body>`: no footer, no bottom gutter, the phone
 * margin WordPress takes back. Counted, because the skeleton and the editor
 * both hold it across the hand-off — the editor mounts and holds it, then the
 * skeleton inside it unmounts, and a plain add/remove pair would have taken
 * the class off the editor that still needs it.
 */
let editingHolds = 0;
export function useEditingFrame(): void {
  useEffect(() => {
    editingHolds += 1;
    document.body.classList.add('wconvert-editing');
    return () => {
      editingHolds -= 1;
      if (editingHolds === 0) document.body.classList.remove('wconvert-editing');
    };
  }, []);
}

/**
 * The way out of the builder.
 *
 * It is a button because leaving an unsaved editor needs a decision before
 * accepting the destination route. The route itself remains bookmarkable.
 *
 * **It lives out here so the skeleton can carry it.** A merchant who opened the
 * builder on a slow connection must be able to leave again before the chunk
 * lands, and the control that leaves cannot be inside the chunk. So the
 * skeleton above and {@see OptinBuilder} render the same component, in the same
 * band, and the way out does not move when the wait ends.
 *
 * App also uses this over the creation flow. Narrow editors use the same
 * header and navigation guard as wide editors.
 *
 * It takes a ref because it is what the unsaved-changes confirm has to put the
 * caret back on — a triggerless dialog restores focus to nothing, which leaves
 * a keyboard merchant on `<body>` ({@see ConfirmDialog}).
 */
export function BackLink({
  onClose,
  ref,
  className,
  label,
  disabled = false,
}: {
  onClose: () => void;
  ref?: Ref<HTMLButtonElement>;
  className?: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      <Button ref={ref} variant="ghost" className="-ms-3" onClick={onClose} disabled={disabled}>
        {/* Back is the other way in Persian; see {@see GoalScreen}'s footer. */}
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
        {label ?? __('Back to Campaigns', 'wconvert')}
      </Button>
    </div>
  );
}
