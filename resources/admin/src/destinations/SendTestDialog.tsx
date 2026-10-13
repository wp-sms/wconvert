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
import { draftSend, testSend, type Destination, type DestinationType, type SampleAnswer, type SampleQuestion, type TestReport } from './api';
import { targetShown } from './settings';
import { TestReportAlert } from './status';

/** The most sample answers one test carries, as the server caps them. */
const MOST_ANSWERS = 32;

/** A sample a merchant can send unchanged: the first choice, the first two, or a stand-in sentence. */
export function sampleAnswer(question: SampleQuestion): string {
  if (question.answer_type === 'text' || question.options.length === 0) return __('Sample answer', 'wconvert');
  return question.answer_type === 'multi' ? question.options.slice(0, 2).join(', ') : question.options[0];
}

/** What the merchant typed, as the server takes it: a multi-choice answer is its comma-separated labels. */
function answersToSend(questions: readonly SampleQuestion[], typed: Readonly<Record<string, string>>): SampleAnswer[] {
  return questions.flatMap((question) => {
    const value = (typed[question.id] ?? '').trim();
    if (value === '') return [];
    return [{ id: question.id, question: question.label, answer: question.answer_type === 'multi'
      ? value.split(',').map((part) => part.trim()).filter((part) => part !== '') : value }];
  });
}

/**
 * Inspect the explicit email sample and saved route before a real provider
 * push. A small dialog: the title is the route, the meta line says what it is
 * and where it lands, and Send test is the one action.
 *
 * **From a campaign, a type that forwards the whole submission sends that
 * campaign's own questions** with sample answers the merchant can edit, so a
 * receiver that learns its fields from a sample can map them before the
 * first real Lead (ADR 0148). From Settings it sends the plain sample.
 */
export function SendTestDialog({
  destination, type, initialEmail, settingsDirty, returnFocusTo, onClose, onSent, campaign,
}: {
  /** Opened from a campaign: its id where it is saved, and the questions its save point asks. */
  campaign?: { optinId?: string; questions: readonly SampleQuestion[] };
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
  const questions = type?.forwards_submission && campaign ? campaign.questions.slice(0, MOST_ANSWERS) : null;
  const [samples, setSamples] = useState<Record<string, string>>(() =>
    Object.fromEntries((questions ?? []).map((question) => [question.id, sampleAnswer(question)])));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sample = useRef<HTMLInputElement>(null);
  useEffect(() => { if (result === null) sample.current?.focus(); }, [result]);
  const target = targetShown(destination.target);
  const sent = result?.outcome === 'success';
  const initialSamples = useRef(samples);
  const dirty = !busy && result === null && (email !== (initialEmail ?? '') || interest !== '' || samples !== initialSamples.current);
  const close = () => { if (!busy) onClose(); };
  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const answer = questions !== null
        ? await draftSend(destination.id, { email: email.trim(), answers: answersToSend(questions, samples),
          ...(campaign?.optinId ? { optin: campaign.optinId } : {}) })
        : sendsInterest && interest.trim() !== ''
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
              hint={questions !== null && questions.length > 0
                ? __('Only this address and the sample answers below are sent — no name or phone.', 'wconvert')
                : sendsInterest
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
            {questions !== null && questions.length > 0 && <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" disabled={busy || sent}>
              <legend className="mb-1.5 p-0 font-medium">{__('Sample answers', 'wconvert')}</legend>
              {questions.map((question) => <Field key={question.id} label={<bdi>{question.label}</bdi>} htmlFor={`${id}-q-${question.id}`}
                hint={question.answer_type === 'multi' ? __('Separate choices with commas.', 'wconvert') : undefined}
                hintId={question.answer_type === 'multi' ? `${id}-q-${question.id}-hint` : undefined}>
                <Input id={`${id}-q-${question.id}`} value={samples[question.id] ?? ''} maxLength={500}
                  aria-describedby={question.answer_type === 'multi' ? `${id}-q-${question.id}-hint` : undefined}
                  onChange={(event) => { setSamples({ ...samples, [question.id]: event.target.value }); edited(); }} />
              </Field>)}
            </fieldset>}
            <p id={`${id}-effect`} className="m-0 text-note text-muted-foreground">
              {/*
                One sentence of effect. What a success does NOT prove is the
                result's to say, beside the result, not a caveat read first.
              */}
              {type?.forwards_submission
                ? __('The test really sends, marked as a test, so your receiver may run — but it creates no lead.', 'wconvert')
                : __('Use an address you own. The test really sends — it may add a contact or send an email — but creates no lead.', 'wconvert')}
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
