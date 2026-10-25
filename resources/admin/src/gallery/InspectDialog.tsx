import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Dialog, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { PickerDialogBody, PickerDialogContent, PickerDialogHeader } from '../discovery/PickerDialog';
import { OptionStrip } from '../shell/OptionStrip';
import { DesignStage } from '../stage/DesignStage';
import type { Template } from '@renderer/types';
import { TemplateMarks } from './GalleryCard';
import type { GalleryCard } from './model';

/**
 * A template at its inspect size (ADR 0171): Desktop or Mobile, Fit or Actual
 * size, its screens, the gist, and the card's one action.
 */
export function InspectDialog({ card, template, gist, action, conversion = null, current = false, onClose, returnFocusTo }: {
  card: GalleryCard | null;
  /** The live tree, for a template on this site; an online one is its picture. */
  template?: Template;
  gist?: string;
  /** The card's one action, and anything that went wrong with it. */
  action: ReactNode;
  conversion?: { readonly chip: string } | null;
  current?: boolean;
  onClose: () => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>(() => window.innerWidth < 640 ? 'mobile' : 'desktop');
  const [zoom, setZoom] = useState<'fit' | 'actual'>('fit');
  const [step, setStep] = useState(0);
  const key = card?.key;

  useEffect(() => { setStep(0); }, [key]);

  const screens = template?.tree.steps ?? [];

  return (
    <Dialog open={card !== null} onOpenChange={open => { if (!open) onClose(); }}>
      {card && <PickerDialogContent className="wconvert-inspect-dialog" onCloseAutoFocus={event => {
        if (!returnFocusTo?.current?.isConnected) return;
        event.preventDefault();
        returnFocusTo.current.focus({ preventScroll: true });
      }}>
        <PickerDialogHeader>
          <DialogTitle>{card.name}</DialogTitle>
          {card.designName && card.designName !== card.name
            ? <DialogDescription>{sprintf(/* translators: %s: a design's name. */ __('Design: %s', 'wconvert'), card.designName)}</DialogDescription>
            : <DialogDescription className="sr-only">{__('A larger preview of this template.', 'wconvert')}</DialogDescription>}
        </PickerDialogHeader>
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
              {current ? <p className="text-note text-muted-foreground">{__('This is the current template.', 'wconvert')}</p> : <div className="grid gap-2">{action}</div>}
            </div>
          </div>
        </PickerDialogBody>
      </PickerDialogContent>}
    </Dialog>
  );
}
