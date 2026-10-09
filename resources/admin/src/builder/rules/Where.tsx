import { __ } from '@wordpress/i18n';
import { Description } from '../../shell/Description';
import { ParamField } from '../controls';
import { RuleRows, type Row } from '../RuleRows';
import { AddRule } from './AddRule';
import type { Rule, RuleType, Targeting } from '../api';

/**
 * *Where* it may appear — the Targeting axis, as the Where section's body.
 *
 * ============================================================================
 * EXCLUDE BEATS INCLUDE, AND THE SCREEN SAYS SO — WHEN IT MATTERS.
 * ============================================================================
 * The axis is an include list unioned, an exclude list unioned, and exclude
 * winning (CONTEXT.md, Targeting). A merchant who has put the checkout in both
 * lists has asked a question the rule already answers, and a builder that let
 * them find out from a live site is a builder that made them guess.
 *
 * **That sentence used to be standing text.** *"Empty means everywhere.
 * Exclusions always win."* sat above both lists on every visit, and half of it
 * was about a state the merchant could see for themselves — the empty list
 * right below it. ADR 0042 rule 2: say only what changes what they do next. So
 * the "empty means everywhere" half **is** the empty state now, and the
 * precedence half appears only once both lists hold something, which is the
 * only arrangement in which it decides anything.
 *
 * **The visitor predicates moved to the WHO section.** They are still stored
 * on this axis — the browser cannot read WordPress's HttpOnly auth cookie, so
 * only the server can answer `logged_in`, and a membership level is a fact
 * another plugin holds — and read whole the axis is
 * `page-set AND logged_in AND roles` (ADR 0005). What moved is the CONTROLS,
 * to the section a merchant looks in for a question about who sees the Optin
 * — *Who sees it?*, where the quick picks and Custom… write them as rules.
 *
 * This was `TargetingEditor`, whole; what it lost is its own `<h3>`, because
 * the section above it is the heading now.
 */
export interface WhereProps {
  readonly types: readonly RuleType[];
  readonly targeting: Targeting;
  readonly onChange: (targeting: Targeting) => void;
  /** Selected pages is chosen: the include list is the merchant's to edit. */
  readonly showInclude: boolean;
}

export function Where({ types, targeting, onChange, showInclude }: WhereProps) {
  // The five page rules, and only those. The visitor predicates are on this
  // axis only because the client cannot read WordPress's HttpOnly auth cookie,
  // and neither of them is a page set — which is why they are fields rather
  // than members of these two lists.
  const pages = types.filter((type) => type.kind === 'page');

  const include = targeting.include ?? [];
  const exclude = targeting.exclude ?? [];

  const setList = (list: 'include' | 'exclude', rules: { type: string; value: unknown }[]) =>
    onChange({ ...targeting, [list]: rules });

  return (
    <>
      {showInclude && <RuleList
        list="include"
        heading={__('Show it on', 'wconvert')}
        empty={__('Choose at least one page', 'wconvert')}
        attention
        types={pages}
        rules={include}
        onChange={(rules) => onChange({ ...targeting, mode: 'selected', include: rules })}
      />}

      <RuleList
        list="exclude"
        heading={__('But never on', 'wconvert')}
        empty={__('Nowhere is excluded.', 'wconvert')}
        types={pages}
        rules={exclude}
        onChange={(rules) => setList('exclude', rules)}
      />

      {/*
        `mt-3` rather than a margin in the stylesheet: `Description` carries
        `m-0` as a Tailwind utility, which is `!important` (ADR 0035), so no
        hand-written rule can reach it.
      */}
      {include.length > 0 && exclude.length > 0 && (
        <Description className="mt-3">
          {__('Exclusions override included pages.', 'wconvert')}
        </Description>
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
  /** An empty list here is something to fix before publishing. */
  readonly attention?: boolean;
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
function RuleList({ list, heading, empty, types, rules, onChange, attention = false }: RuleListProps) {
  const rows: Row[] = rules.map((rule, at) => {
    const type = types.find((each) => each.type === rule.type);

    return {
      key: String(at),
      content:
        type === undefined ? (
          <span className="wconvert-rule__note">{__('A rule that is not available on this site.', 'wconvert')}</span>
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
    /*
      ==================================================================
      ONE GROUP PER LIST, AND A LABEL RATHER THAN A HEADING.
      ==================================================================
      The two lists rendered as one run of rows down the left margin —
      label, card, Add, label, empty state, Add — with nothing saying where
      "Show it on" ended and "But never on" began. The GROUP is what carries
      "these three belong together"; the label alone was carrying it and
      could not.

      And it is not a heading. `.wconvert-editor :is(h2, h3, h4)` sets 16px,
      so `<h4>Show it on</h4>` rendered LARGER than the section summary that
      contains it — the child announcing itself more loudly than the parent.
      "Show it on" names the list under it the way a field's label names its
      input, which is `--text-micro`'s role (ADR 0037).
    */
    <div className="wconvert-rules__group">
      <h4 className="wconvert-rules__label">{heading}</h4>
      {list === 'include' && rules.length > 1 && <p className="wconvert-display-rule-help">{__('A page only needs to match one of these rules.', 'wconvert')}</p>}
      <RuleRows rows={rows} empty={empty} attention={attention} />
      {/*
        ==================================================================
        THE SAME ADD CONTROL AS THE OTHER THREE SECTIONS, AND THAT CLOSES A
        HOLE RATHER THAN TIDYING ONE.
        ==================================================================
        This was a hand-rolled `<select>` over `types` that called
        `renderingFor` nowhere — so the day a targeting type declares a `tier`
        or a `requires`, it would have been offered on a site that cannot run
        it, with no gate and no explanation. That is the exact failure
        {@see AddRule} was written to close, and it was closed on three axes
        out of four.

        **The shape conversion is here**, at the boundary that owns the shape:
        a Targeting rule is `{type, value}` and `toRule` emits the type's own
        params, so a type declaring `value` with nothing filled in comes back
        without the key. The empty string is what this list has always
        appended, and it is what `ParamField` opens on.
      */}
      <AddRule
        axis={types}
        label={list === 'include' ? __('Add pages', 'wconvert') : __('Exclude pages', 'wconvert')}
        onAdd={(rule: Rule) =>
          onChange([...rules, { type: rule.type, value: rule.value ?? '' }])
        }
      />
    </div>
  );
}
