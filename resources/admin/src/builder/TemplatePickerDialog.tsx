import { useState } from 'react';
import { Button } from '../components/ui/button';
import { TemplatePacks } from '../templates/TemplatePacks';
import { __ } from '@wordpress/i18n';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { TemplatePicker, type TemplatePickerProps } from './TemplatePicker';

export interface TemplatePickerDialogProps extends TemplatePickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onClosed?: () => void;
  readonly onCatalogInstalled?: () => Promise<void>;
}

/** The library owns one dialog; inspecting a design stays within that surface. */
export function TemplatePickerDialog({ open, onOpenChange, onClosed, onCatalogInstalled, ...picker }: TemplatePickerDialogProps) {
  const [packs, setPacks] = useState(false);
  const [inspectId, setInspectId] = useState<string | undefined>();
  const format = ({
    popup: __('Popup', 'wconvert'),
    inline: __('Inline', 'wconvert'),
    floating_bar: __('Floating bar', 'wconvert'),
    slide_in: __('Slide-in', 'wconvert'),
  } as Record<string, string>)[picker.displayType] ?? picker.displayType;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wconvert-picker gap-0 overflow-hidden p-0 sm:max-w-[80rem]"
        onCloseAutoFocus={(event) => {
          if (onClosed) { event.preventDefault(); onClosed(); }
        }}>
        <DialogHeader className="wconvert-picker__header">
          <DialogTitle>{__('Browse designs', 'wconvert')}</DialogTitle>
          <DialogDescription>
            {format} · {__('Preview every screen before applying a design.', 'wconvert')}
          </DialogDescription>
        </DialogHeader>
        {onCatalogInstalled && <div className="flex gap-2 border-b px-6 py-2" role="group" aria-label={__('Library source', 'wconvert')}>
          <Button variant={packs ? "ghost" : "secondary"} aria-pressed={!packs} onClick={() => setPacks(false)}>{__('Your designs', 'wconvert')}</Button>
          <Button variant={packs ? "secondary" : "ghost"} aria-pressed={packs} onClick={() => setPacks(true)}>{__('Template packs', 'wconvert')}</Button>
        </div>}
        <div className="wconvert-picker__scroll">
          {packs && onCatalogInstalled ? <TemplatePacks displayType={picker.displayType} onInstalled={onCatalogInstalled}
            onInspect={(id) => { picker.onNear(id); setInspectId(id); setPacks(false); }} /> :
            <TemplatePicker key={`${picker.displayType}:${inspectId ?? ''}`} {...picker} initialInspectedId={inspectId} active={open} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
