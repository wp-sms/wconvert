import { useState, type ReactNode, type RefObject } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { AdminDialogFooter } from '../components/ui/admin-dialog';
import { Button } from '../components/ui/button';
import { Dialog, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { PickerDialogBody, PickerDialogContent, PickerDialogHeader } from '../discovery/PickerDialog';
import { OptionStrip } from '../shell/OptionStrip';
import { DesignStage } from '../stage/DesignStage';
import type { Template } from '@renderer/types';
import { TemplateMarks } from './GalleryCard';
import type { GalleryCard } from './model';

/** The header's one line about a template at its inspect size, for whichever modal holds it. */
export function InspectDescription({ card }: { card: GalleryCard }) {
  return card.designName && card.designName !== card.name
    ? <DialogDescription>{sprintf(/* translators: %s: a design's name. */ __('Layout: %s', 'wconvert'), card.designName)}</DialogDescription>
    : <DialogDescription className="sr-only">{__('A larger preview of this template.', 'wconvert')}</DialogDescription>;
}

/**
 * A template at its inspect size (ADR 0171): Desktop or Mobile, Fit or Actual
 * size, its screens and the gist in the one scroll body, and the card's action
 * with anything that went wrong with it in the fixed footer beside Back, so
 * both stay reachable in a short or phone window (§9).
 *
 * It renders the inside of a picker's modal. Creation holds it in
 * `InspectDialog`; Change template opens it in place, over its grid.
 */
export function InspectView({ card, template, gist, action, error = null, conversion = null, current = false, busy = false, onBack }: {
  card: GalleryCard;
  /** The live tree, for a template on this site; an online one is its picture. */
  template?: Template;
  gist?: string;
  /** The card's one action. */
  action: ReactNode;
  /** What went wrong with it, said beside it. */
  error?: ReactNode;
  conversion?: { readonly chip: string } | null;
  current?: boolean;
  busy?: boolean;
  onBack: () => void;
}) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>(() => window.innerWidth < 640 ? 'mobile' : 'desktop');
  const [zoom, setZoom] = useState<'fit' | 'actual'>('fit');
  const [step, setStep] = useState(0);
  const screens = template?.tree.steps ?? [];

  return <>
    <PickerDialogBody className="p-0">
      <div className="wconvert-inspect">
        <div className="wconvert-inspect__view">
          <div className="wconvert-inspect__bar">
            <OptionStrip label={__('Device', 'wconvert')} value={device} onChange={value => setDevice(value === 'mobile' ? 'mobile' : 'desktop')}
              options={[{ value: 'desktop', label: __('Desktop', 'wconvert') }, { value: 'mobile', label: __('Mobile', 'wconvert') }]} />
            {device === 'desktop' && <OptionStrip label={__('Zoom', 'wconvert')} value={zoom} onChange={value => setZoom(value === 'actual' ? 'actual' : 'fit')}
              options={[{ value: 'fit', label: __('Fit', 'wconvert') }, { value: 'actual', label: __('Actual size', 'wconvert') }]} />}
          </div>
          <div className="wconvert-inspect__stage">
            <DesignStage displayType={card.displayType} size="inspect" device={device} zoom={zoom} step={step} interactive={template !== undefined}
              source={template ? { live: { template } } : card.thumbnail ? { image: card.thumbnail } : undefined}
              region={{ label: __('Scrollable design preview', 'wconvert') }} />
          </div>
        </div>
        <div className="wconvert-inspect__about">
          <TemplateMarks card={card} conversion={conversion} current={current} />
          {gist && <p className="text-note text-muted-foreground">{gist}</p>}
          {screens.length > 1 && <div className="grid gap-1.5">
            <span className="text-note text-muted-foreground">{__('Screens', 'wconvert')}</span>
            <OptionStrip label={__('Screens', 'wconvert')} value={String(step)} onChange={value => setStep(Number(value))}
              options={screens.map((screen, index) => ({ value: String(index), label: screen.name || __('Screen', 'wconvert') }))} />
          </div>}
        </div>
      </div>
    </PickerDialogBody>
    <AdminDialogFooter error={error} note={current ? __('This is the current template.', 'wconvert') : undefined}
      back={<Button type="button" className="wconvert-picker__back" variant="outline" disabled={busy} onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back to templates', 'wconvert')}
      </Button>}>
      {!current && action}
    </AdminDialogFooter>
  </>;
}

/** The inspect view as a modal of its own, for a gallery that is a page rather than a dialog. */
export function InspectDialog({ card, onClose, returnFocusTo, ...view }: Omit<Parameters<typeof InspectView>[0], 'card' | 'onBack'> & {
  card: GalleryCard | null;
  onClose: () => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog open={card !== null} onOpenChange={open => { if (!open) onClose(); }}>
      {card && <PickerDialogContent className="wconvert-inspect-dialog" onCloseAutoFocus={event => {
        if (!returnFocusTo?.current?.isConnected) return;
        event.preventDefault();
        returnFocusTo.current.focus({ preventScroll: true });
      }}>
        <PickerDialogHeader>
          <DialogTitle>{card.name}</DialogTitle>
          <InspectDescription card={card} />
        </PickerDialogHeader>
        <InspectView key={card.key} card={card} onBack={onClose} {...view} />
      </PickerDialogContent>}
    </Dialog>
  );
}
