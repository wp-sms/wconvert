import { useEffect, useRef, useState } from 'react';
import { Badge } from '../components/ui/badge';
import { OptionStrip } from '../shell/OptionStrip';
import { TemplatePacks } from '../templates/TemplatePacks';
import { __ } from '@wordpress/i18n';
import {
  Dialog, DialogDescription, DialogTitle,
} from '../components/ui/dialog';
import { PickerDialogContent, PickerDialogHeader } from '../discovery/PickerDialog';
import { TemplatePicker, type TemplatePickerProps } from './TemplatePicker';
import { designMeta } from './TemplateDesignDetail';
import type { TemplateIndexEntry } from '../templates/api';

export interface TemplatePickerDialogProps extends TemplatePickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onClosed?: () => void;
  readonly onCatalogInstalled?: () => Promise<void>;
}

/**
 * The library owns one dialog; inspecting a design stays within that surface.
 * While a design is inspected the header is that design — its name, whether it
 * is the current one, and what it is — and the library switch steps aside
 * (ADR 0137).
 */
export function TemplatePickerDialog({ open, onOpenChange, onClosed, onCatalogInstalled, ...picker }: TemplatePickerDialogProps) {
  const [packs, setPacks] = useState(false);
  const [inspectId, setInspectId] = useState<string | undefined>();
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const displayType = selectedFormat ?? picker.displayType;
  const [inspected, setInspected] = useState<TemplateIndexEntry | undefined>();
  const title = useRef<HTMLHeadingElement>(null);
  const shown = packs ? undefined : inspected;
  // Opening a design moves the caret to its name, as the setup preview does.
  const shownId = shown?.id;
  useEffect(() => { if (shownId) title.current?.focus({ preventScroll: true }); }, [shownId]);
  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) { setSelectedFormat(null); setInspectId(undefined); setPacks(false); setInspected(undefined); }
      onOpenChange(next);
    }}>
      <PickerDialogContent
        onCloseAutoFocus={(event) => {
          if (onClosed) { event.preventDefault(); onClosed(); }
        }}>
        <PickerDialogHeader className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-3 text-start">
          <div className="wconvert-picker__identity">
            <DialogTitle ref={title} tabIndex={-1}>{shown ? shown.name : packs ? __('Template packs','wconvert') : __('Browse designs', 'wconvert')}</DialogTitle>
            {shown && shown.id === picker.chosen && <Badge variant="secondary">{__('Current design', 'wconvert')}</Badge>}
          </div>
          <DialogDescription>{shown ? designMeta(shown, picker.index.labels) : packs ? __('Packs add designs to your library.','wconvert') : __('Review a design with your content before it replaces this draft’s design.','wconvert')}</DialogDescription>
          {onCatalogInstalled && !shown && <OptionStrip label={__('Library source','wconvert')} value={packs ? 'packs' : 'designs'} disabled={picker.busy}
            options={[{value:'designs',label:__('Your designs','wconvert')},{value:'packs',label:__('Template packs','wconvert')}]}
            onChange={value=>setPacks(value==='packs')} />}
        </PickerDialogHeader>
        <div className="wconvert-picker__scroll">
          {packs && onCatalogInstalled && <TemplatePacks displayType={displayType} onInstalled={onCatalogInstalled}
            onInspect={(id) => { picker.onNear(id); setInspectId(id); setPacks(false); }} />}
          <div className="wconvert-picker__library" hidden={packs}>
            <TemplatePicker {...picker} displayType={displayType} onFormatChange={value => { setSelectedFormat(value); setInspectId(undefined); }} currentDisplayType={picker.displayType}
              onChoose={(id, prepared) => { picker.onChoose(id, prepared); setSelectedFormat(null); setInspectId(undefined); }}
              initialInspectedId={inspectId} active={open && !packs} onInspectedChange={setInspected} />
          </div>
        </div>
      </PickerDialogContent>
    </Dialog>
  );
}
