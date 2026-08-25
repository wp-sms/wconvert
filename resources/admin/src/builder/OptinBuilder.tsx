import { useCallback, useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Gallery } from './Gallery';
import { RulesEditor } from './RulesEditor';
import { SettingsPanel } from './SettingsPanel';
import { TargetingEditor, type Targeting } from './TargetingEditor';
import { getOptin, getRules, saveOptin, type Rule, type RuleVocabulary } from './api';
import { listTemplates, type Gallery as TemplateGallery, type TemplateEntry } from '../templates/api';
import type { Template } from '@renderer/types';

/**
 * The builder: pick a design, adjust it, and set the rules that decide who
 * sees it and when.
 *
 * ============================================================================
 * FOUR SURFACES OVER ONE `config`, AND NONE OF THEM IS A NEW VOCABULARY.
 * ============================================================================
 * The gallery picks a [[Template]]; the settings panel edits the Optin's copy
 * of it; the rules editor edits the two client axes; the targeting picker
 * edits the server one. Everything they write is the same flat, closed
 * vocabulary the loader evaluates and the renderer draws (ADR 0005, ADR 0010)
 * — there is no builder-only field anywhere in this screen.
 *
 * **Nothing is saved as you type.** `config` is the working draft and
 * `published_config` is what the site is serving; they are separate columns so
 * that editing is not publishing. Publishing stays on the list beside the
 * Optin, which is where a merchant decides that what they have is ready.
 *
 * **Except picking a design, which saves at once.** That is the one edit that
 * is not a value in a field: it takes a fresh snapshot of the design and
 * carries the merchant's words across by [[Slot Role]], and the snapshot
 * boundary is the server's. Taking it at the click is what lets the panel
 * underneath show what was actually stored.
 */

export interface OptinBuilderProps {
  readonly id: string;
  readonly onClose: () => void;
}

type Config = Record<string, unknown>;

export function OptinBuilder({ id, onClose }: OptinBuilderProps) {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [vocabulary, setVocabulary] = useState<RuleVocabulary | null>(null);
  const [gallery, setGallery] = useState<TemplateGallery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const report = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);

  useEffect(() => {
    getOptin(id)
      .then((optin) => {
        setName(optin.name);
        setConfig(optin.config);
      })
      .catch(report);
  }, [id, report]);

  // The rule vocabulary and the gallery are the install's, not the Optin's, so
  // they are fetched once and survive every edit below.
  useEffect(() => {
    getRules().then(setVocabulary).catch(report);
    listTemplates().then(setGallery).catch(report);
  }, [report]);

  const edit = (changes: Config) => {
    setConfig((current) => (current === null ? current : { ...current, ...changes }));
    setSaved(false);
  };

  const save = (next: Config = config ?? {}) => {
    setBusy(true);
    setError(null);

    return saveOptin(id, name, next)
      .then((optin) => {
        // The server's copy wins: it normalises against both vocabularies on
        // the way in, and a screen that kept its own would show a rule or a
        // node that was dropped at the boundary.
        setConfig(optin.config);
        setSaved(true);
      })
      .catch(report)
      .finally(() => setBusy(false));
  };

  if (config === null || vocabulary === null || gallery === null) {
    return (
      <section className="wconvert-builder">
        {error !== null && <Notice message={error} />}
        {error === null && <p>{__('Loading…', 'wconvert')}</p>}
      </section>
    );
  }

  const template = config.template as Template | undefined;
  const templateId = typeof config.template_id === 'string' ? config.template_id : undefined;

  return (
    <section className="wconvert-builder">
      <p>
        <button type="button" className="button-link" onClick={onClose}>
          {__('← All Optins', 'wconvert')}
        </button>
      </p>

      {error !== null && <Notice message={error} />}

      <h2>
        <label>
          {__('Name', 'wconvert')}{' '}
          <input
            type="text"
            className="regular-text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
          />
        </label>
      </h2>

      <Gallery
        templates={gallery.templates}
        displayType={displayTypeOf(config, gallery.templates)}
        chosen={templateId}
        busy={busy}
        onChoose={(chosen) => void save({ ...config, template_id: chosen })}
      />

      {template === undefined ? (
        <p className="description">{__('Choose a design above to start adjusting it.', 'wconvert')}</p>
      ) : (
        <SettingsPanel
          entry={entryFor(template, templateId, gallery.templates)}
          labels={gallery.labels}
          dev={window.wconvertAdmin?.dev === true}
          onChange={(next) => edit({ template: next })}
          onError={report}
        />
      )}

      <RulesEditor
        triggers={vocabulary.triggers}
        conditions={vocabulary.conditions}
        rules={Array.isArray(config.rules) ? (config.rules as Rule[]) : []}
        onChange={(rules) => edit({ rules })}
      />

      <TargetingEditor
        types={vocabulary.targeting}
        targeting={(config.targeting ?? {}) as Targeting}
        onChange={(targeting) => edit({ targeting })}
      />

      <p className="wconvert-builder__save">
        <button type="button" className="button button-primary" disabled={busy} onClick={() => void save()}>
          {__('Save changes', 'wconvert')}
        </button>{' '}
        {saved && <span className="description">{__('Saved. Publish it from the list when it is ready.', 'wconvert')}</span>}
      </p>
    </section>
  );
}

function Notice({ message }: { message: string }) {
  return (
    <div className="notice notice-error">
      <p>{message}</p>
    </div>
  );
}

/**
 * Which [[Display Type]]'s designs the gallery shows.
 *
 * **Not the first question asked.** Users arrive via a [[Goal]] and the type
 * is prefilled by the chosen [[Playbook]]; it is an override and a filter, and
 * never the primary axis of the product (CONTEXT.md, Display Type). So it is
 * read off the Optin, and falls back to whatever the shipped library actually
 * offers rather than to a name spelled here — a free install ships popups, and
 * the day Pro's floating bars and slide-ins land the fallback follows them
 * without this line changing.
 */
function displayTypeOf(config: Config, templates: readonly TemplateEntry[]): string {
  const declared = config.display_type;

  return typeof declared === 'string' ? declared : (templates[0]?.display_type ?? 'popup');
}

/**
 * The Optin's OWN design, wearing the name of the entry it came from.
 *
 * The tree and tokens are the Optin's copy and never the library entry's —
 * improving a Template must not restyle an Optin already running on it
 * (ADR 0010). What the entry supplies is provenance: a name to show, and the
 * id an export would carry. An Optin whose entry this install no longer ships
 * still edits and still renders; it simply has no name but its own id.
 */
function entryFor(
  template: Template,
  templateId: string | undefined,
  templates: readonly TemplateEntry[],
): TemplateEntry {
  const source = templates.find((each) => each.id === templateId);

  return {
    id: templateId ?? 'optin',
    name: source?.name ?? (templateId ?? ''),
    display_type: source?.display_type ?? 'popup',
    tree: template.tree,
    tokens: template.tokens,
  };
}
