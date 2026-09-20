import { __ } from '@wordpress/i18n';
import { useId } from 'react';

/** This choice belongs to the draft; it does not edit a shared connection. */
export function CaptureModeChoice({ mode, onChange, selectedCount = 0, disabled = false }: { mode: string; onChange: (mode: 'connected' | 'local') => void; selectedCount?: number; disabled?: boolean }) {
  const id = useId();
  return <fieldset disabled={disabled} className="wconvert-capture-mode mb-3 rounded-md border border-border p-3">
    <legend className="px-1 font-medium">{__('What happens after submission?', 'wconvert')}</legend>
    <div className="mb-3 flex items-start gap-2">
      <input id={`${id}-connected`} aria-describedby={`${id}-connected-help`} type="radio" name={id} value="connected" checked={mode !== 'local'} onChange={() => onChange('connected')} />
      <div><label htmlFor={`${id}-connected`} className="font-medium">{__('Send to a service', 'wconvert')}</label><p id={`${id}-connected-help`} className="m-0 text-note text-muted-foreground">{__('Save in Leads and forward to selected services.', 'wconvert')}</p></div>
    </div>
    <div className="flex items-start gap-2">
      <input id={`${id}-local`} aria-describedby={`${id}-local-help`} type="radio" name={id} value="local" checked={mode === 'local'} onChange={() => onChange('local')} />
      <div><label htmlFor={`${id}-local`} className="font-medium">{__('Collect only in WConvert', 'wconvert')}</label><p id={`${id}-local-help`} className="m-0 text-note text-muted-foreground">{__('Save in Leads for review or export. No automatic sending.', 'wconvert')}{selectedCount > 0 && <> {__('Clears selected destinations. Undo restores them.', 'wconvert')}</>}</p></div>
    </div>
    {mode === 'local' && <p role="status" className="mb-0 text-note">{__('Check your form copy. Automatic emails and texts need a separate sending setup.', 'wconvert')}</p>}
    {mode !== 'local' && <p className="mb-0 text-note text-muted-foreground">{__('Your service handles subscriptions, confirmation and messages.', 'wconvert')}</p>}
  </fieldset>;
}
