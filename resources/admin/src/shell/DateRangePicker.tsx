import { useId, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';

/**
 * A named window of days. What each preset covers is the caller's to resolve:
 * Leads counts today in "Last 7 days", Analytics reads complete days.
 */
export type DatePreset = 'all' | 'today' | 'yesterday' | '7' | '30' | '90' | 'this_month' | 'last_month';
export type DateRange = { preset: DatePreset } | { preset: 'custom'; from: string; to: string };

export const presetLabel = (preset: DatePreset | 'custom'): string => {
  switch (preset) {
    case 'all': return __('Any time', 'wconvert');
    case 'today': return __('Today', 'wconvert');
    case 'yesterday': return __('Yesterday', 'wconvert');
    case '7': return __('Last 7 days', 'wconvert');
    case '30': return __('Last 30 days', 'wconvert');
    case '90': return __('Last 90 days', 'wconvert');
    case 'this_month': return __('This month', 'wconvert');
    case 'last_month': return __('Last month', 'wconvert');
    case 'custom': return __('Custom dates', 'wconvert');
  }
};

/**
 * **One date control for every screen that reads a window** (ADR 0132):
 * a button naming the window and its dates, opening the presets, custom
 * dates and anything that qualifies the window (Analytics' comparison).
 *
 * The presets are native radios — one tab stop, arrow keys, announced as a
 * set (GUIDELINES §7) — and choosing one applies it and closes. Custom dates
 * need two answers, so they apply on their own button. It is a popover
 * because the control is the button; what opens is its choices, never a
 * second place to find them.
 */
export function DateRangePicker({
  label,
  value,
  presets,
  summary,
  today,
  custom = true,
  maxDays,
  disabled = false,
  footer,
  onChange,
}: {
  /** What the window is for, e.g. "Report period"; the button's accessible name starts with it. */
  label: string;
  value: DateRange;
  presets: readonly DatePreset[];
  /** The resolved dates, e.g. "Sep 9 – Oct 8, 2026", or null while unknown. */
  summary: string | null;
  /** The site's today, the latest a custom range may end. */
  today: string | null;
  custom?: boolean;
  /** The longest custom window the reader accepts. */
  maxDays?: number;
  disabled?: boolean;
  footer?: ReactNode;
  onChange: (next: DateRange) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.preset === 'custom' ? value.from : '');
  const [to, setTo] = useState(value.preset === 'custom' ? value.to : '');
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const span = from && to ? Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1 : 0;
  const problem = !from || !to ? null
    : from > to ? __('The first day comes after the last.', 'wconvert')
      : today !== null && to > today ? __('The last day can’t be after today.', 'wconvert')
        : maxDays !== undefined && span > maxDays ? __('Choose a shorter range.', 'wconvert')
          : null;
  const choose = (next: DateRange) => {
    onChange(next);
    setOpen(false);
  };
  const name = presetLabel(value.preset);

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) setCustomOpen(value.preset === 'custom');
    }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="wconvert-date-picker__trigger" disabled={disabled}
          aria-label={summary ? `${label}: ${name}, ${summary}` : `${label}: ${name}`}>
          <CalendarDays aria-hidden="true" />
          <span className="wconvert-date-picker__name">{name}</span>
          {summary && <span className="wconvert-date-picker__dates">{summary}</span>}
          <ChevronDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="wconvert-date-picker">
        <div role="group" aria-label={label} className="wconvert-date-picker__presets">
          {presets.map((preset) => (
            <label key={preset}>
              <input type="radio" name={id} checked={value.preset === preset && !customOpen}
                onChange={() => { setCustomOpen(false); choose({ preset }); }} />
              {presetLabel(preset)}
            </label>
          ))}
          {custom && (
            <label>
              <input type="radio" name={id} checked={customOpen} onChange={() => setCustomOpen(true)} />
              {presetLabel('custom')}
            </label>
          )}
        </div>
        {custom && customOpen && (
          <form className="wconvert-date-picker__custom" noValidate onSubmit={(event) => {
            event.preventDefault();
            if (from && to && problem === null) choose({ preset: 'custom', from, to });
          }}>
            <label htmlFor={`${id}-from`}>{__('From', 'wconvert')}</label>
            <Input id={`${id}-from`} type="date" value={from} max={today ?? undefined} onChange={(event) => setFrom(event.target.value)} />
            <label htmlFor={`${id}-to`}>{__('To', 'wconvert')}</label>
            <Input id={`${id}-to`} type="date" value={to} max={today ?? undefined} onChange={(event) => setTo(event.target.value)} />
            <p className="wconvert-date-picker__note" role={problem ? 'alert' : undefined}>
              {problem ?? __('Both days are included.', 'wconvert')}
            </p>
            <Button type="submit" disabled={!from || !to || problem !== null}>{__('Apply dates', 'wconvert')}</Button>
          </form>
        )}
        {footer && <div className="wconvert-date-picker__footer">{footer}</div>}
      </PopoverContent>
    </Popover>
  );
}
