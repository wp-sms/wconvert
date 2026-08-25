import { __, sprintf } from '@wordpress/i18n';
import { Preview } from './Preview';
import type { TemplateEntry } from '../templates/api';

/**
 * The gallery: a set of designs per [[Display Type]].
 *
 * ============================================================================
 * TEMPLATES ARE GOAL-AGNOSTIC, WHICH IS WHY THIS LIST IS SHORT.
 * ============================================================================
 * A Template is the design of an Optin **with no words in it** — copy comes
 * from the [[Playbook]] that prefilled it, or from the merchant (CONTEXT.md,
 * Template). With the copy held elsewhere the library is a set of designs per
 * Display Type rather than a design for every pairing of Display Type and
 * [[Goal]], which is the matrix this boundary exists to collapse.
 *
 * So there is no Goal filter here, and adding one would be asserting a pairing
 * that does not exist.
 *
 * **Picking a design saves immediately.** It is the one edit that is not a
 * value in a field: it takes a fresh SNAPSHOT of the design, carrying the
 * merchant's words across by [[Slot Role]], and the snapshot boundary is the
 * server's (ADR 0010). Taking it at the moment of the click is what lets the
 * panel underneath show the design that was actually stored rather than a
 * guess at what the save will produce.
 */

export interface GalleryProps {
  readonly templates: readonly TemplateEntry[];
  readonly displayType: string;
  readonly chosen: string | undefined;
  readonly busy: boolean;
  readonly onChoose: (id: string) => void;
}

export function Gallery({ templates, displayType, chosen, busy, onChoose }: GalleryProps) {
  // One Template serves exactly one Display Type (CONTEXT.md, Template), so
  // this is a filter over a property of the entry rather than a question the
  // merchant is asked twice.
  const shown = templates.filter((template) => template.display_type === displayType);

  return (
    <>
      <h3>{__('The design', 'wconvert')}</h3>
      {shown.length === 0 && (
        <p className="wconvert-templates__empty">
          {/* translators: %s: a Display Type, e.g. "popup". */}
          {sprintf(__('No designs for “%s” on this site.', 'wconvert'), displayType)}
        </p>
      )}
      <ul className="wconvert-gallery">
        {shown.map((template) => (
          <li
            key={template.id}
            className={`wconvert-gallery__card${template.id === chosen ? ' is-chosen' : ''}`}
          >
            <Preview template={template} />
            <p>
              <strong>{template.name}</strong>
            </p>
            {template.id === chosen ? (
              <p className="wconvert-gallery__chosen">{__('In use', 'wconvert')}</p>
            ) : (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => onChoose(template.id)}
              >
                {__('Use this design', 'wconvert')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
