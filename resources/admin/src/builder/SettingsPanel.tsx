import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Preview } from './Preview';
import { TOKENS, slotsOf, withHidden, withToken, withValue } from './panel';
import { exportEntry, importEntry } from './entry';
import { getThemeTokens } from './api';
import type { Path, Slot } from './panel';
import type { TemplateEntry, TemplateLabels } from '../templates/api';
import type { Template } from '@renderer/types';

/**
 * The settings panel: **tokens, slot content and slot visibility. Never
 * arrangement.**
 *
 * ============================================================================
 * THAT BOUNDARY IS THE WHOLE BARGAIN OF ADR 0010.
 * ============================================================================
 * The vocabulary is the ceiling on design variety and the gallery IS the
 * design surface. A panel that could add, remove or reorder a node would move
 * that ceiling into a builder nobody designed — and it would cost the other
 * half: a canvas lands later as an editor over a tree that already exists,
 * with no migration, precisely because nothing else reshapes the tree in the
 * meantime.
 *
 * So a merchant who does not want the fine print HIDES it, and the `consent`
 * checkbox every capture design ships hidden is switched on the same way —
 * which is how ADR 0032's "off by default" and this boundary are both true at
 * once.
 *
 * The preview beside it is the real design drawn by the renderer the loader
 * imports, so there is nothing here that can disagree with what a visitor
 * sees (ADR 0010).
 */

export interface SettingsPanelProps {
  readonly entry: TemplateEntry;
  readonly labels: TemplateLabels;
  /** `WP_DEBUG`. The export is for whoever is authoring the library. */
  readonly dev: boolean;
  readonly onChange: (template: Template) => void;
  readonly onError: (cause: unknown) => void;
}

export function SettingsPanel({ entry, labels, dev, onChange, onError }: SettingsPanelProps) {
  const [step, setStep] = useState(0);
  const steps = entry.tree.steps.length;
  const shown = Math.min(step, Math.max(steps - 1, 0));

  return (
    <div className="wconvert-panel">
      <div className="wconvert-panel__preview">
        {steps > 1 && (
          <p>
            {entry.tree.steps.map((_node, index) => (
              <button
                key={index}
                type="button"
                className={`button${index === shown ? ' button-primary' : ''}`}
                onClick={() => setStep(index)}
              >
                {/*
                  Terminal is STRUCTURAL — the success state is the last step
                  rather than a flagged one (ADR 0025) — so the name follows
                  from the position and there is no second spelling to keep in
                  step.
                */}
                {index === 0 ? __('The form', 'wconvert') : __('After they submit', 'wconvert')}
              </button>
            ))}
          </p>
        )}
        <Preview template={entry} step={shown} />
      </div>

      <div className="wconvert-panel__controls">
        <Slots template={entry} labels={labels} onChange={onChange} />
        <Tokens template={entry} labels={labels} onChange={onChange} onError={onError} />
        {dev && <DevExport entry={entry} onChange={onChange} />}
      </div>
    </div>
  );
}

/**
 * What each slot says, and whether it is shown.
 *
 * Headed by its [[Slot Role]] where it has one, because that is what the slot
 * IS — a `field`'s Roles are derived from what it captures rather than
 * declared, so it is headed by the kind it captures instead (CONTEXT.md, Slot
 * Role).
 */
function Slots({
  template,
  labels,
  onChange,
}: {
  template: Template;
  labels: TemplateLabels;
  onChange: (template: Template) => void;
}) {
  const slots = slotsOf(template.tree);

  const edit = (path: Path, key: string, value: unknown) =>
    onChange({ ...template, tree: withValue(template.tree, path, key, value) });

  return (
    <>
      <h4>{__('What it says', 'wconvert')}</h4>
      {slots.map((slot) => (
        <fieldset key={slot.path.join('.')} className="wconvert-slot">
          <legend>{headingFor(slot, labels)}</legend>

          {slot.hideable && (
            <label className="wconvert-slot__shown">
              <input
                type="checkbox"
                checked={!slot.hidden}
                onChange={(event) =>
                  onChange({ ...template, tree: withHidden(template.tree, slot.path, !event.target.checked) })
                }
              />{' '}
              {__('Show this', 'wconvert')}
            </label>
          )}

          {slot.keys.map((key) =>
            key === 'link' ? (
              <LinkControl
                key={key}
                label={labels.keys[key] ?? key}
                value={slot.values[key]}
                onChange={(value) => edit(slot.path, key, value)}
              />
            ) : (
              <label key={key} className="wconvert-slot__key">
                {labels.keys[key] ?? key}
                <input
                  type="text"
                  className="widefat"
                  value={typeof slot.values[key] === 'string' ? (slot.values[key] as string) : ''}
                  onChange={(event) => edit(slot.path, key, event.target.value)}
                />
              </label>
            ),
          )}
        </fieldset>
      ))}
    </>
  );
}

function headingFor(slot: Slot, labels: TemplateLabels): string {
  if (slot.role !== null) {
    return labels.roles[slot.role] ?? slot.role;
  }

  if (slot.captures !== null) {
    return labels.fields[slot.captures] ?? slot.captures;
  }

  return labels.nodes[slot.type] ?? slot.type;
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
function LinkControl({
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
 * The look, as token values — and the one place theme inheritance happens.
 *
 * **Opt-in, and a VALUE COPY.** The button reads the site's palette once and
 * writes the values into these controls, where the merchant can see and change
 * every one of them. Nothing records where a value came from, so switching
 * theme later cannot restyle a running Optin — the same reason an Optin takes
 * a copy of its Template rather than a link to it (ADR 0010).
 *
 * Default off is the absence of the button having been pressed. A stored flag
 * would be the live link this exists not to be.
 */
function Tokens({
  template,
  labels,
  onChange,
  onError,
}: {
  template: Template;
  labels: TemplateLabels;
  onChange: (template: Template) => void;
  onError: (cause: unknown) => void;
}) {
  const [copied, setCopied] = useState<number | null>(null);

  const copyTheme = () => {
    getThemeTokens()
      .then(({ tokens }) => {
        onChange({
          ...template,
          tokens: Object.entries(tokens).reduce(
            (carried, [name, value]) => withToken(carried, name, value),
            template.tokens,
          ),
        });
        setCopied(Object.keys(tokens).length);
      })
      .catch(onError);
  };

  return (
    <>
      <h4>{__('How it looks', 'wconvert')}</h4>
      <p>
        <button type="button" className="button" onClick={copyTheme}>
          {__('Copy my theme’s colours', 'wconvert')}
        </button>{' '}
        {copied !== null && (
          <span className="description">
            {copied === 0
              ? __('Your theme declares no palette to copy.', 'wconvert')
              : __('Copied. Change any of them below.', 'wconvert')}
          </span>
        )}
      </p>
      {TOKENS.map((token) => (
        <label key={token.name} className="wconvert-token">
          {labels.tokens[token.name] ?? token.name}
          <input
            type="text"
            className="regular-text"
            // The template's own value is the placeholder rather than the
            // value, so an empty control means "whatever the design says" and
            // clearing one is how a merchant undoes an edit.
            placeholder={token.fallback}
            value={template.tokens[token.name] ?? ''}
            onChange={(event) =>
              onChange({ ...template, tokens: withToken(template.tokens, token.name, event.target.value) })
            }
          />
        </label>
      ))}
    </>
  );
}

/**
 * The dev-only export, and the import that reads one back.
 *
 * **Authoring is the settings panel plus a dev-only export, not hand-written
 * JSON** (ADR 0010) — which is what makes the vocabulary self-testing: a
 * design arrived at here comes out as the library entry it would ship as, so
 * every shipped Template is provably reachable through this panel.
 */
function DevExport({ entry, onChange }: { entry: TemplateEntry; onChange: (template: Template) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);

  return (
    <details className="wconvert-export">
      <summary>{__('Library entry (developers)', 'wconvert')}</summary>
      <textarea
        className="widefat code"
        rows={12}
        spellCheck={false}
        value={draft ?? exportEntry(entry)}
        onChange={(event) => {
          setDraft(event.target.value);
          setRefused(false);
        }}
      />
      <p>
        <button
          type="button"
          className="button"
          onClick={() => {
            const read = draft === null ? entry : importEntry(draft);

            if (read === null) {
              setRefused(true);

              return;
            }

            onChange({ tree: read.tree, tokens: read.tokens });
            setDraft(null);
            setRefused(false);
          }}
        >
          {__('Load this design', 'wconvert')}
        </button>{' '}
        {refused && <span className="description">{__('That is not a library entry.', 'wconvert')}</span>}
      </p>
    </details>
  );
}
