import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../../components/ui/button';
import { renderingFor } from '../../goals/availability';
import { ConfirmDialog } from '../../shell/ConfirmDialog';
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
      <p className="description">
        {__('A ready-made set of rules. Applying one replaces only the sections it names.', 'wconvert')}
      </p>

      <ul className="wconvert-starters__list">
        {bundles.map((bundle) => {
          const rendering = renderingFor(bundle.availability, 'settings_list');

          return (
            <li key={bundle.id} className="wconvert-starters__card">
              <p className="wconvert-starters__name">{bundle.label}</p>
              <p className="wconvert-starters__what">{bundle.description}</p>
              <p className="wconvert-starters__sections">{sectionsIn(bundle)}</p>

              {/*
                The cascade is `renderingFor`'s rather than one written out
                again: `locked` and `unavailable` must never collapse into a
                single "not available", because that is how a merchant with no
                store gets sold Pro for a feature Pro would not give them
                either (ADR 0026). `hide` cannot be reached from a settings
                list.
              */}
              {rendering === 'offer' ? (
                <Button variant="outline" size="sm" onClick={() => setPending(bundle)}>
                  {__('Use this', 'wconvert')}
                </Button>
              ) : rendering === 'upsell' ? (
                <span className="wconvert-starters__reason">{__('Included with Pro.', 'wconvert')}</span>
              ) : (
                <span className="wconvert-starters__reason">
                  {sprintf(
                    /* translators: %s: the plugin the site needs, e.g. “WooCommerce”. */
                    __('Needs %s on this site.', 'wconvert'),
                    bundle.requires_label ?? __('something this site does not have', 'wconvert')
                  )}
                </span>
              )}
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
