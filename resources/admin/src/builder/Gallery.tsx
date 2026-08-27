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
              **The name is on its own line and the action under it**, which is
              the only arrangement that is the same on every card. Side by side,
              a name one word longer either wrapped the button onto a second
              line — leaving that card taller than the one beside it — or, once
              wrapping was off, truncated a name as short as "Stacked signup".
              A gallery is read by comparing designs, and cards that are not the
              same shape compare badly.

              `aria-describedby` is what tells three identically labelled "Use
              this design" buttons apart in the accessibility tree, without
              putting the design's name on every button face.
            */}
            <div className="flex flex-col items-start gap-2 border-t border-border px-3 py-2.5">
              <span id={`wconvert-design-${template.id}`} className="font-medium text-foreground">
                {template.name}
              </span>
              {inUse ? (
                <Badge variant="success">{__('In use', 'wconvert')}</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  aria-describedby={`wconvert-design-${template.id}`}
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
