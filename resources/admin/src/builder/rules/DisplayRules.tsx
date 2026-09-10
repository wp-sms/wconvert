import { __ } from '@wordpress/i18n';
import type { ConvertingAct } from '../structure/catalogue';
import { useEffect, useState } from 'react';
import { entriesOffEveryAxis, entriesOn, visitorWith } from './axis';
import { HowOften } from './HowOften';
import { Section } from './Section';
import { StartingPoints, patchOf, affectedSections, type BundlePatch } from './StartingPoints';
import { Unknown } from './Unknown';
import { When } from './When';
import { Where } from './Where';
import { Who } from './Who';
import { summarise, type DisplayRulesValue } from './summaries';
import { targetingSummary } from './targetingSummary';
import type { Rule, RuleVocabulary, Targeting } from '../api';

/**
 * Display rules: four questions, four disclosures, one flat list underneath.
 *
 * ============================================================================
 * THE SECTIONS ARE A VIEW. NOTHING ABOUT THE RULE MODEL CHANGES.
 * ============================================================================
 * Where, When, Who and How often are four answers a merchant already has to
 * give; what changed is that they can now see each answer without opening it.
 * Underneath, the rules are still flat, still ANDed across axes and ORed
 * within the Trigger one, and **there is still no ALL/ANY grouping anywhere**.
 * ADR 0005's nesting ceiling is permanent rather than "not in v1": "we'll add
 * OR later" is the path by which an expression language arrives, and a builder
 * that drew the brackets would be that path. The connectives in the summaries
 * are the AXES' own, never the merchant's.
 *
 * ============================================================================
 * THE INVARIANT THAT HAD TO SURVIVE THE SPLIT.
 * ============================================================================
 * `RulesEditor` landed every edit at the rule's own index in the flat list,
 * because rebuilding that list from the filtered views would silently reorder
 * the merchant's rules into triggers-then-conditions on every save — and the
 * rule list is a screen they look at.
 *
 * Four files is where that would quietly be lost, so this component owns
 * `rules` and hands When and Who the same four things: `entries` as
 * `[rule, index]` pairs, `replace(at, rule)`, `remove(at)` and `add(rule)`.
 * Neither section is ever given a filtered array, so neither has one to
 * rebuild. That is strictly stronger than what it replaced, where the
 * invariant was a habit rather than a shape.
 *
 * ============================================================================
 * ONE PATCH OUT FOR THE SECTIONS A STARTING POINT REPLACES.
 * ============================================================================
 * Applying a bundle can change Triggers, Conditions, Targeting and the
 * allowance at once. One patch keeps that replacement atomic. Design Undo
 * does not cover rules, so StartingPoints reviews and confirms the replacement.
 */
/**
 * **The value moved to `summaries.ts`, which is where the four sentences are
 * now built.** Re-exported here because this is where a caller looks for it,
 * and because moving a name is not the same as moving a screen.
 */
export type { DisplayRulesValue } from './summaries';

export interface DisplayRulesProps {
  readonly vocabulary: RuleVocabulary;
  readonly value: DisplayRulesValue;
  /**
   * Whether this Optin competes for the screen.
   *
   * `arbitrate()` sorts overlays only, so on an `inline` design the priority
   * control decides nothing and is not drawn.
   */
  readonly overlay: boolean;
  readonly act?: ConvertingAct;
  readonly onChange: (patch: Partial<DisplayRulesValue>) => void;
  /**
   * A section the SCREEN has asked this panel to open, as a fresh object each
   * time it asks.
   *
   * **It exists because a control on another tab points here.** A `countdown`
   * counts to the Optin's `ends_at` and carries no deadline of its own
   * (ADR 0052), so its inspector says what it counts to and offers the route to
   * the field — and a route that lands on a collapsed section is a route that
   * stops one click short (ADR 0054 rule 4).
   *
   * Identity is the signal: a new object means a new request, and null means
   * none has been made. Same shape and same reason as {@see StructureView}'s
   * `focus`, which crosses the same boundary in the other direction.
   */
  readonly reveal?: { readonly id: string; readonly focus?: string } | null;
}

export function DisplayRules({ vocabulary, value, overlay, act = 'submit', onChange, reveal }: DisplayRulesProps) {
  const { rules, targeting, frequency, schedule, priority } = value;
  const client = [...vocabulary.triggers, ...vocabulary.conditions];
  const all = [...vocabulary.targeting, ...client];

  /*
   * **Both visitor predicates are stored on the TARGETING axis and edited
   * under WHO, and that is not an inconsistency to tidy.** They live there
   * because the browser cannot read WordPress's HttpOnly auth cookie, so the
   * server has to answer `logged_in` — and a membership level is a fact
   * another plugin holds, which no browser could answer at all. They are drawn
   * under WHO because *"only signed-in subscribers"* is a question about WHO
   * sees the Optin, and a merchant looks for it under that word.
   *
   * Moving the STORAGE into the rules array to match would break the axis: a
   * visitor rule dropped into an include list WIDENS the Optin to the whole
   * site for anyone matching it, because the list is a union of page sets
   * (ADR 0005, as completed by #21 and extended by #92). Read whole, the axis
   * is `page-set AND logged_in AND roles`.
   */
  /*
   * ==========================================================================
   * TOLD APART BY THEIR CONTROL, BECAUSE THIS BUNDLE SPELLS NO RULE TYPE.
   * ==========================================================================
   * There are two visitor predicates now, so `find(kind === 'visitor')` would
   * silently pick whichever the manifest declared first. Naming them —
   * `'logged_in'`, `'role'` — would put a rule type in this bundle, which is
   * the one vocabulary it deliberately does not have: the manifest owns the
   * types and this file owns the CONTROLS that draw them (`api.ts`).
   *
   * So each is found by the shape of its value, which is exactly what a
   * control is — and that they declare DIFFERENT shapes is asserted rather
   * than assumed, in the same file that pins the visitor half by name
   * ({@link visitorWith}).
   */
  const visitor = visitorWith('boolean', vocabulary.targeting);
  const roleType = visitorWith('role_set', vocabulary.targeting);

  const replace = (at: number, rule: Rule) =>
    onChange({ rules: rules.map((each, index) => (index === at ? rule : each)) });
  const remove = (at: number) => onChange({ rules: rules.filter((_each, index) => index !== at) });
  const add = (rule: Rule) => onChange({ rules: [...rules, rule] });

  const triggers = entriesOn(rules, vocabulary.triggers);
  const conditions = entriesOn(rules, vocabulary.conditions);

  /*
   * **Built by `summaries.ts`, which the readiness panel above these tabs
   * reads too.** The four sentences and the four questions were spelled here
   * and would have been spelled a second time up there — same axes, same
   * order, and two chances to call one of them something different.
   */
  const summaries = summarise(value, vocabulary, overlay, act);
  const [where, who, when, often] = summaries;

  /*
   * ==========================================================================
   * OPEN WHAT NEEDS ATTENTION — NOT WHAT IS SET.
   * ==========================================================================
   * The obvious rule is "open the sections that have rules in them", and it is
   * wrong: a [[Playbook]] prefills rules across three axes, so a brand-new
   * Optin would arrive with three of four sections open and this tab would be
   * LONGER than the four closed rows it replaced.
   *
   * `attention` is already computed, already drives `data-attention`, and is
   * exactly ADR 0042 rule 2 read literally — *open what changes what you do
   * next*. An Optin whose rules are all fine opens nothing and is read off the
   * four summary lines, which is what they are for.
   *
   * **Decided once, on arrival.** These sentences are derived from the value
   * and recompute on every keystroke, so a section keyed off the live
   * `attention` would shut itself under the merchant's hands the moment they
   * fixed the thing it opened for. The initialiser runs once; after that the
   * disclosures are theirs.
   */
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(summaries.filter((axis) => axis.attention).map((axis) => axis.id)),
  );

  /*
   * **Open, then focus — in that order and in two paints.** Radix unmounts a
   * collapsed section's body, so the field does not exist to focus until the
   * open has rendered. `requestAnimationFrame` is what puts the second step
   * after that paint; doing both in one effect focuses nothing at all.
   */
  useEffect(() => {
    if (reveal === undefined || reveal === null) {
      return;
    }

    setOpen((current) => new Set(current).add(reveal.id));

    if (reveal.focus === undefined) {
      return;
    }

    /*
      **`focus()` and nothing else.** It was followed by a `scrollIntoView`,
      which is both redundant — focusing an element scrolls it into view unless
      you pass `preventScroll` — and a crash: jsdom models no layout and does
      not implement the method, so every run threw inside this frame *after* the
      tests had passed, and the suite went green while the job went red.
    */
    const frame = requestAnimationFrame(() => document.getElementById(reveal.focus as string)?.focus());

    return () => cancelAnimationFrame(frame);
  }, [reveal]);

  const opener = (id: string) => (next: boolean) =>
    setOpen((current) => {
      const shown = new Set(current);

      if (next) {
        shown.add(id);
      } else {
        shown.delete(id);
      }

      return shown;
    });

  return (
    <div className="wconvert-sections">
      <p className="m-0 mb-4 text-note text-muted-foreground">{__('Choose eligible pages and visitors, then the moment it appears. Schedule and frequency limits also apply.', 'wconvert')}</p>
      <Section
        id={where.id}
        eyebrow={where.eyebrow}
        summary={where.text}
        attention={where.attention}
        open={open.has(where.id)}
        onOpenChange={opener(where.id)}
      >
        <Where types={vocabulary.targeting} targeting={targeting} onChange={(next) => onChange({ targeting: next })} />
      </Section>

      <Section
        id={who.id}
        eyebrow={who.eyebrow}
        summary={who.text}
        attention={who.attention}
        open={open.has(who.id)}
        onOpenChange={opener(who.id)}
      >
        <Who
          types={vocabulary.conditions}
          entries={conditions}
          replace={replace}
          remove={remove}
          add={add}
          all={all}
          visitor={visitor}
          roleType={roleType}
          loggedIn={targeting.logged_in}
          onLoggedIn={(next) => onChange({ targeting: withLoggedIn(targeting, next) })}
          roles={targeting.roles}
          onRoles={(next) => onChange({ targeting: withRoles(targeting, next) })}
        />
      </Section>

      <Section
        id={when.id}
        eyebrow={when.eyebrow}
        summary={when.text}
        attention={when.attention}
        open={open.has(when.id)}
        onOpenChange={opener(when.id)}
      >
        <When
          types={vocabulary.triggers}
          entries={triggers}
          replace={replace}
          remove={remove}
          add={add}
          all={all}
        />
      </Section>

      <Section
        id={often.id}
        eyebrow={often.eyebrow}
        summary={often.text}
        attention={often.attention}
        open={open.has(often.id)}
        onOpenChange={opener(often.id)}
      >
        <HowOften
          act={act}
          frequency={frequency}
          schedule={schedule}
          priority={priority}
          overlay={overlay}
          onFrequency={(next) => onChange({ frequency: next })}
          onSchedule={(next) => onChange({ schedule: next })}
          onPriority={(next) => onChange({ priority: next })}
        />
      </Section>

      <Unknown entries={entriesOffEveryAxis(rules, client)} remove={remove} all={all} />

      <StartingPoints
        bundles={vocabulary.bundles}
        describe={(bundle) => {
          const nextValue = { ...value, ...applied(patchOf(bundle), value, vocabulary) };
          const next = summarise(nextValue, vocabulary, overlay, act);
          return summaries.filter((axis) => affectedSections(bundle).includes(axis.id)).map((axis) => ({
            label: axis.eyebrow,
            before: axis.id === 'where' ? targetingSummary(value.targeting, vocabulary.targeting, 'review') : axis.text,
            after: axis.id === 'where' ? targetingSummary(nextValue.targeting, vocabulary.targeting, 'review')
              : next.find((replacement) => replacement.id === axis.id)!.text,
          }));
        }}
        onApply={(patch) => onChange(applied(patch, value, vocabulary))}
      />
    </div>
  );
}

/**
 * A [[Starting point]] folded into the working draft.
 *
 * **It replaces the sections the bundle names and nothing else.** A bundle
 * carrying only Conditions leaves the merchant's Triggers where they are —
 * wiping them would leave an Optin that can never fire, which the save route
 * refuses outright, so the "improve my rules" button would break the Optin.
 *
 * The flat list is rebuilt HERE, deliberately and once: replacing one axis
 * means removing the rules of that axis and appending the bundle's, which is
 * the one operation that genuinely cannot be expressed as an edit at an index.
 * It is also the one place a reorder is what the merchant asked for.
 */
function applied(patch: BundlePatch, value: DisplayRulesValue, vocabulary: RuleVocabulary): Partial<DisplayRulesValue> {
  const next: { -readonly [K in keyof DisplayRulesValue]?: DisplayRulesValue[K] } = {};

  if (patch.triggers !== undefined || patch.conditions !== undefined) {
    const replaced = [
      ...(patch.triggers === undefined ? [] : vocabulary.triggers),
      ...(patch.conditions === undefined ? [] : vocabulary.conditions),
    ];

    next.rules = [
      ...value.rules.filter((rule) => !replaced.some((type) => type.type === rule.type)),
      ...((patch.triggers ?? []) as Rule[]),
      ...((patch.conditions ?? []) as Rule[]),
    ];
  }

  if (patch.targeting !== undefined) {
    next.targeting = patch.targeting;
  }

  if (patch.frequency !== undefined) {
    next.frequency = patch.frequency;
  }

  return next;
}

/**
 * The targeting axis with the visitor predicate set, or with it gone.
 *
 * **Cleared rather than stored false.** Unset means *do not ask*, and an Optin
 * that does not care whether the visitor is signed in is a different thing from
 * one that shows only to signed-out visitors — collapsing them into a boolean
 * would make *"anyone"* unspellable.
 */
function withLoggedIn(targeting: Targeting, next: boolean | undefined): Targeting {
  const without = { ...targeting };

  delete without.logged_in;

  return next === undefined ? without : { ...without, logged_in: next };
}

/**
 * The targeting axis with the roles set, or with them gone.
 *
 * **Cleared rather than stored empty**, and the two readings differ by the
 * whole audience: read as a set, an empty one holds for nobody, which would be
 * an Optin that is published and can never show. An emptied control means *any
 * role*, which is *do not ask* — the same reading `src/Targeting/Targeting.php`
 * takes on the way in, so a client that wrote one anyway changes nothing.
 */
function withRoles(targeting: Targeting, next: readonly string[] | undefined): Targeting {
  const without = { ...targeting };

  delete without.roles;

  return next === undefined || next.length === 0 ? without : { ...without, roles: [...next] };
}
