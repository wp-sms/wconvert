import { __, sprintf } from '@wordpress/i18n';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Description } from '../shell/Description';
import type { Connection, Destination, DestinationType, SettingsField } from './api';

/**
 * **The controls a [[Destination]]'s settings schema draws, and the round trip
 * they edit.**
 *
 * ============================================================================
 * EXTRACTED BECAUSE THERE ARE NOW TWO SCREENS, NOT ONE.
 * ============================================================================
 * All of this lived inside `Destinations.tsx`, which was right while a
 * Destination was created nameless and configured afterwards. It is created
 * *named and pointed* now — a merchant with two MailPoet audiences has two
 * routes and has to tell them apart — so {@see AddDestinationDialog} draws the
 * same schema before the Destination exists, and the same round trip has to
 * produce the same stored shape from both. A control copied into the dialog
 * would be a second `fromDraft` waiting to disagree with the first.
 *
 * What did NOT move is the health, the tests and the re-push: those are facts
 * about a configured Destination and there is nothing to say about them at
 * create time.
 */

/**
 * One control per field kind — **the whole of what a Destination's settings UI
 * can draw.**
 *
 * The precedent is `../builder/controls.tsx`, which does the same job for the
 * rules manifest: a schema kind picks a control, and the `default` case is a
 * text input rather than nothing. That default is what makes a new field kind
 * a DEGRADED control instead of an invisible one — a merchant can still type
 * into it, and the value round-trips as a string.
 *
 * **Every value here is a string except `ids`.** The whole draft is held as
 * text while it is being edited, and {@see fromDraft} is the one place that
 * turns it back into what the server stores. `ids` is the exception because
 * WSMS's `tags` is a list — the shape that shipped, and it round-trips
 * unchanged.
 *
 * There is no `select`: nothing in the Destination schemas offers a closed set
 * of options yet, and inventing the control before a field needs it would be
 * guessing at whether the options travel in the schema or come off the wire.
 */
export function SettingsControl({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: SettingsField;
  value: string;
  onChange: (value: string) => void;
}) {
  switch (field.type) {
    /**
     * A list. **Checkboxes where the server could enumerate the choices, and a
     * comma-separated text input where it could not** — the same stored
     * `string[]` either way, so {@see toDraft} and {@see fromDraft} stay one
     * code path and the draft stays the comma-separated string they round-trip.
     *
     * WSMS's `tags` has always been the second of those: the ids are the
     * merchant's own and the admin has no list to offer. MailPoet's are
     * integers nobody could be asked to find, so its schema carries the names
     * and this draws them (#87). A provider that could not be reached sends no
     * options and lands back on the text input, which is a degraded control
     * rather than an invisible one.
     */
    case 'ids':
      return isGroup(field) ? (
        <ChoiceList id={id} options={field.options} value={value} onChange={onChange} />
      ) : (
        <Input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      );

    /**
     * `type="url"` for the keyboard and the browser's own hint, and nothing
     * more: the value is not validated here or on the way in. The push checks
     * what it needs at the moment it needs it, which is the same posture the
     * rest of the settings bag takes.
     */
    case 'url':
      return <Input id={id} type="url" value={value} onChange={(e) => onChange(e.target.value)} />;

    case 'multiline':
      return (
        <textarea
          id={id}
          rows={5}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-body shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'text':
    default:
      return <Input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * Whether a field draws as a group of controls rather than as one control.
 *
 * One predicate, read by both halves — the label association at the call site
 * and the control switch above — so the two cannot disagree about what is
 * being drawn. It narrows `options`, so the group can be handed them without a
 * second check that could drift from this one.
 */
export function isGroup(
  field: SettingsField,
): field is SettingsField & { options: NonNullable<SettingsField['options']> } {
  return LIST_KINDS.has(field.type) && field.options !== undefined && field.options.length > 0;
}

/**
 * A set of checkboxes over a list field's enumerated options.
 *
 * **The draft it edits is still the comma-separated string**, which is the
 * point: `ids` has one stored shape and one round trip, and whether the server
 * could name the choices decides only what the merchant is shown. So this is a
 * control swap and not a second field kind.
 *
 * It is a labelled `role="group"` rather than a labelled control, because the
 * words above a set of checkboxes name the SET and a `for` pointing at one of
 * them would be a lie. The caller's `Label` keeps the words and this points
 * back at it, which is why {@see isGroup} exists there.
 */
function ChoiceList({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: NonNullable<SettingsField['options']>;
  value: string;
  onChange: (value: string) => void;
}) {
  const chosen = new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== ''),
  );

  const offered = options.map((option) => option.value);

  /**
   * **What was stored and is not on offer survives.**
   *
   * A configured id the server did not enumerate — a MailPoet list the
   * merchant binned, one deleted outright — is not a value this control can
   * draw, and rebuilding from `options` alone would delete it the first time
   * anybody ticked any box. That is the same posture {@see fromDraft} takes
   * one level up, where a stored key the type no longer declares is left
   * alone rather than dropped, and for the same reason: a settings bag is
   * opaque, and the screen that cannot draw something must not be the screen
   * that destroys it.
   */
  const kept = [...chosen].filter((entry) => !offered.includes(entry));

  const toggle = (option: string, on: boolean) => {
    const next = new Set(chosen);

    if (on) {
      next.add(option);
    } else {
      next.delete(option);
    }

    // The offered ids in the ORDER THE SERVER GAVE THEM, not in click order,
    // so saving the same set twice produces the same string and unticking and
    // reticking a box does not look like an edit.
    onChange([...kept, ...offered.filter((entry) => next.has(entry))].join(', '));
  };

  return (
    <div id={id} className="flex flex-col gap-2" role="group" aria-labelledby={`${id}-label`}>
      {options.map((option) => (
        <div key={option.value} className="flex items-center gap-2">
          <Checkbox
            id={`${id}-${option.value}`}
            checked={chosen.has(option.value)}
            onCheckedChange={(on) => toggle(option.value, on === true)}
          />
          <Label htmlFor={`${id}-${option.value}`} className="font-normal">
            {option.label}
          </Label>
        </div>
      ))}
    </div>
  );
}

/**
 * The field kinds whose stored value is a **list** rather than a string.
 *
 * One place rather than two `=== 'ids'` checks that have to stay in step:
 * {@see toDraft} and {@see fromDraft} are the two halves of one round trip, and
 * a kind added to one but not the other would read back as a different shape
 * than it was saved as. WSMS's `tags` is the only member today.
 *
 * **It is also the kind that SELECTS a target**, which is the same list PHP's
 * `ConfiguredTarget::SELECTS` names — a Destination points at a set of things,
 * and every other kind on a schema is configuration. The two spellings sit on
 * either side of REST and there is nowhere to put one; the server is the
 * authority, and {@see suggestedName} is the only place this side reads it.
 *
 * The control switch in {@see SettingsControl} is deliberately NOT driven off
 * this: which control to draw and which shape to store are different questions,
 * and `ids` happens to answer both the same way only because a comma-separated
 * text input is what a list has always been edited with here.
 */
export const LIST_KINDS = new Set(['ids']);

/**
 * What is stored, as text a control can edit.
 *
 * Keyed off the SCHEMA rather than off the stored settings, so a field the
 * type declares but nothing has ever saved still gets an empty control — and a
 * stored key the type no longer declares is left alone rather than drawn.
 */
export function toDraft(
  schema: DestinationType['settings_schema'],
  settings: Destination['settings'],
): Record<string, string> {
  const draft: Record<string, string> = {};

  for (const [key, field] of Object.entries(schema)) {
    const stored = settings[key];

    draft[key] = LIST_KINDS.has(field.type)
      ? (Array.isArray(stored) ? (stored as unknown[]) : []).filter((id) => typeof id === 'string').join(', ')
      : typeof stored === 'string'
        ? stored
        : '';
  }

  return draft;
}

/**
 * The text, back in the shape the server stores.
 *
 * **The caller spreads this over the existing settings rather than replacing
 * them**, so a key this type no longer declares — or one a future version
 * wrote — survives a save from this screen. A settings bag is opaque to the
 * REST layer (`DestinationController::store()` validates nothing in it), and a
 * screen that silently dropped what it could not draw would be the one place
 * that opacity bites.
 */
export function fromDraft(
  schema: DestinationType['settings_schema'],
  draft: Record<string, string>,
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema)) {
    const value = draft[key] ?? '';

    settings[key] = LIST_KINDS.has(field.type)
      ? value
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id !== '')
      : value;
  }

  return settings;
}

/**
 * A name to offer for a route about to be created — **the type, and where it
 * is being pointed.**
 *
 * ============================================================================
 * THE ONE CLIENT-SIDE ECHO OF `ConfiguredTarget`, AND IT IS CONFINED TO CREATE.
 * ============================================================================
 * Everywhere a SAVED Destination's target is read out, the server says it:
 * `ConfiguredTarget` is the single spelling of the rule, and it resolves ids
 * against **that Destination's own Connection**, which the browser cannot do —
 * the payload's `settings_schema` is built from the first Connection of the
 * type, so a client-side version would name the second account's audience with
 * the first account's names.
 *
 * At create time there is no saved Destination for the server to describe and
 * no round trip to spend on describing one, so the suggestion is made here off
 * the schema in hand. That is the whole of its licence: **suggest a name for
 * something that does not exist yet.** Anything else asks the server.
 *
 * **Pre-filled and editable, never derived.** Merchants name routes after
 * their own intent — *"Black Friday signups"* — which no derivation can guess,
 * and a name the merchant cannot change is defect 2 of this screen written a
 * second time.
 */
export function suggestedName(
  type: DestinationType,
  draft: Record<string, string>,
): string {
  const named: string[] = [];

  for (const [key, field] of Object.entries(type.settings_schema)) {
    if (!LIST_KINDS.has(field.type)) {
      continue;
    }

    const labels = new Map((field.options ?? []).map((option) => [option.value, option.label]));

    for (const id of (draft[key] ?? '').split(',').map((entry) => entry.trim())) {
      if (id !== '') {
        named.push(labels.get(id) ?? id);
      }
    }
  }

  return named.length === 0
    ? type.label
    : sprintf(
        /* translators: 1: a destination type, e.g. “MailPoet”. 2: what it is pointed at, e.g. “Newsletter”. */
        __('%1$s — %2$s', 'wconvert'),
        type.label,
        named.join(', '),
      );
}

/**
 * Where a [[Destination]]'s [[Lead]]s land, in one line — or nothing at all.
 *
 * ============================================================================
 * THREE STATES, BECAUSE AN EMPTY TARGET MEANS THREE DIFFERENT THINGS.
 * ============================================================================
 * `target` is computed by `ConfiguredTarget` and its docblock owns the
 * reasoning; this is the wording, and the wording is where getting it wrong
 * shows.
 *
 * - `null` — the type selects nothing (the lead-magnet email, a webhook), or
 *   its schema could not be read. **Say nothing.** A lead-magnet Destination
 *   is perfectly configured, and *"not pointed at anything yet"* under it
 *   reports a fault against something that works.
 * - `''` — it selects something and nothing is chosen. That changes what the
 *   merchant does next, so it is said (ADR 0042).
 * - a string — where it lands, in the merchant's own words.
 *
 * Read by the Destinations screen and by the builder's Destinations tab, so
 * the sentence a merchant reads while CHOOSING a Destination is the one they
 * read while configuring it.
 */
export function targetSaid(target: string | null): string | null {
  if (target === null) {
    return null;
  }

  return target === ''
    ? __('Not pointed at anything yet.', 'wconvert')
    : sprintf(
        /* translators: %s: what a destination is pointed at, e.g. “Newsletter”. */
        __('Sending to %s.', 'wconvert'),
        target,
      );
}

/**
 * **Which account this route runs over.**
 *
 * ============================================================================
 * A ROUTE HAS AN ACCOUNT, AND NOTHING HAS EVER LET A MERCHANT CHOOSE ONE.
 * ============================================================================
 * `Destinations.tsx` has passed `destination.connection` through on every save
 * since Connections shipped, and no control has ever set it — so a merchant
 * with two Mailchimp accounts could not say which one a route used. It is
 * latent today, because every type free ships authenticates against nothing
 * and `needs_connection` is false for all three, and it goes live with the
 * first ESP (#35).
 *
 * **Nothing is drawn where the type has no credentials**, rather than a
 * disabled control explaining itself — an empty select over a concept that
 * does not apply is exactly what ADR 0042 rule 3 refuses.
 *
 * With no Connections at all this says so rather than offering an empty
 * select. What it deliberately does NOT do is offer *"Add a new one"*: there
 * is no route that creates a Connection and no screen that draws one, so the
 * option would open nothing. #35 brings both, and the entry point belongs in
 * the same change as the thing it opens.
 */
export function ConnectionPicker({
  id,
  connections,
  value,
  onChange,
}: {
  id: string;
  /** The Connections of THIS type — the caller filters, so this draws what it is given. */
  connections: readonly Connection[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/*
        The words come with the control rather than from the caller, because
        the control has two shapes — a picker and a sentence — and only one of
        them is something a `<label for>` may point at. A label naming an id
        that is not on the page is worse than no label.
      */}
      {connections.length === 0 ? (
        // No control, so no label: the sentence is the whole of what there is
        // to say, and a `<label>` naming nothing is worse than none.
        <Description>
          {__('No account has been added for this destination type yet.', 'wconvert')}
        </Description>
      ) : (
        <>
          <Label htmlFor={id}>{__('Account', 'wconvert')}</Label>
          {/*
            **A native `<select>`**, for the reason `stats/Dashboard.tsx`
            writes out: the vendored Radix select is the right control inside a
            region's toolbar beside other controls we drew, and this is one
            field in a form of fields. `pe-9` clears the arrow the browser
            draws, which Preflight does not strip.
          */}
          <select
            id={id}
            className="h-9 max-w-xl rounded-md border border-input bg-transparent ps-3 pe-9 text-body text-foreground"
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
          >
            <option value="">{__('Choose…', 'wconvert')}</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
