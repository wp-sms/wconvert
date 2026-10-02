import { useEffect, useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowRight, ChevronRight, Info } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { MappingTest } from './MappingTest';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Description } from '../shell/Description';
import { messageOf } from '../shell/loadable';
import { readMappingFields } from '../destinations/api';
import type { Destination } from '../destinations/api';
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

/** Whether this signup has an optional answer that could be mapped by a capable destination. */
export const hasExtraAnswers = (template: Template, submissionId: string): boolean =>
  sources(template, submissionId).length > 0;

export function ExtraAnswerMapping({ destination, providerLabel, submissionId, template, value, onChange }: {
  destination: Destination;
  providerLabel?: string;
  submissionId: string;
  template: Template;
  value: Readonly<Record<string, string>>;
  onChange: (value: Record<string, string>) => void;
}) {
  const id = useId();
  const eligible = sources(template, submissionId);
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // A changed account or audience must never display the previous target's fields.
  const context = JSON.stringify([destination.id, destination.connection, destination.settings, destination.target, refresh]);
  const [loaded, setLoaded] = useState<{ context: string; fields?: { value: string; label: string }[]; error?: string } | null>(null);
  const fields = loaded?.context === context ? loaded.fields : undefined;
  const error = loaded?.context === context ? loaded.error : undefined;
  const selected = eligible.filter((source) => value[source.id]);
  const orphaned = Object.keys(value).filter((source) => !eligible.some((item) => item.id === source));
  const issueFor = (source: { id: string }) => {
    const target = value[source.id];
    if (!target || !fields) return null;
    if (!fields.some((field) => field.value === target)) return __('This field is unavailable. Choose another field or keep this answer in WConvert only.', 'wconvert');
    if (selected.some((other) => other.id !== source.id && value[other.id] === target)) return __('This field is used more than once. Choose a different field for each answer.', 'wconvert');
    return null;
  };
  const hasIssues = orphaned.length > 0 || selected.some(issueFor);
  useEffect(() => {
    if (!open || eligible.length === 0) return;
    let active = true;
    void readMappingFields(destination.id, refresh > 0)
      .then((result) => { if (active) setLoaded({ context, fields: result.fields }); })
      .catch((cause) => { if (active) setLoaded({ context, error: messageOf(cause) }); });
    return () => { active = false; };
  }, [open, destination.id, context, eligible.length, refresh]);
  if (eligible.length === 0 && orphaned.length === 0) return null;
  return <details className="group/mapping mt-3 min-w-0 rounded-md border border-border bg-card" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="flex min-h-(--control-height-sm) cursor-pointer list-none flex-wrap items-center gap-2 rounded-md px-3 py-2 text-note font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
      <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180 group-open/mapping:rotate-90" />
      <span className="min-w-0 flex-1 basis-28 [overflow-wrap:anywhere]">{__('Field mapping', 'wconvert')}</span>
      <Badge variant={hasIssues ? "warning" : "outline"} className="ms-auto text-micro font-normal">{hasIssues ? __('Needs review', 'wconvert') : sprintf(__('%1$d of %2$d mapped', 'wconvert'), selected.length, eligible.length)}</Badge>
    </summary>
    {open && <div className="flex min-w-0 flex-col gap-4 border-t border-border p-3">
      <Description>{__('Send extra answers to existing text fields. Unmapped answers stay in WConvert only. Changes take effect when you publish.', 'wconvert')}</Description>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-note font-medium [overflow-wrap:anywhere]">{destination.target ?? destination.label}</span>
        <Button type="button" size="sm" variant="ghost" disabled={!fields && !error && eligible.length > 0} onClick={() => setRefresh((old) => old + 1)}>{error ? __('Retry loading fields', 'wconvert') : __('Refresh fields', 'wconvert')}</Button>
      </div>
      {error && <p role="alert" className="m-0 text-note text-warning">{__('Could not load fields.', 'wconvert')} {error}</p>}
      {!fields && !error && eligible.length > 0 && <p role="status" className="m-0 text-note">{__('Loading fields…', 'wconvert')}</p>}
      {fields?.length === 0 && <Description>{__('No compatible text fields were found. Add a text field in this service, then refresh fields.', 'wconvert')}</Description>}
      {fields && (fields.length > 0 || selected.length > 0) && <div className="@container min-w-0">
        <div className="hidden grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] gap-3 border-b border-border pb-2 text-note text-muted-foreground @min-[400px]:grid" aria-hidden="true">
          <span>{__('Campaign answer', 'wconvert')}</span><span /><span>{providerLabel ? sprintf(__('%s field', 'wconvert'), providerLabel) : __('Destination field', 'wconvert')}</span>
        </div>
        <div className="divide-y divide-border">
          {eligible.map((source, index) => {
            const issue = issueFor(source);
            return <div key={source.id} className="grid min-w-0 grid-cols-1 items-center gap-2 py-3 @min-[400px]:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] @min-[400px]:gap-3">
              <Label htmlFor={`${id}-target-${index}`} className="min-w-0 leading-snug [overflow-wrap:anywhere]">{source.label}</Label>
              <ArrowRight aria-hidden="true" className="hidden size-4 text-muted-foreground @min-[400px]:block rtl:rotate-180" />
              <div className="flex min-w-0 flex-col gap-1.5">
                <select id={`${id}-target-${index}`} aria-invalid={!!issue} aria-describedby={issue ? `${id}-issue-${index}` : undefined} className="h-(--control-height) w-full min-w-0 rounded-md border border-input bg-card ps-3 pe-9 text-body text-foreground" value={value[source.id] ?? ''} onChange={(event) => {
                  const next = { ...value };
                  if (event.target.value) next[source.id] = event.target.value; else delete next[source.id];
                  onChange(next);
                }}>
                  <option value="">{__('Keep in WConvert only', 'wconvert')}</option>
                  {value[source.id] && !fields.some((field) => field.value === value[source.id]) &&
                    <option value={value[source.id]}>{sprintf(__('Unavailable field (%s)', 'wconvert'), value[source.id])}</option>}
                  {fields.map((field) => {
                    const used = selected.some((other) => other.id !== source.id && value[other.id] === field.value);
                    return <option key={field.value} value={field.value} disabled={used}>{used ? sprintf(__('%s — already used', 'wconvert'), field.label) : field.label}</option>;
                  })}
                </select>
                {issue && <p id={`${id}-issue-${index}`} role="alert" className="m-0 text-note text-warning">{issue}</p>}
              </div>
            </div>;
          })}
        </div>
      </div>}
      {orphaned.length > 0 && <div className="flex flex-col items-start gap-2">
        <p role="alert" className="m-0 text-note text-warning">{__('Some mapped answers are no longer in this signup. Remove their mappings before publishing.', 'wconvert')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(Object.fromEntries(Object.entries(value).filter(([source]) => !orphaned.includes(source))))}>{__('Remove unavailable answers', 'wconvert')}</Button>
      </div>}
      {fields && selected.length > 0 && !hasIssues &&
        <MappingTest key={JSON.stringify([context, fields, selected, value])} destination={destination} fields={fields} sources={selected} mapping={Object.fromEntries(selected.map((source) => [source.id, value[source.id]]))} />}
    </div>}
  </details>;
}

/** A capability limit is supporting information, not a failed delivery. */
export function UnsupportedAnswerMapping() {
  return <div className="mt-3 flex items-start gap-2 rounded-md bg-muted p-3">
    <Info aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    <div className="flex min-w-0 flex-col gap-1">
      <p className="m-0 text-note font-medium">{__('Extra answers stay in WConvert', 'wconvert')}</p>
      <Description>{__('This destination does not support sending extra answers.', 'wconvert')}</Description>
    </div>
  </div>;
}
