import { __ } from '@wordpress/i18n';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Slot } from './panel';

/**
 * The controls for **one slot** — what it says, and whether it is shown.
 *
 * ============================================================================
 * ONE IMPLEMENTATION OF "THE CONTROLS FOR A SLOT", BECAUSE TWO WOULD DRIFT.
 * ============================================================================
 * This was the body of the settings panel's `<fieldset>`, reached only by
 * walking every slot in the design as one flat column. The block tree needs
 * exactly the same controls for exactly one slot — the one whose row the
 * merchant is on — and a second spelling of them would be a `link` that is two
 * controls in one place and a text box in the other, or a visibility checkbox
 * that says "Show this" here and something else there.
 *
 * So it is extracted rather than rewritten. What each caller supplies is the
 * slot and where to write: this file knows what a slot's keys are called and
 * which control each takes, and nothing about where the slot came from.
 *
 * **It draws no heading and no box.** The panel headed each slot with a
 * `<legend>` inside a bordered `<fieldset>`, because it was drawing fifteen of
 * them in a column and they had to be told apart. An inspector under the tree
 * is showing one, already named by the row that selected it, so the frame is
 * the caller's decision rather than this file's.
 */

export interface SlotFieldsProps {
  readonly slot: Slot;
  readonly labels: TemplateLabels;
  /** Write one of the slot's content keys. */
  readonly onValue: (key: string, value: unknown) => void;
  /** Switch the slot off, or back on. Never called for a slot that cannot hide. */
  readonly onHidden: (hidden: boolean) => void;
}

export function SlotFields({ slot, labels, onValue, onHidden }: SlotFieldsProps) {
  return (
    <>
      {slot.hideable && (
        <label className="wconvert-slot__shown">
          <input
            type="checkbox"
            checked={!slot.hidden}
            onChange={(event) => onHidden(!event.target.checked)}
          />{' '}
          {__('Show this', 'wconvert')}
        </label>
      )}

      {slot.keys.map((key) =>
        key === 'link' ? (
          <LinkControl
            key={key}
            label={nameOf(labels.keys, key)}
            value={slot.values[key]}
            onChange={(value) => onValue(key, value)}
          />
        ) : (
          <label key={key} className="wconvert-slot__key">
            {nameOf(labels.keys, key)}
            <input
              type="text"
              className="widefat"
              value={typeof slot.values[key] === 'string' ? (slot.values[key] as string) : ''}
              onChange={(event) => onValue(key, event.target.value)}
            />
          </label>
        ),
      )}
    </>
  );
}

/**
 * What this slot is CALLED, in the vocabulary's own words.
 *
 * Headed by its [[Slot Role]] where it has one, because that is what the slot
 * IS — a `field`'s Roles are derived from what it captures rather than
 * declared, so it is headed by the kind it captures instead (CONTEXT.md, Slot
 * Role), and a slot with neither is named by its node type.
 *
 * The same three-step answer {@see nameOfBlock} gives a row, which is what
 * stops one thing being called "Headline" in one place and "Heading" in the
 * other on one screen.
 */
export function nameOfSlot(slot: Slot, labels: TemplateLabels): string {
  if (slot.role !== null) {
    return nameOf(labels.roles, slot.role);
  }

  if (slot.captures !== null) {
    return nameOf(labels.fields, slot.captures);
  }

  return nameOf(labels.nodes, slot.type);
}

/**
 * A link inside a sentence, expressed as STRUCTURE rather than markup
 * (ADR 0013) — which is why it is two controls and not a rich-text box.
 *
 * The sentence carries `%s` where the link goes, and the renderer splits on it
 * and builds the anchor itself, so no code path reaches `innerHTML`. Leaving
 * the address empty is the ordinary case for a privacy-policy link: the
 * renderer fills it from the site's own configured policy, and with none
 * configured the link renders nothing rather than a dead `#` (ADR 0032).
 */
export function LinkControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const link = (value ?? {}) as { label?: string; href?: string };

  const write = (next: { label?: string; href?: string }) =>
    onChange(next.label === undefined || next.label === '' ? undefined : next);

  return (
    <fieldset className="wconvert-slot__link">
      <legend>{label}</legend>
      <label className="wconvert-slot__key">
        {__('Link text', 'wconvert')}
        <input
          type="text"
          className="widefat"
          value={link.label ?? ''}
          onChange={(event) => write({ ...link, label: event.target.value })}
        />
      </label>
      <label className="wconvert-slot__key">
        {__('Address — leave empty for your privacy policy', 'wconvert')}
        <input
          type="text"
          className="widefat"
          value={link.href ?? ''}
          onChange={(event) => write({ ...link, href: event.target.value === '' ? undefined : event.target.value })}
        />
      </label>
      <p className="description">
        {__('Put %s in the sentence above where the link should sit.', 'wconvert')}
      </p>
    </fieldset>
  );
}
