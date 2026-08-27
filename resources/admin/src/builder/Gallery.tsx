import { __, sprintf } from '@wordpress/i18n';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
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

  if (shown.length === 0) {
    return (
      <p className="m-0 text-muted-foreground">
        {/* translators: %s: a Display Type, e.g. "popup". */}
        {sprintf(__('No designs for “%s” on this site.', 'wconvert'), displayType)}
      </p>
    );
  }

  return (
    <ul className="wconvert-gallery">
      {shown.map((template) => {
        const inUse = template.id === chosen;

        return (
          <li
            key={template.id}
            className={`wconvert-gallery__card${inUse ? ' is-chosen' : ''}`}
          >
            {/*
              The real design at real width, scaled down rather than reflowed:
              reflowing would show the merchant a layout no visitor gets, which
              is the one thing a live-rendered gallery exists to avoid.
            */}
            <Preview template={template} />

            {/*
              `nowrap` and a truncating name: with wrapping, a card whose name
              happened to be one word longer put its button on a second line and
              stood taller than the card beside it. A gallery is read by
              comparing designs, and a row of cards that are not the same shape
              is a row that compares badly.
            */}
            <div className="flex flex-nowrap items-center justify-between gap-x-3 border-t border-border px-3 py-2.5">
              <span className="min-w-0 truncate font-medium text-foreground" title={template.name}>
                {template.name}
              </span>
              {inUse ? (
                <Badge variant="success">{__('In use', 'wconvert')}</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onChoose(template.id)}
                >
                  {__('Use this design', 'wconvert')}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
