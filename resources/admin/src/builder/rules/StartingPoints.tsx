import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Lock } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { renderingFor, tierName } from '../../goals/availability';
import { ConfirmDialog } from '../../shell/ConfirmDialog';
import { Description } from '../../shell/Description';
import { listWithAnd } from './sentence';
import type { Frequency, RuleBundle, Targeting } from '../api';

/**
 * [[Starting point]]s: a named set of rules to begin from.
 *
 * ============================================================================
 * THEY ARE NOT CALLED PRESETS, AND THE NAME IS THE DECISION.
 * ============================================================================
 * `preset` already means a per-type shortcut on this very screen — `presets.ts`,
 * `RulePreset`, `RuleLabels::presets()` — and both would have been on the
 * screen at once, since a Starting point that lands *"after a few seconds"* is
 * a bundle whose content is a preset. Two meanings of one word is exactly what
 * CONTEXT.md's glossary exists to prevent.
 *
 * ============================================================================
 * APPLYING REPLACES THE SECTIONS IT NAMES, AND CONFIRMS FIRST.
 * ============================================================================
 * A bundle carries only the sections it fills, so one holding Conditions
 * leaves the merchant's Triggers alone — an Optin with no Trigger can never
 * fire and the save route refuses one outright, so a button that wiped them
 * would break the Optin it was offered to improve.
 *
 * **And it asks.** ADR 0039's exception to confirming — that an action which
 * is trivially undoable does not need one — is bought with undo, and the
 * builder's history watches `template` only. Rules are not undoable, so
 * replacing a merchant's Triggers with one click is a change they cannot walk
 * back.
 *
 * **A bundle this install cannot run is explained rather than hidden**, through
 * the same cascade every other absence uses: this is a settings list, so it
 * explains the gap (ADR 0026). `unavailable` never renders as an upsell.
 */
export interface StartingPointsProps {
  readonly bundles: readonly RuleBundle[];
  readonly onApply: (patch: BundlePatch) => void;
}

/** What applying one bundle changes — only the sections it named. */
export interface BundlePatch {
  readonly triggers?: readonly { type: string }[];
  readonly conditions?: readonly { type: string }[];
  readonly targeting?: Targeting;
  readonly frequency?: Frequency;
}

export function StartingPoints({ bundles, onApply }: StartingPointsProps) {
  const [pending, setPending] = useState<RuleBundle | null>(null);

  if (bundles.length === 0) {
    return null;
  }

  return (
    <div className="wconvert-starters">
      <h3>{__('Starting points', 'wconvert')}</h3>
      <Description>
        {__('A ready-made set of rules. Applying one replaces only the sections it names.', 'wconvert')}
      </Description>

      <ul className="wconvert-starters__list">
        {bundles.map((bundle) => {
          const rendering = renderingFor(bundle.availability, 'settings_list');

          /*
            ==================================================================
            THE CARD IS THE CONTROL, SO THERE IS NO BUTTON ON IT.
            ==================================================================
            Every card carried a `Use this` — seven copies of one word under
            seven descriptions, in a grid where the card is obviously the thing
            you press. Removing it takes a row out of every card and takes
            nothing away: the card was already the affordance.

            **A `<button>` may hold only phrasing content**, so the lines are
            `<span>`s. A `<p>` in here is invalid markup that browsers silently
            reflow — the same trap `Section`'s summary has.
          */
          if (rendering === 'offer') {
            return (
              <li key={bundle.id}>
                <button type="button" className="wconvert-starter" onClick={() => setPending(bundle)}>
                  <span className="wconvert-starter__head">
                    <span className="wconvert-starter__name text-body font-semibold">{bundle.label}</span>
                  {/*
                    Which sections applying it replaces — a CLASSIFICATION, and
                    a badge is what a classification looks like. It had a line
                    of its own in the small-caps label register, which gave a
                    piece of metadata the same weight as the pitch above it.
                  */}
                    <Badge variant="secondary" className="wconvert-starter__tag">
                      {sectionsIn(bundle)}
                    </Badge>
                  </span>
                  <span className="wconvert-starter__what text-note text-muted-foreground">
                    {bundle.description}
                  </span>
                </button>
              </li>
            );
          }

          /*
            Not a disabled button — there is nothing here to press, and wp.org
            Guideline 9 is about showing a real control a merchant cannot use.
            The badge slot carries the REASON instead of the sections, because
            "you cannot use this" outranks "this is a When rule" for somebody
            who cannot use it.

            The cascade is `renderingFor`'s rather than one written out again:
            `locked` and `unavailable` must never collapse into a single "not
            available", because that is how a merchant with no store gets sold
            Pro for a feature Pro would not give them either (ADR 0026).
          */
          return (
            <li key={bundle.id}>
              <div className="wconvert-starter wconvert-starter--absent">
                <span className="wconvert-starter__head">
                  <span className="wconvert-starter__name text-body font-semibold">{bundle.label}</span>
                  {rendering === 'upsell' ? (
                    <Badge variant="secondary" className="wconvert-starter__tag">
                      <Lock aria-hidden="true" />
                      {/*
                        A Starting point is a GROUP of rules and carries no
                        `tier` of its own — it is locked when any rule in it is
                        (`RuleCatalogue`). So this names no rung, and takes the
                        word the product has always used (ADR 0056). If a
                        bundle ever declares a tier, this is the one call site
                        that should be handed it.
                      */}
                      {tierName(undefined)}
                    </Badge>
                  ) : (
                    // Amber is the reserved meaning it already carries on the
                    // Optin list: the SITE is holding this back (ADR 0037).
                    <Badge variant="warning" className="wconvert-starter__tag">
                      {sprintf(
                        /* translators: %s: the plugin the site needs, e.g. “WooCommerce”. */
                        __('Needs %s', 'wconvert'),
                        bundle.requires_label ?? __('another plugin', 'wconvert')
                      )}
                    </Badge>
                  )}
                </span>
                <span className="wconvert-starter__what text-note text-muted-foreground">
                  {bundle.description}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.label ?? ''}
        description={
          pending === null
            ? ''
            : sprintf(
                /* translators: %s: the sections it replaces, e.g. “When and Who”. */
                __('This replaces what you have under %s. It cannot be undone.', 'wconvert'),
                sectionsIn(pending)
              )
        }
        confirmLabel={__('Replace these rules', 'wconvert')}
        onConfirm={() => {
          if (pending !== null) {
            onApply(patchOf(pending));
            setPending(null);
          }
        }}
      />
    </div>
  );
}

/**
 * The sections a bundle names, in the order they appear on screen.
 *
 * Read off the keys the response carries rather than from a list kept beside
 * it, so the words and the effect cannot disagree: what the confirmation names
 * is what {@link patchOf} sends.
 */
function sectionsIn(bundle: RuleBundle): string {
  const named: string[] = [];

  if (bundle.targeting !== undefined) {
    named.push(__('Where', 'wconvert'));
  }

  if (bundle.triggers !== undefined) {
    named.push(__('When', 'wconvert'));
  }

  if (bundle.conditions !== undefined) {
    named.push(__('Who', 'wconvert'));
  }

  if (bundle.frequency !== undefined) {
    named.push(__('How often', 'wconvert'));
  }

  return listWithAnd(named);
}

/** The bundle as a patch — exactly the sections it carries, and no others. */
function patchOf(bundle: RuleBundle): BundlePatch {
  const patch: BundlePatch = {};

  return {
    ...patch,
    ...(bundle.triggers === undefined ? {} : { triggers: bundle.triggers }),
    ...(bundle.conditions === undefined ? {} : { conditions: bundle.conditions }),
    ...(bundle.targeting === undefined ? {} : { targeting: bundle.targeting }),
    ...(bundle.frequency === undefined ? {} : { frequency: bundle.frequency }),
  };
}
