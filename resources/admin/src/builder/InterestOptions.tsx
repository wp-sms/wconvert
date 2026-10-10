import { useLayoutEffect, useRef } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { FieldHeading, PanelHint } from './PanelSection';
import { Disclosure } from '../shell/Disclosure';
import manifest from '../../../templates/manifest.json';
import { Button } from '../components/ui/button';

export type InterestOption = { value: string; label: string };
export const optionLimits = manifest.field_options;
// JavaScript's $ also matches before a final newline; PHP uses an absolute end.
const valuePattern = new RegExp(`${optionLimits.value_pattern}(?![\\s\\S])`);

export function interestOptions(value: unknown): InterestOption[] {
  return Array.isArray(value) ? value.filter((option): option is InterestOption =>
    option !== null && typeof option === 'object' && typeof option.value === 'string' && typeof option.label === 'string') : [];
}

export function validInterestOptions(value: unknown): boolean {
  const options = interestOptions(value);
  return Array.isArray(value) && options.length === value.length
    && options.length > 0 && options.length <= optionLimits.max_items && options.every((option, at) =>
    valuePattern.test(option.value) && option.label.trim() !== '' && [...option.label.trim()].length <= optionLimits.label_max_length
    && options.findIndex((other) => other.value === option.value) === at);
}

/** Empty/absent choices are an unfinished draft; entered rows must survive Save. */
export function validDraftInterestOptions(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.length === 0) || validInterestOptions(value);
}

export function InterestOptions({ value, onEdit, onChange }: {
  value: unknown;
  onEdit: (value: InterestOption[]) => void;
  onChange: (value: InterestOption[]) => void;
}) {
  const options = interestOptions(value);
  const labels = useRef<(HTMLInputElement | null)[]>([]);
  const addButton = useRef<HTMLButtonElement>(null);
  const focusAfterChange = useRef<number | null>(null);
  useLayoutEffect(() => {
    const at = focusAfterChange.current;
    if (at === null) return;
    focusAfterChange.current = null;
    (at < 0 ? addButton.current : labels.current[at])?.focus();
  }, [value]);
  const update = (at: number, key: keyof InterestOption, text: string) =>
    onEdit(options.map((option, index) => index === at ? { ...option, [key]: text } : option));

  function add() {
    let next = options.length + 1;
    while (options.some((option) => option.value === `option-${next}`)) next++;
    focusAfterChange.current = options.length;
    onChange([...options, { value: `option-${next}`, label: sprintf(__('Option %d', 'wconvert'), next) }]);
  }

  // In the panel grammar (ADR 0136): a field heading with its help as an InfoTip, and one line about the limit.
  return <fieldset className="wconvert-panel-field m-0 min-w-0 border-0 p-0">
    <legend className="sr-only">{__('Choices', 'wconvert')}</legend>
    <FieldHeading as="span" label={__('Choices', 'wconvert')}
      tip={sprintf(/* translators: %d: the most choices a field may offer. */ __('Visitors choose one answer. Up to %d choices; answers stay in your capture history, so check that your destination forwards them.', 'wconvert'), optionLimits.max_items)} />
    {options.map((option, at) => <div key={at} className="space-y-2 rounded-md border border-border p-3">
      <label className="wconvert-slot__key">{sprintf(__('Choice %d', 'wconvert'), at + 1)}
        <input ref={(input) => { labels.current[at] = input; }} type="text" value={option.label} maxLength={optionLimits.label_max_length} onChange={(event) => update(at, 'label', event.target.value)} />
      </label>
      <Disclosure variant="inline" className="text-note text-muted-foreground" title={sprintf(__('Saved as: %s', 'wconvert'), option.value || __('not set', 'wconvert'))}>
        <label className="wconvert-slot__key mt-2">{sprintf(__('Value sent for choice %d', 'wconvert'), at + 1)}
          <input type="text" value={option.value} pattern={optionLimits.value_pattern} onChange={(event) => update(at, 'value', event.target.value)} />
        </label>
        <PanelHint>{__('Lowercase letters, numbers, hyphens or underscores. Changing it affects future submissions.', 'wconvert')}</PanelHint>
      </Disclosure>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={at === 0} aria-label={sprintf(__('Move choice %d up', 'wconvert'), at + 1)} onClick={() => {
          focusAfterChange.current = at - 1;
          const moved = [...options]; [moved[at - 1], moved[at]] = [moved[at], moved[at - 1]]; onChange(moved);
        }}>{__('Move up', 'wconvert')}</Button>
        <Button type="button" variant="ghost" size="sm" aria-label={sprintf(__('Remove choice %d', 'wconvert'), at + 1)} onClick={() => {
          focusAfterChange.current = Math.min(at, options.length - 2);
          onChange(options.filter((_, index) => index !== at));
        }}>{__('Remove', 'wconvert')}</Button>
      </div>
    </div>)}
    {!validInterestOptions(value) && <p role="status" className="text-sm text-destructive">{__('Add at least one choice. Each choice needs a label and a unique valid sent value.', 'wconvert')}</p>}
    <button ref={addButton} type="button" className="wconvert-panel-link" onClick={add} disabled={options.length >= optionLimits.max_items}>{__('Add choice', 'wconvert')}</button>
  </fieldset>;
}
