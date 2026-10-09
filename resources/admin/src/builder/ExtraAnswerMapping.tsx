import { useEffect, useId, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Disclosure } from '../shell/Disclosure';
import { ArrowRight, Info } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { MappingTest } from './MappingTest';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Description } from '../shell/Description';
import { messageOf } from '../shell/loadable';
import { readMappingFields } from '../destinations/api';
import type { Destination, MappingField } from '../destinations/api';
import type { Template } from '@renderer/types';
import { RegionError, RegionErrorState, TryAgain } from '../shell/Region';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { answerGroups, answerSources } from './answerSources';
import type { AnswerSource } from './answerSources';

/** Whether this signup has an optional answer that could be mapped by a capable destination. */
export const hasExtraAnswers = (template: Template, submissionId: string): boolean =>
  answerSources(template, submissionId).length > 0;

export function ExtraAnswerMapping({ destination, providerLabel, submissionId, template, value, onChange, onSettings }: {
  destination: Destination;
  providerLabel?: string;
  submissionId: string;
  template: Template;
  value: Readonly<Record<string, string>>;
  onChange: (value: Record<string, string>) => void;
  onSettings?: (trigger: HTMLButtonElement) => void;
}) {
  const id = useId();
  const sources = answerSources(template, submissionId);
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // A changed account or audience must never display the previous target's fields.
  const context = JSON.stringify([destination.id, destination.connection, destination.settings, destination.target]);
  const [loaded, setLoaded] = useState<{ context: string; revision: number; fields?: MappingField[]; error?: string } | null>(null);
  const fields = loaded?.context === context ? loaded.fields : undefined;
  const error = loaded?.context === context ? loaded.error : undefined;
  const busy = open && sources.length > 0 && (loaded?.context !== context || loaded.revision !== refresh);
  const supportsInterests = destination.type === 'mailtrap' || fields?.some((field) => field.type === 'boolean');
  const eligible = sources.filter((source) => !source.type || supportsInterests || value[source.id]);
  const selected = eligible.filter((source) => value[source.id]);
  const orphaned = Object.keys(value).filter((source) => !sources.some((item) => item.id === source));
  const issueFor = (source: AnswerSource) => {
    const target = value[source.id];
    if (!target || !fields) return null;
    if (!fields.some((field) => field.value === target && compatible(source, field))) return __('This field is unavailable or has an incompatible type. Choose another field or keep this answer in WConvert only.', 'wconvert');
    if (selected.some((other) => other.id !== source.id && value[other.id] === target)) return __('This field is used more than once. Choose a different field for each answer.', 'wconvert');
    return null;
  };
  const hasIssues = orphaned.length > 0 || selected.some(issueFor);
  useEffect(() => {
    if (!open || sources.length === 0) return;
    let active = true;
    void readMappingFields(destination.id, refresh > 0)
      .then((result) => { if (active) setLoaded({ context, revision: refresh, fields: result.fields }); })
      .catch((cause) => { if (active) setLoaded((previous) => ({ context, revision: refresh, fields: previous?.context === context ? previous.fields : undefined, error: messageOf(cause) })); });
    return () => { active = false; };
  }, [open, destination.id, context, sources.length, refresh]);
  if (eligible.length === 0 && orphaned.length === 0) return null;
  return <Disclosure className="mt-3" onToggle={setOpen} bodyClassName="p-0" title={__('Field mapping', 'wconvert')}
    summary={<Badge variant={hasIssues ? 'warning' : 'outline'} className="mt-1 font-normal">{hasIssues ? __('Needs review', 'wconvert') : sprintf(_n('%d field mapped', '%d fields mapped', selected.length, 'wconvert'), selected.length)}</Badge>}>
    {open && <div className="flex min-w-0 flex-col gap-4 p-3">
      <div className="wconvert-toolbar flex flex-wrap items-start justify-between gap-3">
        <Description className="min-w-0 flex-1 basis-56">{__('Choose which answers to send. Changes take effect when you publish.', 'wconvert')}</Description>
        {!error && <Button type="button" variant="ghost" disabled={busy} onClick={() => setRefresh((old) => old + 1)}>{busy && fields ? __('Refreshing fields…', 'wconvert') : __('Refresh fields', 'wconvert')}</Button>}
      </div>
      {error && (fields
        ? <RegionError message={__('Could not refresh fields. Showing the last loaded fields; testing is unavailable until they load.', 'wconvert')} action={<TryAgain busy={busy} onClick={() => setRefresh((old) => old + 1)} />} />
        : <RegionErrorState message={__('Could not load fields.', 'wconvert')} hint={error} action={<TryAgain busy={busy} onClick={() => setRefresh((old) => old + 1)} />} />)}
      {!fields && !error && busy && <RegionSkeleton label={__('fields', 'wconvert')} lines={Math.min(eligible.length, 3)} />}
      {fields && <fieldset disabled={busy || !!error} className="@container m-0 min-w-0 border-0 p-0" aria-label={__('Answer mappings', 'wconvert')} aria-busy={busy}>
        <div className="hidden grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] gap-3 border-b border-border pb-2 text-note text-muted-foreground @min-[400px]:grid" aria-hidden="true">
          <span>{__('Campaign answer', 'wconvert')}</span><span /><span>{providerLabel ? sprintf(__('%s field', 'wconvert'), providerLabel) : __('Destination field', 'wconvert')}</span>
        </div>
        <div className="divide-y divide-border">
          {answerGroups(eligible).map((group) => group.choices.length > 0 ? <fieldset key={group.id} className="m-0 min-w-0 border-0 px-0 pb-3 pt-4">
            <legend className="float-start mb-1 w-full text-body font-medium [overflow-wrap:anywhere]">{group.label}</legend>
            <div className="clear-both">
              <Description>{__('Each selected choice sends Yes. Earlier interests stay saved.', 'wconvert')}</Description>
              {!fields.some((field) => field.type === 'boolean') && <Description className="mt-2">{sprintf(__('Add a yes/no field for each choice in %s, then refresh fields.', 'wconvert'), providerLabel ?? destination.label)}</Description>}
              {group.choices.map((source) => <MappingRow key={source.id} id={`${id}-${source.id}`} source={source} label={source.choice?.label ?? source.label} fields={fields} value={value} issue={issueFor(source)} onChange={onChange} />)}
              {group.answer && <Disclosure variant="inline" className="border-t border-border" open={value[group.answer.id] ? true : undefined} title={__('Send all choices as text (optional)', 'wconvert')}>
                <MappingRow id={`${id}-${group.answer.id}`} source={group.answer} label={__('All selected choices', 'wconvert')} fields={fields} value={value} issue={issueFor(group.answer)} onChange={onChange} />
              </Disclosure>}
            </div>
          </fieldset> : group.answer && <MappingRow key={group.id} id={`${id}-${group.id}`} source={group.answer} fields={fields} value={value} issue={issueFor(group.answer)} onChange={onChange} />)}
        </div>
      </fieldset>}
      {selected.some((source) => source.type === 'boolean') && destination.settings.existing_contact !== 'update' && <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface p-3">
        <Description className="min-w-0 flex-1 basis-56">{__('Existing contacts keep their current details. Choose Update mapped fields in destination settings to add new interests too.', 'wconvert')}</Description>
        {onSettings && <Button type="button" variant="outline" onClick={(event) => onSettings(event.currentTarget)}>{__('Destination settings', 'wconvert')}</Button>}
      </div>}
      {orphaned.length > 0 && <div className="flex flex-col items-start gap-2">
        <p role="alert" className="m-0 text-note text-warning">{__('Some mapped answers are no longer in this signup. Remove their mappings before publishing.', 'wconvert')}</p>
        <Button type="button" variant="outline" onClick={() => onChange(Object.fromEntries(Object.entries(value).filter(([source]) => !orphaned.includes(source))))}>{__('Remove unavailable answers', 'wconvert')}</Button>
      </div>}
      {fields && selected.length > 0 && !hasIssues && !busy && !error &&
        <MappingTest key={JSON.stringify([context, fields, selected, value])} destination={destination} fields={fields} sources={selected} mapping={Object.fromEntries(selected.map((source) => [source.id, value[source.id]]))} />}
    </div>}
  </Disclosure>;
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

const compatible = (source: AnswerSource, field: MappingField) => source.type === field.type;

function MappingRow({ id, source, label = source.label, fields, value, issue, onChange }: {
  id: string; source: AnswerSource; label?: string; fields: readonly MappingField[];
  value: Readonly<Record<string, string>>; issue: string | null; onChange: (value: Record<string, string>) => void;
}) {
  const options = fields.filter((field) => compatible(source, field));
  const target = value[source.id] ?? '';
  return <div className="grid min-w-0 grid-cols-1 items-center gap-2 py-3 @min-[400px]:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] @min-[400px]:gap-3">
    <Label htmlFor={id} className="min-w-0 leading-snug [overflow-wrap:anywhere]">{label}</Label>
    <ArrowRight aria-hidden="true" className="hidden size-4 text-muted-foreground @min-[400px]:block rtl:-scale-x-100" />
    <div className="flex min-w-0 flex-col gap-1.5">
      <select id={id} aria-label={source.choice || label === source.label ? source.label : `${label} — ${source.label}`} aria-invalid={!!issue} aria-describedby={issue || (options.length === 0 && source.type !== 'boolean') ? `${id}-help` : undefined}
        className="h-(--control-height) w-full min-w-0 rounded-md border border-input bg-card ps-3 pe-9 text-body text-foreground" value={target} onChange={(event) => {
          const next = { ...value };
          if (event.target.value) next[source.id] = event.target.value; else delete next[source.id];
          onChange(next);
        }}>
        <option value="">{__('Keep in WConvert only', 'wconvert')}</option>
        {target && !options.some((field) => field.value === target) && <option value={target}>{sprintf(__('Unavailable field (%s)', 'wconvert'), target)}</option>}
        {options.map((field) => {
          const used = Object.entries(value).some(([other, selected]) => other !== source.id && selected === field.value);
          return <option key={field.value} value={field.value} disabled={used}>{used ? sprintf(__('%s — already used', 'wconvert'), field.label) : field.label}</option>;
        })}
      </select>
      {issue ? <p id={`${id}-help`} role="alert" className="m-0 text-note text-warning">{issue}</p>
        : options.length === 0 && source.type !== 'boolean' && <Description id={`${id}-help`}>{__('Add a text field in this service, then refresh fields.', 'wconvert')}</Description>}
    </div>
  </div>;
}
