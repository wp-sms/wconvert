import { __ } from '@wordpress/i18n';
import { useId } from 'react';

/** This choice belongs to the draft; it does not edit a shared connection. */
export function CaptureModeChoice({ mode, onChange, disabled = false }: { mode: string; onChange: (mode: 'connected' | 'local') => void; disabled?: boolean }) {
  const id = useId();
  return <fieldset disabled={disabled} className="mb-4 rounded-md border border-border p-4">
    <legend className="px-1 font-medium">{__('What happens after submission?', 'wconvert')}</legend>
    <div className="mb-3 flex items-start gap-2">
      <input id={`${id}-connected`} aria-describedby={`${id}-connected-help`} type="radio" name={id} value="connected" checked={mode !== 'local'} onChange={() => onChange('connected')} />
      <div><label htmlFor={`${id}-connected`} className="font-medium">{__('Send to a service', 'wconvert')}</label><p id={`${id}-connected-help`} className="m-0 text-note text-muted-foreground">{__('Recommended. Save submissions here and forward them to a selected email or SMS service. The service handles subscriptions, confirmation and messages.', 'wconvert')}</p></div>
    </div>
    <div className="flex items-start gap-2">
      <input id={`${id}-local`} aria-describedby={`${id}-local-help`} type="radio" name={id} value="local" checked={mode === 'local'} onChange={() => onChange('local')} />
      <div><label htmlFor={`${id}-local`} className="font-medium">{__('Collect only in WConvert', 'wconvert')}</label><p id={`${id}-local-help`} className="m-0 text-note text-muted-foreground">{__('Save details in Leads for review or export. No forwarding, subscription or message sending is configured. Choosing this removes selected destinations from this draft; Undo restores the choice.', 'wconvert')}</p></div>
    </div>
    {mode === 'local' && <p role="status" className="mb-0 text-note">{__('Before publishing, review the form copy: do not promise automatic emails or texts without arranging how you will send them.', 'wconvert')}</p>}
  </fieldset>;
}
