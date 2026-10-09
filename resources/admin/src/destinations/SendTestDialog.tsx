import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Description } from '../shell/Description';
import { messageOf } from '../shell/loadable';
import { testSend, type Destination, type DestinationType, type TestReport } from './api';
import { targetSaid } from './settings';

/** Inspect the explicit email sample and saved route before a real provider push. */
export function SendTestDialog({
  destination, type, initialEmail, settingsDirty, returnFocusTo, onClose, onSent,
}: {
  destination: Destination;
  type?: DestinationType;
  initialEmail: string | null;
  settingsDirty: boolean;
  returnFocusTo: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSent: (report: TestReport) => void;
}) {
  const id = useId();
  const [email, setEmail] = useState(initialEmail ?? '');
  const [interest, setInterest] = useState('');
  const interestMapping = destination.requirements?.mapped_fields.interest;
  const sendsInterest = interestMapping !== undefined && typeof destination.settings[interestMapping.setting] === 'string'
    && String(destination.settings[interestMapping.setting]).trim() !== '';
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sample = useRef<HTMLInputElement>(null);
  useEffect(() => { if (result === null) sample.current?.focus(); }, [result]);
  const target = targetSaid(destination.target);
  const close = () => { if (!busy) onClose(); };
  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const answer = sendsInterest && interest.trim() !== ''
        ? await testSend(destination.id, email.trim(), interest.trim())
        : await testSend(destination.id, email.trim());
      setResult(answer);
      onSent(answer);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-xl" showCloseButton={!busy}
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusTo.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>{sprintf(__('Send a test to %s', 'wconvert'), destination.label)}</DialogTitle>
          <DialogDescription>
            {__('Review the sample and destination before sending. This is a real action in the receiving service.', 'wconvert')}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-surface p-3">
          {type && <p className="m-0 font-medium">{type.label}</p>}
          {target !== null && <p className="m-0">{target}</p>}
          <Description>{__('Uses this destination’s saved settings.', 'wconvert')}</Description>
          {settingsDirty && <p className="mb-0 text-note text-warning">{__('There are unsaved settings on this page. Save them first if the test should use those changes.', 'wconvert')}</p>}
        </div>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-email`}>{__('Test email address', 'wconvert')}</Label>
            <Input ref={sample} id={`${id}-email`} type="email" required autoComplete="email" disabled={busy || result?.outcome === 'success'}
              value={email} onChange={(event) => { setEmail(event.target.value); setResult(null); setError(null); }}
              aria-describedby={`${id}-sample ${id}-effect`} />
            <Description id={`${id}-sample`}>{sendsInterest
              ? __('The email address and any interest value you enter are sent. No name or phone is included.', 'wconvert')
              : __('Only this email address is sent. No name or phone is included in the sample.', 'wconvert')}</Description>
          </div>
          {sendsInterest && <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-interest`}>{__('Test interest value (optional)', 'wconvert')}</Label>
            <Input id={`${id}-interest`} value={interest} disabled={busy || result?.outcome === 'success'}
              onChange={(event) => { setInterest(event.target.value); setResult(null); setError(null); }} aria-describedby={`${id}-interest-help`} />
            <Description id={`${id}-interest-help`}>{__('Enter one of your form’s stable option values. It is written to the mapped field for new subscribers only; existing subscriber fields stay unchanged.', 'wconvert')}</Description>
          </div>}
          <div id={`${id}-effect`} className="text-note text-muted-foreground">
            <p className="mt-0">{__('Use an address you own. Depending on this destination, the test can create or update a contact, add it to selected lists or tags, or send an email.', 'wconvert')}</p>
            <p>{__('It creates no lead and changes no reports in WConvert. A successful handoff does not confirm subscription or inbox delivery.', 'wconvert')}</p>
          </div>
          {error !== null && <p role="alert" className="m-0 rounded-md border border-destructive/30 bg-destructive-surface p-3 text-destructive">{error}</p>}
          {result !== null && <p role={result.outcome === 'failed' ? 'alert' : 'status'}
            className={`m-0 rounded-md border p-3 ${result.outcome === 'failed' ? 'border-destructive/30 bg-destructive-surface text-destructive' : 'border-border bg-surface'}`}>
            {result.message}
          </p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={close}>{result?.outcome === 'success' ? __('Done', 'wconvert') : __('Cancel', 'wconvert')}</Button>
            {result?.outcome === 'success' ? (
              <Button type="button" variant="outline" onClick={() => setResult(null)}>{__('Prepare another test', 'wconvert')}</Button>
            ) : (
              <Button type="submit" disabled={busy} aria-describedby={`${id}-sample ${id}-effect`}>
                {busy ? __('Sending test…', 'wconvert') : __('Send test', 'wconvert')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
