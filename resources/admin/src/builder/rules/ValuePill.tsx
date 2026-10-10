import { useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger } from '../../components/ui/popover';
import { OptionListContent } from '../../components/ui/option-menu';

/**
 * A rule's value as a pill in its sentence (ADR 0139) — shared by the Who and
 * When rows and by Where's page lists, so every rule reads the same way.
 */

/** The pill itself: the value, or "Choose…" dashed and amber while there is none. */
export function PillTrigger({ label, text }: { label: string; text: string | null }) {
  const shown = text ?? __('Choose…', 'wconvert');

  return <PopoverTrigger asChild>
    <button type="button" className="wconvert-value-pill" data-attention={text === null || undefined}
      aria-label={sprintf(/* translators: 1: what the value is, e.g. “Device”. 2: the value, e.g. “Phone”. */ __('%1$s: %2$s', 'wconvert'), label, shown)}>
      <span>{shown}</span><ChevronDown aria-hidden="true" />
    </button>
  </PopoverTrigger>;
}

/** The menu a pill opens, at a width that fits a phone. */
export const PILL_MENU = 'w-[min(320px,calc(100vw-32px))]';

/**
 * A value as a pill, opening the control that edits it. Empty, it says
 * "Choose…" dashed and amber — the same attention `groupProblems` raises.
 * Done, Escape or a click outside close it, and focus goes back to the pill.
 */
export function ValuePill({ label, text, children }: { label: string; text: string | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return <Popover open={open} onOpenChange={setOpen}>
    <PillTrigger label={label} text={text} />
    <OptionListContent align="start" className={PILL_MENU} aria-label={label}>
      <div className="wconvert-option-menu__control">
        {children}
        <button type="button" className="wconvert-option-menu__done" onClick={() => setOpen(false)}>{__('Done', 'wconvert')}</button>
      </div>
    </OptionListContent>
  </Popover>;
}

