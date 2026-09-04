import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ObjectPicker } from './rules/ObjectPicker';
import type { RuleParam } from './api';

/**
 * One control per param kind — the whole of what the rules UI can draw.
 *
 * ============================================================================
 * THE REAL OR CASES ARE SET-VALUED SCALARS. THERE IS NO GROUPING UI.
 * ============================================================================
 * "Mobile or tablet", "from Google or Bing" — one rule carrying several
 * values, never two rules under an `or` (ADR 0005). So the two set controls
 * here take a LIST on one rule and there is nowhere in this file to nest a
 * condition inside another: no group, no bracket, no `any of / all of`. The
 * nesting ceiling is recorded as permanent rather than "not in v1" precisely
 * because "we'll add OR later" is the path by which an expression language
 * arrives, and a builder that drew the brackets would be that path.
 *
 * The kinds are spelled here as well as in the rule manifest, which is the
 * same duplicate `goals/availability.ts` carries: there is nothing else about
 * a control to declare, so a file between the two would have one column.
 * `tests/js/builder-controls.test.tsx` is what stops them drifting — it asks
 * this component for every kind the manifest names and looks at what came
 * back.
 */

export interface ParamControlProps {
  readonly id: string;
  readonly param: RuleParam;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
}

export function ParamControl({ id, param, value, onChange }: ParamControlProps) {
  switch (param.control) {
    case 'boolean':
      return (
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
      );

    case 'seconds':
    case 'percent':
      return (
        <input
          id={id}
          type="number"
          className="small-text"
          min={0}
          max={param.control === 'percent' ? 100 : undefined}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        />
      );

    /**
     * A money threshold, in the store's own currency.
     *
     * No symbol and no locale formatting, deliberately: the store's currency
     * is a WooCommerce setting this bundle does not read, and a control that
     * printed the wrong one would be worse than a control that prints none.
     * The label carries the fact instead. `step` allows minor units, since a
     * threshold of 49.99 is the one a merchant actually writes.
     */
    case 'amount':
      return (
        <input
          id={id}
          type="number"
          className="small-text"
          min={0}
          step="0.01"
          value={typeof value === 'number' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        />
      );

    /**
     * ========================================================================
     * BOTH OF THESE WERE `<input type="number" min={1}>`.
     * ========================================================================
     * Which meant "show this on the pricing page" was: leave the builder, find
     * the post id, come back and type it. The value is still a STRING, because
     * that is what a Targeting rule stores — `TargetingRule` casts its scalar
     * to one on the way in, and a number here would round-trip to a different
     * value than the one that was saved.
     */
    case 'post_id':
    case 'term_id':
      return (
        <ObjectPicker
          id={id}
          kind={param.control === 'post_id' ? 'post' : 'term'}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
        />
      );

    case 'post_type':
      return (
        <select id={id} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">{__('Choose…', 'wconvert')}</option>
          {param.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    // Two closed sets drawn the same way, and closed for two different
    // reasons: the device buckets are the manifest's, and the roles are the
    // SITE's — every role it registered, plus whatever a membership or LMS
    // adapter offers beside them (`src/Targeting/RoleRegistry.php`). Both are
    // several values on ONE rule, which is how ADR 0005 answers the real OR
    // cases without any boolean structure.
    case 'device_set':
    case 'role_set':
      return <OptionSet id={id} param={param} value={value} onChange={onChange} />;

    case 'text_set':
      return <ValueList value={value} onChange={onChange} />;

    case 'referrer_set':
      return <SourceSet id={id} param={param} value={value} onChange={onChange} />;

    case 'hours':
      return <HourRange id={id} value={value} onChange={onChange} />;

    default:
      return (
        <input
          id={id}
          type="text"
          className="regular-text"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
        />
      );
  }
}

/** A set drawn from a closed list — several values on ONE rule (ADR 0005). */
function OptionSet({ id, param, value, onChange }: ParamControlProps) {
  const chosen = Array.isArray(value) ? (value as unknown[]) : [];

  // A group of checkboxes rather than one control, so it carries `role` and a
  // pointer at its own name instead of an `id` no `<label>` can point at.
  return (
    <span className="wconvert-option-set" role="group" aria-labelledby={id}>
      {param.options.map((option) => (
        <label key={option.value}>
          <input
            type="checkbox"
            checked={chosen.includes(option.value)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? // Rebuilt in the option order rather than appended, so two
                    // rules choosing the same buckets in a different order are
                    // the same rule. Otherwise the panel would draw one preset
                    // for one of them and "custom" for the other.
                    param.options.map((each) => each.value).filter((each) => each === option.value || chosen.includes(each))
                  : chosen.filter((each) => each !== option.value),
              )
            }
          />{' '}
          {option.label}
        </label>
      ))}
    </span>
  );
}

/**
 * The traffic sources, closed and open halves of ONE set.
 *
 * ============================================================================
 * TWO KINDS OF MEMBER, ONE SET-VALUED SCALAR. NOT TWO PARAMS.
 * ============================================================================
 * A merchant targets *"search or social"* or *"anyone arriving from
 * partner.example"*, and both are the same question — where the visit came
 * from — so both land in one `in` array. Split across two params, every rule
 * using only one of them would read as *"needs Came from and Any of these
 * sites"* in its section summary, because a summary reports any declared param
 * it was given no value for ({@link ../rules/sentence.ts}). One param has no
 * such half-filled state.
 *
 * The closed half is rebuilt in OPTION order and the typed half keeps the
 * merchant's, so one rule has one spelling and the preset the panel draws does
 * not depend on the order the boxes were ticked in — the same rule
 * {@link OptionSet} follows, for the same reason.
 */
function SourceSet({ id, param, value, onChange }: ParamControlProps) {
  const chosen = (Array.isArray(value) ? (value as unknown[]) : []).map((each) => String(each));
  const options = param.options.map((option) => option.value);
  // A member that is not one of the closed sources is a site the merchant
  // named. The three source names are therefore reserved words, which costs
  // nothing: none of them is a hostname.
  const sources = chosen.filter((each) => options.includes(each));
  const sites = chosen.filter((each) => !options.includes(each));

  const write = (nextSources: string[], nextSites: string[]): void =>
    onChange([...options.filter((each) => nextSources.includes(each)), ...nextSites]);

  return (
    <span
      className="wconvert-option-set wconvert-source-set"
      role="group"
      aria-labelledby={id}
      aria-describedby={`${id}-hint`}
    >
      {param.options.map((option) => (
        <label key={option.value}>
          <input
            type="checkbox"
            checked={sources.includes(option.value)}
            onChange={(event) =>
              write(
                event.target.checked
                  ? [...sources, option.value]
                  : sources.filter((each) => each !== option.value),
                sites,
              )
            }
          />{' '}
          {option.label}
        </label>
      ))}
      {/*
        A lead-in rather than a bare column of inputs, because a text box with
        three checkboxes beside it and nothing said about it is a control a
        merchant has to guess at. It stays inside the ONE group: the group's
        name is the param's ("Came from") and it covers both halves, which is
        what makes them read as one answer rather than two settings.
      */}
      <span className="wconvert-source-set__sites">
        <span className="wconvert-param__name">{__('or from these sites', 'wconvert')}</span>{' '}
        <ValueList value={sites} onChange={(next) => write(sources, (next as string[]) ?? [])} />
      </span>
    </span>
  );
}

/**
 * A recurring daily window: two times, ONE stored value.
 *
 * ============================================================================
 * A HALF-FILLED WINDOW IS WRITTEN AS NO WINDOW, AND THAT IS THE WHOLE DESIGN.
 * ============================================================================
 * `time_of_day` declares one param because a window has no honest half-filled
 * spelling. Two params — a `from` and a `to` — would leave a merchant who had
 * filled one reading *"Time of day — needs To"* on the collapsed row, and
 * worse, would let a `from` with no `to` be SAVED as a rule that holds for
 * nobody. So this writes `undefined` until both ends are chosen, and the
 * section summary says the row needs its hours.
 *
 * The two ends the merchant is part way through therefore have nowhere in
 * `config` to live, which is what {@link typing} is for. It leads the stored
 * value only while the window is incomplete — the moment it is whole, the two
 * agree — so a WINDOW written from outside this control, by a preset, is
 * recognised by not being what this draft would have written, and wins.
 *
 * The one case it does not recognise is an outside write of *nothing*, which
 * is indistinguishable from the draft's own: a half-typed window survives a
 * preset being cleared. That costs a merchant one visible end they have not
 * saved and were about to finish, and closing it would mean this control
 * holding a second flag about who wrote last.
 *
 * The times are the SITE's, and {@link HINTS} says so under the group: an
 * `<input type="time">` shows the visitor's own locale formatting, and a
 * merchant reading their opening hours as each visitor's local morning targets
 * the wrong people.
 */
function HourRange({ id, value, onChange }: Omit<ParamControlProps, 'param'>) {
  const stored = typeof value === 'string' ? value : '';
  const [typing, setTyping] = useState(stored);
  const shown = written(typing) === stored ? typing : stored;
  const [from, to] = shown.split('-');

  const write = (next: string) => {
    setTyping(next);
    // Only a whole window travels. An emptied end is "no window", never a
    // boundary at midnight — the same reading `HowOften.tsx` takes of an
    // emptied number and `Schedule` takes of an emptied date.
    onChange(written(next) === '' ? undefined : next);
  };

  return (
    <span className="wconvert-hours" role="group" aria-labelledby={id} aria-describedby={`${id}-hint`}>
      <label>
        {__('From', 'wconvert')}{' '}
        <input type="time" value={from ?? ''} onChange={(event) => write(`${event.target.value}-${to ?? ''}`)} />
      </label>
      <label>
        {__('To', 'wconvert')}{' '}
        <input type="time" value={to ?? ''} onChange={(event) => write(`${from ?? ''}-${event.target.value}`)} />
      </label>
    </span>
  );
}

/**
 * What a draft would be STORED as: a whole window, or nothing.
 *
 * **Two ends the same is not a window**, and it is refused here rather than
 * left to fail shut in the loader. `09:00-09:00` passes the shape test and
 * contains no minute — the state
 * {@see \WConvert\Optin\Schedule::isImpossible()} refuses one scope up, for
 * the reason `CONTEXT.md` gives about a schedule: an Optin that is published
 * and can never show is a state the merchant has no word for. Unwritten, the
 * section summary says the row still needs its hours.
 */
const written = (draft: string): string => {
  const found = /^(\d\d:\d\d)-(\d\d:\d\d)$/.exec(draft);

  return found !== null && found[1] !== found[2] ? draft : '';
};

/** A set the merchant types — one value per row, and no way to nest one. */
function ValueList({ value, onChange }: Omit<ParamControlProps, 'param' | 'id'>) {
  const values = (Array.isArray(value) ? (value as unknown[]) : []).map((each) => String(each));
  // Always one empty row at the end, so adding a value is typing rather than
  // finding a button first.
  const rows = [...values, ''];

  const write = (at: number, next: string) =>
    onChange(rows.map((row, index) => (index === at ? next : row)).filter((row) => row !== ''));

  return (
    <span className="wconvert-value-list">
      {rows.map((row, index) => (
        <span key={index}>
          <input
            type="text"
            className="regular-text"
            value={row}
            onChange={(event) => write(index, event.target.value)}
          />
          {row !== '' && (
            <button type="button" className="button-link" onClick={() => write(index, '')}>
              {__('Remove', 'wconvert')}
            </button>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * What a control has to say for itself beyond its own name.
 *
 * ============================================================================
 * KEYED ON THE CONTROL, BECAUSE THIS BUNDLE SPELLS NO RULE TYPE.
 * ============================================================================
 * The vocabulary is `resources/rules/manifest.json` and its words are PHP's,
 * where `wp i18n make-pot` can see them — so a caveat about one rule type has
 * nowhere in that split to live: it is not the type's NAME, not a param's, and
 * not a phrase a summary reads. What it is about is the control, which is the
 * one thing this file already declares (`api.ts`).
 *
 * **Each of the three earns it.** `document.referrer` is
 * the page immediately before this one and nothing more — absent on a direct
 * visit, absent where a referrer policy strips it, never a session history. A
 * merchant who reads the rule as *"originally arrived from Google"* targets the
 * wrong people and blames the plugin, and reconstructing a first touch is not
 * the alternative: a source held across page views is a per-visitor fact with a
 * lifetime, which is the shape ADR 0017 refuses.
 *
 * Lazy, so the strings are translated when the panel renders rather than when
 * this module is first evaluated — the same reason nothing else here is a
 * module-level constant.
 */
const HINTS: Partial<Record<RuleParam['control'], () => string>> = {
  referrer_set: () =>
    __(
      'The page they were on immediately before this one — not where they first found your site. A visit with no previous page counts as Direct.',
      'wconvert',
    ),
  hours: () =>
    __(
      'Your site’s own time, not each visitor’s. A window may run past midnight — 22:00 to 02:00 is overnight.',
      'wconvert',
    ),
  role_set: () =>
    __(
      'Holding any one of these is enough. Signed-out visitors hold none, so choosing any role means signed-in visitors only.',
      'wconvert',
    ),
};

/**
 * The controls that are SEVERAL controls, and therefore a named group.
 *
 * `<label>` points at exactly one form control, so a set of checkboxes, a list
 * of values or a pair of times wrapped in one leaves the param's name attached
 * to whichever the browser picks — which reads as a checkbox called "Shows on"
 * and two with no name at all. A list rather than a property on the param,
 * because it is a fact about how this file DRAWS a control and the manifest
 * describes the value rather than the markup.
 */
const GROUPS: ReadonlySet<RuleParam['control']> = new Set<RuleParam['control']>([
  'device_set',
  'text_set',
  'referrer_set',
  'role_set',
  'hours',
]);

/**
 * One param, with its name attached to its control the way an assistive
 * technology reads it.
 *
 * ============================================================================
 * A SET IS SEVERAL CONTROLS, SO IT IS A GROUP AND NOT A LABEL.
 * ============================================================================
 * `<label>` points at exactly one form control. A device set is three
 * checkboxes and a value list is a column of inputs, so wrapping either in a
 * label leaves the name attached to whichever one the browser picks — which
 * reads as a checkbox called "Shows on" and two with no name at all. Those get
 * a named group instead.
 *
 * This file already cites wp.org Guideline 9 about not drawing controls a user
 * cannot use; a control they cannot hear the name of is the same failure one
 * layer down.
 */
export function ParamField({ id, param, value, onChange }: ParamControlProps) {
  const control = <ParamControl id={id} param={param} value={value} onChange={onChange} />;
  const hint = HINTS[param.control];

  if (GROUPS.has(param.control)) {
    return (
      <span className="wconvert-param">
        <span id={id} className="wconvert-param__name">
          {param.label}
        </span>{' '}
        {control}
        {hint !== undefined && (
          <span id={`${id}-hint`} className="wconvert-param__hint text-note">
            {hint()}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="wconvert-param">
      <label htmlFor={id}>{param.label}</label> {control}
    </span>
  );
}
