import { useEffect, useId, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Description } from '../shell/Description';
import { messageOf } from '../shell/loadable';
import { previewMapping, readMappingFields, testMapping } from '../destinations/api';
import type { Destination, MappingSample, TestReport } from '../destinations/api';
import { targetSaid } from '../destinations/settings';
import type { Template, TemplateNode } from '@renderer/types';

const children = (node: TemplateNode): readonly TemplateNode[] => {
  const branches = node as { children?: readonly TemplateNode[]; start?: readonly TemplateNode[]; end?: readonly TemplateNode[] };
  return [...(branches.children ?? []), ...(branches.start ?? []), ...(branches.end ?? [])];
};

function sources(template: Template, submissionId: string): { id: string; label: string }[] {
  const found: { id: string; label: string }[] = [];
  const submission = template.tree.submissions.find((item) => item.id === submissionId);
  const boundary = template.tree.steps.findIndex((step) => submission?.fields.some((id) => {
    const contains = (node: TemplateNode): boolean => {
      if ((node as { id?: string }).id === id) return true;
      return children(node).some(contains);
    };
    return contains(step.content);
  }));
  const walk = (node: TemplateNode) => {
    const item = node as { type?: string; id?: string; label?: string; name?: string; hidden?: boolean };
    if (item.hidden) return;
    if (item.type === 'question' && item.id && item.label) found.push({ id: item.id, label: item.label });
    if (item.type === 'field' && (item.name === 'interest' || item.name === 'message')) found.push({ id: `field:${item.name}`, label: item.name === 'message' ? __('Message', 'wconvert') : __('Interest', 'wconvert') });
    children(node).forEach(walk);
  };
  template.tree.steps.slice(0, boundary < 0 ? 0 : boundary + 1).forEach((step) => walk(step.content));
  return found.filter((item, index) => found.findIndex((other) => other.id === item.id) === index);
}

export function ExtraAnswerMapping({ destination, submissionId, template, value, onChange }: {
  destination: Destination;
  submissionId: string;
  template: Template;
  value: Readonly<Record<string, string>>;
  onChange: (value: Record<string, string>) => void;
}) {
  const destinationId = destination.id;
  const id = useId();
  const eligible = sources(template, submissionId);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<{ value: string; label: string }[] | null>(null);
  const [refreshFields, setRefreshFields] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sample, setSample] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ email: string; mapped: Record<string, string> } | null>(null);
  const [report, setReport] = useState<TestReport | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = eligible.filter((source) => value[source.id]);
  const draft = (): MappingSample => ({ email, mapping: Object.fromEntries(selected.map((source) => [source.id, value[source.id]])), sample });
  const invalidate = () => { setPreview(null); setReport(null); setError(null); };
  const previewDraft = async () => {
    setBusy(true);
    setReport(null);
    try { setPreview(await previewMapping(destinationId, draft())); setError(null); }
    catch (cause) { setPreview(null); setError(messageOf(cause)); }
    finally { setBusy(false); }
  };
  const sendDraft = async () => {
    if (!preview) return;
    setBusy(true);
    try { setReport(await testMapping(destinationId, draft())); setError(null); }
    catch (cause) { setReport(null); setError(messageOf(cause)); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!open || eligible.length === 0) return;
    let active = true;
    setFields(null);
    setError(null);
    void readMappingFields(destinationId, refreshFields > 0).then((result) => { if (active) { setFields(result.fields); setError(null); } })
      .catch((cause) => { if (active) setError(messageOf(cause)); });
    return () => { active = false; };
  }, [open, destinationId, eligible.length, refreshFields]);
  useEffect(() => { setPreview(null); setReport(null); }, [destinationId, destination.target, destination.settings.existing_contact]);
  if (eligible.length === 0) return null;
  return <details className="mt-3 rounded-md border border-border bg-card" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded-md px-3 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{__('Send extra answers', 'wconvert')}{selected.length > 0 && <span className="ms-2 text-note text-muted-foreground">({selected.length})</span>}</summary>
    {open && <div className="flex flex-col gap-3 border-t border-border p-3">
      <Description>{__('Choose only the answers you want to send. Basic contact details are sent automatically. Changes take effect when you publish.', 'wconvert')}</Description>
      <div><Button type="button" variant="outline" onClick={() => setRefreshFields((old) => old + 1)}>{__('Refresh fields', 'wconvert')}</Button></div>
      {error && <p role="alert" className="text-warning">{error}</p>}
      {fields === null && !error && <p role="status">{__('Loading fields…', 'wconvert')}</p>}
      {fields?.length === 0 && <p>{__('No compatible text fields are available in this destination.', 'wconvert')}</p>}
      {fields && fields.length > 0 && eligible.map((source, index) => <div key={source.id} className="flex min-w-0 flex-col gap-1.5"><Label htmlFor={`${id}-target-${index}`}>{source.label}</Label>
        <select id={`${id}-target-${index}`} className="h-(--control-height) w-full min-w-0 rounded-md border border-input bg-transparent ps-3 pe-9 text-body text-foreground" value={value[source.id] ?? ''} onChange={(event) => {
          const next = { ...value };
          if (event.target.value) next[source.id] = event.target.value; else delete next[source.id];
          invalidate();
          onChange(next);
        }}>
          <option value="">{__('Do not send', 'wconvert')}</option>
          {value[source.id] && !fields.some((field) => field.value === value[source.id]) &&
            <option value={value[source.id]}>{__('Unavailable field — choose another', 'wconvert')}</option>}
          {fields.map((field) => <option key={field.value} value={field.value} disabled={Object.entries(value).some(([id, target]) => id !== source.id && target === field.value)}>{field.label}</option>)}
        </select>
      </div>)}
      {fields && selected.some((source) => !fields.some((field) => field.value === value[source.id])) &&
        <p role="alert" className="text-warning">{__('A mapped field is no longer available. Choose another field before publishing.', 'wconvert')}</p>}
      {selected.length > 0 && <div className="flex flex-col gap-3 border-t pt-3">
        <Description>{__('Try a sample before publishing. Preview does not send anything. A test send creates or updates a real contact, may join the selected list, and may trigger provider automations. Use your own address.', 'wconvert')}</Description>
        <div className="flex flex-col gap-1.5"><Label htmlFor={`${id}-email`}>{__('Your test email', 'wconvert')}</Label>
          <Input id={`${id}-email`} type="email" autoComplete="email" value={email} onChange={(event) => { invalidate(); setEmail(event.target.value); }} />
        </div>
        {selected.map((source, index) => <div key={source.id} className="flex flex-col gap-1.5"><Label htmlFor={`${id}-sample-${index}`}>{__('Sample answer:', 'wconvert')} {source.label}</Label>
          <Input id={`${id}-sample-${index}`} type="text" maxLength={500} value={sample[source.id] ?? ''} onChange={(event) => { invalidate(); setSample({ ...sample, [source.id]: event.target.value }); }} />
        </div>)}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void previewDraft()}>{__('Preview data', 'wconvert')}</Button>
          <Button type="button" disabled={busy || !preview} onClick={() => void sendDraft()}>{__('Send test contact', 'wconvert')}</Button>
        </div>
        {preview && <div className="min-w-0 border-t border-border pt-3 text-note"><strong>{__('Review this test send', 'wconvert')}</strong>
          <div className="[overflow-wrap:anywhere]">{targetSaid(destination.target) ?? destination.label}</div>
          <div className="[overflow-wrap:anywhere]">{__('Email', 'wconvert')}: {preview.email}</div>
          <div>{destination.settings.existing_contact === 'update' ? __('If this contact exists, mapped fields may be updated.', 'wconvert') : __('If this contact exists, its details are kept.', 'wconvert')}</div>
          {Object.entries(preview.mapped).map(([target, text]) => <div className="[overflow-wrap:anywhere]" key={target}>{fields?.find((field) => field.value === target)?.label ?? target}: {text}</div>)}
        </div>}
        {report && <p role="status">{report.message}</p>}
      </div>}
    </div>}
  </details>;
}
