import { __ } from '@wordpress/i18n';
import { ParamField } from '../controls';
import { Description } from '../../shell/Description';
import { RuleRows, type Row } from '../RuleRows';
import { AddRule } from './AddRule';
import { RuleRow } from './RuleRow';
import { repeatable, surplus } from './sentence';
import type { Entry } from './axis';
import type { Rule, RuleType } from '../api';

/**
 * *Who* sees it — the [[Condition]] axis, as the Who section's body.
 *
 * The mirror of {@link When}, and separate from it for the reason the two
 * lists were always separate: a rule type is a Trigger or a Condition and
 * never both (CONTEXT.md, Condition). `scroll_depth` means "when they reach
 * half way" and there is no second spelling meaning "if they already had". One
 * list with a kind column would read as a choice the merchant makes.
 *
 * **Every Condition holds**, so the sentence joins them with "and" — again the
 * axis's own connective. The two sections differ in exactly that word and in
 * nothing else, which is why the shared parts are `RuleRow` and `AddRule`
 * rather than one component taking a discriminator.
 */
export interface WhoProps {
  readonly types: readonly RuleType[];
  readonly entries: readonly Entry[];
  readonly replace: (at: number, rule: Rule) => void;
  readonly remove: (at: number) => void;
  readonly add: (rule: Rule) => void;
  readonly all: readonly RuleType[];
  /**
   * The two visitor predicates' declarations, for their labels and their
   * controls — or undefined on a vocabulary that does not declare one.
   *
   * They are looked up by their param's CONTROL rather than by their rule
   * type, because this bundle spells no rule type of its own: a control is its
   * own vocabulary ({@link ../api}), and a rule type is the manifest's
   * ({@see DisplayRules}).
   */
  readonly visitor: RuleType | undefined;
  readonly roleType: RuleType | undefined;
  /*
   * ==========================================================================
   * THESE TWO COME OUT OF `targeting`, NOT OUT OF `entries`. LEAVE THEM THERE.
   * ==========================================================================
   * Every other control in this section reads the rules array, so a prop
   * reaching in from the targeting axis looks like an inconsistency somebody
   * will want to tidy. Tidying it breaks the axis: a visitor rule dropped into
   * a targeting include list WIDENS the Optin to the whole site for anyone
   * matching it, because that list is a union of page SETS (ADR 0005, as
   * completed by #21).
   *
   * It is stored on the targeting axis because the browser cannot read
   * WordPress's HttpOnly auth cookie, so only the server can answer it. It is
   * DRAWN here because *"only signed-in visitors"* is a question about who sees
   * the Optin, and under that word is where a merchant looks for it. Storage
   * and control answer to different questions and this is where they differ.
   */
  readonly loggedIn: boolean | undefined;
  readonly onLoggedIn: (next: boolean | undefined) => void;
  /**
   * The roles this Optin wants, or undefined for *any role*.
   *
   * Off `targeting` like the one above it, and for a sharper version of its
   * reason: a role is a fact another plugin may hold in the database, and the
   * browser could not answer it even if the auth cookie were readable.
   */
  readonly roles: readonly string[] | undefined;
  readonly onRoles: (next: readonly string[] | undefined) => void;
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

export function Who({
  types,
  entries,
  replace,
  remove,
  add,
  all,
  visitor,
  roleType,
  loggedIn,
  onLoggedIn,
  roles,
  onRoles,
}: WhoProps) {
  // Which of them is a second of a kind that may only be set once. See
  // {@link surplus}: on this axis the trap is worse than on the Trigger one —
  // Conditions are ANDed, so `device [mobile]` beside `device [desktop]` is a
  // rule that can never hold.
  const extra = surplus(entries, all);

  const rows: Row[] = entries.map(([rule, at]) => ({
    key: String(at),
    content: (
      <>
        <RuleRow rule={rule} at={at} types={all} onChange={(next) => replace(at, next)} />
        {extra.has(at) && (
          <p className="wconvert-rule__note text-note">
            {__(
              'Combined with “and” — a second rule of this kind narrows the one above it rather than widening it.',
              'wconvert',
            )}
          </p>
        )}
      </>
    ),
    onRemove: () => remove(at),
  }));

  return (
    <>
      <Description>{__('Visitors must match all the audience rules below when the Optin is ready to appear.', 'wconvert')}</Description>
      <RuleRows rows={rows} empty={__('No extra audience restrictions.', 'wconvert')} />
      {/*
        ======================================================================
        ONE OF EACH, UNLESS TWO OF IT COULD MEAN DIFFERENT THINGS.
        ======================================================================
        Two `query_param`s are two different parameters and are real. Two
        `device`s are an INTERSECTION — "mobile AND desktop" holds for nobody —
        and one rule carrying several values is what the merchant meant, which
        is exactly what a set-valued scalar is for (ADR 0005). So the second is
        not offered.
      */}
      <AddRule
        axis={types.filter(
          (type) => repeatable(type) || !entries.some(([rule]) => rule.type === type.type),
        )}
        label={__('Add a condition', 'wconvert')}
        onAdd={add}
      />

      {/*
        **Under the Add control rather than in the list above it**, because it
        is not a Condition and never becomes one: it is a field on the targeting
        axis with a fixed set of answers, so it has no row to remove and nothing
        to add. It is here because this is the section a merchant looks in.
      */}
      {visitor !== undefined && (
        <p className="wconvert-rules__group">
          <label>
            {visitor.label}{' '}
            <select
              value={loggedIn === undefined ? '' : loggedIn ? 'yes' : 'no'}
              onChange={(event) =>
                onLoggedIn(event.target.value === '' ? undefined : event.target.value === 'yes')
              }
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

      {/*
        **Beside the sign-in question, not inside the list above it**, and for
        exactly its reason. It is a field on the targeting axis: no row to
        remove, nothing to add, and it must not be a member of the include or
        exclude lists — those union PAGE SETS, so a visitor rule in one would
        show the Optin on every page of the site to anyone holding the role.

        Drawn through {@link ParamField} rather than a control written here, so
        the set, its group name and its hint are the manifest's declaration
        exactly as an ordinary rule row would draw them. An emptied set is
        *any role*, never *no role*: the server drops one rather than store a
        set nothing can satisfy.
      */}
      {roleType?.params.value !== undefined && (
        <p className="wconvert-rules__group">
          <ParamField
            id="wconvert-roles"
            param={roleType.params.value}
            value={roles}
            onChange={(next) =>
              onRoles(Array.isArray(next) && next.length > 0 ? (next as string[]) : undefined)
            }
          />
        </p>
      )}
    </>
  );
}
