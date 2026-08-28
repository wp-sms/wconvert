import { __, sprintf } from '@wordpress/i18n';
import { ImagePlus } from 'lucide-react';
import { Button } from '../components/ui/button';
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

      {slot.keys.map((key) => {
        const label = nameOf(labels.keys, key);
        const held = typeof slot.values[key] === 'string' ? (slot.values[key] as string) : '';

        if (key === 'link') {
          return (
            <LinkControl
              key={key}
              label={label}
              value={slot.values[key]}
              onChange={(value) => onValue(key, value)}
            />
          );
        }

        return (
          <label key={key} className="wconvert-slot__key">
            {label}
            <KeyControl
              control={controlFor(key, slot)}
              label={label}
              value={held}
              onChange={(value) => onValue(key, value)}
            />
          </label>
        );
      })}
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

/**
 * Which control a content key takes.
 *
 * ============================================================================
 * INFERRED FROM THE KEY, SO A NEW KEY ARRIVES WEARING THE RIGHT CONTROL.
 * ============================================================================
 * Every content key was a bare `<input type="text">`, which is the same answer
 * for *"Get 10% off your first order"*, an image address and a URL. One
 * function rather than a branch per key, for the reason `TOKENS` and
 * `additionsIn` both give: a key added to `resources/templates/manifest.json`
 * has to cost the editor nothing, and a `switch` on key names would be another
 * hand-maintained cross-cutting list (ADR 0019).
 *
 * - **`href`** is an address, so `type="url"` — which is a keyboard on a phone
 *   and a validity hint on a desktop, and nothing at all otherwise.
 * - **`src` on an image** is an address a merchant should not have to type.
 *   The media library is WordPress's own picker, and it degrades to the URL
 *   field where the script is absent.
 * - **`text` on anything but a heading** wraps. A headline is one line by
 *   construction; a body paragraph and a consent sentence are not, and a
 *   single-line box for them is a control that hides most of what it holds.
 * - **Everything else** keeps the box it had. `label`, `placeholder` and `alt`
 *   are short by nature and a bigger control would be a bigger target for the
 *   same three words.
 */
export type KeyControlKind = 'url' | 'media' | 'multiline' | 'text';

export function controlFor(key: string, slot: Pick<Slot, 'type'>): KeyControlKind {
  if (key === 'href') {
    return 'url';
  }

  if (key === 'src') {
    return slot.type === 'image' ? 'media' : 'url';
  }

  return key === 'text' && slot.type !== 'heading' ? 'multiline' : 'text';
}

function KeyControl({
  control,
  label,
  value,
  onChange,
}: {
  control: KeyControlKind;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (control === 'multiline') {
    return (
      <textarea
        className="widefat"
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (control === 'media') {
    return <MediaControl label={label} value={value} onChange={onChange} />;
  }

  return (
    <input
      type={control === 'url' ? 'url' : 'text'}
      className="widefat"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * An image, chosen from the media library — with the address still typeable.
 *
 * ============================================================================
 * IT DEGRADES TO THE FIELD IT REPLACES, RATHER THAN TO NOTHING.
 * ============================================================================
 * The picker is WordPress's own `wp.media`, which the builder screen has to ask
 * for (`wp_enqueue_media()` in `AdminMenu`). Where that script is absent — a
 * test, a screen that did not enqueue it, a future where it is dropped — the
 * URL field is still here and still writes the same key. The button is what is
 * missing, not the ability to set an image.
 *
 * That is also why the address stays visible beside it: a merchant pasting a
 * CDN URL is a real case, and `MerchantsOwn` carries an `src` across a design
 * switch precisely because it is theirs.
 */
function MediaControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const media = mediaLibrary();

  return (
    <span className="wconvert-slot__media">
      <input
        type="url"
        className="widefat"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {media !== null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const frame = media({
              title: __('Choose an image', 'wconvert'),
              button: { text: __('Use this image', 'wconvert') },
              multiple: false,
            });

            frame.on('select', () => {
              const chosen = frame.state().get('selection').first()?.toJSON();

              if (chosen !== undefined && typeof chosen.url === 'string') {
                onChange(chosen.url);
              }
            });

            frame.open();
          }}
        >
          <ImagePlus aria-hidden="true" />
          <span className="sr-only">
            {sprintf(
              /* translators: %s: what the address is for, e.g. “Image address”. */
              __('Choose %s from the media library', 'wconvert'),
              label,
            )}
          </span>
        </Button>
      )}
    </span>
  );
}

/** What `wp_enqueue_media()` leaves on the page, or null where it was not asked for. */
function mediaLibrary(): MediaFrameOpener | null {
  const wp = (window as unknown as { wp?: { media?: unknown } }).wp;

  return typeof wp?.media === 'function' ? (wp.media as MediaFrameOpener) : null;
}

/**
 * The sliver of `wp.media` this uses.
 *
 * Typed here rather than by taking `@types/wordpress__media-utils`, which
 * would pull the `@wordpress/*` type tree into a bundle that imports two of its
 * packages — the same argument ADR 0036 makes about vendoring the behaviour
 * rather than the dependency.
 */
type MediaFrameOpener = (options: {
  title: string;
  button: { text: string };
  multiple: boolean;
}) => {
  on: (event: 'select', handle: () => void) => void;
  open: () => void;
  state: () => { get: (what: 'selection') => { first: () => { toJSON: () => { url?: unknown } } | undefined } };
};
