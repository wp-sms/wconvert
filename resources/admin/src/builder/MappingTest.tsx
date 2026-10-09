import { useId, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Disclosure } from '../shell/Disclosure';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CheckRow } from '../shell/CheckRow';
import { Description } from '../shell/Description';
import { messageOf } from '../shell/loadable';
import { previewMapping, testMapping } from '../destinations/api';
import type { Destination, MappingSample, TestReport } from '../destinations/api';
import { targetSaid } from '../destinations/settings';
import type { AnswerSource } from './answerSources';
import { answerGroups } from './answerSources';

/** Reset by the parent when the destination, fields, or mapping change. */
export function MappingTest({ destination, fields, sources, mapping }: {
  destination: Destination;
  fields: readonly { value: string; label: string }[];
  sources: readonly AnswerSource[];
  mapping: Record<string, string>;
}) {
  const id = useId();
  const emailInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [sample, setSample] = useState<MappingSample['sample']>({});
  const [preview, setPreview] = useState<{ draft: MappingSample; email: string; mapped: Record<string, string | true> } | null>(null);
  const [report, setReport] = useState<TestReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null);
  const invalidate = () => { setPreview(null); setReport(null); setError(null); };
  const previewDraft = async () => {
    if (!email.trim()) { setError(__('Enter your test email before previewing.', 'wconvert')); emailInput.current?.focus(); return; }
    if (!emailInput.current?.reportValidity()) return;
    const draft = { email, mapping, sample: Object.fromEntries(sources.map((source) => [source.id, sample[source.id] ?? (source.type === 'boolean' ? false : '')])) };
    invalidate();
    setBusy('preview');
    try { setPreview({ ...await previewMapping(destination.id, draft), draft }); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(null); }
  };
  const sendDraft = async () => {
    if (!preview || busy) return;
    setBusy('send');
    setReport(null);
    setError(null);
    try { setReport(await testMapping(destination.id, preview.draft)); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(null); }
  };
  return <Disclosure variant="inline" className="border-t border-border" title={__('Preview and test mapping', 'wconvert')}>
    <div className="flex min-w-0 flex-col gap-3">
      <Description>{__('Try sample answers before sending a test contact.', 'wconvert')}</Description>
      <fieldset disabled={busy !== null} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <div className="flex flex-col gap-1.5"><Label htmlFor={`${id}-email`}>{__('Your test email', 'wconvert')}</Label>
          <Input id={`${id}-email`} ref={emailInput} type="email" autoComplete="email" value={email} onChange={(event) => { invalidate(); setEmail(event.target.value); }} />
        </div>
        {answerGroups(sources).map((group) => <fieldset key={group.id} className="m-0 min-w-0 space-y-2 border-0 p-0">
          {group.choices.length > 0 && <>
            <legend className="mb-2 text-body font-medium [overflow-wrap:anywhere]">{group.label}</legend>
            <div className="flex flex-wrap gap-2">
              {group.choices.map((source) => <CheckRow key={source.id} id={`${id}-${source.id}`} aria-label={`${__('Sample answer:', 'wconvert')} ${source.label}`}
                className="[overflow-wrap:anywhere]" checked={sample[source.id] === true}
                onChange={(event) => { invalidate(); setSample({ ...sample, [source.id]: event.target.checked }); }}
                label={source.choice?.label ?? source.label} />)}
            </div>
          </>}
          {group.answer && <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${id}-${group.answer.id}`} className="[overflow-wrap:anywhere]">{__('Sample answer:', 'wconvert')} {group.answer.label}</Label>
            <Input id={`${id}-${group.answer.id}`} type="text" maxLength={500} value={String(sample[group.answer.id] ?? '')} onChange={(event) => { invalidate(); setSample({ ...sample, [group.answer!.id]: event.target.value }); }} />
          </div>}
        </fieldset>)}
        <Description>{__('Blank answers and unchecked interests are omitted; they do not clear existing values.', 'wconvert')}</Description>
        <div><Button type="button" variant="outline" onClick={() => void previewDraft()}>{busy === 'preview' ? __('Preparing preview…', 'wconvert') : __('Preview data', 'wconvert')}</Button></div>
      </fieldset>
      {preview && <div className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-surface p-3 text-note" aria-live="polite">
        <strong>{__('Review this test send', 'wconvert')}</strong>
        <span className="[overflow-wrap:anywhere]">{targetSaid(destination.target) ?? destination.label}</span>
        <dl className="m-0 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 [overflow-wrap:anywhere]">
          <dt className="text-muted-foreground">{__('Email', 'wconvert')}</dt><dd className="m-0">{preview.email}</dd>
          {Object.entries(preview.mapped).map(([target, text]) => <MappingValue key={target} label={fields.find((field) => field.value === target)?.label ?? target} text={text} />)}
        </dl>
        {Object.keys(preview.mapped).length === 0 && <Description>{__('No extra answers in this sample. Enter an answer above to check its mapping.', 'wconvert')}</Description>}
        <Description>{destination.settings.existing_contact === 'update' ? __('If this contact exists, mapped fields may be updated.', 'wconvert') : __('If this contact exists, its details are kept.', 'wconvert')}</Description>
        <Description>{__('A test sends a real contact and may add it to the selected audience or list and trigger automations. Use your own address.', 'wconvert')}</Description>
        <div><Button type="button" disabled={busy !== null || report?.outcome === 'success' || Object.keys(preview.mapped).length === 0} onClick={() => void sendDraft()}>{busy === 'send' ? __('Sending test contact…', 'wconvert') : __('Send test contact', 'wconvert')}</Button></div>
      </div>}
      {error && <p role="alert" className="m-0 text-note text-destructive">{error}</p>}
      {report && <p role="status" className="m-0 text-note">{report.message}</p>}
    </div>
  </Disclosure>;
}

function MappingValue({ label, text }: { label: string; text: string | true }) {
  return <><dt className="text-muted-foreground">{label}</dt><dd className="m-0 whitespace-pre-wrap">{text === true ? __('Yes', 'wconvert') : text}</dd></>;
}
