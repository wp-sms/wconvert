import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Description } from '../shell/Description';
import { messageOf } from '../shell/loadable';
import { previewMapping, readMappingFields, testMapping } from '../destinations/api';
import type { MappingSample, TestReport } from '../destinations/api';
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

export function ExtraAnswerMapping({ destinationId, submissionId, template, value, onChange }: {
  destinationId: string;
  submissionId: string;
  template: Template;
  value: Readonly<Record<string, string>>;
  onChange: (value: Record<string, string>) => void;
}) {
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
    void readMappingFields(destinationId, refreshFields > 0).then((result) => { if (active) { setFields(result.fields); setError(null); } })
      .catch((cause) => { if (active) setError(messageOf(cause)); });
    return () => { active = false; };
  }, [open, destinationId, eligible.length, refreshFields]);
  useEffect(() => { setPreview(null); setReport(null); }, [destinationId]);
  if (eligible.length === 0) return null;
  return <div className="mt-2">
    <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(!open)}>{__('Send extra answers', 'wconvert')}</Button>
    {open && <div className="mt-2 flex flex-col gap-3 rounded-md border p-3">
      <Description>{__('Choose only the answers you want to send. Basic contact details are sent automatically. Changes take effect when you publish.', 'wconvert')}</Description>
      <Button type="button" size="sm" variant="outline" onClick={() => setRefreshFields((old) => old + 1)}>{__('Refresh fields', 'wconvert')}</Button>
      {error && <p role="alert" className="text-warning">{error}</p>}
      {fields === null && !error && <p>{__('Loading fields…', 'wconvert')}</p>}
      {fields?.length === 0 && <p>{__('No compatible text fields are available in this destination.', 'wconvert')}</p>}
      {fields && fields.length > 0 && eligible.map((source) => <label key={source.id} className="flex flex-col gap-1 text-note">{source.label}
        <select className="rounded-md border border-input bg-background p-2" value={value[source.id] ?? ''} onChange={(event) => {
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
      </label>)}
      {fields && selected.some((source) => !fields.some((field) => field.value === value[source.id])) &&
        <p role="alert" className="text-warning">{__('A mapped field is no longer available. Choose another field before publishing.', 'wconvert')}</p>}
      {selected.length > 0 && <div className="flex flex-col gap-3 border-t pt-3">
        <Description>{__('Try a sample before publishing. Preview does not send anything. A test send creates or updates a real contact, may join the selected list, and may trigger provider automations. Use your own address.', 'wconvert')}</Description>
        <label className="flex flex-col gap-1 text-note">{__('Your test email', 'wconvert')}
          <input type="email" className="rounded-md border border-input bg-background p-2" value={email} onChange={(event) => { invalidate(); setEmail(event.target.value); }} />
        </label>
        {selected.map((source) => <label key={source.id} className="flex flex-col gap-1 text-note">{__('Sample answer:', 'wconvert')} {source.label}
          <input type="text" maxLength={500} className="rounded-md border border-input bg-background p-2" value={sample[source.id] ?? ''} onChange={(event) => { invalidate(); setSample({ ...sample, [source.id]: event.target.value }); }} />
        </label>)}
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void previewDraft()}>{__('Preview data', 'wconvert')}</Button>
          <Button type="button" size="sm" disabled={busy || !preview} onClick={() => void sendDraft()}>{__('Send test contact', 'wconvert')}</Button>
        </div>
        {preview && <div className="rounded-md border p-2 text-note"><strong>{__('Preview', 'wconvert')}</strong>
          <div>{__('Email', 'wconvert')}: {preview.email}</div>
          {Object.entries(preview.mapped).map(([target, text]) => <div key={target}>{fields?.find((field) => field.value === target)?.label ?? target}: {text}</div>)}
        </div>}
        {report && <p role="status">{report.message}</p>}
      </div>}
    </div>}
  </div>;
}
