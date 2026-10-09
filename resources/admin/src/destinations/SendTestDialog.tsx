import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from '../components/ui/admin-dialog';
import { Input } from '../components/ui/input';
import { Field } from '../shell/Field';
import { messageOf } from '../shell/loadable';
import { testSend, type Destination, type DestinationType, type TestReport } from './api';
import { targetShown } from './settings';
import { TestReportAlert } from './status';

/**
 * Inspect the explicit email sample and saved route before a real provider
 * push. A small dialog: the title is the route, the meta line says what it is
 * and where it lands, and Send test is the one action.
 */
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
  const target = targetShown(destination.target);
  const sent = result?.outcome === 'success';
  const dirty = !busy && result === null && (email !== (initialEmail ?? '') || interest !== '');
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
  const edited = () => { setResult(null); setError(null); };

  return (
    <AdminDialog open onOpenChange={(open) => { if (!open) close(); }}>
      <AdminDialogContent size="sm" dirty={dirty} showCloseButton={!busy}
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusTo.current?.focus(); }}>
        <AdminDialogHeader
          title={destination.label}
          meta={[type?.label, target].filter((part) => part !== undefined && part !== null && part !== '').join(' · ') || undefined}
        />
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <AdminDialogBody className="flex flex-col gap-4">
            <Field label={__('Test email address', 'wconvert')} htmlFor={`${id}-email`} hintId={`${id}-sample`}
              hint={sendsInterest
                ? __('Only this address and any interest value below are sent — no name or phone.', 'wconvert')
                : __('Only this email address is sent — no name or phone.', 'wconvert')}>
              <Input ref={sample} id={`${id}-email`} type="email" required autoComplete="email" disabled={busy || sent}
                value={email} onChange={(event) => { setEmail(event.target.value); edited(); }}
                aria-describedby={`${id}-sample ${id}-effect`} />
            </Field>
            {sendsInterest && <Field label={__('Test interest value (optional)', 'wconvert')} htmlFor={`${id}-interest`} hintId={`${id}-interest-help`}
              hint={__('One of your form’s option values. It is written to the mapped field for new subscribers only.', 'wconvert')}>
              <Input id={`${id}-interest`} value={interest} disabled={busy || sent}
                onChange={(event) => { setInterest(event.target.value); edited(); }} aria-describedby={`${id}-interest-help`} />
            </Field>}
            <p id={`${id}-effect`} className="m-0 text-note text-muted-foreground">
              {__('Use an address you own: the test can create or update a contact, add it to lists or tags, or send an email. It creates no lead in WConvert, and a success does not confirm subscription or inbox delivery.', 'wconvert')}
            </p>
            {settingsDirty && <p className="m-0 text-note text-warning">{__('Uses the saved settings. Save your changes first to test them.', 'wconvert')}</p>}
            {result !== null && <TestReportAlert report={result} />}
          </AdminDialogBody>
          <AdminDialogFooter error={error}
            back={!sent && <Button type="button" variant="outline" disabled={busy} onClick={close}>{__('Cancel', 'wconvert')}</Button>}>
            {sent ? <>
              <Button type="button" variant="outline" onClick={() => setResult(null)}>{__('Send another', 'wconvert')}</Button>
              <Button type="button" onClick={close}>{__('Done', 'wconvert')}</Button>
            </> : (
              <Button type="submit" disabled={busy} aria-describedby={`${id}-sample ${id}-effect`}>
                {busy ? __('Sending test…', 'wconvert') : __('Send test', 'wconvert')}
              </Button>
            )}
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialog>
  );
}
