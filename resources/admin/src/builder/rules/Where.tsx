import { __ } from '@wordpress/i18n';
import { Description } from '../../shell/Description';
import { ParamField } from '../controls';
import { RuleRows, type Row } from '../RuleRows';
import type { RuleType, Targeting } from '../api';

/**
 * *Where* it may appear — the Targeting axis, as the Where section's body.
 *
 * ============================================================================
 * EXCLUDE BEATS INCLUDE, AND THE SCREEN SAYS SO.
 * ============================================================================
 * The axis is an include list unioned, an exclude list unioned, and exclude
 * winning (CONTEXT.md, Targeting). A merchant who has put the checkout in both
 * lists has asked a question the rule already answers, and a builder that let
 * them find out from a live site is a builder that made them guess.
 *
 * **An empty include list is "everywhere", not "nowhere"** — the only reading
 * under which an exclude-only Optin, everywhere except the checkout, means
 * anything. That is stated on screen for the same reason: the empty state is
 * where the surprise would live.
 *
 * **`logged_in` is held apart from the two lists**, as a field beside them.
 * The lists are a union of page SETS, so a visitor rule dropped into the
 * include list would widen the Optin to the whole site for anyone matching it.
 * Read whole, the axis is `page-set AND logged_in` (ADR 0005).
 *
 * This was `TargetingEditor`, whole; what it lost is its own `<h3>`, because
 * the section above it is the heading now.
 */
export interface WhereProps {
  readonly types: readonly RuleType[];
  readonly targeting: Targeting;
  readonly onChange: (targeting: Targeting) => void;
}

/**
 * The one visitor predicate, and the three answers it has.
 *
 * Unset means **do not ask**, which is not the same as false: an Optin that
 * does not care whether the visitor is signed in is a different thing from one
 * that shows only to signed-out visitors, and collapsing them into a checkbox
 * would make "any visitor" unspellable.
 */
const SIGNED_IN = [
  { value: '', label: __('Anyone', 'wconvert') },
  { value: 'yes', label: __('Only signed-in visitors', 'wconvert') },
  { value: 'no', label: __('Only signed-out visitors', 'wconvert') },
];

export function Where({ types, targeting, onChange }: WhereProps) {
  // The five page rules. `logged_in` is on this axis only because the client
  // cannot read WordPress's HttpOnly auth cookie, and it is not a page set.
  const pages = types.filter((type) => type.kind === 'page');
  const visitor = types.find((type) => type.kind === 'visitor');

  const setList = (list: 'include' | 'exclude', rules: { type: string; value: unknown }[]) =>
    onChange({ ...targeting, [list]: rules });

  return (
    <>
      <Description>{__('Empty means everywhere. Exclusions always win.', 'wconvert')}</Description>

      <RuleList
        list="include"
        heading={__('Show it on', 'wconvert')}
        empty={__('Everywhere on the site.', 'wconvert')}
        types={pages}
        rules={targeting.include ?? []}
        onChange={(rules) => setList('include', rules)}
      />

      <RuleList
        list="exclude"
        heading={__('But never on', 'wconvert')}
        empty={__('Nowhere is excluded.', 'wconvert')}
        types={pages}
        rules={targeting.exclude ?? []}
        onChange={(rules) => setList('exclude', rules)}
      />

      {visitor !== undefined && (
        <p>
          <label>
            {visitor.label}{' '}
            <select
              value={targeting.logged_in === undefined ? '' : targeting.logged_in ? 'yes' : 'no'}
              onChange={(event) => {
                // Cleared rather than set to false: unset means "do not ask",
                // and an Optin that does not care whether the visitor is
                // signed in is a different thing from one that shows only to
                // signed-out visitors.
                const next = { ...targeting };

                delete next.logged_in;

                onChange(event.target.value === '' ? next : { ...next, logged_in: event.target.value === 'yes' });
              }}
            >
              {SIGNED_IN.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </p>
      )}
    </>
  );
}

interface RuleListProps {
  /** `include` or `exclude` — a stable key, so a control id is not a translated string. */
  readonly list: string;
  readonly heading: string;
  readonly empty: string;
  readonly types: readonly RuleType[];
  readonly rules: readonly { type: string; value: unknown }[];
  readonly onChange: (rules: { type: string; value: unknown }[]) => void;
}

/**
 * One list, typed.
 *
 * A Targeting rule is `{type, value}` and nothing else, and the control its
 * value takes follows from the type — a post id is a picker over
 * `wp/v2/search`, a content type is a select of what this site registers, a
 * path is a glob. Which is what makes this a picker rather than a pair of
 * free-text boxes.
 */
function RuleList({ list, heading, empty, types, rules, onChange }: RuleListProps) {
  const rows: Row[] = rules.map((rule, at) => {
    const type = types.find((each) => each.type === rule.type);

    return {
      key: String(at),
      content:
        type === undefined ? (
          <code>{rule.type}</code>
        ) : (
          <>
            <strong>{type.label}</strong>{' '}
            <ParamField
              id={`wconvert-target-${list}-${at}`}
              param={type.params.value}
              value={rule.value}
              onChange={(value) => onChange(rules.map((each, index) => (index === at ? { ...each, value } : each)))}
            />
          </>
        ),
      onRemove: () => onChange(rules.filter((_each, index) => index !== at)),
    };
  });

  return (
    <>
      {/*
        ==================================================================
        A GROUP LABEL, NOT A HEADING — AND IT USED TO BE BOTH.
        ==================================================================
        `.wconvert-editor :is(h2, h3, h4)` sets `--text-heading` (16px), so
        `<h4>Show it on</h4>` rendered LARGER than the section's own summary
        that contains it. The hierarchy read backwards: the child announced
        itself more loudly than the parent.

        It is not a heading in the first place. "Show it on" names the list
        under it the way a field's label names its input, which is
        `--text-micro`'s role — the same register the table headers and
        `Stat`'s labels use (ADR 0037).
      */}
      <p className="wconvert-rules__label text-micro uppercase text-muted-foreground">{heading}</p>
      <RuleRows rows={rows} empty={empty} />
      <p>
        <label>
          {__('Add', 'wconvert')}{' '}
          <select
            value=""
            onChange={(event) => {
              if (event.target.value !== '') {
                onChange([...rules, { type: event.target.value, value: '' }]);
              }
            }}
          >
            <option value="">{__('Choose…', 'wconvert')}</option>
            {types.map((type) => (
              <option key={type.type} value={type.type}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      </p>
    </>
  );
}
