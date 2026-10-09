import { __ } from '@wordpress/i18n';
import { useId } from 'react';

/** This choice belongs to the draft; it does not edit a shared connection. */
export function CaptureModeChoice({ mode, onChange, selectedCount = 0, disabled = false }: { mode: string; onChange: (mode: 'connected' | 'local') => void; selectedCount?: number; disabled?: boolean }) {
  const id = useId();
  return <fieldset disabled={disabled} className="wconvert-capture-mode">
    <legend className="wconvert-capture-mode__legend">{__('What happens after submission?', 'wconvert')}</legend>
    <div className="wconvert-capture-mode__options">
      <label className="wconvert-radio-card">
        <input aria-labelledby={`${id}-connected`} aria-describedby={`${id}-connected-help`} type="radio" name={id} value="connected" checked={mode !== 'local'} onChange={() => onChange('connected')} />
        <span><span id={`${id}-connected`}>{__('Send to a service', 'wconvert')}</span><span id={`${id}-connected-help`}>{__('Save in Leads and forward to selected services.', 'wconvert')}</span></span>
      </label>
      <label className="wconvert-radio-card">
        <input aria-labelledby={`${id}-local`} aria-describedby={`${id}-local-help`} type="radio" name={id} value="local" checked={mode === 'local'} onChange={() => onChange('local')} />
        <span><span id={`${id}-local`}>{__('Keep in WConvert only', 'wconvert')}</span><span id={`${id}-local-help`}>{__('Save in Leads for review or export. No automatic sending.', 'wconvert')}{selectedCount > 0 && <> {__('Clears selected destinations. Undo restores them.', 'wconvert')}</>}</span></span>
      </label>
    </div>
    {mode === 'local' && <p role="status" className="mb-0 text-note">{__('Check your form copy. Automatic emails and texts need a separate sending setup.', 'wconvert')}</p>}
    {mode !== 'local' && <p className="mb-0 text-note text-muted-foreground">{__('Your service handles subscriptions, confirmation and messages.', 'wconvert')}</p>}
  </fieldset>;
}
