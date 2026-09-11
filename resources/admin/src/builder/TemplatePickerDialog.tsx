import { __ } from '@wordpress/i18n';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { TemplatePicker, type TemplatePickerProps } from './TemplatePicker';

export interface TemplatePickerDialogProps extends TemplatePickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onClosed?: () => void;
}

/** The library owns one dialog; inspecting a design stays within that surface. */
export function TemplatePickerDialog({ open, onOpenChange, onClosed, ...picker }: TemplatePickerDialogProps) {
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
        <div className="wconvert-picker__scroll">
          <TemplatePicker key={picker.displayType} {...picker} active={open} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
