import { useId } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import type { HeaderPair, SettingsField } from './api';

/** An HTTP token, as the server checks it. */
const TOKEN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/;

/**
 * Why one header would be refused, or null where it is fine — the server's
 * own rules, said beside the row rather than as its one generic refusal.
 * `stored` is the names the account already holds: a blank value on one of
 * those keeps what it had.
 */
export function headerProblem(pair: HeaderPair, all: readonly HeaderPair[], field: Pick<SettingsField, 'reserved'>, stored: readonly string[] = []): string | null {
  const name = pair.name.trim();
  if (name === '' && pair.value.trim() === '') return null;
  if (!TOKEN.test(name)) return __('Use letters, numbers and dashes for the name.', 'wconvert');
  const lower = name.toLowerCase();
  if ((field.reserved ?? []).some((reserved) => reserved.toLowerCase() === lower)) return __('WConvert sets this header itself.', 'wconvert');
  if (all.filter((other) => other.name.trim().toLowerCase() === lower).length > 1) return __('This header is already listed.', 'wconvert');
  if ([...pair.value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)) return __('Use a single line for the value.', 'wconvert');
  if (pair.value.trim() === '' && !stored.some((known) => known.toLowerCase() === lower)) return __('Enter a value.', 'wconvert');
  return null;
}

/** The pairs to send: blank rows dropped, the rest trimmed. */
export const headersToSend = (pairs: readonly HeaderPair[]): HeaderPair[] =>
  pairs.map((pair) => ({ name: pair.name.trim(), value: pair.value.trim() })).filter((pair) => pair.name !== '' || pair.value !== '');

/** A stored list of header names, as rows whose blank values keep what they hold. */
export const storedHeaders = (names: unknown): HeaderPair[] =>
  Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string').map((name) => ({ name, value: '' })) : [];

/**
 * A `headers` connection field: up to `max` name/value rows, values typed as
 * passwords, and a stored value never shown — its row reads "Stored; enter a
 * replacement" and a blank value keeps it (ADR 0148).
 */
export function HeadersEditor({ field, value, onChange, stored = [], label, hint }: {
  field: SettingsField;
  value: readonly HeaderPair[];
  onChange: (next: HeaderPair[]) => void;
  /** The names this account already holds. */
  stored?: readonly string[];
  label?: string;
  hint?: string;
}) {
  const id = useId();
  const max = field.max ?? 5;
  const set = (index: number, pair: HeaderPair) => onChange(value.map((old, at) => at === index ? pair : old));
  const add = () => {
    onChange([...value, { name: '', value: '' }]);
    requestAnimationFrame(() => document.getElementById(`${id}-name-${value.length}`)?.focus());
  };
  return <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
    <legend className="mb-1.5 flex w-full flex-wrap items-baseline justify-between gap-x-3 p-0">
      <span className="font-medium">{label ?? field.label}</span>
      <span className="text-note text-muted-foreground">{sprintf(/* translators: %d: most headers allowed. */ __('Optional · up to %d', 'wconvert'), max)}</span>
    </legend>
    {hint && <p className="m-0 text-note text-muted-foreground">{hint}</p>}
    {value.map((pair, index) => {
      const problem = headerProblem(pair, value, field, stored);
      const kept = pair.value === '' && stored.some((name) => name.toLowerCase() === pair.name.trim().toLowerCase());
      return <div key={index} className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Input id={`${id}-name-${index}`} aria-label={__('Header name', 'wconvert')} dir="ltr" autoComplete="off" spellCheck={false}
            className="min-w-0 flex-[1_1_9rem] font-mono" value={pair.name} placeholder="x-api-key"
            aria-invalid={problem !== null ? true : undefined} aria-describedby={problem !== null ? `${id}-problem-${index}` : undefined}
            onChange={(event) => set(index, { ...pair, name: event.target.value })} />
          <Input aria-label={__('Header value', 'wconvert')} type="password" dir="ltr" autoComplete="off"
            className="min-w-0 flex-[1_1_9rem]" value={pair.value}
            placeholder={kept ? __('Stored; enter a replacement', 'wconvert') : ''}
            onChange={(event) => set(index, { ...pair, value: event.target.value })} />
          <Button type="button" variant="ghost" size="icon"
            aria-label={sprintf(/* translators: %s: a header's name. */ __('Remove header %s', 'wconvert'), pair.name.trim() || __('(unnamed)', 'wconvert'))}
            onClick={() => onChange(value.filter((_, at) => at !== index))}>
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
        {problem !== null && <p id={`${id}-problem-${index}`} className="m-0 text-note text-destructive">{problem}</p>}
      </div>;
    })}
    {value.length < max && <div>
      <Button type="button" variant="outline" size="sm" onClick={add}><Plus aria-hidden="true" />{__('Add header', 'wconvert')}</Button>
    </div>}
  </fieldset>;
}
