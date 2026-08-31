import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { exportEntry, importEntry } from './entry';
import type { TemplateEntry } from '../templates/api';
import type { Template } from '@renderer/types';

/**
 * The dev-only export, and the import that reads one back.
 *
 * **Authoring is the editor plus a dev-only export, not hand-written JSON**
 * (ADR 0010) — which is what makes the vocabulary self-testing: a design
 * arrived at here comes out as the library entry it would ship as, so every
 * shipped Template is provably reachable through the editor.
 *
 * It sits under the tokens on the **Design** tab, which is where it always
 * belonged: what it exports is a design, and the tab it was on asked what the
 * design says.
 */
export function DevExport({ entry, onChange }: { entry: TemplateEntry; onChange: (template: Template) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);

  return (
    <details className="wconvert-export">
      <summary>{__('Library entry (developers)', 'wconvert')}</summary>
      {/*
       * **The `<summary>` is not this control's name**, which is the whole
       * reason for the `aria-label`. A `<details>` summary labels the
       * disclosure, not the fields inside it, so a screen reader reaching this
       * textarea announced "edit text, blank" — a control with no accessible
       * name, and a WCAG 2.1 AA failure (4.1.2) rather than a rough edge.
       *
       * It is spelled as a label rather than by pairing an `id` with the
       * summary, because the summary names the disclosure correctly and would
       * then be doing two jobs. Found by #74's keyboard pass; the
       * `widefat code` class beside it is the staged boundary this deliberately
       * does not touch.
       */}
      <textarea
        aria-label={__('Library entry JSON', 'wconvert')}
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
