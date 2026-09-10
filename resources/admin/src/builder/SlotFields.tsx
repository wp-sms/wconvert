import { __, sprintf } from '@wordpress/i18n';
import { CalendarClock, ImagePlus } from 'lucide-react';
import { GLYPHS } from '@renderer/render';
import { Button } from '../components/ui/button';
import { ParamChoice } from './ParamChoice';
import { readable, momentOf } from './wallTime';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Slot } from './panel';

/**
 * The controls for **one slot** — what it says, how it behaves, and whether it
 * is shown.
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
 * them in a column and they had to be told apart. An inspector is showing ONE,
 * already named by the row that selected it, so the frame is the caller's
 * decision rather than this file's.
 */

export interface SlotFieldsProps {
  readonly slot: Slot;
  readonly labels: TemplateLabels;
  /** Write one of the slot's content keys. */
  readonly onValue: (key: string, value: unknown) => void;
  /**
   * Write one of the slot's SETTINGS.
   *
   * **Its own callback rather than {@link onValue}, and the reason is the undo
   * history.** A caller wires `onValue` with a coalescing key, so a burst of
   * typing in one box is one entry — and a radio press is not typing. Sharing
   * the callback would fold *"made this field optional"* into whatever sentence
   * the merchant had been writing a moment earlier, and one ⌘Z would take both
   * back. `onHidden` is spelled separately for exactly the same reason.
   */
  readonly onParam: (param: string, value: unknown) => void;
  /** Switch the slot off, or back on. Never called for a slot that cannot hide. */
  readonly onHidden: (hidden: boolean) => void;
  /**
   * When this Optin stops running, as the merchant typed it — or undefined.
   *
   * **Read by exactly one block type and passed to all of them**, because a
   * `countdown` counts to the Optin's `ends_at` and to nothing else (ADR 0052)
   * and therefore has no setting of its own to draw. What it needs is the
   * sentence saying what it counts to, and the deadline is not this block's to
   * hold ({@see Countdown}).
   */
  readonly endsAt?: string;
  /** Take the merchant to the field that sets it. */
  readonly onSetEndDate?: () => void;
}

export function SlotFields({
  slot,
  labels,
  onValue,
  onParam,
  onHidden,
  endsAt,
  onSetEndDate,
}: SlotFieldsProps) {
  return (
    <>
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
            {/*
              **The mark is where the words go, and it has to be said in the
              same breath as the box that holds them.** `emphasis` is the
              second placeholder a sentence carries and the only key whose
              value renders NOWHERE unless the sentence has a place for it —
              which is a control that silently does nothing, and the one thing
              ADR 0054 rule 3 says a control may not be. `link` says the same
              sentence about `%s` inside {@see LinkControl}.
            */}
            {key === 'emphasis' && (
              <span className="description">
                {__('Put %b in the text above where the bold words should sit.', 'wconvert')}
              </span>
            )}
          </label>
        );
      })}

      {/*
        ======================================================================
        THE THREE SETTINGS THE RENDERER READS AND NOTHING EVER SET.
        ======================================================================
        `heading.level`, `image.fit` and `field.required` are declared in
        `resources/templates/manifest.json`, honoured by the renderer, and —
        for `required` — enforced by the capture endpoint, which refuses a
        submission that left one empty. Until now the only way to set any of
        them was to author a [[Template]] by hand, which is exactly the hole
        `split.ratio` was in one level up.

        **Under the words and above the switch**, which is the order of what
        the merchant came for: what it says, then how it behaves, then whether
        it is shown at all. Which settings exist is the manifest's answer
        ({@see Slot.settings}) and neither the params nor their values are
        spelled in this bundle.
      */}
      {slot.settings.map((setting) => (
        <ParamChoice
          key={setting.param}
          id={`${slot.type}-${setting.param}`}
          label={nameOf(labels.nodeParams, `${slot.type}.${setting.param}`)}
          offered={setting.offered}
          held={setting.held}
          fallback={setting.fallback}
          nameOfValue={(choice) =>
            nameOf(labels.nodeParamValues, `${slot.type}.${setting.param}.${choice}`)
          }
          /*
            **The one setting in the vocabulary whose values are pictures**, and
            the picker offered six nouns for them (ADR 0054 rule 3). Which
            setting has pictures is decided here rather than in `ParamChoice`,
            so every other one is untouched and that file still names no param.

            Read off `GLYPHS` rather than off the param name: a value the
            manifest offers that the renderer has no path for draws no picture
            here and none in the preview, which is the two agreeing.
          */
          renderChoice={
            setting.param === 'name' && slot.type === 'icon'
              ? (choice) => <Glyph name={choice} />
              : undefined
          }
          onChange={(value) => onParam(setting.param, value)}
        />
      ))}

      {/*
        ======================================================================
        A CONTROL THAT DEPENDS ON A VALUE EDITED ELSEWHERE NAMES IT AND POINTS
        AT IT (ADR 0054 rule 4).
        ======================================================================
        A `countdown`'s inspector is one *Show this* switch, because the node
        declares no settings — correct under ADR 0052 and not what to change.
        What was missing is the sentence: a merchant looking at a clock counting
        to nothing, on a tab with no field that could change it, and nothing
        saying where the deadline lives.
      */}
      {slot.type === 'countdown' && <Countdown endsAt={endsAt} onSetEndDate={onSetEndDate} />}

      {/*
        **Under the fields, not over them.** The thing a merchant opened this
        panel for is the TEXT; whether the slot is shown at all is a property
        *of* that text, and a switch above the box it applies to is read as the
        panel's first question. It also put the one control that can empty the
        panel where the eye lands first.
      */}
      {slot.hideable && (
        <label className="wconvert-slot__shown">
          <input
            type="checkbox"
            checked={!slot.hidden}
            onChange={(event) => onHidden(!event.target.checked)}
          />
          {__('Show this', 'wconvert')}
        </label>
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
 * - **`text`** wraps, on everything including a heading. It used to say *"on
 *   anything but a heading. A headline is one line by construction"*, and that
 *   stopped being true the day a newline became a `<br>`: every headline in
 *   the reference set breaks its own line, so where the break falls is now the
 *   most design-bearing thing a merchant types into this box. A single-line
 *   input cannot show them where it is.
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

  return key === 'text' ? 'multiline' : 'text';
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
 *
 * **Exported for the Design tab's background picture**, which is the same
 * control over a different key: a token whose value is a CSS background layer.
 * The wrapping and unwrapping of `url(…)` is that caller's, so this stays what
 * it has always been — an address, typeable, with a picker beside it — and
 * there is one media frame in the admin rather than two that drift.
 */
export function MediaControl({
  id,
  label,
  value,
  type = 'url',
  preview,
  onChange,
}: {
  /**
   * Where a `<label htmlFor>` outside this component points.
   *
   * Optional because the slot editor WRAPS its control in the label and needs
   * none; the Design tab cannot, because the reset button sits in the same row
   * and a wrapping label would take its words into the control's own name.
   */
  id?: string;
  label: string;
  value: string;
  /**
   * `url` everywhere but the background token, which may also hold a
   * `linear-gradient()` — and a `url` input marks one invalid while happily
   * storing it, which is a red outline over a value that works.
   */
  type?: 'url' | 'text';
  preview?: string;
  onChange: (value: string) => void;
}) {
  const media = mediaLibrary();
  const image = preview ?? (type === 'url' ? value : '');

  return (
    <span className="wconvert-slot__media">
      {image && <img className="wconvert-media-preview" src={image} alt="" loading="lazy" />}
      <input
        id={id}
        type={type}
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
          <span aria-hidden="true">{image ? __('Replace image', 'wconvert') : __('Choose image', 'wconvert')}</span>
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

/**
 * One of the renderer's six glyphs, for a chip that offers it.
 *
 * The path data is `render.ts`'s and is imported rather than copied — the admin
 * already loads that module to draw previews, so there is one source and
 * nothing to keep in step. A name it has no path for draws nothing, which is
 * exactly what the preview does with the same value.
 */
function Glyph({ name }: { name: string }) {
  const path = GLYPHS[name];

  if (path === undefined) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative in both places: the word under it is the accessible name,
      // and "check, Tick" is the same thing read out twice.
      aria-hidden="true"
      className="wconvert-choice__glyph"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * What this clock counts to, and the way to the field that decides.
 *
 * ============================================================================
 * THREE STATES, AND THE THIRD IS ONE NOTHING ELSE IN THE BUILDER REPORTS.
 * ============================================================================
 * An `ends_at` in the past means the Optin is outside its window: it shows
 * nothing and records no Impression (ADR 0050), correctly and silently. That is
 * also said on the *How often* summary now, which is where a merchant reading
 * their rules meets it; this is where a merchant looking at the clock does.
 *
 * **The preview keeps its fake deadline.** `Preview.tsx`'s `A_PREVIEW_DEADLINE`
 * argues its own case and it holds: a dead clock is a preview of nothing, and
 * the preview is a picture of the DESIGN the same way the placeholder headline
 * beside it is. The truth about this Optin belongs in the inspector.
 *
 * **The date is a wall time and is never `new Date(stored)`** — see
 * {@see momentOf} for what that shape does on the wrong engine.
 */
function Countdown({
  endsAt,
  onSetEndDate,
}: {
  readonly endsAt?: string;
  readonly onSetEndDate?: () => void;
}) {
  const moment = momentOf(endsAt);
  const spelled = readable(endsAt);
  const finished = moment !== null && moment.getTime() < Date.now();

  return (
    <div className="wconvert-slot__note">
      <p className="text-note">
        {spelled === null
          ? __('This Optin has no end date, so the clock will be empty on the page.', 'wconvert')
          : finished
            ? sprintf(
                /* translators: %s: a date and time the Optin stopped running. */
                __('Counted down to %s. This Optin has already stopped running.', 'wconvert'),
                spelled,
              )
            : sprintf(
                /* translators: %s: a date and time the Optin stops running. */
                __('Counts down to %s — when this Optin stops running.', 'wconvert'),
                spelled,
              )}
      </p>

      {/* The same 24px tier: this repairs the group it sits in rather than
          acting on the Optin. */}
      {onSetEndDate !== undefined && (
        <Button type="button" variant="secondary" size="xs" onClick={onSetEndDate}>
          <CalendarClock aria-hidden="true" />
          {/*
            Two labels, because one of them would be wrong half the time: *Set
            an end date* over a date that is already set reads as an offer to
            add a second one.
          */}
          {spelled === null
            ? __('Set an end date', 'wconvert')
            : __('Change the end date', 'wconvert')}
        </Button>
      )}
    </div>
  );
}
