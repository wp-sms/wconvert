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
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const displayType = selectedFormat ?? picker.displayType;
  const formats: Record<string, string> = {
    popup: __('Popup', 'wconvert'),
    inline: __('Inline', 'wconvert'),
    floating_bar: __('Floating bar', 'wconvert'),
    slide_in: __('Slide-in', 'wconvert'),
  };
  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) { setSelectedFormat(null); setInspectId(undefined); }
      onOpenChange(next);
    }}>
      <DialogContent className="wconvert-picker gap-0 overflow-hidden p-0 sm:max-w-[80rem]"
        onCloseAutoFocus={(event) => {
          if (onClosed) { event.preventDefault(); onClosed(); }
        }}>
        <DialogHeader className="wconvert-picker__header flex-row flex-wrap items-center justify-between gap-x-6 gap-y-3 text-start">
          <div className="wconvert-picker__identity">
            <DialogTitle>{__('Browse designs', 'wconvert')}</DialogTitle>
            <label className="flex items-center gap-2 text-note">
              {__('Format', 'wconvert')}
              <select className="rounded border border-input bg-background px-3 py-2" value={displayType}
                onChange={(event) => { setSelectedFormat(event.target.value); setInspectId(undefined); }}>
                {Object.entries(formats).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <DialogDescription className="sr-only">{__('Preview every screen before applying a design.', 'wconvert')}</DialogDescription>
          {onCatalogInstalled && <div className="wconvert-segmented inline-flex" role="group" aria-label={__('Library source', 'wconvert')}>
            <Button variant="ghost" aria-pressed={!packs} onClick={() => setPacks(false)}>{__('Your designs', 'wconvert')}</Button>
            <Button variant="ghost" aria-pressed={packs} onClick={() => setPacks(true)}>{__('Template packs', 'wconvert')}</Button>
          </div>}
        </DialogHeader>
        <p className="m-0 px-6 py-3 text-note text-muted-foreground" role="status">
          {displayType === 'inline'
            ? __('Inline campaigns appear where you place their block or shortcode. Applying a design updates its format too; review placement before publishing.', 'wconvert')
            : __('Applying a design updates its format too. Review display rules before publishing. Browsing does not change your draft.', 'wconvert')}
        </p>
        <div className="wconvert-picker__scroll">
          {packs && onCatalogInstalled ? <TemplatePacks displayType={displayType} onInstalled={onCatalogInstalled}
            onInspect={(id) => { picker.onNear(id); setInspectId(id); setPacks(false); }} /> :
            <TemplatePicker key={`${displayType}:${inspectId ?? ''}`} {...picker} displayType={displayType}
              onChoose={(id, prepared) => { picker.onChoose(id, prepared); setSelectedFormat(null); setInspectId(undefined); }}
              initialInspectedId={inspectId} active={open} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
